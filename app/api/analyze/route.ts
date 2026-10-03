import { NextRequest, NextResponse } from 'next/server';
import { extractStyleDNA } from '@/lib/style-dna';
import { extractStyleProfile } from '@/lib/style-extractor';
import { checkRateLimit, RATE_LIMITS, getClientIP, rateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

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
