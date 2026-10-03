/**
 * API 输入校验 / rate limit 集成测试（v0.6.0 强化）
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';

// 防止 set-key 等真写 .env.local（vitest 启动时已自动设为 test）

// Mock NextRequest 工厂
function mockReq(url: string, init?: { method?: string; body?: any; headers?: Record<string, string> }): NextRequest {
  const method = init?.method || 'POST';
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
  const req = new NextRequest(fullUrl, {
    method,
    headers: { 'content-type': 'application/json', 'x-real-ip': '127.0.0.1', ...(init?.headers || {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined
  });
  return req;
}

describe('API 输入校验', () => {
  describe('POST /api/generate', () => {
    it('缺少 dna/requirements/topic 应 400', async () => {
      const { POST } = await import('./generate/route');
      const req = mockReq('/api/generate', { body: {} });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/analyze', () => {
    it('空 samples 应 400', async () => {
      const { POST } = await import('./analyze/route');
      const req = mockReq('/api/analyze', { body: { samples: [] } });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('样本 < 100 字应 400', async () => {
      const { POST } = await import('./analyze/route');
      const req = mockReq('/api/analyze', { body: { samples: ['太短了'] } });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('样本 > 50000 字应 400', async () => {
      const { POST } = await import('./analyze/route');
      const req = mockReq('/api/analyze', { body: { samples: ['a'.repeat(50001)] } });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('样本数 > 10 应 400', async () => {
      const { POST } = await import('./analyze/route');
      const samples = Array(11).fill('a'.repeat(150));
      const req = mockReq('/api/analyze', { body: { samples } });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/materials (GET)', () => {
    it('空 topic 应 400', async () => {
      const { GET } = await import('./materials/route');
      const req = mockReq('/api/materials?type=argument', { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(400);
    });

    it('topic 过长应 400', async () => {
      const { GET } = await import('./materials/route');
      const longTopic = 'a'.repeat(201);
      const req = mockReq(`/api/materials?topic=${longTopic}`, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(400);
    });

    it('正常 topic 应 200', async () => {
      const { GET } = await import('./materials/route');
      const req = mockReq('/api/materials?topic=母爱&type=argument', { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.materials.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/predict-score', () => {
    it('essay < 100 字应 400', async () => {
      const { POST } = await import('./predict-score/route');
      const req = mockReq('/api/predict-score', { body: { essay: '太短' } });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('essay > 10000 字应 400', async () => {
      const { POST } = await import('./predict-score/route');
      const req = mockReq('/api/predict-score', { body: { essay: 'a'.repeat(10001) } });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/score', () => {
    it('essay < 50 字应 400', async () => {
      const { POST } = await import('./score/route');
      const req = mockReq('/api/score', { body: { essay: '太短' } });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('essay > 50000 字应 400', async () => {
      const { POST } = await import('./score/route');
      const req = mockReq('/api/score', { body: { essay: 'a'.repeat(50001) } });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('正常 essay 应 200', async () => {
      const { POST } = await import('./score/route');
      const req = mockReq('/api/score', { body: { essay: '今天天气真好'.repeat(20) } });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/rewrite-segment', () => {
    it('段落 < 10 字应 400', async () => {
      const { POST } = await import('./rewrite-segment/route');
      const req = mockReq('/api/rewrite-segment', { body: { originalSegment: '短', dna: {} } });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('段落 > 3000 字应 400', async () => {
      const { POST } = await import('./rewrite-segment/route');
      const req = mockReq('/api/rewrite-segment', { body: { originalSegment: 'a'.repeat(3001), dna: {} } });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });
});

describe('Rate limiting', () => {
  it('同一 IP 短时间内连续请求 /api/score 应被 429', async () => {
    const { POST } = await import('./score/route');
    const essay = '今天天气真好'.repeat(20);

    // 打满 60 次（rewrite 上限）
    let lastStatus = 0;
    for (let i = 0; i < 70; i++) {
      const req = mockReq('/api/score', { body: { essay }, headers: { 'x-real-ip': '1.2.3.4' } });
      const res = await POST(req);
      lastStatus = res.status;
      if (res.status === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});