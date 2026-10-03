'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { StyleDNA } from '@/lib/style-dna';
import type { StyleProfile } from '@/lib/style-extractor';
import type { AITraceScore } from '@/lib/ai-detector';
import { scoreAITrace } from '@/lib/ai-detector';
import { downloadDocx } from '@/lib/docx-export';
import { downloadMarkdown } from '@/lib/markdown-export';
import { downloadPdf } from '@/lib/pdf-export';
import ScorePredictor from '@/components/ScorePredictor';

type Props = {
  dna: StyleDNA;
  profile?: StyleProfile | null;
  result: GenerateResult;
  alternatives?: GenerateResult[];
  topic?: string;
  onRegenerate: () => void;
  onRestart: () => void;
  onPickAlternative?: (idx: number) => void;
};

type GenerateResult = {
  essay: string;
  model: string;
  aiScore: AITraceScore;
  durationMs: number;
  topic?: string;
  candidates?: GenerateResult[];
};

const LEVEL_LABEL: Record<AITraceScore['level'], string> = {
  'human-like': '像人写的',
  'slight-ai': '略有 AI 味',
  'obvious-ai': 'AI 味明显',
  'heavy-ai': 'AI 味很重'
};

const LEVEL_COLOR: Record<AITraceScore['level'], string> = {
  'human-like': 'text-emerald-600 bg-emerald-50 border-emerald-200',
  'slight-ai': 'text-amber-600 bg-amber-50 border-amber-200',
  'obvious-ai': 'text-orange-600 bg-orange-50 border-orange-200',
  'heavy-ai': 'text-red-600 bg-red-50 border-red-200'
};

