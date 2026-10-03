/**
 * /api/set-key 集成测试
 *
 * ⚠️ 用临时目录隔离 .env.local，避免污染真实配置
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { POST, GET as initKeyStatus } from './route';

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'essay-copilot-test-'));
const ENV_LOCAL_PATH = path.join(TMP_DIR, '.env.local');
const ORIGINAL_CWD = process.cwd;

// Mock process.cwd to return our tmp dir for this test
beforeAll(() => {
  process.cwd = (): string => TMP_DIR;
});

afterAll(() => {
  process.cwd = ORIGINAL_CWD;
  try {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  } catch {}
});

describe('POST /api/set-key (isolated)', () => {
  it('saves valid key to .env.local in test dir', async () => {
    const req = new Request('http://localhost/api/set-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'sk-or-v1-1234567890abcdef' })
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(fs.existsSync(ENV_LOCAL_PATH)).toBe(true);
    const content = fs.readFileSync(ENV_LOCAL_PATH, 'utf8');
    expect(content).toContain('OPENROUTER_API_KEY=sk-or-v1-1234567890abcdef');
  });

  it('rejects empty key', async () => {
    const req = new Request('http://localhost/api/set-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: '' })
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('rejects malformed key', async () => {
    const req = new Request('http://localhost/api/set-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'invalid-key-format' })
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});