import { NextRequest, NextResponse } from 'next/server';
import { extractStyleDNA } from '@/lib/style-dna';
import { extractStyleProfile } from '@/lib/style-extractor';
import { checkRateLimit, RATE_LIMITS, getClientIP, rateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { detectInjection } from '@/lib/sanitize';

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const rl = checkRateLimit(`analyze:${ip}`, RATE_LIMITS.generate);
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
    const samples: string[] = body?.samples || [];
    if (samples.length === 0) {
      return NextResponse.json({ error: 'At least one sample is required' }, { status: 400 });
    }
    if (samples.some((s: any) => typeof s !== 'string' || s.trim().length < 100)) {
      return NextResponse.json({ error: 'Each sample must be at least 100 characters' }, { status: 400 });
    }
    if (samples.some((s: any) => s.length > 50000)) {
      return NextResponse.json({ error: 'Each sample must be <= 50000 characters' }, { status: 400 });
    }
    if (samples.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 samples' }, { status: 400 });
    }
    // v0.6.1 安全：prompt injection 检测
    // strict=false —— 范文是学生自己写的，可能引用英文对话（"Assistant: ..."），不误伤
    for (let i = 0; i < samples.length; i++) {
      const check = detectInjection(samples[i], {
        maxLength: 50000,
        maxLineBreaks: 200,
        strict: false
      });
      if (check.suspicious) {
        logger.warn(`analyze: suspicious sample ${i}`, { reasons: check.reasons });
        return NextResponse.json(
          { error: `第 ${i + 1} 篇范文包含可疑内容：${check.reasons.join('; ')}` },
          { status: 400 }
        );
      }
    }

    // 1. 规则量化 DNA
    const dna = extractStyleDNA(samples);

    // 2. LLM 风格画像（仅用 server-side key，不接受 body.apiKey 防滥用）
    const apiKey = process.env.OPENROUTER_API_KEY;
    let profile = null;
    let profileError = null;
    if (apiKey && !/your-key-here|placeholder|xxx/i.test(apiKey)) {
      try {
        profile = await extractStyleProfile(samples, apiKey);
      } catch (e: any) {
        profileError = e.message;
        logger.warn('analyze: LLM profile extraction failed', { error: e.message });
      }
    }

    return NextResponse.json({ dna, profile, profileError });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
