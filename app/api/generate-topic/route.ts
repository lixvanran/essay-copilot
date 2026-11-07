/**
 * AI 题目生成器（v0.4.0）
 *
 * 输入：{keywords, grade}
 * 输出：3-5 个题目候选
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS, getClientIP, rateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { detectInjection } from '@/lib/sanitize';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const PROMPT = `你是一位经验丰富的语文老师。请根据用户的关键词，生成 3-5 个适合学生写的作文题。

# 用户输入

关键词：{KEYWORDS}
学段：{GRADE}

# 要求

1. 题目风格多样化（议论文 / 记叙文 / 半命题 都可）
2. 题目贴近学生生活
3. 题目立意积极、有思考空间
4. 每个题目下面给一句简短的写作方向提示（10 字内）
5. 只输出 JSON，不要其他内容

# JSON 格式

{
  "topics": [
    {"topic": "题目文字", "hint": "写作方向", "category": "议论文/记叙文/散文/半命题"}
  ]
}`;

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const rl = checkRateLimit(`topicGen:${ip}`, RATE_LIMITS.topicGen);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `请求太频繁，${Math.ceil(rl.resetIn / 1000)} 秒后重试` },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const keywords: string = (body.keywords || '').trim();
    const grade: string = body.grade || '初中';

    if (!keywords) {
      return NextResponse.json({ error: '请输入关键词' }, { status: 400 });
    }
    if (keywords.length > 200) {
      return NextResponse.json({ error: '关键词太长（< 200 字）' }, { status: 400 });
    }
    // v0.6.1 安全：prompt injection 检测（keywords 直接进 prompt）
    const kwCheck = detectInjection(keywords, { maxLength: 200, maxLineBreaks: 20 });
    if (kwCheck.suspicious) {
      logger.warn('generate-topic: suspicious keywords', { reasons: kwCheck.reasons });
      return NextResponse.json(
        { error: `关键词包含可疑内容：${kwCheck.reasons.join('; ')}` },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
    if (/your-key-here|placeholder|xxx/i.test(apiKey)) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY is placeholder' }, { status: 500 });
    }

    const prompt = PROMPT.replace('{KEYWORDS}', keywords).replace('{GRADE}', grade);

    const start = Date.now();
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://essay-copilot.local',
        'X-Title': 'Essay Co-Pilot TopicGen'
      },
      body: JSON.stringify({
        model: 'qwen/qwen-2.5-14b-instruct',  // 用快速小模型即可
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 800,
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
    if (!content) throw new Error('Empty response from LLM');

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('Failed to parse JSON');
      parsed = JSON.parse(m[0]);
    }

    logger.info('generate-topic success', {
      model: data.model || 'qwen/qwen-2.5-14b-instruct',
      count: parsed.topics?.length ?? 0,
      durationMs: Date.now() - start
    });
    return NextResponse.json({
      topics: parsed.topics || [],
      model: data.model || 'qwen/qwen-2.5-14b-instruct',
      durationMs: Date.now() - start
    });
  } catch (e: any) {
    logger.error('generate-topic failed', { error: e.message });
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}