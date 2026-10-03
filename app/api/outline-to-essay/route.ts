/**
 * 大纲展开成全文（v0.5.0）
 *
 * 输入：{dna, profile, topic, outline, requirements?}
 * 输出：完整 essay（按 outline 顺序展开，每段 1 个核心点）
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt } from '@/lib/prompts';
import type { StyleDNA } from '@/lib/style-dna';
import type { StyleProfile } from '@/lib/style-extractor';
import { checkRateLimit, RATE_LIMITS, getClientIP, rateLimitHeaders } from '@/lib/rate-limit';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const EXPAND_INSTRUCTIONS = `# 你的任务

把下面的**大纲**展开成一篇完整作文。

# 关键原则

1. **严格遵循大纲** — 不能改变立意、不能增减段落、不能改段顺序
2. **每段 1 个核心点** — 不要重复强调大纲已经说过的
3. **承上启下** — 段与段之间要有过渡（不是生硬切换）
4. **具体细节** — 大纲里提到的事例/论据，要写出具体内容（人物、动作、对话、心理）
5. **保持风格** — 严格遵守 system prompt 里的 DNA + 风格画像
6. **不引入 AI 词** — 严禁：深刻/至关重要/不言而喻/引人深思 等

# 大纲

{OUTLINE}

# 题目
{TOPIC}

# 输出格式

直接输出完整文章，按大纲段落顺序写。段与段之间用空行分隔。不要任何前缀/后缀。`;

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const rl = checkRateLimit(`outline-expand:${ip}`, RATE_LIMITS.generate);
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
    const topic: string = body.topic || '';
    const outline: any = body.outline;
    const requirements: string = body.requirements || '';
    const targetLength: number = body.targetLength || 800;
    const model: string = body.model || 'moonshotai/kimi-k2';

    if (!dna || !outline?.paragraphs?.length) {
      return NextResponse.json({ error: 'dna and outline.paragraphs required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
    if (/your-key-here|placeholder|xxx/i.test(apiKey)) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY is placeholder' }, { status: 500 });
    }

    const systemPrompt = buildSystemPrompt(dna, profile) + '\n\n' + EXPAND_INSTRUCTIONS;

    const outlineText = JSON.stringify(outline, null, 2);
    const reqLine = requirements ? `\n\n# 额外要求\n${requirements}` : '';

    const userPrompt = `# 大纲\n${outlineText}\n\n# 题目\n${topic}\n\n# 目标字数\n${targetLength} 字${reqLine}\n\n请直接输出完整作文。`;

    const start = Date.now();
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://essay-copilot.local',
        'X-Title': 'Essay Co-Pilot Expand'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt.replace('{OUTLINE}', outlineText).replace('{TOPIC}', topic) },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.85,
        max_tokens: 3000,
        top_p: 0.95
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data: any = await res.json();
    const essay = data.choices?.[0]?.message?.content?.trim();
    if (!essay) throw new Error('Empty response');

    return NextResponse.json({
      essay: essay.replace(/^["「『]+|["」』]+$/g, '').trim(),
      model: data.model || model,
      usage: data.usage || {},
      durationMs: Date.now() - start
    });
  } catch (e: any) {
    console.error('Expand error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}