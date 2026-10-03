'use client';

import { useState, useEffect } from 'react';
import { loadHistory, removeFromHistory, clearHistory, type HistoryEntry } from '@/lib/storage';
import type { AITraceScore } from '@/lib/ai-detector';

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (entry: HistoryEntry) => void;
};

const LEVEL_COLOR: Record<AITraceScore['level'], string> = {
  'human-like': 'text-emerald-600 bg-emerald-50',
  'slight-ai': 'text-amber-600 bg-amber-50',
  'obvious-ai': 'text-orange-600 bg-orange-50',
  'heavy-ai': 'text-red-600 bg-red-50'
};

function scoreToLevel(score: number): AITraceScore['level'] {
  if (score < 25) return 'human-like';
  if (score < 45) return 'slight-ai';
  if (score < 65) return 'obvious-ai';
  return 'heavy-ai';
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)} 天前`;
  return new Date(ms).toLocaleDateString('zh-CN');
}

export default function HistoryPanel({ open, onClose, onPick }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (open) setEntries(loadHistory());
  }, [open]);

  if (!open) return null;

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromHistory(id);
    setEntries(loadHistory());
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    clearHistory();
    setEntries([]);
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark-surface w-full max-w-md h-full overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-dark-surface border-b border-ink-100 dark:border-dark-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-semibold text-ink-800 dark:text-dark-text">📚 历史记录</h2>
            <p className="text-xs text-ink-400 dark:text-dark-textSubtle mt-0.5">
              最近 5 篇 · 本地存储
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text text-2xl leading-none"
            title="关闭"
          >
            ×
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="p-12 text-center text-ink-400 dark:text-dark-textSubtle">
            <div className="text-4xl mb-3">📝</div>
            <div className="text-sm">还没有生成过作文</div>
            <div className="text-xs mt-1">生成一篇会自动保存到这里</div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {entries.map(entry => {
              const level = scoreToLevel(entry.aiScore);
              return (
                <button
                  key={entry.id}
                  onClick={() => onPick(entry)}
                  className="w-full text-left p-3 border border-ink-200 dark:border-dark-borderLight rounded-lg hover:border-ink-400 dark:hover:bg-dark-surfaceHover transition group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-800 dark:text-dark-text truncate">
                        {entry.topic || '(无题)'}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-ink-500 dark:text-dark-textMuted">
                        <span className="font-mono">{entry.model.split('/').pop()}</span>
                        <span>·</span>
                        <span>{timeAgo(entry.savedAt)}</span>
                      </div>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${LEVEL_COLOR[level]}`}>
                      {entry.aiScore}
                    </span>
                  </div>
                  <div className="text-xs text-ink-600 dark:text-dark-textMuted line-clamp-2 leading-relaxed">
                    {entry.essay.slice(0, 120)}...
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-ink-400 dark:text-dark-textSubtle">
                      {entry.essay.length} 字
                    </span>
                    <span
                      onClick={e => handleDelete(entry.id, e)}
                      className="text-xs text-ink-400 dark:text-dark-textSubtle hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                    >
                      删除
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {entries.length > 0 && (
          <div className="sticky bottom-0 bg-white dark:bg-dark-surface border-t border-ink-100 dark:border-dark-border px-6 py-3">
            <button
              onClick={handleClear}
              className={`text-xs px-3 py-1.5 rounded transition ${
                confirmClear
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'text-ink-500 dark:text-dark-textMuted hover:text-red-600'
              }`}
            >
              {confirmClear ? '⚠️ 再点一次确认清空' : '清空全部'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}