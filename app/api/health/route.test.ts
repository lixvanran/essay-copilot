/**
 * /api/health 集成测试
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { GET } from './route';

describe('GET /api/health', () => {
  beforeAll(() => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-test-key-1234567890';
  });

  it('returns 200 with status ok when healthy', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toMatch(/ok|degraded/);
    expect(body.version).toBeDefined();
    expect(body.checks).toBeDefined();
    expect(body.checks.node).toBeDefined();
    expect(body.checks.jieba).toBeDefined();
  });

  it('returns 503 when OPENROUTER_API_KEY is missing', async () => {
    const original = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.checks.apiKey.status).toBe('fail');

    process.env.OPENROUTER_API_KEY = original;
  });

  it('includes uptime counter', async () => {
    const res = await GET();
    const body = await res.json();
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });
});