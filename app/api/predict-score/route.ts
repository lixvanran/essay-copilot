/**
 * 评分预测（v0.5.0）
 *
 * 学生 + 老师 最想要的功能：丢一篇作文 + 评分标准 → AI 预测会得几分
 *
 * 输入：{essay, rubric, gradeLevel}
 * rubric: {totalScore, criteria: [{name, weight, description}]}
 * 输出：{prediction: {totalScore, level, breakdown: [{criteria, predictedScore, maxScore, reasoning}]}}
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS, getClientIP, rateLimitHeaders } from '@/lib/rate-limit';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const PROMPT = `你是一位有 20 年经验的语文阅卷老师，正在批改一篇学生的作文。

# 学生作文
{ESSAY}

# 评分标准
{RUBRIC}

# 学段
{GRADE}

# 你的任务

根据上述评分标准，**严格公正**地打分。

# 打分原则

1. **按 rubric 的维度**逐项打分，每项说明理由
2. **不要打人情分** — 学生写得差就低分
3. **不要打印象分** — 严格按 rubric 描述来
4. **具体的引用** — 打分要引用学生作文里的句子
5. **识别抄袭风险** — 如果作文风格突变（如某段过于成熟/出现 AI 词），**扣分**并标注
6. **整体印象** — 给一个总分预测（0-rubric.totalScore）

# 输出 JSON

{
  "totalScore": 数字,
  "maxScore": 数字,
  "level": "一类文(优秀) | 二类文(良好) | 三类文(中等) | 四类文(及格) | 五类文(不及格)",
  "breakdown": [
    {
      "criteria": "维度名（如'内容'）",
      "predictedScore": 数字,
      "maxScore": 数字,
      "reasoning": "打几分 + 引用学生原句说明"
    }
  ],
  "strengths": ["这篇作文的 2-3 条优点"],
  "weaknesses": ["这篇作文的 2-3 条缺点"],
  "aiSuspect": false | true,
  "aiSuspectReason": "如果 aiSuspect=true，说明原因（'第 X 段突然出现'不言而喻'等 AI 词'）"
}

只输出 JSON，不要其他内容。`;

const DEFAULT_RUBRIC = {
  totalScore: 60,
  criteria: [
    { name: '内容', weight: 0.35, description: '立意深刻，材料充实，中心突出' },
    { name: '结构', weight: 0.2, description: '层次分明，过渡自然，详略得当' },
    { name: '语言', weight: 0.3, description: '文从字顺，表达生动，有文采' },
    { name: '书写/卷面', weight: 0.15, description: '字数达标，标点正确，无错别字' }
  ]
};

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const rl = checkRateLimit(`predict:${ip}`, RATE_LIMITS.deauto);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `请求太频繁，${Math.ceil(rl.resetIn / 1000)} 秒后重试` },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const essay: string = (body.essay || '').trim();
    const rubric = body.rubric || DEFAULT_RUBRIC;
    const gradeLevel: string = body.gradeLevel || '高中';

    if (essay.length < 100) {
      return NextResponse.json({ error: '作文至少 100 字' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
    if (/your-key-here|placeholder|xxx/i.test(apiKey)) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY is placeholder' }, { status: 500 });
    }

    const rubricText = `总分 ${rubric.totalScore} 分。\n评分维度：\n${rubric.criteria.map((c: any) => `- ${c.name}（${c.weight * 100}% / ${Math.round(rubric.totalScore * c.weight)} 分）：${c.description}`).join('\n')}`;

    const prompt = PROMPT
      .replace('{ESSAY}', essay)
      .replace('{RUBRIC}', rubricText)
      .replace('{GRADE}', gradeLevel);

    const start = Date.now();
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://essay-copilot.local',
        'X-Title': 'Essay Co-Pilot Scorer'
      },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,  // 评分要稳定
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

    let prediction: any;
    try {
      prediction = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('Failed to parse JSON');
      prediction = JSON.parse(m[0]);
    }

    return NextResponse.json({
      prediction,
      model: data.model || 'moonshotai/kimi-k2',
      usage: data.usage || {},
      durationMs: Date.now() - start
    });
  } catch (e: any) {
    console.error('Predict score error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}