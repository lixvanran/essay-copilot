'use client';

import { useState, useEffect, useRef } from 'react';
import { listProfiles, saveProfile, loadProfile, deleteProfile, type StyleProfile_ } from '@/lib/profile-db';
import type { StyleDNA } from '@/lib/style-dna';
import type { StyleProfile } from '@/lib/style-extractor';

type Props = {
  current: { id?: string; dna: StyleDNA; profile: StyleProfile | null; samples: string[] };
  onSwitch: (profile: StyleProfile_) => void;
  onSave: (name: string, type: StyleProfile_['type']) => Promise<void>;
};

const TYPE_LABEL = {
  argument: '议论文',
  narrative: '记叙文',
  lyric: '散文',
  other: '其他'
};

const TYPE_COLOR = {
  argument: 'bg-blue-100 text-blue-700',
  narrative: 'bg-pink-100 text-pink-700',
  lyric: 'bg-purple-100 text-purple-700',
  other: 'bg-ink-100 text-ink-700'
};

export default function ProfileSelector({ current, onSwitch, onSave }: Props) {
  const [profiles, setProfiles] = useState<StyleProfile_[]>([]);
  const [open, setOpen] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveType, setSaveType] = useState<StyleProfile_['type']>('argument');
  const [activeId, setActiveId] = useState<string | undefined>(current.id);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = async () => setProfiles(await listProfiles());

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    await onSave(saveName.trim(), saveType);
    setSaveDialog(false);
    setSaveName('');
    await refresh();
  };

  const handleSwitch = async (id: string) => {
    const p = await loadProfile(id);
    if (p) {
      setActiveId(p.id);
      onSwitch(p);
      setOpen(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除这个风格档案？')) return;
    await deleteProfile(id);
    await refresh();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="text-xs px-3 py-1.5 rounded-lg border border-ink-200 dark:border-dark-borderLight hover:bg-ink-50 dark:hover:bg-dark-surfaceHover transition flex items-center gap-1"
      >
        📚 {profiles.find(p => p.id === activeId)?.name || '当前范文'}
        <span className="text-ink-400">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-dark-surface border border-ink-200 dark:border-dark-borderLight rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            {profiles.length === 0 ? (
              <div className="text-xs text-ink-400 dark:text-dark-textSubtle text-center py-4">
                还没有保存的风格档案
              </div>
            ) : (
              profiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSwitch(p.id)}
                  className={`w-full text-left px-2 py-2 rounded hover:bg-ink-50 dark:hover:bg-dark-surfaceHover transition flex items-center justify-between gap-2 group ${
                    activeId === p.id ? 'bg-ink-50 dark:bg-dark-surfaceHover' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-800 dark:text-dark-text truncate">{p.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_COLOR[p.type]}`}>
                        {TYPE_LABEL[p.type]}
                      </span>
                      <span className="text-[10px] text-ink-400 dark:text-dark-textSubtle">
                        {p.samples.length} 篇
                      </span>
                    </div>
                  </div>
                  <span
                    onClick={e => handleDelete(p.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-700 transition"
                  >
                    删除
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-ink-100 dark:border-dark-border p-2">
            <button
              onClick={() => setSaveDialog(true)}
              className="w-full text-xs px-3 py-1.5 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded hover:bg-ink-700 transition"
            >
              💾 把当前范文存为新档案
            </button>
          </div>
        </div>
      )}

      {saveDialog && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-dark-surface border border-ink-200 dark:border-dark-borderLight rounded-lg shadow-lg z-50 p-3">
          <div className="text-xs font-medium text-ink-800 dark:text-dark-text mb-2">保存当前为新档案</div>
          <input
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            placeholder="档案名称（如：议论文高分范本）"
            className="w-full text-xs px-2 py-1.5 border border-ink-200 dark:border-dark-borderLight dark:text-dark-text rounded mb-2"
            autoFocus
          />
          <div className="flex gap-1 flex-wrap mb-3">
            {(['argument', 'narrative', 'lyric', 'other'] as const).map(t => (
              <button
                key={t}
                onClick={() => setSaveType(t)}
                className={`text-[10px] px-2 py-0.5 rounded ${
                  saveType === t ? 'bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg' : 'bg-ink-100 dark:bg-dark-surfaceHover text-ink-600 dark:text-dark-text'
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setSaveDialog(false); setSaveName(''); }}
              className="text-xs px-3 py-1 text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!saveName.trim()}
              className="text-xs px-3 py-1 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded hover:bg-ink-700 disabled:opacity-40 transition"
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}