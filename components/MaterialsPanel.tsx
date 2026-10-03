'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Material, MaterialType } from '@/lib/materials';

type Props = {
  topic: string;
  type?: MaterialType;
  onPick?: (material: Material) => void;
  onClose: () => void;
};

const TYPE_LABEL: Record<MaterialType, string> = {
  argument: '议论文',
  narrative: '记叙文',
  lyric: '散文'
};

const CATEGORY_COLOR: Record<string, string> = {
  '人物': 'text-blue-700 bg-blue-50',
  '名言': 'text-purple-700 bg-purple-50',
  '事例': 'text-green-700 bg-green-50',
  '现象': 'text-orange-700 bg-orange-50',
  '场景': 'text-pink-700 bg-pink-50',
  '意象': 'text-cyan-700 bg-cyan-50'
};

export default function MaterialsPanel({ topic, type: initialType, onPick, onClose }: Props) {
  const [type, setType] = useState<MaterialType | undefined>(initialType);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchMaterials = useCallback(async () => {
    if (!topic.trim()) return;
    const ctrl = new AbortController();
    // 取消上一个进行中的请求（防止快速切换 type 竞态）
    const cancelPrev = (window as any).__materialsAbort;
    if (cancelPrev) cancelPrev.abort();
    (window as any).__materialsAbort = ctrl;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        topic,
        limit: '5'
      });
      if (type) params.set('type', type);
      const res = await fetch(`/api/materials?${params}`, { signal: ctrl.signal });
      const data = await res.json();
      if (res.ok) setMaterials(data.materials || []);
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error('Fetch materials failed:', e);
    } finally {
      setLoading(false);
    }
  }, [topic, type]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark-surface w-full max-w-lg h-full overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-dark-surface border-b border-ink-100 dark:border-dark-border px-6 py-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-800 dark:text-dark-text">📚 素材库</h2>
              <p className="text-xs text-ink-400 dark:text-dark-textSubtle mt-0.5">
                智能匹配 · 题目："{topic || '(未填)'}"
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* 类型筛选 */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setType(undefined)}
              className={`text-xs px-3 py-1 rounded-full transition ${
                !type ? 'bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg' : 'bg-ink-100 dark:bg-dark-surfaceHover text-ink-600 dark:text-dark-text'
              }`}
            >
              全部
            </button>
            {(['argument', 'narrative', 'lyric'] as MaterialType[]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`text-xs px-3 py-1 rounded-full transition ${
                  type === t ? 'bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg' : 'bg-ink-100 dark:bg-dark-surfaceHover text-ink-600 dark:text-dark-text'
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-ink-100 dark:bg-dark-surfaceHover rounded w-1/3 mb-2" />
                  <div className="h-3 bg-ink-100 dark:bg-dark-surfaceHover rounded w-full" />
                </div>
              ))}
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center text-ink-400 dark:text-dark-textSubtle text-sm py-12">
              没找到相关素材
            </div>
          ) : (
            <div className="space-y-3">
              {materials.map(m => (
                <div key={m.id} className="border border-ink-200 dark:border-dark-borderLight rounded-lg p-3 hover:border-ink-400 dark:hover:bg-dark-surfaceHover transition">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-ink-800 dark:text-dark-text">{m.title}</h4>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLOR[m.category] || 'text-ink-600 bg-ink-50'}`}>
                      {m.category}
                    </span>
                  </div>

                  <p className="text-xs text-ink-600 dark:text-dark-textMuted mb-2">{m.brief}</p>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {m.topics.slice(0, 4).map(t => (
                      <span key={t} className="text-[10px] text-ink-500 dark:text-dark-textSubtle bg-ink-50 dark:bg-dark-surfaceHover px-1.5 py-0.5 rounded">
                        #{t}
                      </span>
                    ))}
                  </div>

                  {expanded === m.id && (
                    <div className="text-xs text-ink-700 dark:text-dark-text leading-relaxed mt-2 pt-2 border-t border-ink-100 dark:border-dark-border">
                      {m.detail}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <button
                      onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                      className="text-[10px] text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text"
                    >
                      {expanded === m.id ? '收起' : '展开详情'}
                    </button>
                    {onPick && (
                      <button
                        onClick={() => onPick(m)}
                        className="text-[10px] px-2 py-1 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded hover:bg-ink-700 transition"
                      >
                        引用到"额外要求"
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}