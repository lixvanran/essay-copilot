import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const ENV_LOCAL = path.join(process.cwd(), '.env.local');

/**
 * 持久化保存 OPENROUTER_API_KEY 到 .env.local
 * POST { key: "sk-or-v1-..." }
 */
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
    if (!/^sk-or-v1-[a-zA-Z0-9_-]+$/.test(key)) {
      return NextResponse.json({ error: 'Invalid key format. OpenRouter keys start with sk-or-v1-' }, { status: 400 });
    }

    // 读现有 .env.local（如果存在），更新 OPENROUTER_API_KEY
    let content = '';
    try {
      content = await fs.readFile(ENV_LOCAL, 'utf-8');
    } catch {
      // 不存在就用 .env.example 模板
      try {
        content = await fs.readFile(path.join(process.cwd(), '.env.example'), 'utf-8');
      } catch {
        content = 'OPENROUTER_API_KEY=\n';
      }
    }

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

    await fs.writeFile(ENV_LOCAL, newContent, 'utf-8');

    return NextResponse.json({ ok: true, message: 'Key saved to .env.local. Server restart may be required.' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * 读当前 key 状态（不返回真实 key，只返回是否存在 + 是否占位符）
 */
export async function GET() {
  try {
    let content = '';
    try {
      content = await fs.readFile(ENV_LOCAL, 'utf-8');
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
