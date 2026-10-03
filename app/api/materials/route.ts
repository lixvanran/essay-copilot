/**
 * /api/materials - 智能素材匹配（v0.6.0）
 *
 * GET /api/materials?topic=母爱&type=argument&limit=3
 * 返回：根据题目关键词智能匹配的素材
 */

import { NextRequest, NextResponse } from 'next/server';
import { matchMaterials } from '@/lib/materials';
import type { MaterialType } from '@/lib/materials';
import { checkRateLimit, RATE_LIMITS, getClientIP, rateLimitHeaders } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  const rl = checkRateLimit(`materials:${ip}`, RATE_LIMITS.default);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `请求太频繁，${Math.ceil(rl.resetIn / 1000)} 秒后重试` },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const url = new URL(req.url);
    const topic = (url.searchParams.get('topic') || '').trim();
    const typeParam = url.searchParams.get('type') as MaterialType | null;
    const limit = Math.min(10, Math.max(1, parseInt(url.searchParams.get('limit') || '3')));

    if (!topic) {
      return NextResponse.json({ error: 'topic 必填' }, { status: 400 });
    }
    if (topic.length > 200) {
      return NextResponse.json({ error: 'topic 长度不能超过 200 字' }, { status: 400 });
    }

    const validTypes: MaterialType[] = ['argument', 'narrative', 'lyric'];
    const type = typeParam && validTypes.includes(typeParam) ? typeParam : undefined;

    const materials = matchMaterials(topic, type, limit);
    return NextResponse.json({
      topic,
      materials,
      total: materials.length
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}