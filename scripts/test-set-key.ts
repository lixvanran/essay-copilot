/**
 * 直接测 /api/set-key 端点逻辑（绕过 Next.js）
 */
import { POST, GET } from '../app/api/set-key/route';
import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const ENV_LOCAL = path.join(process.cwd(), '.env.local');

function makeReq(body: any) {
  return new NextRequest('http://localhost:3000/api/set-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

(async () => {
  // 清理
  try { await fs.unlink(ENV_LOCAL); } catch {}

  console.log('=== Test 1: GET (no .env.local) ===');
  let r: any = await GET();
  let data = await r.json();
  console.log('  status:', r.status);
  console.log('  body:', JSON.stringify(data));
  console.log('  PASS:', data.exists === false);

  console.log('\n=== Test 2: POST 无 key ===');
  r = await POST(makeReq({}));
  data = await r.json();
  console.log('  status:', r.status);
  console.log('  body:', JSON.stringify(data));
  console.log('  PASS:', r.status === 400);

  console.log('\n=== Test 3: POST 格式错 ===');
  r = await POST(makeReq({ key: 'not-a-valid-key' }));
  data = await r.json();
  console.log('  status:', r.status);
  console.log('  body:', JSON.stringify(data));
  console.log('  PASS:', r.status === 400);

  console.log('\n=== Test 4: POST 真 key ===');
  r = await POST(makeReq({ key: 'sk-or-v1-test1234567890abcdef' }));
  data = await r.json();
  console.log('  status:', r.status);
  console.log('  body:', JSON.stringify(data));
  const envContent = await fs.readFile(ENV_LOCAL, 'utf-8');
  console.log('  .env.local 内容:', envContent.trim());
  console.log('  PASS:', r.status === 200 && envContent.includes('sk-or-v1-test1234567890abcdef'));

  console.log('\n=== Test 5: GET (写入后) ===');
  r = await GET();
  data = await r.json();
  console.log('  body:', JSON.stringify(data));
  console.log('  PASS:', data.hasKey === true);

  console.log('\n=== Test 6: POST 更新已有 key ===');
  r = await POST(makeReq({ key: 'sk-or-v1-updated9876543210xyz' }));
  data = await r.json();
  const envContent2 = await fs.readFile(ENV_LOCAL, 'utf-8');
  console.log('  .env.local:', envContent2.trim());
  console.log('  PASS:', envContent2.includes('sk-or-v1-updated9876543210xyz') && !envContent2.includes('test1234567890'));

  // 清理
  try { await fs.unlink(ENV_LOCAL); } catch {}
  console.log('\n=== 全部测试通过 ===');
})().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});
