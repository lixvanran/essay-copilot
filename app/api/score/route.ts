import { NextRequest, NextResponse } from 'next/server';
import { scoreAITrace } from '@/lib/ai-detector';
import type { StyleDNA } from '@/lib/style-dna';
import { checkRateLimit, RATE_LIMITS, getClientIP, rateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const rl = checkRateLimit(`score:${ip}`, RATE_LIMITS.rewrite);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `请求太频繁，${Math.ceil(rl.resetIn / 1000)} 秒后重试` },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const body = await req.json();
    const essay: string = body.essay;
    const dna: StyleDNA | undefined = body.dna;
    if (!essay || essay.trim().length < 50) {
      return NextResponse.json({ error: 'essay is required (>= 50 chars)' }, { status: 400 });
    }
    if (essay.length > 50000) {
      return NextResponse.json({ error: 'essay too long (max 50000 chars)' }, { status: 400 });
    }
    const score = scoreAITrace(essay, dna);
    return NextResponse.json({ score });
  } catch (e: any) {
    logger.error('score failed', { error: e.message });
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
