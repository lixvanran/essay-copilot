/**
 * localStorage 持久化（v0.4.0）
 *
 * 保存：
 *  - dna + samples + profile（恢复会话）
 *  - essay 历史（最近 5 篇）
 *  - theme（暗/亮）
 *
 * 错误处理：localStorage 可能因为 QuotaExceededError 或隐私模式失败，
 * 不抛给上层，只 warn 一次（避免刷屏）
 */

import type { StyleDNA } from './style-dna';
import type { StyleProfile } from './style-extractor';

const KEYS = {
  analysis: 'essay-copilot:analysis',
  history: 'essay-copilot:history',
  polish: 'essay-copilot:polish-mode'
} as const;

export type SavedAnalysis = {
  dna: StyleDNA;
  profile: StyleProfile | null;
  samples: string[];
  savedAt: number;
};

export type HistoryEntry = {
  id: string;
  essay: string;
  topic: string;
  model: string;
  aiScore: number;
  savedAt: number;
};

let warnedThisSession = false;
function warnOnce(msg: string, error?: unknown) {
  if (warnedThisSession) return;
  warnedThisSession = true;
  console.warn(`[storage] ${msg}`, error);
}

/**
 * SSR 安全访问 localStorage
 * - SSR（typeof window === 'undefined'）返回 null
 * - 隐私模式 / 存储被禁用（setItem 抛错）返回 null
 * 之后所有调用方都要处理 null（用 ?. 可选链）
 */
function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const probe = '__essay_copilot_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * 保存当前分析结果
 */
export function saveAnalysis(data: SavedAnalysis) {
  try {
    safeStorage()?.setItem(KEYS.analysis, JSON.stringify(data));
  } catch (e) {
    warnOnce('saveAnalysis failed — localStorage may be full or disabled', e);
  }
}

export function loadAnalysis(): SavedAnalysis | null {
  try {
    const raw = safeStorage()?.getItem(KEYS.analysis);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.savedAt > 7 * 24 * 3600 * 1000) {
      safeStorage()?.removeItem(KEYS.analysis);
      return null;
    }
    return data;
  } catch (e) {
    warnOnce('loadAnalysis failed', e);
    return null;
  }
}

export function clearAnalysis() {
  try {
    safeStorage()?.removeItem(KEYS.analysis);
  } catch (e) {
    warnOnce('clearAnalysis failed', e);
  }
}

/**
 * 作文历史
 */
export function loadHistory(): HistoryEntry[] {
  try {
    const raw = safeStorage()?.getItem(KEYS.history);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    warnOnce('loadHistory failed', e);
    return [];
  }
}

export function addToHistory(entry: HistoryEntry) {
  try {
    const list = loadHistory();
    const updated = [entry, ...list.filter(e => e.id !== entry.id)].slice(0, 5);
    safeStorage()?.setItem(KEYS.history, JSON.stringify(updated));
  } catch (e) {
    warnOnce('addToHistory failed', e);
  }
}

export function removeFromHistory(id: string) {
  try {
    const list = loadHistory().filter(e => e.id !== id);
    safeStorage()?.setItem(KEYS.history, JSON.stringify(list));
  } catch (e) {
    warnOnce('removeFromHistory failed', e);
  }
}

export function clearHistory() {
  try {
    safeStorage()?.removeItem(KEYS.history);
  } catch (e) {
    warnOnce('clearHistory failed', e);
  }
}

/**
 * 润色模式偏好
 */
export function getPolishMode(): boolean {
  try {
    return safeStorage()?.getItem(KEYS.polish) === '1';
  } catch {
    return false;
  }
}

export function setPolishMode(v: boolean) {
  try {
    safeStorage()?.setItem(KEYS.polish, v ? '1' : '0');
  } catch (e) {
    warnOnce('setPolishMode failed', e);
  }
}