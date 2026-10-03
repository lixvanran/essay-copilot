'use client';

import { useState, useEffect } from 'react';
import { listFavorites, deleteFavorite, type FavoriteTopic } from '@/lib/profile-db';

type Props = {
  onPick?: (topic: string) => void;
  onClose: () => void;
};

export default function FavoritesPanel({ onPick, onClose }: Props) {
  const [favorites, setFavorites] = useState<FavoriteTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTopic, setNewTopic] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setFavorites(await listFavorites());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAdd = async () => {
    if (!newTopic.trim()) return;
    const { addFavorite } = await import('@/lib/profile-db');
    await addFavorite(newTopic.trim(), undefined, newNotes.trim() || undefined);
    setNewTopic('');
    setNewNotes('');
    setAdding(false);
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这条收藏？')) return;
    await deleteFavorite(id);
    refresh();
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-white dark:bg-dark-surface w-full max-w-md h-full overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-dark-surface border-b border-ink-100 dark:border-dark-border px-6 py-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-ink-800 dark:text-dark-text">⭐ 收藏的题目</h2>
            <button onClick={onClose} className="text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text text-2xl leading-none">×</button>
          </div>
          <button
            onClick={() => setAdding(!adding)}
            className="text-xs px-3 py-1.5 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded hover:bg-ink-700 transition"
          >
            {adding ? '取消' : '+ 添加题目'}
          </button>
        </div>

        {adding && (
          <div className="px-6 py-3 bg-ink-50 dark:bg-dark-surfaceHover border-b border-ink-100 dark:border-dark-border">
            <input
              value={newTopic}
              onChange={e => setNewTopic(e.target.value)}
              placeholder="作文题目"
              className="w-full text-sm px-3 py-2 border border-ink-200 dark:border-dark-borderLight dark:bg-dark-surface dark:text-dark-text rounded mb-2 focus:outline-none focus:border-ink-800"
            />
            <input
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              placeholder="备注（可选）"
              className="w-full text-xs px-3 py-1.5 border border-ink-200 dark:border-dark-borderLight dark:bg-dark-surface dark:text-dark-text rounded mb-2 focus:outline-none focus:border-ink-800"
            />
            <button onClick={handleAdd} className="w-full text-xs px-3 py-2 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded hover:bg-ink-700 transition">
              保存
            </button>
          </div>
        )}

        <div className="p-4">
          {loading ? (
            <div className="text-center text-ink-400 dark:text-dark-textSubtle text-sm py-8">加载中…</div>
          ) : favorites.length === 0 ? (
            <div className="text-center text-ink-400 dark:text-dark-textSubtle text-sm py-12">
              还没有收藏的题目
              <div className="text-xs mt-1">点击右上"+ 添加题目"开始</div>
            </div>
          ) : (
            <div className="space-y-2">
              {favorites.map(f => (
                <div key={f.id} className="border border-ink-200 dark:border-dark-borderLight rounded-lg p-3 hover:border-ink-400 dark:hover:bg-dark-surfaceHover transition">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-800 dark:text-dark-text">{f.topic}</p>
                      {f.notes && (
                        <p className="text-xs text-ink-500 dark:text-dark-textMuted mt-1">{f.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(f.id)}
                      className="text-xs text-ink-400 dark:text-dark-textSubtle hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-ink-400 dark:text-dark-textSubtle">
                      {new Date(f.savedAt).toLocaleDateString('zh-CN')}
                    </span>
                    {onPick && (
                      <button
                        onClick={() => { onPick(f.topic); onClose(); }}
                        className="text-[10px] px-2 py-0.5 bg-ink-100 dark:bg-dark-surfaceHover text-ink-700 dark:text-dark-text rounded hover:bg-ink-200"
                      >
                        用这个题目
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