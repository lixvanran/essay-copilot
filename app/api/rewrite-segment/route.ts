/**
 * 局部段落重写接口
 * 用户选中一段，让 AI 按风格画像 + 用户指令重写
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt } from '@/lib/prompts';
import type { StyleDNA } from '@/lib/style-dna';
import type { StyleProfile } from '@/lib/style-extractor';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const REWRITE_INSTRUCTIONS = `# 你的任务

只重写**一段**给定的文字。

# 关键原则

1. **保持风格一致** — 必须严格遵守 system prompt 里的风格 DNA 和 LLM 风格画像
2. **上下文衔接** — 给出的"前文"和"后文"是这段的上下文，重写后**第一句/最后一句要自然衔接**
3. **长度相近** — 不要大幅扩写或缩减，保持原段落长度 ±20%
4. **优先回应用户指令** — 如果用户给了"想改成什么"，必须体现；如果没给，就让这段更"你这个人写的"
5. **不引入 AI 词** — 严禁：深刻/至关重要/显著/不言而喻/引人深思/与时俱进/环环相扣 等
6. **只输出新段落** — 不要说"好的，我来重写" / 不要解释 / 不要引号包裹 / 不要分段

# 输出格式

直接输出新段落文字，不要任何前缀/后缀/解释。`;

/**
 * 调用 OpenRouter 重写段落
 */
export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const dna: StyleDNA = body.dna;
    const profile: StyleProfile | null = body.profile || null;
    const originalSegment: string = body.segment;
    const userInstruction: string = body.instruction || '';
    const prevContext: string = body.prevContext || '';
    const nextContext: string = body.nextContext || '';
    const model: string | undefined = body.model;

    if (!dna || !originalSegment) {
      return NextResponse.json({ error: 'dna and segment are required' }, { status: 400 });
    }
    if (originalSegment.trim().length < 10) {
      return NextResponse.json({ error: '段落太短（< 10 字），不值得重写' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'OPENROUTER_API_KEY is not configured. Click "Advanced Settings" in the first screen and paste your key.'
      }, { status: 500 });
    }
    if (/your-key-here|placeholder|xxx/i.test(apiKey)) {
      return NextResponse.json({
        error: 'OPENROUTER_API_KEY is still the placeholder. Click "Advanced Settings" in the first screen and paste a real key from https://openrouter.ai/keys.'
      }, { status: 500 });
    }

    // 构造 prompt
    const systemPrompt = buildSystemPrompt(dna, profile) + '\n\n' + REWRITE_INSTRUCTIONS;

    const instructionLine = userInstruction.trim()
      ? `\n\n# 用户的指令\n${userInstruction.trim()}\n（如果用户的指令与上述原则冲突，原则优先，但尽量兼顾用户意图）`
      : '';

    const contextSection = (prevContext || nextContext)
      ? `\n\n# 上下文衔接（前/后段是这段在整篇里的位置）\n${prevContext ? `【前一段】\n${prevContext}\n\n` : ''}${nextContext ? `【后一段】\n${nextContext}` : ''}`
      : '';

    const userPrompt = `# 待重写的段落\n${originalSegment}${contextSection}${instructionLine}\n\n请直接输出重写后的段落。`;

    // 选模型 — 默认走主选
    const chosenModel = model || 'moonshotai/kimi-k2';

    const start = Date.now();
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://essay-copilot.local',
        'X-Title': 'Essay Co-Pilot Rewriter'
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.85,
        max_tokens: 2000,
        top_p: 0.95
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    let newSegment = data.choices?.[0]?.message?.content?.trim();
    if (!newSegment) {
      throw new Error('Empty response from LLM');
    }

    // 去掉 LLM 可能包裹的引号
    newSegment = newSegment.replace(/^["「『]+|["」』]+$/g, '').trim();

    return NextResponse.json({
      newSegment,
      model: data.model || chosenModel,
      usage: data.usage || {},
      durationMs: Date.now() - start
    });
  } catch (e: any) {
    console.error('Rewrite error:', e);
    const msg = e?.message || 'Internal error';
    const orMatch = msg.match(/OpenRouter error (\d+):\s*(.+)/);
    if (orMatch) {
      const status = parseInt(orMatch[1], 10);
      let friendly = `OpenRouter 调用失败 (${status})`;
      if (status === 401) friendly = 'OpenRouter API Key 无效或过期';
      else if (status === 402) friendly = 'OpenRouter 账户余额不足';
      else if (status === 429) friendly = '请求太频繁，稍后再试';
      else if (status >= 500) friendly = 'OpenRouter 服务异常，稍后再试';
      return NextResponse.json({ error: friendly, detail: orMatch[2].slice(0, 300) }, { status: 502 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}