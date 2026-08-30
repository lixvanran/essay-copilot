import { NextRequest, NextResponse } from 'next/server';
import { extractStyleDNA } from '@/lib/style-dna';

export async function POST(req: NextRequest) {
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
    const dna = extractStyleDNA(samples);
    return NextResponse.json({ dna });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
