import { test, expect } from '@playwright/test';

test.describe('API 输入校验（E2E）', () => {
  test('/api/materials 空 topic 应 400', async ({ request }) => {
    const res = await request.get('/api/materials?type=argument');
    expect(res.status()).toBe(400);
  });

  test('/api/materials topic 过长应 400', async ({ request }) => {
    const longTopic = 'a'.repeat(201);
    const res = await request.get(`/api/materials?topic=${longTopic}`);
    expect(res.status()).toBe(400);
  });

  test('/api/predict-score essay 过长应 400', async ({ request }) => {
    const essay = 'a'.repeat(10001);
    const res = await request.post('/api/predict-score', { data: { essay } });
    expect(res.status()).toBe(400);
  });

  test('/api/score essay 过长应 400', async ({ request }) => {
    const essay = 'a'.repeat(50001);
    const res = await request.post('/api/score', { data: { essay } });
    expect(res.status()).toBe(400);
  });

  test('/api/analyze samples 超过 10 个应 400', async ({ request }) => {
    const samples = Array(11).fill('a'.repeat(150));
    const res = await request.post('/api/analyze', { data: { samples } });
    expect(res.status()).toBe(400);
  });

  test('速率限制：连续打 30 次 /api/score 应被 429', async ({ request }) => {
    let lastStatus = 0;
    const essay = '今天天气真好'.repeat(20);
    for (let i = 0; i < 80; i++) {
      const res = await request.post('/api/score', { data: { essay } });
      lastStatus = res.status();
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});