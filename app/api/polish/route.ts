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
import type { StyleProfile } from '@/lib/style-extractor';

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
  try {
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const dna: StyleDNA = body.dna;
    const profile: StyleProfile | null = body.profile || null;
    const essay: string = body.essay;
    const userInstruction: string = body.instruction || '';
    const model: string = body.model || 'moonshotai/kimi-k2';

    if (!dna || !essay || essay.trim().length < 100) {
      return NextResponse.json({ error: 'dna 和 essay 必填，essay 至少 100 字' }, { status: 400 });
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

    return NextResponse.json({
      essay: polished,
      model: data.model || model,
      usage: data.usage || {},
      durationMs: Date.now() - start
    });
  } catch (e: any) {
    console.error('Polish error:', e);
    const msg = e?.message || 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}