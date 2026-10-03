/**
 * AI 味自动消除器（杀手锏）
 *
 * 输入：{dna, profile, essay, targetScore?}
 * 流程：
 *   1. 评分
 *   2. 如果已经达标，跳出
 *   3. 并发重写所有 flagged 句
 *   4. 重组
 *   5. 重新评分
 *   6. 递归到达标或超过轮数
 *
 * 输出：{essay, score, iterations, rewrites[]}
 */

import { NextRequest, NextResponse } from 'next/server';
import type { StyleDNA } from '@/lib/style-dna';
import type { StyleProfile } from '@/lib/style-extractor';
import { buildSystemPrompt } from '@/lib/prompts';
import { scoreAITrace } from '@/lib/ai-detector';
import { checkRateLimit, RATE_LIMITS, getClientIP, rateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

type RewriteLog = {
  iteration: number;
  beforeScore: number;
  afterScore: number;
  rewrites: { original: string; rewritten: string; reason: string }[];
};

const REWRITE_INSTRUCTIONS = `# 你的任务

只重写**一个句子**，让它的 AI 味减弱。

# 关键原则

1. **保持原意** — 不要改变句子表达的核心观点
2. **保持风格** — 必须符合用户的语言习惯画像
3. **去除 AI 味** — 这句之所以被标记，必然是因为：
   - 含 AI 高频词（深刻/不言而喻/引人深思 等）
   - 或句式过于书面化（"在当今社会""综上所述"）
   - 或结构过于工整（连续排比、长定语堆砌）
   - 或与上下文不自然衔接
4. **口语化优先** — 真人不会写得像官方文件
5. **长度相近** — 不要大幅扩写或缩减，±20% 内

# 严禁

- 不要说"好的，我来改" / 不要解释 / 不要引号包裹
- 不要分段（原文中段要保持段落）
- 不要引入新的 AI 词

# 输出格式

直接输出改写后的句子，不要任何前缀/后缀/解释。`;

/**
 * 重写单个句子
 */
async function rewriteSentence(
  original: string,
  dna: StyleDNA,
  profile: StyleProfile | null,
  reason: string,
  prevContext: string,
  nextContext: string,
  apiKey: string,
  model: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(dna, profile) + '\n\n' + REWRITE_INSTRUCTIONS;

  const userPrompt = `# 待改写的句子
${original}

# 被标记的原因
${reason}

# 上下文
${prevContext ? `【前一句】${prevContext}\n` : ''}${nextContext ? `【后一句】${nextContext}` : ''}

请直接输出改写后的句子。`;

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://essay-copilot.local',
      'X-Title': 'Essay Co-Pilot DeAuto'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: 1000,
      top_p: 0.95
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  let rewritten: string = data.choices?.[0]?.message?.content?.trim() || '';
  rewritten = rewritten.replace(/^["「『]+|["」』]+$/g, '').trim();
  return rewritten || original;  // 失败时保留原文
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = getClientIP(req);
  const rl = checkRateLimit(`deauto:${ip}`, RATE_LIMITS.deauto);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `请求太频繁，${Math.ceil(rl.resetIn / 1000)} 秒后重试` },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const dna: StyleDNA = body.dna;
    const profile: StyleProfile | null = body.profile || null;
    let essay: string = body.essay;
    const targetScore: number = body.targetScore || 25;
    const maxIterations: number = body.maxIterations || 3;
    const model: string = body.model || 'moonshotai/kimi-k2';

    if (!dna || !essay) {
      return NextResponse.json({ error: 'dna and essay are required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
    }
    if (/your-key-here|placeholder|xxx/i.test(apiKey)) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY is placeholder' }, { status: 500 });
    }

    const start = Date.now();
    const logs: RewriteLog[] = [];

    let score = scoreAITrace(essay, dna);

    // 已达标直接返回
    if (score.total <= targetScore) {
      return NextResponse.json({
        essay,
        score,
        iterations: 0,
        rewrites: [],
        durationMs: Date.now() - start,
        message: '已经达标，无需重写'
      });
    }

    let currentEssay = essay;
    let iter = 0;

    for (iter = 0; iter < maxIterations; iter++) {
      score = scoreAITrace(currentEssay, dna);
      if (score.total <= targetScore) break;
      if (score.flaggedSentences.length === 0) break;  // 没有 flagged 句，跳出

      const beforeScore = score.total;

      // 切分为 sentence 数组（保留段落结构）
      // 这里简化处理：按句号/问号/感叹号切
      const sentences = currentEssay.split(/(?<=[。！？!?；;])/g).filter(s => s.trim().length > 0);

      // 并发重写所有 flagged 句
      const rewrites: { original: string; rewritten: string; reason: string }[] = [];

      const promises = score.flaggedSentences.map(async (flagged) => {
        try {
          const idx = sentences.findIndex(s => s.trim() === flagged.sentence);
          const prev = idx > 0 ? sentences[idx - 1].trim() : '';
          const next = idx < sentences.length - 1 ? sentences[idx + 1].trim() : '';

          const rewritten = await rewriteSentence(
            flagged.sentence,
            dna, profile,
            flagged.reason,
            prev, next,
            apiKey, model
          );

          rewrites.push({
            original: flagged.sentence,
            rewritten,
            reason: flagged.reason
          });
        } catch (e: any) {
          // 单句失败不影响其他
          logger.warn('Rewrite sentence failed', { error: e.message.slice(0, 200) });
        }
      });

      await Promise.allSettled(promises);

      // 重组 essay
      let newEssay = currentEssay;
      for (const rw of rewrites) {
        // 用全句替换（避免部分匹配）
        newEssay = newEssay.replace(rw.original, rw.rewritten);
      }
      currentEssay = newEssay;

      // 重新打分
      const newScore = scoreAITrace(currentEssay, dna);

      logs.push({
        iteration: iter + 1,
        beforeScore,
        afterScore: newScore.total,
        rewrites
      });

      // 退出条件
      if (newScore.total <= targetScore) break;
      if (rewrites.length === 0) break;  // 没成功重写任何句
    }

    const finalScore = scoreAITrace(currentEssay, dna);

    return NextResponse.json({
      essay: currentEssay,
      score: finalScore,
      iterations: logs.length,
      rewrites: logs,
      durationMs: Date.now() - start,
      message: finalScore.total <= targetScore
        ? `✅ 已达标（${finalScore.total} 分）`
        : `⚠️ 仍有 AI 味（${finalScore.total} 分），可能需要手动修改`
    });
  } catch (e: any) {
    logger.error('DeAuto error', { error: e.message, stack: e.stack?.slice(0, 500) });
    const msg = e?.message || 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}