export default function CompareStep({
  dna, profile, result, alternatives = [], topic, onRegenerate, onRestart, onPickAlternative
}: Props) {
  const [copied, setCopied] = useState(false);
  const [deAutoLoading, setDeAutoLoading] = useState(false);
  const [deAutoProgress, setDeAutoProgress] = useState('');
  const [deAutoError, setDeAutoError] = useState<string | null>(null);

  // 段落管理
  const initialSegments = useMemo(() => splitIntoSegments(result.essay), [result.essay]);
  const [segments, setSegments] = useState<string[]>(initialSegments);
  const [history, setHistory] = useState<string[][]>([]);

  const currentEssay = segments.join('\n\n');
  const currentScore = useMemo(() => scoreAITrace(currentEssay, dna), [segments, dna]);

  const handleSegmentRewrite = useCallback(async (idx: number, instruction: string) => {
    const prev = segments[idx - 1] || '';
    const next = segments[idx + 1] || '';
    const original = segments[idx];
    try {
      const res = await fetch('/api/rewrite-segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dna, profile, segment: original, instruction, prevContext: prev, nextContext: next })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '重写失败');
      setHistory(h => [...h.slice(-9), segments]);
      setSegments(s => s.map((seg, i) => i === idx ? data.newSegment : seg));
    } catch (e: any) {
      throw e;
    }
  }, [segments, dna, profile]);

  /**
   * 一键消除 AI 味（杀手锏）
   */
  const handleDeAuto = async () => {
    setDeAutoLoading(true);
    setDeAutoError(null);
    setDeAutoProgress('正在扫描 AI 痕迹...');
    try {
      setDeAutoProgress('并发重写所有可疑句...');
      const res = await fetch('/api/deauto-essay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dna, profile,
          essay: currentEssay,
          targetScore: 25,
          maxIterations: 3
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '处理失败');

      setHistory(h => [...h.slice(-9), segments]);
      // 用新 essay 重新分段
      setSegments(splitIntoSegments(data.essay));

      const iterCount = data.iterations || 0;
      setDeAutoProgress(
        iterCount === 0
          ? data.message || '已经达标'
          : `✅ ${data.message}（${iterCount} 轮）`
      );
      setTimeout(() => setDeAutoProgress(''), 5000);
    } catch (e: any) {
      setDeAutoError(e.message);
    } finally {
      setDeAutoLoading(false);
    }
  };

  const handleUndo = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setSegments(last);
      return h.slice(0, -1);
    });
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentEssay);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = currentEssay;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([currentEssay], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `essay-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDocx = () => {
    downloadDocx({ title: topic || '生成的作文', essay: currentEssay });
  };

  const handleDownloadMd = () => {
    downloadMarkdown({
      title: topic || '生成的作文',
      topic: topic || '',
      essay: currentEssay,
      metadata: { model: result.model, aiScore: currentScore.total }
    });
  };

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [scorePredictorOpen, setScorePredictorOpen] = useState(false);

  // v0.6.0: 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z: 撤销（如果有历史）
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && history.length > 0 && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Esc: 关闭弹窗
      if (e.key === 'Escape' && scorePredictorOpen) {
        setScorePredictorOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [history.length, scorePredictorOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    setPdfError(null);
    try {
      await downloadPdf({
        title: topic || '生成的作文',
        essay: currentEssay,
        metadata: { model: result.model, aiScore: currentScore.total }
      });
    } catch (e: any) {
      setPdfError(e.message || 'PDF 导出失败');
    } finally {
      setPdfLoading(false);
    }
  };

  // 从 result 中拿到最佳 essay（用于评分预测）
  const bestEssay = result.candidates?.[0]?.essay || result.essay || '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {scorePredictorOpen && (
        <ScorePredictor
          essay={bestEssay}
          topic={result.topic}
          onClose={() => setScorePredictorOpen(false)}
        />
      )}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white dark:bg-dark-surface rounded-2xl p-8 shadow-sm border border-ink-100 dark:border-dark-border">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold">{topic || '生成的作文'}</h2>
            <div className="flex items-center gap-3 text-xs text-ink-400 dark:text-dark-textSubtle">
              <span className="font-mono">{result.model.split('/').pop()}</span>
              <span>·</span>
              <span>{(result.durationMs / 1000).toFixed(1)}s</span>
            </div>
          </div>

          <div className="essay-text text-ink-800 dark:text-dark-text space-y-3">
            {segments.map((seg, i) => (
              <SegmentBlock
                key={i}
                segment={seg}
                index={i}
                flagged={currentScore.flaggedSentences}
                onRewrite={(instruction) => handleSegmentRewrite(i, instruction)}
              />
            ))}
          </div>

          {/* 杀手锏按钮 */}
          {currentScore.total > 25 && currentScore.flaggedSentences.length > 0 && (
            <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-amber-900 dark:text-amber-200">
                  <div className="font-medium">⚡ 检测到 {currentScore.flaggedSentences.length} 句 AI 味较重</div>
                  <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    当前 {currentScore.total} 分 · 一键重写所有可疑句，目标 ≤ 25 分
                  </div>
                </div>
                <button
                  onClick={handleDeAuto}
                  disabled={deAutoLoading}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-40 text-sm font-medium transition flex items-center gap-1"
                >
                  {deAutoLoading ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      处理中…
                    </>
                  ) : (
                    <>⚡ 一键消除 AI 味</>
                  )}
                </button>
              </div>
              {deAutoProgress && (
                <div className="mt-2 text-xs text-amber-800 dark:text-amber-300">{deAutoProgress}</div>
              )}
              {deAutoError && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{deAutoError}</div>
              )}
            </div>
          )}

          {currentScore.total <= 25 && currentScore.flaggedSentences.length === 0 && (
            <div className="mt-6 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 rounded-lg">
              <div className="text-sm text-emerald-900 dark:text-emerald-200 font-medium">
                ✅ AI 痕迹评分 {currentScore.total}（已达标）· 像人写的
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-ink-100 dark:border-dark-border flex items-center justify-between flex-wrap gap-3">
            <div className="text-xs text-ink-400 dark:text-dark-textSubtle">
              {currentEssay.length} 字 · {segments.length} 段 · 鼠标悬停段落可"重写这段"
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                className="px-3 py-1.5 rounded-lg text-xs border border-ink-200 dark:border-dark-borderLight hover:bg-ink-50 dark:hover:bg-dark-surfaceHover disabled:opacity-30 disabled:cursor-not-allowed text-ink-700 dark:text-dark-text transition"
              >
                ↶ 撤销 {history.length > 0 && `(${history.length})`}
              </button>
              <button
                onClick={handleCopy}
                className={`px-3 py-1.5 rounded-lg text-xs transition border ${
                  copied
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'border-ink-200 dark:border-dark-borderLight hover:bg-ink-50 dark:hover:bg-dark-surfaceHover text-ink-700 dark:text-dark-text'
                }`}
              >
                {copied ? '✓ 已复制' : '📋 复制'}
              </button>
              <button
                onClick={handleDownloadTxt}
                className="px-3 py-1.5 rounded-lg text-xs border border-ink-200 dark:border-dark-borderLight hover:bg-ink-50 dark:hover:bg-dark-surfaceHover text-ink-700 dark:text-dark-text transition"
              >
                💾 .txt
              </button>
              <button
                onClick={handleDownloadDocx}
                className="px-3 py-1.5 rounded-lg text-xs border border-ink-200 dark:border-dark-borderLight hover:bg-ink-50 dark:hover:bg-dark-surfaceHover text-ink-700 dark:text-dark-text transition"
              >
                📄 .docx
              </button>
              <button
                onClick={handleDownloadMd}
                className="px-3 py-1.5 rounded-lg text-xs border border-ink-200 dark:border-dark-borderLight hover:bg-ink-50 dark:hover:bg-dark-surfaceHover text-ink-700 dark:text-dark-text transition"
              >
                📝 .md
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="px-3 py-1.5 rounded-lg text-xs border border-ink-200 dark:border-dark-borderLight hover:bg-ink-50 dark:hover:bg-dark-surfaceHover text-ink-700 dark:text-dark-text disabled:opacity-40 transition"
                title={pdfError || 'PDF 导出（含中文字体）'}
              >
                {pdfLoading ? '...' : '📑 .pdf'}
              </button>
            </div>
          </div>
        </div>

        {alternatives.length > 0 && (
          <div className="bg-white dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-ink-100 dark:border-dark-border">
            <h3 className="text-sm font-medium text-ink-700 dark:text-dark-text mb-3">
              其他版本（{alternatives.length}） · 分数越低越像你
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {alternatives.map((alt, i) => (
                <button
                  key={i}
                  onClick={() => onPickAlternative?.(i)}
                  className="text-left p-3 border border-ink-200 dark:border-dark-borderLight rounded-lg hover:border-ink-400 dark:hover:bg-dark-surfaceHover transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-ink-500 dark:text-dark-textMuted">{alt.model.split('/').pop()}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${LEVEL_COLOR[alt.aiScore.level]}`}>
                      {alt.aiScore.total} 分
                    </span>
                  </div>
                  <div className="text-xs text-ink-600 dark:text-dark-textMuted line-clamp-4 leading-relaxed">
                    {alt.essay.slice(0, 120)}...
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onRegenerate}
            className="px-4 py-2 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded-lg hover:bg-ink-700 text-sm transition"
          >
            ↻ 重新生成
          </button>
          <button
            onClick={() => setScorePredictorOpen(true)}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm transition"
            title="Ctrl/Cmd + Z 撤销"
          >
            📊 评分预测
          </button>
          <button
            onClick={onRestart}
            className="px-4 py-2 text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text text-sm transition"
          >
            换一个题目
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <ScoreGauge score={currentScore} />
        <SignalsPanel score={currentScore} />
        {currentScore.flaggedSentences.length > 0 && (
          <FlaggedPanel
            sentences={currentScore.flaggedSentences}
            onRewriteOne={async (sentence) => {
              const idx = segments.findIndex(s => s.includes(sentence));
              if (idx >= 0) {
                await handleSegmentRewrite(idx, '让这句更自然、去除 AI 味');
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function SegmentBlock({
  segment, index, flagged, onRewrite
}: {
  segment: string;
  index: number;
  flagged: { sentence: string; reason: string }[];
  onRewrite: (instruction: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentences = segment.split(/(?<=[。！？!?；;])/g).filter(s => s.trim().length > 0);
  const flaggedMap = new Map(flagged.map(f => [f.sentence, f.reason]));

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await onRewrite(instruction);
      setEditing(false);
      setInstruction('');
    } catch (e: any) {
      setError(e.message || '重写失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="group relative border border-transparent hover:border-ink-200 dark:hover:border-dark-borderLight rounded-lg p-2 -mx-2 transition">
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition flex gap-1">
        <button
          onClick={() => setEditing(true)}
          disabled={loading}
          className="text-[10px] px-2 py-0.5 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded hover:bg-ink-700 disabled:opacity-40 transition"
        >
          ✏️ 重写这段
        </button>
      </div>

      <div>
        {sentences.map((s, i) => {
          const trimmed = s.trim();
          const reason = flaggedMap.get(trimmed);
          return (
            <span
              key={i}
              className={reason ? 'bg-red-100/60 dark:bg-red-900/40 rounded px-0.5' : ''}
              title={reason}
            >
              {s}
            </span>
          );
        })}
      </div>

      {editing && (
        <div className="mt-3 p-3 bg-ink-50 dark:bg-dark-surfaceHover rounded-lg border border-ink-200 dark:border-dark-borderLight space-y-2">
          <div className="text-xs text-ink-600 dark:text-dark-textMuted font-medium">重写第 {index + 1} 段</div>
          <div className="text-xs text-ink-500 dark:text-dark-textMuted bg-white dark:bg-dark-surface p-2 rounded border border-ink-100 dark:border-dark-borderLight max-h-20 overflow-y-auto">
            {segment}
          </div>
          <textarea
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder="想改成什么？（可空 — 让 AI 自由发挥）"
            className="w-full text-xs px-2 py-1.5 border border-ink-200 dark:border-dark-borderLight dark:bg-dark-surface rounded resize-none focus:outline-none focus:border-ink-800"
            rows={2}
            disabled={loading}
          />
          {error && <div className="text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded">{error}</div>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setEditing(false); setError(null); }}
              disabled={loading}
              className="text-xs px-3 py-1 text-ink-500 hover:text-ink-800 transition"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="text-xs px-3 py-1 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded hover:bg-ink-700 disabled:opacity-40 transition"
            >
              {loading ? '重写中…' : '🤖 让 AI 重写'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function splitIntoSegments(essay: string): string[] {
  return essay.split(/\n\s*\n+/).map(s => s.trim()).filter(s => s.length > 0);
}

function ScoreGauge({ score }: { score: AITraceScore }) {
  const pct = score.total;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;
  const strokeColor = score.total < 25 ? '#10b981' : score.total < 45 ? '#f59e0b' : score.total < 65 ? '#f97316' : '#ef4444';

  return (
    <div className="bg-white dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-ink-100 dark:border-dark-border">
      <h3 className="text-sm font-medium text-ink-700 dark:text-dark-text mb-4">
        AI 痕迹评分
        <span className="text-[10px] text-ink-400 dark:text-dark-textSubtle ml-2 font-normal">实时</span>
      </h3>
      <div className="flex items-center gap-4">
        <div className="relative">
          <svg width="140" height="140" className="transform -rotate-90">
            <circle cx="70" cy="70" r={radius} stroke="#ebebe7" strokeWidth="10" fill="none" />
            <circle
              cx="70" cy="70" r={radius}
              stroke={strokeColor} strokeWidth="10" fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-semibold" style={{ color: strokeColor }}>{score.total}</div>
            <div className="text-xs text-ink-400 dark:text-dark-textSubtle">/ 100</div>
          </div>
        </div>
        <div>
          <div className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${LEVEL_COLOR[score.level]}`}>
            {LEVEL_LABEL[score.level]}
          </div>
          <p className="text-xs text-ink-500 dark:text-dark-textMuted mt-2 leading-relaxed">
            分数越低越像你本人写的。<br />建议 &lt; 30 较安全。
          </p>
        </div>
      </div>
    </div>
  );
}

function SignalsPanel({ score }: { score: AITraceScore }) {
  const s = score.signals;
  return (
    <div className="bg-white dark:bg-dark-surface rounded-2xl p-5 shadow-sm border border-ink-100 dark:border-dark-border">
      <h3 className="text-sm font-medium text-ink-700 dark:text-dark-text mb-3">信号明细</h3>
      <div className="space-y-2 text-sm">
        <SignalBar label="AI 高频词" value={s.aiWordRatio} max={3} suffix="次/百字" invert />
        <SignalBar label="句首重复" value={s.sentenceStartRepeat} max={0.5} invert />
        <SignalBar label="词汇丰富度" value={s.vocabRichness} max={0.6} />
        <SignalBar label="段落可预测" value={s.structurePredictability} max={1} invert />
        <SignalBar label="文风匹配" value={s.styleConsistency} max={1} />
      </div>
      {s.aiWordHits.length > 0 && (
        <div className="mt-3 pt-3 border-t border-ink-100 dark:border-dark-border">
          <div className="text-xs text-ink-500 dark:text-dark-textMuted mb-1.5">命中的 AI 词</div>
          <div className="flex flex-wrap gap-1">
            {s.aiWordHits.slice(0, 6).map(h => (
              <span key={h.word} className="text-xs px-1.5 py-0.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
                {h.word} ×{h.count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FlaggedPanel({
  sentences, onRewriteOne
}: {
  sentences: { sentence: string; reason: string }[];
  onRewriteOne: (sentence: string) => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  return (
    <div className="bg-white dark:bg-dark-surface rounded-2xl p-5 shadow-sm border border-ink-100 dark:border-dark-border">
      <h3 className="text-sm font-medium text-ink-700 dark:text-dark-text mb-3">可疑句（{sentences.length}）</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {sentences.map((f, i) => (
          <div key={i} className="text-xs bg-red-50/50 dark:bg-red-900/20 rounded p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="text-ink-700 dark:text-dark-text">{f.sentence}</div>
                <div className="text-red-500 dark:text-red-400 mt-1">{f.reason}</div>
              </div>
              <button
                onClick={async () => {
                  setBusy(i);
                  try { await onRewriteOne(f.sentence); } finally { setBusy(null); }
                }}
                disabled={busy === i}
                className="text-[10px] px-2 py-1 bg-white dark:bg-dark-surface border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 rounded hover:bg-red-50 transition"
                title="重写这句"
              >
                {busy === i ? '...' : '✏️'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalBar({ label, value, max, suffix = '', invert }: {
  label: string; value: number; max: number; suffix?: string; invert?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const goodColor = invert ? '#10b981' : '#f59e0b';
  const badColor = invert ? '#ef4444' : '#10b981';
  const color = invert
    ? (pct < 0.3 ? goodColor : pct < 0.6 ? '#f59e0b' : badColor)
    : (pct > 0.7 ? goodColor : pct > 0.4 ? '#f59e0b' : badColor);

  return (
    <div>
      <div className="flex justify-between text-xs text-ink-500 dark:text-dark-textMuted mb-1">
        <span>{label}</span>
        <span className="font-mono text-ink-700 dark:text-dark-text">{value.toFixed(2)}{suffix}</span>
      </div>
      <div className="h-1.5 bg-ink-50 dark:bg-dark-surfaceHover rounded-full overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
    </div>
  );
}