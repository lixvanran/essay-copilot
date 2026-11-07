'use client';

import { useTheme } from '@/lib/use-theme';

type Props = { onReset?: () => void; onShowHistory?: () => void; historyCount?: number };

export default function Header({ onReset, onShowHistory, historyCount }: Props) {
  const [theme, toggle] = useTheme();

  return (
    <header className="border-b border-ink-100 dark:border-dark-border bg-white/80 dark:bg-dark-bg/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            作文副驾驶
            <span className="text-ink-400 dark:text-dark-textSubtle font-normal text-sm">· Style Co-Pilot</span>
            <span className="text-[10px] text-ink-400 dark:text-dark-textSubtle border border-ink-200 dark:border-dark-borderLight rounded px-1.5 py-0.5 font-mono">v0.6.1</span>
          </h1>
          <p className="text-xs text-ink-400 dark:text-dark-textSubtle mt-0.5">不是写得最好，而是写得最像你</p>
        </div>
        <div className="flex items-center gap-2">
          {onShowHistory && (
            <button
              onClick={onShowHistory}
              className="text-sm px-2.5 py-1.5 rounded-md hover:bg-ink-50 dark:hover:bg-dark-surfaceHover transition relative"
              title="历史记录"
            >
              📚
              {historyCount !== undefined && historyCount > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded-full w-4 h-4 flex items-center justify-center">
                  {historyCount}
                </span>
              )}
            </button>
          )}
          <button
            onClick={toggle}
            className="text-sm px-2.5 py-1.5 rounded-md hover:bg-ink-50 dark:hover:bg-dark-surfaceHover transition"
            title={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          {onReset && (
            <button
              onClick={onReset}
              className="text-sm text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text px-3 py-1.5 rounded-md hover:bg-ink-50 dark:hover:bg-dark-surfaceHover transition"
            >
              重新开始
            </button>
          )}
        </div>
      </div>
    </header>
  );
}