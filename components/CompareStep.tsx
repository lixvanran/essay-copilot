'use client';

import type { StyleDNA } from '@/lib/style-dna';
import type { AITraceScore } from '@/lib/ai-detector';

type Props = {
  dna: StyleDNA;
  result: {
    essay: string;
    model: string;
    aiScore: AITraceScore;
    durationMs: number;
  };
  onRegenerate: () => void;
  onRestart: () => void;
};

const LEVEL_LABEL: Record<AITraceScore['level'], string> = {
  'human-like': '像人写的',
  'slight-ai': '略有 AI 味',
  'obvious-ai': 'AI 味明显',
  'heavy-ai': 'AI 味很重'
};

const LEVEL_COLOR: Record<AITraceScore['level'], string> = {
  'human-like': 'text-emerald-600 bg-emerald-50',
  'slight-ai': 'text-amber-600 bg-amber-50',
  'obvious-ai': 'text-orange-600 bg-orange-50',
  'heavy-ai': 'text-red-600 bg-red-50'
};

export default function CompareStep({ dna, result, onRegenerate, onRestart }: Props) {
  const score = result.aiScore;
  const flaggedSet = new Set(score.flaggedSentences.map(f => f.sentence));

  // 把作文按句切，标红可疑句
  const sentences = result.essay.split(/(?<=[。！？!?；;])/g).filter(s => s.trim().length > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-ink-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">生成的作文</h2>
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <span>{result.model}</span>
              <span>·</span>
              <span>{(result.durationMs / 1000).toFixed(1)}s</span>
            </div>
          </div>
          <div className="essay-text text-ink-800">
            {sentences.map((s, i) => {
              const trimmed = s.trim();
              const flagged = flaggedSet.has(trimmed);
              const flagInfo = score.flaggedSentences.find(f => f.sentence === trimmed);
              return (
                <span
                  key={i}
                  className={flagged ? 'bg-red-100/60 rounded px-0.5' : ''}
                  title={flagInfo ? flagInfo.reason : undefined}
                >
                  {s}
                </span>
              );
            })}
          </div>
          <div className="mt-6 pt-4 border-t border-ink-100 text-xs text-ink-400">
            总字数 {result.essay.length} · 标红处为 AI 痕迹可疑句（hover 查看原因）
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onRegenerate}
            className="px-4 py-2 bg-ink-800 text-ink-50 rounded-lg hover:bg-ink-700 text-sm transition"
          >
            ↻ 重新生成
          </button>
          <button
            onClick={onRestart}
            className="px-4 py-2 text-ink-500 hover:text-ink-800 text-sm transition"
          >
            换一个题目
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <ScoreGauge score={score} />

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-ink-100">
          <h3 className="text-sm font-medium text-ink-700 mb-3">信号明细</h3>
          <div className="space-y-2 text-sm">
            <SignalBar label="AI 高频词" value={score.signals.aiWordRatio} max={3} suffix="次/百字" invert />
            <SignalBar label="句首重复" value={score.signals.sentenceStartRepeat} max={0.5} suffix="" invert />
            <SignalBar label="词汇丰富度" value={score.signals.vocabRichness} max={0.6} suffix="" />
            <SignalBar label="段落可预测" value={score.signals.structurePredictability} max={1} suffix="" invert />
            <SignalBar label="文风匹配" value={score.signals.styleConsistency} max={1} suffix="" />
          </div>
          {score.signals.aiWordHits.length > 0 && (
            <div className="mt-3 pt-3 border-t border-ink-100">
              <div className="text-xs text-ink-500 mb-1.5">命中的 AI 词</div>
              <div className="flex flex-wrap gap-1">
                {score.signals.aiWordHits.slice(0, 6).map(h => (
                  <span key={h.word} className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded">
                    {h.word} ×{h.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {score.flaggedSentences.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-ink-100">
            <h3 className="text-sm font-medium text-ink-700 mb-3">可疑句（{score.flaggedSentences.length}）</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {score.flaggedSentences.map((f, i) => (
                <div key={i} className="text-xs bg-red-50/50 rounded p-2">
                  <div className="text-ink-700">{f.sentence}</div>
                  <div className="text-red-500 mt-1">{f.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreGauge({ score }: { score: AITraceScore }) {
  const pct = score.total;
  const levelClass = LEVEL_COLOR[score.level];
  const levelLabel = LEVEL_LABEL[score.level];
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;
  const strokeColor = score.total < 25 ? '#10b981' : score.total < 45 ? '#f59e0b' : score.total < 65 ? '#f97316' : '#ef4444';

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-ink-100">
      <h3 className="text-sm font-medium text-ink-700 mb-4">AI 痕迹评分</h3>
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
            <div className="text-xs text-ink-400">/ 100</div>
          </div>
        </div>
        <div>
          <div className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${levelClass}`}>
            {levelLabel}
          </div>
          <p className="text-xs text-ink-500 mt-2 leading-relaxed">
            分数越低越像你本人写的。<br />
            建议 &lt; 30 较安全。
          </p>
        </div>
      </div>
    </div>
  );
}

function SignalBar({ label, value, max, suffix, invert }: {
  label: string; value: number; max: number; suffix: string; invert?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const goodColor = invert ? '#10b981' : '#f59e0b';
  const badColor = invert ? '#ef4444' : '#10b981';
  const color = invert
    ? (pct < 0.3 ? goodColor : pct < 0.6 ? '#f59e0b' : badColor)
    : (pct > 0.7 ? goodColor : pct > 0.4 ? '#f59e0b' : badColor);

  return (
    <div>
      <div className="flex justify-between text-xs text-ink-500 mb-1">
        <span>{label}</span>
        <span className="font-mono text-ink-700">{value.toFixed(2)}{suffix}</span>
      </div>
      <div className="h-1.5 bg-ink-50 rounded-full overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
    </div>
  );
}
