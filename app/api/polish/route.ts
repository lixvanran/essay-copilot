/**
 * 润色模式（v0.4.0）
 *
 * 用户贴一篇作文，AI 帮润色（不是重写）
 * - 保持原结构
 * - 改善表达
 * - 减少 AI 味
 * - 保留核心观点
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt } from '@/lib/prompts';
import type { StyleDNA } from '@/lib/style-dna';
import { validateDNA } from '@/lib/style-dna';
import type { StyleProfile } from '@/lib/style-extractor';
import { checkRateLimit, RATE_LIMITS, getClientIP, rateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { detectInjection } from '@/lib/sanitize';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const POLISH_INSTRUCTIONS = `# 你的任务

**润色**这篇作文 —— 不是重写，不是扩写，不是改主题。

# 核心原则

1. **保留原意** — 整篇文章的核心观点、立场、关键事件不能改
2. **保持段落结构** — 不能增减段落，段落顺序不能改
3. **改善表达** — 改：
   - 啰嗦/重复的句子
   - 错别字/语病
   - 平淡无味的表达
   - 太"机器化"的句式
4. **降低 AI 味** — 如果原文里有些表达是你（AI）容易写的那种，改成更自然的真人写法
5. **保持风格** — 必须严格符合用户的语言习惯画像（system prompt 里有）
6. **长度控制** — 改后长度 ±15%

# 严禁

- 不要重写整段（除非那段本身就有问题需要调整）
- 不要扩写成更长
- 不要添加原文没有的观点
- 不要总结陈词/升华段落

# 输出格式

直接输出润色后的完整文章，不要任何前缀/后缀/解释/总结。`;

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const rl = checkRateLimit(`polish:${ip}`, RATE_LIMITS.generate);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `请求太频繁，${Math.ceil(rl.resetIn / 1000)} 秒后重试` },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const dna: StyleDNA = body.dna;
    const profile: StyleProfile | null = body.profile || null;
    const essay: string = body.essay;
    const userInstruction: string = body.instruction || '';
    const model: string = body.model || 'moonshotai/kimi-k2';

    if (!dna || !essay || essay.trim().length < 100) {
    // v0.6.1：dna 结构校验（客户端可能传裁剪过的旧 schema）
    const dnaCheck = validateDNA(dna);
    if (!dnaCheck.ok) {
      logger.warn('polish: invalid dna', { missing: dnaCheck.missing });
      return NextResponse.json(
        { error: `dna 结构不完整（缺少 ${dnaCheck.missing.join(', ')}），请重新上传范文` },
        { status: 400 }
      );
    }

      return NextResponse.json({ error: 'dna 和 essay 必填，essay 至少 100 字' }, { status: 400 });
    }
    if (essay.length > 10000) {
      return NextResponse.json({ error: 'essay 不能超过 10000 字' }, { status: 400 });
    }

    // v0.6.1 安全：prompt injection 检测
    // strict=false —— 作文是学生自己写的，可能引用英文对话，不误伤
    const essayCheck = detectInjection(essay, {
      maxLength: 10000,
      maxLineBreaks: 200,
      strict: false
    });
    if (essayCheck.suspicious) {
      logger.warn('polish: suspicious essay', { reasons: essayCheck.reasons });
      return NextResponse.json(
        { error: `作文包含可疑内容：${essayCheck.reasons.join('; ')}` },
        { status: 400 }
      );
    }
    if (userInstruction) {
      const insCheck = detectInjection(userInstruction, { maxLength: 2000, maxLineBreaks: 50 });
      if (insCheck.suspicious) {
        logger.warn('polish: suspicious instruction', { reasons: insCheck.reasons });
        return NextResponse.json(
          { error: `用户指令包含可疑内容：${insCheck.reasons.join('; ')}` },
          { status: 400 }
        );
      }
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
    if (/your-key-here|placeholder|xxx/i.test(apiKey)) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY is placeholder' }, { status: 500 });
    }

    const systemPrompt = buildSystemPrompt(dna, profile) + '\n\n' + POLISH_INSTRUCTIONS;
    const instructionLine = userInstruction.trim()
      ? `\n\n# 用户特别要求\n${userInstruction.trim()}`
      : '';

    const userPrompt = `# 待润色的作文\n${essay}${instructionLine}\n\n请直接输出润色后的完整作文。`;

    const start = Date.now();
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://essay-copilot.local',
        'X-Title': 'Essay Co-Pilot Polish'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,  // 润色温度更低，更稳
        max_tokens: 2500,
        top_p: 0.95
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data: any = await res.json();
    let polished = data.choices?.[0]?.message?.content?.trim() || '';
    polished = polished.replace(/^["「『]+|["」』]+$/g, '').trim();
    if (!polished) throw new Error('Empty response from LLM');

    logger.info('polish success', {
      model: data.model || model,
      durationMs: Date.now() - start
    });
    return NextResponse.json({
      essay: polished,
      model: data.model || model,
      usage: data.usage || {},
      durationMs: Date.now() - start
    });
  } catch (e: any) {
    logger.error('polish failed', { error: e.message });
    const msg = e?.message || 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}