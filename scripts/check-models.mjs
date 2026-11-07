#!/usr/bin/env node
/**
 * 实时校验 FALLBACK_CHAIN 里的模型 ID 是否还在 OpenRouter 上
 *
 * 用法：
 *   OPENROUTER_API_KEY=sk-or-v1-xxx node scripts/check-models.mjs
 *
 * 用途：
 * - 定期（CI / 手动）检查模型是否被下架
 * - 拿到实时列表后更新 lib/llm-models.test.ts 里的快照
 *
 * 退出码：0 = 全部有效；1 = 有失效模型（CI 会红）
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('❌ 未设置 OPENROUTER_API_KEY');
  process.exit(2);
}

const res = await fetch('https://openrouter.ai/api/v1/models', {
  headers: { Authorization: `Bearer ${apiKey}` }
});
if (!res.ok) {
  console.error(`❌ OpenRouter /models 返回 ${res.status}`);
  process.exit(2);
}
const data = await res.json();
const validIds = new Set(data.data.map(m => m.id));

// 从 llm.ts 里抠出 FALLBACK_CHAIN（避免 import TS）
const llmSrc = readFileSync(join(ROOT, 'lib/llm.ts'), 'utf-8');
const chainMatch = llmSrc.match(/export const FALLBACK_CHAIN\s*=\s*\[([\s\S]*?)\]\s*as const;/);
if (!chainMatch) {
  console.error('❌ 没能从 lib/llm.ts 解析出 FALLBACK_CHAIN');
  process.exit(2);
}
const chain = [...chainMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

console.log(`OpenRouter 当前有 ${validIds.size} 个模型\n`);
let bad = 0;
for (const m of chain) {
  const ok = validIds.has(m);
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} ${m}`);
}

console.log('');
if (bad === 0) {
  console.log(`🎉 FALLBACK_CHAIN 全部 ${chain.length} 个模型 ID 均有效`);
  process.exit(0);
} else {
  console.log(`⚠️  有 ${bad} 个模型 ID 已失效 —— 请更新 lib/llm.ts 的 FALLBACK_CHAIN`);
  console.log('   候选（从实时列表里挑同类替代）：');
  for (const m of chain) {
    if (!validIds.has(m)) {
      const prefix = m.split('/')[0];
      const alts = [...validIds].filter(v => v.startsWith(prefix + '/')).slice(0, 5);
      if (alts.length) console.log(`   ${m} → ${alts.join(', ')}`);
    }
  }
  process.exit(1);
}
