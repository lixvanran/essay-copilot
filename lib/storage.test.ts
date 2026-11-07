/**
 * storage.ts 测试（v0.6.1 补覆盖率）
 *
 * 覆盖：
 * - 正常读写
 * - 7 天过期
 * - 历史去重 + 上限 5 条
 * - 损坏 JSON 容错
 * - SSR 守卫（无 window 时不崩）
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// 每个测试独立一个 mock localStorage
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
}

function installStorage() {
  const s = new MemoryStorage();
  (globalThis as any).window = { localStorage: s };
  return s;
}

function uninstallStorage() {
  delete (globalThis as any).window;
}

describe('storage.ts', () => {
  beforeEach(() => {
    vi.resetModules();
    installStorage();
  });

  afterEach(() => {
    uninstallStorage();
  });

  describe('saveAnalysis / loadAnalysis', () => {
    it('保存后能读回', async () => {
      const { saveAnalysis, loadAnalysis } = await import('./storage');
      const data = {
        dna: { avgSentenceLen: 20 } as any,
        profile: null,
        samples: ['范文一'],
        savedAt: Date.now()
      };
      saveAnalysis(data);
      const loaded = loadAnalysis();
      expect(loaded).toBeTruthy();
      expect(loaded?.samples).toEqual(['范文一']);
    });

    it('没有存档时返回 null', async () => {
      const { loadAnalysis } = await import('./storage');
      expect(loadAnalysis()).toBeNull();
    });

    it('超过 7 天的存档视为过期并清除', async () => {
      const { saveAnalysis, loadAnalysis } = await import('./storage');
      const eightDaysAgo = Date.now() - 8 * 24 * 3600 * 1000;
      saveAnalysis({ dna: {} as any, profile: null, samples: [], savedAt: eightDaysAgo });
      expect(loadAnalysis()).toBeNull();
    });

    it('损坏的 JSON 不抛错，返回 null', async () => {
      const { loadAnalysis } = await import('./storage');
      window.localStorage.setItem('essay-copilot:analysis', '{ 不是合法 JSON');
      expect(loadAnalysis()).toBeNull();
    });

    it('clearAnalysis 能清掉存档', async () => {
      const { saveAnalysis, clearAnalysis, loadAnalysis } = await import('./storage');
      saveAnalysis({ dna: {} as any, profile: null, samples: [], savedAt: Date.now() });
      expect(loadAnalysis()).toBeTruthy();
      clearAnalysis();
      expect(loadAnalysis()).toBeNull();
    });
  });

  describe('history', () => {
    it('添加历史 + 读回', async () => {
      const { addToHistory, loadHistory } = await import('./storage');
      addToHistory({ id: 'h1', essay: '作文一', topic: '题目一', model: 'kimi', aiScore: 20, savedAt: Date.now() });
      const list = loadHistory();
      expect(list.length).toBe(1);
      expect(list[0].essay).toBe('作文一');
    });

    it('相同 id 覆盖而不是重复（去重）', async () => {
      const { addToHistory, loadHistory } = await import('./storage');
      addToHistory({ id: 'h1', essay: '第一版', topic: 't', model: 'kimi', aiScore: 20, savedAt: 1 });
      addToHistory({ id: 'h1', essay: '第二版', topic: 't', model: 'kimi', aiScore: 15, savedAt: 2 });
      const list = loadHistory();
      expect(list.length).toBe(1);
      expect(list[0].essay).toBe('第二版');
    });

    it('最多保留 5 条', async () => {
      const { addToHistory, loadHistory } = await import('./storage');
      for (let i = 0; i < 8; i++) {
        addToHistory({ id: `h${i}`, essay: `作文${i}`, topic: 't', model: 'kimi', aiScore: 20, savedAt: i });
      }
      expect(loadHistory().length).toBe(5);
    });

    it('removeFromHistory 能删指定项', async () => {
      const { addToHistory, removeFromHistory, loadHistory } = await import('./storage');
      addToHistory({ id: 'h1', essay: 'a', topic: 't', model: 'kimi', aiScore: 20, savedAt: 1 });
      addToHistory({ id: 'h2', essay: 'b', topic: 't', model: 'kimi', aiScore: 20, savedAt: 2 });
      removeFromHistory('h1');
      const list = loadHistory();
      expect(list.length).toBe(1);
      expect(list[0].id).toBe('h2');
    });

    it('clearHistory 清空全部', async () => {
      const { addToHistory, clearHistory, loadHistory } = await import('./storage');
      addToHistory({ id: 'h1', essay: 'a', topic: 't', model: 'kimi', aiScore: 20, savedAt: 1 });
      clearHistory();
      expect(loadHistory().length).toBe(0);
    });

    it('损坏的 history JSON 返回空数组', async () => {
      const { loadHistory } = await import('./storage');
      window.localStorage.setItem('essay-copilot:history', 'not json');
      expect(loadHistory()).toEqual([]);
    });
  });

  describe('polish mode 偏好', () => {
    it('默认 false', async () => {
      const { getPolishMode } = await import('./storage');
      expect(getPolishMode()).toBe(false);
    });

    it('setPolishMode(true) 后读回 true', async () => {
      const { setPolishMode, getPolishMode } = await import('./storage');
      setPolishMode(true);
      expect(getPolishMode()).toBe(true);
    });

    it('setPolishMode(false) 后读回 false', async () => {
      const { setPolishMode, getPolishMode } = await import('./storage');
      setPolishMode(true);
      setPolishMode(false);
      expect(getPolishMode()).toBe(false);
    });
  });

  describe('SSR 守卫（v0.6.1 新增）', () => {
    it('无 window 时（SSR）调用不抛错', async () => {
      vi.resetModules();
      uninstallStorage();
      const { saveAnalysis, loadAnalysis, addToHistory, loadHistory, getPolishMode, setPolishMode } =
        await import('./storage');
      expect(() => saveAnalysis({ dna: {} as any, profile: null, samples: [], savedAt: Date.now() })).not.toThrow();
      expect(loadAnalysis()).toBeNull();
      expect(() => addToHistory({ id: 'x', essay: 'e', topic: 't', model: 'm', aiScore: 1, savedAt: 0 })).not.toThrow();
      expect(loadHistory()).toEqual([]);
      expect(getPolishMode()).toBe(false);
      expect(() => setPolishMode(true)).not.toThrow();
    });

    it('localStorage 被禁用（setItem 抛错）时不崩', async () => {
      vi.resetModules();
      const broken = {
        get length() { return 0; },
        clear() {},
        getItem() { return null; },
        key() { return null; },
        removeItem() {},
        setItem() { throw new Error('QuotaExceededError'); }
      } as unknown as Storage;
      (globalThis as any).window = { localStorage: broken };
      const { saveAnalysis, loadAnalysis } = await import('./storage');
      expect(() => saveAnalysis({ dna: {} as any, profile: null, samples: [], savedAt: Date.now() })).not.toThrow();
      expect(loadAnalysis()).toBeNull();
    });
  });
});
