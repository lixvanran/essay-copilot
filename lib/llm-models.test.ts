/**
 * FALLBACK_CHAIN 模型 ID 离线守卫（v0.6.1）
 *
 * 背景：2026-11 审计发现 FALLBACK_CHAIN 里有 5 个模型 ID 已在 OpenRouter 下架
 *   （qwen-2.5-32b / qwen-2.5-14b / zhipu/glm-4-32b / gemini-2.0-flash-exp:free
 *     / claude-3-5-sonnet-20241022）
 * 而 OpenRouter 对无效模型 ID 返回 400 "not a valid model ID"，
 * 旧代码把 400 当"不可恢复"直接 throw ⇒ 请求在第 4 个模型就全线崩。
 *
 * ⇒ 本文件用一份"已知有效模型 ID 快照"做离线守卫。
 *    快照过期时会有专门的测试失败提醒更新（见 KNOWN_VALID_MODELS 的注释）。
 *
 * 想要实时校验：跑 `node scripts/check-models.mjs`（需要 OPENROUTER_API_KEY）。
 */
import { describe, it, expect } from 'vitest';
import { FALLBACK_CHAIN, DEFAULT_MODELS } from './llm';

/**
 * 快照时间：2026-11-07
 * 来源：GET https://openrouter.ai/api/v1/models
 *
 * ⚠️ 快照会过期 —— 如果下面的测试失败，先跑
 *    `node scripts/check-models.mjs` 拿实时列表，然后更新这里。
 */
const KNOWN_VALID_MODELS = new Set([
  // 月之暗面 Kimi
  'moonshotai/kimi-k2',
  'moonshotai/kimi-k2.5',
  'moonshotai/kimi-k2.6',
  'moonshotai/kimi-k3',
  'moonshotai/kimi-k3.1-pro',
  // DeepSeek
  'deepseek/deepseek-chat',
  'deepseek/deepseek-chat-v3.1',
  'deepseek/deepseek-v3.1',
  'deepseek/deepseek-v3.2',
  // 通义千问
  'qwen/qwen-2.5-72b-instruct',
  'qwen/qwen-2.5-7b-instruct',
  'qwen/qwen3-32b',
  'qwen/qwen3-14b',
  'qwen/qwen3-30b-a3b',
  'qwen/qwen3.8-flash',
  // 智谱 GLM
  'z-ai/glm-4.5',
  'z-ai/glm-4.6',
  'z-ai/glm-4.7',
  'z-ai/glm-5',
  // Meta Llama
  'meta-llama/llama-3.1-70b-instruct',
  'meta-llama/llama-3.1-8b-instruct',
  // Google Gemini
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'google/gemini-3-flash-preview',
  'google/gemini-3.8-flash',
  // Anthropic / OpenAI（国区可能不可用，但 ID 有效）
  'anthropic/claude-sonnet-4.5',
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-sonnet-5',
  'openai/gpt-4o-mini'
]);

describe('FALLBACK_CHAIN 模型 ID 守卫', () => {
  it('chain 里每个模型 ID 都是已知的有效 ID', () => {
    const invalid = FALLBACK_CHAIN.filter(m => !KNOWN_VALID_MODELS.has(m));
    expect(
      invalid,
      `以下模型 ID 已失效或未在快照中：${invalid.join(', ')}\n` +
      '跑 `node scripts/check-models.mjs` 拿实时列表，然后更新 lib/llm-models.test.ts 的快照'
    ).toEqual([]);
  });

  it('DEFAULT_MODELS 也都是有效 ID', () => {
    expect(KNOWN_VALID_MODELS.has(DEFAULT_MODELS.best)).toBe(true);
    expect(KNOWN_VALID_MODELS.has(DEFAULT_MODELS.fast)).toBe(true);
  });

  it('chain 不含重复', () => {
    expect(new Set(FALLBACK_CHAIN).size).toBe(FALLBACK_CHAIN.length);
  });

  it('chain 至少 5 个模型（保证有 fallback 余地）', () => {
    expect(FALLBACK_CHAIN.length).toBeGreaterThanOrEqual(5);
  });

  it('Kimi K2 在首位（实测中文写作最佳）', () => {
    expect(FALLBACK_CHAIN[0]).toBe('moonshotai/kimi-k2');
  });

  it('前 6 个都是国区可用的国产/开源模型', () => {
    const domestic = FALLBACK_CHAIN.slice(0, 6);
    for (const m of domestic) {
      const isDomestic =
        m.startsWith('moonshotai/') ||
        m.startsWith('deepseek/') ||
        m.startsWith('qwen/') ||
        m.startsWith('z-ai/') ||
        m.startsWith('meta-llama/');
      expect(isDomestic, `${m} 不应排在国区模型前面`).toBe(true);
    }
  });

  it('不再包含已下架的旧 ID（回归防护）', () => {
    const removed = [
      'qwen/qwen-2.5-32b-instruct',
      'qwen/qwen-2.5-14b-instruct',
      'zhipu/glm-4-32b',
      'google/gemini-2.0-flash-exp:free',
      'anthropic/claude-3-5-sonnet-20241022'
    ];
    for (const r of removed) {
      expect(FALLBACK_CHAIN).not.toContain(r);
    }
  });
});
