'use client';

import { useState } from 'react';
import type { StyleDNA } from '@/lib/style-dna';
import type { StyleProfile } from '@/lib/style-extractor';
import type { AITraceScore } from '@/lib/ai-detector';
import DNACard from '@/components/DNACard';
import { scoreAITrace } from '@/lib/ai-detector';
import { addToHistory } from '@/lib/storage';

type OutlineParagraph = {
  role: 'opening' | 'body' | 'turn' | 'climax' | 'ending';
  title: string;
  keyPoints: string[];
  evidence?: string[];
  rhetoricalDevices?: string[];
};

type Outline = {
  thesis: string;
  paragraphs: OutlineParagraph[];
  warnings?: string[];
};

type Props = {
  data: {
    dna: StyleDNA;
    profile: StyleProfile | null;
    profileError: string | null;
    samples: string[];
  };
  topic: string;
  onGenerated: (r: GenerateResult) => void;
  onBack: () => void;
};

type GenerateResult = {
  essay: string;
  model: string;
  aiScore: AITraceScore;
  durationMs: number;
};

const ROLE_LABEL: Record<OutlineParagraph['role'], string> = {
  opening: '开篇',
  body: '展开',
  turn: '转折',
  climax: '高潮',
  ending: '结尾'
};

const ROLE_COLOR: Record<OutlineParagraph['role'], string> = {
  opening: 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20',
  body: 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20',
  turn: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20',
  climax: 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20',
  ending: 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20'
};

export default function OutlineStep({ data, topic, onGenerated, onBack }: Props) {
  const { dna, profile } = data;
  const [outlineMode, setOutlineMode] = useState<'simple' | 'detailed'>('detailed');
  const [outline, setOutline] = useState<Outline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateOutline = async () => {
    if (!topic.trim()) {
      setError('请填写作文题');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dna, profile,
          topic: topic.trim(),
          mode: outlineMode,
          model: 'moonshotai/kimi-k2'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '大纲生成失败');
      setOutline(data.outline);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExpandToEssay = async () => {
    if (!outline) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/outline-to-essay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dna, profile,
          topic: topic.trim(),
          outline,
          targetLength: 800,
          model: 'moonshotai/kimi-k2'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '展开失败');

      const aiScore = scoreAITrace(data.essay, dna);
      const result: GenerateResult = {
        essay: data.essay,
        model: data.model,
        aiScore,
        durationMs: data.durationMs
      };
      addToHistory({
        id: Date.now().toString(),
        essay: result.essay,
        topic: topic.trim(),
        model: result.model,
        aiScore: result.aiScore.total,
        savedAt: Date.now()
      });
      onGenerated(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <DNACard dna={dna} profile={profile} profileError={data.profileError} />

        <div className="bg-white dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-ink-100 dark:border-dark-border">
          <h3 className="text-sm font-medium text-ink-700 dark:text-dark-text mb-3">题目</h3>
          <div className="text-base text-ink-800 dark:text-dark-text">{topic || '(未填)'}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-surface rounded-2xl p-8 shadow-sm border border-ink-100 dark:border-dark-border space-y-5">
        <div>
          <h2 className="text-2xl font-semibold mb-1">📝 大纲模式</h2>
          <p className="text-ink-500 dark:text-dark-textMuted text-sm">
            先列大纲（立意 + 段落 + 论据），再展开成全文。
          </p>
        </div>

        {!outline && (
          <div>
            <label className="text-sm text-ink-700 dark:text-dark-text block mb-2">大纲详细度</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOutlineMode('simple')}
                className={`p-3 rounded-lg border text-left transition ${
                  outlineMode === 'simple'
                    ? 'border-ink-800 dark:border-dark-text bg-ink-50 dark:bg-dark-surfaceHover'
                    : 'border-ink-200 dark:border-dark-borderLight'
                }`}
              >
                <div className="text-sm font-medium text-ink-800 dark:text-dark-text">简化</div>
                <div className="text-[11px] text-ink-500 dark:text-dark-textMuted">每段 1-2 要点，适合时间紧</div>
              </button>
              <button
                onClick={() => setOutlineMode('detailed')}
                className={`p-3 rounded-lg border text-left transition ${
                  outlineMode === 'detailed'
                    ? 'border-ink-800 dark:border-dark-text bg-ink-50 dark:bg-dark-surfaceHover'
                    : 'border-ink-200 dark:border-dark-borderLight'
                }`}
              >
                <div className="text-sm font-medium text-ink-800 dark:text-dark-text">详细</div>
                <div className="text-[11px] text-ink-500 dark:text-dark-textMuted">每段 2-3 要点 + 具体论据</div>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md">{error}</div>
        )}

        {!outline && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={onBack}
              disabled={loading}
              className="px-4 py-2.5 text-sm text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text transition"
            >
              ← 返回
            </button>
            <button
              onClick={handleGenerateOutline}
              disabled={loading}
              className="flex-1 px-6 py-2.5 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded-lg hover:bg-ink-700 disabled:opacity-40 transition text-sm font-medium"
            >
              {loading ? '生成大纲中…' : '✨ 生成大纲'}
            </button>
          </div>
        )}

        {outline && (
          <div className="space-y-4">
            {/* 立意 */}
            <div className="p-4 bg-ink-50 dark:bg-dark-surfaceHover rounded-lg border-l-4 border-ink-800 dark:border-dark-text">
              <div className="text-xs text-ink-500 dark:text-dark-textMuted mb-1">立意</div>
              <div className="text-base font-medium text-ink-800 dark:text-dark-text">{outline.thesis}</div>
            </div>

            {/* 警示 */}
            {outline.warnings && outline.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg">
                <div className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">⚠️ AI 的警示</div>
                {outline.warnings.map((w, i) => (
                  <div key={i} className="text-xs text-amber-700 dark:text-amber-400">• {w}</div>
                ))}
              </div>
            )}

            {/* 段落 */}
            <div className="space-y-2">
              {outline.paragraphs.map((p, i) => (
                <div key={i} className={`p-3 rounded-lg border ${ROLE_COLOR[p.role]}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white dark:bg-dark-surface text-ink-700 dark:text-dark-text">
                        {i + 1}
                      </span>
                      <span className="text-xs font-medium text-ink-800 dark:text-dark-text">{p.title}</span>
                    </div>
                    <span className="text-[10px] text-ink-500 dark:text-dark-textMuted">
                      {ROLE_LABEL[p.role]}
                    </span>
                  </div>
                  <ul className="space-y-0.5 mt-1.5">
                    {p.keyPoints.map((kp, j) => (
                      <li key={j} className="text-xs text-ink-700 dark:text-dark-text leading-relaxed">· {kp}</li>
                    ))}
                  </ul>
                  {p.evidence && p.evidence.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-ink-200/50 dark:border-dark-border/50">
                      <div className="text-[10px] text-ink-500 dark:text-dark-textMuted mb-0.5">可用论据：</div>
                      {p.evidence.map((e, j) => (
                        <div key={j} className="text-xs text-ink-600 dark:text-dark-textMuted italic">· {e}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-3 border-t border-ink-100 dark:border-dark-border">
              <button
                onClick={() => setOutline(null)}
                disabled={loading}
                className="px-4 py-2 text-sm text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text transition"
              >
                重新出大纲
              </button>
              <button
                onClick={handleExpandToEssay}
                disabled={loading}
                className="flex-1 px-6 py-2.5 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded-lg hover:bg-ink-700 disabled:opacity-40 transition text-sm font-medium"
              >
                {loading ? '展开中…' : '🚀 按大纲展开成全文 →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}