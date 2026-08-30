import { NextRequest, NextResponse } from 'next/server';
import { scoreAITrace } from '@/lib/ai-detector';
import type { StyleDNA } from '@/lib/style-dna';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const essay: string = body.essay;
    const dna: StyleDNA | undefined = body.dna;
    if (!essay || essay.trim().length < 50) {
      return NextResponse.json({ error: 'essay is required (>= 50 chars)' }, { status: 400 });
    }
    const score = scoreAITrace(essay, dna);
    return NextResponse.json({ score });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
