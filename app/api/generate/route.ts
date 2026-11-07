import { NextRequest, NextResponse } from 'next/server';
import { generateEssay, generateBestEssay } from '@/lib/llm';
import { scoreAITrace } from '@/lib/ai-detector';
import type { StyleDNA } from '@/lib/style-dna';
import { validateDNA } from '@/lib/style-dna';
import type { StyleProfile } from '@/lib/style-extractor';
import { checkRateLimit, RATE_LIMITS, getClientIP, rateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { detectInjection } from '@/lib/sanitize';

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const rl = checkRateLimit(`generate:${ip}`, RATE_LIMITS.generate);
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
      return NextResponse.json({ error: 'Invalid or empty JSON body' }, { status: 400 });
    }
    const dna: StyleDNA = body.dna;
    const profile: StyleProfile | null = body.profile || null;
    const topic: string = body.topic;
    const requirements: string | undefined = body.requirements;
    const targetLength: number | undefined = body.targetLength;
    const model: string | undefined = body.model;
    const multiSample: boolean = body.multiSample === true;
    const apiKey: string | undefined = process.env.OPENROUTER_API_KEY;

    if (!dna || !topic) {
      return NextResponse.json({ error: 'dna and topic are required' }, { status: 400 });
    }
    // v0.6.1：dna 结构校验（客户端可能传裁剪过的旧 schema）
    const dnaCheck = validateDNA(dna);
    if (!dnaCheck.ok) {
      logger.warn('generate: invalid dna', { missing: dnaCheck.missing });
      return NextResponse.json(
        { error: `dna 结构不完整（缺少 ${dnaCheck.missing.join(', ')}），请重新上传范文` },
        { status: 400 }
      );
    }

    // v0.6.1 安全：prompt injection 检测（用户输入会拼进 system prompt）
    const topicCheck = detectInjection(topic, { maxLength: 200, maxLineBreaks: 20 });
    if (topicCheck.suspicious) {
      logger.warn('generate: suspicious topic', { reasons: topicCheck.reasons });
      return NextResponse.json(
        { error: `题目包含可疑内容：${topicCheck.reasons.join('; ')}` },
        { status: 400 }
      );
    }
    if (requirements) {
      const reqCheck = detectInjection(requirements, { maxLength: 2000, maxLineBreaks: 50 });
      if (reqCheck.suspicious) {
        logger.warn('generate: suspicious requirements', { reasons: reqCheck.reasons });
        return NextResponse.json(
          { error: `额外要求包含可疑内容：${reqCheck.reasons.join('; ')}` },
          { status: 400 }
        );
      }
    }
    if (!apiKey) {
      return NextResponse.json({
        error: 'OPENROUTER_API_KEY is not configured. Click "Advanced Settings" in the first screen and paste your key, or edit .env.local.'
      }, { status: 500 });
    }
    // 检测占位符，避免浪费一次 OpenRouter 调用
    if (/your-key-here|placeholder|xxx/i.test(apiKey)) {
      return NextResponse.json({
        error: 'OPENROUTER_API_KEY is still the placeholder. Click "Advanced Settings" in the first screen and paste a real key from https://openrouter.ai/keys.'
      }, { status: 500 });
    }

    if (multiSample) {
      // 多采样挑 AI 味最低的
      const { best, all } = await generateBestEssay({
        dna, profile, topic, requirements, targetLength, model, apiKey,
        attempts: body.attempts || 3,
        scorer: (essay) => -scoreAITrace(essay, dna).total
      });
      const bestScore = scoreAITrace(best.essay, dna);
      const allScores = all.map(r => ({ essay: r.essay, score: scoreAITrace(r.essay, dna) }));
      logger.info('generate success (multi-sample)', {
        model: best.model,
        durationMs: best.durationMs,
        attempts: all.length,
        bestAiScore: bestScore.total
      });
      return NextResponse.json({
        result: { ...best, aiScore: bestScore },
        alternatives: allScores
      });
    } else {
      const result = await generateEssay({ dna, profile, topic, requirements, targetLength, model, apiKey });
      const aiScore = scoreAITrace(result.essay, dna);
      logger.info('generate success', {
        model: result.model,
        durationMs: result.durationMs,
        aiScore: aiScore.total,
        topicLength: topic.length
      });
      return NextResponse.json({ result: { ...result, aiScore } });
    }
  } catch (e: any) {
    logger.error('generate failed', { error: e.message, stack: e.stack?.slice(0, 500) });
    const msg = e?.message || 'Internal error';
    // OpenRouter 错误：把 401/402/429 等包装成友好提示 + 合适状态码
    const orMatch = msg.match(/OpenRouter error (\d+):\s*(.+)/);
    if (orMatch) {
      const status = parseInt(orMatch[1], 10);
      let friendly = `OpenRouter 调用失败 (${status})`;
      if (status === 401) friendly = 'OpenRouter API Key 无效或过期，请检查 .env.local 里的 key';
      else if (status === 402) friendly = 'OpenRouter 账户余额不足，请去 openrouter.ai 充值';
      else if (status === 429) friendly = 'OpenRouter 请求太频繁（限流），稍后再试';
      else if (status >= 500) friendly = 'OpenRouter 服务异常，请稍后再试';
      return NextResponse.json({ error: friendly, detail: orMatch[2].slice(0, 300) }, { status: 502 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
