/**
 * 大纲生成（v0.5.0）
 *
 * 学生最常用功能：先出大纲（结构 + 论点），再展开成整篇
 *
 * 输入：{dna, profile, topic, mode: 'simple' | 'detailed'}
 * 输出：{
 *   outline: {
 *     thesis: string,         // 立意句
 *     paragraphs: [
 *       {role: 'opening' | 'body' | 'turn' | 'climax' | 'ending',
 *        title: string,
 *        keyPoints: string[],
 *        evidence?: string[],  // 论据/例子
 *        rhetoricalDevices?: string[]}
 *     ],
 *     warnings?: string[]      // 警示（如"这个题目太泛"）
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import type { StyleDNA } from '@/lib/style-dna';
import type { StyleProfile } from '@/lib/style-extractor';
import { checkRateLimit, RATE_LIMITS, getClientIP, rateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

type OutlineMode = 'simple' | 'detailed';

const OUTLINE_PROMPT = `你是一位资深的中文写作老师。请为学生的作文题生成一份**大纲**（不是全文）。

# 作文题
{TOPIC}

{STYLE_PROFILE}

# 用户的语言习惯
{STYLE_DESCRIPTION}

# 大纲模式
{MODE_DESC}

# 输出 JSON
{
  "thesis": "一句话立意（25 字内）",
  "paragraphs": [
    {
      "role": "opening | body | turn | climax | ending",
      "title": "本段主题",
      "keyPoints": ["要点 1", "要点 2"],
      "evidence": ["可用的事例/论据（详细模式才有）"],
      "rhetoricalDevices": ["可用的修辞（如：反问/比喻）"]
    }
  ],
  "warnings": ["对这个题目的警示（如'立意宜小不宜大'）"]
}

# 要求

1. 段落数：议论文 4-5 段，记叙文 3-4 段，散文 3-5 段
2. 每段必须有一个明确的 role：开头/展开/转折/高潮/结尾
3. **议论文**必须有 turn 段（让步转折）和 climax 段（核心论点）
4. **记叙文**以 opening(场景) → body(过程) → climax(高潮) → ending(感悟) 为主
5. 立意必须有深度，避免"感动/温暖/成长"等空洞词
6. 论据要**具体**（人物/作品/事件），不要"古往今来/伟人"等泛指
7. 输出纯 JSON，不要解释`;

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = getClientIP(req);
  const rl = checkRateLimit(`outline:${ip}`, RATE_LIMITS.topicGen);
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
    const topic: string = (body.topic || '').trim();
    const mode: OutlineMode = body.mode || 'detailed';
    const model: string = body.model || 'moonshotai/kimi-k2';

    if (!dna) return NextResponse.json({ error: 'dna required' }, { status: 400 });
    if (!topic || topic.length > 200) {
      return NextResponse.json({ error: 'topic 必填且 ≤ 200 字' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
    if (/your-key-here|placeholder|xxx/i.test(apiKey)) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY is placeholder' }, { status: 500 });
    }

    const modeDesc = mode === 'simple'
      ? '简化大纲：每段只 1-2 个要点（适合时间紧）'
      : '详细大纲：每段 2-3 个要点 + 1-2 个具体论据（适合要打磨）';

    const styleProfile = profile ? `\n# 用户文风画像\n情感基调：${profile.emotionalTone}\n声音人格：${profile.voicePersonality}\n标志性技巧：${profile.signatureTechniques.join('/')}\n` : '';

    // 简化 DNA 描述（避免 prompt 过长）
    const styleDescription = `句长偏好：${dna.avgSentenceLen.toFixed(0)} 字\n句式偏好：${dna.topSentenceTemplates?.slice(0, 3).map(t => t.pattern).join('、') || '无特别'}\n修辞：比喻${dna.rhetoricalDevices.metaphor} 处、拟人${dna.rhetoricalDevices.personification} 处`;

    const prompt = OUTLINE_PROMPT
      .replace('{TOPIC}', topic)
      .replace('{STYLE_PROFILE}', styleProfile)
      .replace('{STYLE_DESCRIPTION}', styleDescription)
      .replace('{MODE_DESC}', modeDesc);

    const start = Date.now();
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://essay-copilot.local',
        'X-Title': 'Essay Co-Pilot Outline'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 0.95,
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response');

    let outline: any;
    try {
      outline = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('Failed to parse JSON');
      outline = JSON.parse(m[0]);
    }

    // 验证
    if (!outline.thesis || !Array.isArray(outline.paragraphs) || outline.paragraphs.length === 0) {
      throw new Error('Incomplete outline');
    }

    return NextResponse.json({
      outline,
      model: data.model || model,
      usage: data.usage || {},
      durationMs: Date.now() - start
    });
  } catch (e: any) {
    logger.error('outline failed', { error: e.message });
    const msg = e?.message || 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}