/**
 * OpenRouter LLM 客户端
 * 文档：https://openrouter.ai/docs
 */

import type { StyleDNA } from './style-dna';
import type { GenerateOptions } from './prompts';
import { buildSystemPrompt, buildUserPrompt } from './prompts';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenRouterRequest = {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
};

type OpenRouterChoice = {
  index: number;
  message: { role: string; content: string };
  finish_reason: string;
};

type OpenRouterResponse = {
  id: string;
  model: string;
  choices: OpenRouterChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type GenerateResult = {
  essay: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  durationMs: number;
};

/**
 * 默认模型
 * 重要：国区 OpenRouter 账户无法访问 Anthropic Claude / 部分 OpenAI 模型
 * 默认走国产模型，中文写作质量强 + 国区可用
 */
export const DEFAULT_MODELS = {
  best: 'deepseek/deepseek-chat',                  // 主选：DeepSeek V3（国产，中文最强）
  fast: 'qwen/qwen-2.5-14b-instruct',             // 快速：Qwen 14B
} as const;

/**
 * 国区友好 Fallback 模型链（按推荐顺序）
 * 优先国产模型 → 国际开源模型 → 国际闭源（可能国区不可用）
 */
export const FALLBACK_CHAIN = [
  'deepseek/deepseek-chat',                        // DeepSeek V3
  'qwen/qwen-2.5-72b-instruct',                    // 通义千问 72B
  'qwen/qwen-2.5-32b-instruct',                    // 通义千问 32B
  'qwen/qwen-2.5-14b-instruct',                    // 通义千问 14B（更快）
  'moonshotai/kimi-k2',                            // 月之暗面 Kimi K2
  'zhipu/glm-4-32b',                               // 智谱 GLM-4
  'meta-llama/llama-3.1-70b-instruct',             // Meta Llama 70B（国际开源）
  'meta-llama/llama-3.1-8b-instruct',              // Meta Llama 8B
  'google/gemini-2.0-flash-exp:free',             // Google Gemini（可能国区不可用）
  'anthropic/claude-3-5-sonnet-20241022',         // Anthropic（国区大概率 404）
  'openai/gpt-4o-mini'                             // OpenAI（国区大概率 404）
] as const;

/**
 * 调用 OpenRouter 生成作文
 */
export async function generateEssay(
  opts: GenerateOptions & { model?: string; apiKey?: string; withFallback?: boolean }
): Promise<GenerateResult> {
  const apiKey = opts.apiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set. Provide via opts.apiKey or env var.');
  }

  // 决定模型链
  let modelsToTry: string[];
  if (opts.model) {
    // 用户指定了具体模型
    modelsToTry = opts.withFallback ? [opts.model, ...FALLBACK_CHAIN.filter(m => m !== opts.model)] : [opts.model];
  } else {
    // 默认走 fallback chain
    modelsToTry = opts.withFallback !== false
      ? [...FALLBACK_CHAIN]
      : [process.env.OPENROUTER_MODEL || DEFAULT_MODELS.best];
  }

  const systemPrompt = buildSystemPrompt(opts.dna);
  const userPrompt = buildUserPrompt(opts);

  const errors: string[] = [];

  for (const model of modelsToTry) {
    const requestBody: OpenRouterRequest = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: 2000,
      top_p: 0.95
    };

    const start = Date.now();
    try {
      const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://zuowen-copilot.local',
          'X-Title': 'Zuowen Co-Pilot'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        // 404 / 402 / 403 都视为"不可用"，尝试下一个
        if (response.status === 404 || response.status === 402 || response.status === 403) {
          errors.push(`${model} (${response.status})`);
          continue;
        }
        // 其他错误（401 / 429 / 5xx）直接抛出
        throw new Error(`OpenRouter error ${response.status}: ${errText}`);
      }

      const data: OpenRouterResponse = await response.json();
      const durationMs = Date.now() - start;

      if (!data.choices || data.choices.length === 0) {
        errors.push(`${model} (no choices)`);
        continue;
      }

      const essay = data.choices[0].message.content.trim();
      return {
        essay,
        model: data.model,
        usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        durationMs
      };
    } catch (e: any) {
      // 不可恢复错误（401/429/5xx），透传
      throw e;
    }
  }

  // 所有模型都失败
  throw new Error(`All models failed. Tried: ${errors.join(', ')}. Your OpenRouter account may not have access to any of these models. Check https://openrouter.ai/models for available models.`);
}

/**
 * 多次采样挑最好的（用 AI 自检器打分）
 */
export async function generateBestEssay(
  opts: GenerateOptions & { model?: string; apiKey?: string; attempts?: number; scorer?: (essay: string) => number }
): Promise<{ best: GenerateResult; all: GenerateResult[] }> {
  const attempts = opts.attempts || 3;
  const scorer = opts.scorer || ((essay: string) => -essay.length);
  const all: GenerateResult[] = [];
  const errors: Error[] = [];
  let firstFailFast = false;  // 第一次失败后立即停止（模型问题不会自愈）

  for (let i = 0; i < attempts; i++) {
    if (firstFailFast) break;
    try {
      const result = await generateEssay(opts);
      all.push(result);
    } catch (e: any) {
      console.error(`Attempt ${i + 1} failed:`, e);
      errors.push(e);
      // 如果错误是"所有模型都失败"或类似的不可恢复错误，立即停止
      if (/All models failed|OpenRouter error (401|402|403|404)/.test(e.message)) {
        firstFailFast = true;
      }
    }
  }

  if (all.length === 0) {
    const lastErr = errors[errors.length - 1];
    if (lastErr) {
      throw lastErr;
    }
    throw new Error('All attempts failed');
  }

  const scored = all.map(r => ({ ...r, _score: scorer(r.essay) }));
  scored.sort((a, b) => b._score - a._score);
  const best = scored[0];
  const { _score, ...bestClean } = best;
  return { best: bestClean, all };
}
