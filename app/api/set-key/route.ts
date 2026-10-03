/**
 * /api/set-key（v0.5.1 强化版）
 *
 * 持久化保存 OPENROUTER_API_KEY 到 .env.local
 * POST { key: "sk-or-v1-..." }
 *
 * 安全增强：
 * - 格式校验（必须是 sk-or-v1-* 开头）
 * - 原子写（先写临时文件再 rename）—— 防止并发写入损坏
 * - 文件权限 0o600（仅 owner 可读写）
 * - 验证拒绝过短/可疑 key
 */
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// 注意：path 在函数内求值（不能用 const 缓存），否则测试 mock process.cwd() 无效
function getEnvPath(): string {
  return path.join(process.cwd(), '.env.local');
}
function getLockPath(): string {
  return path.join(process.cwd(), '.env.local.lock');
}

const KEY_FORMAT = /^sk-or-v1-[a-zA-Z0-9_-]{10,}$/;

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid or empty JSON body' }, { status: 400 });
    }

    const key = (body?.key || '').trim();
    if (!key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }
    if (!KEY_FORMAT.test(key)) {
      return NextResponse.json({
        error: 'Invalid key format. OpenRouter keys start with sk-or-v1- and require ≥ 20 alphanumeric chars.'
      }, { status: 400 });
    }

    // 简单文件锁：避免并发写入损坏 .env.local
    // 使用 mkdir 原子性（mkdir 是原子操作）
    let lockAcquired = false;
    try {
      await fs.mkdir(getLockPath());
      lockAcquired = true;
    } catch (e: any) {
      if (e.code === 'EEXIST') {
        return NextResponse.json({
          error: 'Another save is in progress. Please retry.'
        }, { status: 429 });
      }

      throw e;
    }

    try {
      // 读现有 .env.local
      let content = '';
      try {
        content = await fs.readFile(getEnvPath(), 'utf-8');
      } catch {
        try {
          content = await fs.readFile(path.join(process.cwd(), '.env.example'), 'utf-8');
        } catch {
          content = 'OPENROUTER_API_KEY=\n';
        }
      }

      // 更新 / 添加 OPENROUTER_API_KEY 行
      const lines = content.split(/\r?\n/);
      let found = false;
      const newLines = lines.map(line => {
        if (/^OPENROUTER_API_KEY\s*=/.test(line)) {
          found = true;
          return `OPENROUTER_API_KEY=${key}`;
        }
        return line;
      });
      if (!found) {
        if (newLines.length > 0 && newLines[newLines.length - 1] !== '') {
          newLines.push('');
        }
        newLines.push(`OPENROUTER_API_KEY=${key}`);
      }
      const newContent = newLines.join('\n');

      // 原子写：先写临时文件，再 rename
      // rename 在同一文件系统下是原子操作
      const envPath = getEnvPath();
      const tmpFile = `${envPath}.tmp.${process.pid}.${Date.now()}`;
      await fs.writeFile(tmpFile, newContent, { encoding: 'utf-8', mode: 0o600 });
      await fs.rename(tmpFile, envPath);

      return NextResponse.json({
        ok: true,
        message: 'Key saved to .env.local. If the dev server was already running, restart it.'
      });
    } finally {
      if (lockAcquired) {
        try { await fs.rmdir(getLockPath()); } catch {}
      }
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    let content = '';
    try {
      content = await fs.readFile(getEnvPath(), 'utf-8');
    } catch {
      return NextResponse.json({ exists: false, isPlaceholder: true, hasKey: false });
    }
    const match = content.match(/^OPENROUTER_API_KEY\s*=\s*(.*)$/m);
    if (!match) {
      return NextResponse.json({ exists: true, hasKey: false, isPlaceholder: true });
    }
    const value = match[1].trim();
    const isPlaceholder = !value || value === 'sk-or-v1-your-key-here' || /placeholder|xxx/i.test(value);
    return NextResponse.json({
      exists: true,
      hasKey: !!value && !isPlaceholder,
      isPlaceholder,
      length: value.length
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}