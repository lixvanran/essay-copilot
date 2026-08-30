import { NextRequest, NextResponse } from 'next/server';
import { generateEssay, generateBestEssay } from '@/lib/llm';
import { scoreAITrace } from '@/lib/ai-detector';
import type { StyleDNA } from '@/lib/style-dna';

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid or empty JSON body' }, { status: 400 });
    }
    const dna: StyleDNA = body.dna;
    const topic: string = body.topic;
    const requirements: string | undefined = body.requirements;
    const targetLength: number | undefined = body.targetLength;
    const model: string | undefined = body.model;
    const multiSample: boolean = body.multiSample === true;
    const apiKey: string | undefined = process.env.OPENROUTER_API_KEY;

    if (!dna || !topic) {
      return NextResponse.json({ error: 'dna and topic are required' }, { status: 400 });
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
        dna, topic, requirements, targetLength, model, apiKey,
        attempts: body.attempts || 3,
        scorer: (essay) => -scoreAITrace(essay, dna).total
      });
      const bestScore = scoreAITrace(best.essay, dna);
      const allScores = all.map(r => ({ essay: r.essay, score: scoreAITrace(r.essay, dna) }));
      return NextResponse.json({
        result: { ...best, aiScore: bestScore },
        alternatives: allScores
      });
    } else {
      const result = await generateEssay({ dna, topic, requirements, targetLength, model, apiKey });
      const aiScore = scoreAITrace(result.essay, dna);
      return NextResponse.json({ result: { ...result, aiScore } });
    }
  } catch (e: any) {
    console.error('Generate error:', e);
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
