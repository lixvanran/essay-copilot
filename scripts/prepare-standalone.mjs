#!/usr/bin/env node
/**
 * 准备 standalone 运行目录（v0.6.1）
 *
 * Next.js 的 `output: 'standalone'` 只把 server.js + 精简 node_modules
 * 放进 .next/standalone/，**不含** .next/static（JS/CSS chunks）和 public/。
 * 生产运行和 E2E 都必须把这两个目录拷进去，否则页面 404 / 不 hydrate。
 *
 * Docker 镜像里已经做了同样的事（Dockerfile runner stage）——
 * 这个脚本让本地 E2E 走的是**和生产完全一致**的路径。
 *
 * 用法：node scripts/prepare-standalone.mjs
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STANDALONE = join(ROOT, '.next', 'standalone');

if (!existsSync(join(STANDALONE, 'server.js'))) {
  console.error('❌ .next/standalone/server.js 不存在 —— 请先 npm run build');
  process.exit(1);
}

// 1. .next/static → .next/standalone/.next/static
const staticSrc = join(ROOT, '.next', 'static');
const staticDst = join(STANDALONE, '.next', 'static');
if (existsSync(staticSrc)) {
  mkdirSync(dirname(staticDst), { recursive: true });
  cpSync(staticSrc, staticDst, { recursive: true });
  console.log('✅ .next/static → .next/standalone/.next/static');
} else {
  console.warn('⚠️  .next/static 不存在（跳过）');
}

// 2. public → .next/standalone/public
const publicSrc = join(ROOT, 'public');
const publicDst = join(STANDALONE, 'public');
if (existsSync(publicSrc)) {
  mkdirSync(publicDst, { recursive: true });
  cpSync(publicSrc, publicDst, { recursive: true });
  console.log('✅ public → .next/standalone/public');
} else {
  console.warn('⚠️  public 不存在（跳过）');
}

console.log('🎉 standalone 运行目录就绪');
