'use client';

import { useState } from 'react';

type Prediction = {
  totalScore: number;
  maxScore: number;
  level: string;
  breakdown: { criteria: string; predictedScore: number; maxScore: number; reasoning: string }[];
  strengths: string[];
  weaknesses: string[];
  aiSuspect: boolean;
  aiSuspectReason?: string;
};

type Props = {
  essay: string;
  topic?: string;
  onClose: () => void;
};

const LEVEL_COLORS: Record<string, string> = {
  '一类文(优秀)': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  '二类文(良好)': 'text-blue-700 bg-blue-50 border-blue-200',
  '三类文(中等)': 'text-amber-700 bg-amber-50 border-amber-200',
  '四类文(及格)': 'text-orange-700 bg-orange-50 border-orange-200',
  '五类文(不及格)': 'text-red-700 bg-red-50 border-red-200'
};

export default function ScorePredictor({ essay, topic, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gradeLevel, setGradeLevel] = useState('高中');

  const handlePredict = async () => {
    if (essay.trim().length < 100) {
      setError('作文至少 100 字');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/predict-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          essay,
          gradeLevel
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '评分失败');
      setPrediction(data.prediction);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-dark-surface border-b border-ink-100 dark:border-dark-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-ink-800 dark:text-dark-text">📊 评分预测</h2>
          <button
            onClick={onClose}
            className="text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!prediction && (
            <div className="space-y-3">
              <p className="text-sm text-ink-600 dark:text-dark-textMuted">
                AI 会按评分标准逐项打分，预测总分 + 维度分解。
              </p>
              <div>
                <label className="text-xs text-ink-600 dark:text-dark-textMuted block mb-1">学段</label>
                <div className="flex gap-1.5">
                  {['初中', '高中', '大学'].map(s => (
                    <button
                      key={s}
                      onClick={() => setGradeLevel(s)}
                      className={`text-xs px-3 py-1 rounded transition ${
                        gradeLevel === s ? 'bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg' : 'bg-ink-100 dark:bg-dark-surfaceHover text-ink-600 dark:text-dark-text'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {topic && (
                <div className="text-xs text-ink-500 dark:text-dark-textMuted">
                  题目：{topic}
                </div>
              )}
              {error && (
                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">{error}</div>
              )}
              <button
                onClick={handlePredict}
                disabled={loading}
                className="w-full px-4 py-3 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded-lg hover:bg-ink-700 disabled:opacity-40 transition text-sm font-medium"
              >
                {loading ? '预测中（5-10 秒）…' : '🎯 开始预测'}
              </button>
            </div>
          )}

          {prediction && (
            <div className="space-y-4">
              {/* 总分 */}
              <div className="flex items-center justify-between p-4 bg-ink-50 dark:bg-dark-surfaceHover rounded-lg">
                <div>
                  <div className="text-xs text-ink-500 dark:text-dark-textMuted mb-1">预测总分</div>
                  <div className="text-3xl font-semibold text-ink-800 dark:text-dark-text">
                    {prediction.totalScore}
                    <span className="text-base text-ink-400 dark:text-dark-textSubtle"> / {prediction.maxScore}</span>
                  </div>
                </div>
                <span className={`text-sm px-3 py-1.5 rounded-full border ${LEVEL_COLORS[prediction.level] || 'text-ink-700 bg-ink-50 border-ink-200'}`}>
                  {prediction.level}
                </span>
              </div>

              {/* AI 嫌疑 */}
              {prediction.aiSuspect && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg">
                  <div className="text-sm font-medium text-amber-800 dark:text-amber-300">⚠️ AI 嫌疑</div>
                  <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    {prediction.aiSuspectReason}
                  </div>
                </div>
              )}

              {/* 维度分解 */}
              <div>
                <h3 className="text-sm font-medium text-ink-700 dark:text-dark-text mb-2">维度分解</h3>
                <div className="space-y-2">
                  {prediction.breakdown.map((b, i) => (
                    <div key={i} className="border border-ink-200 dark:border-dark-borderLight rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-ink-800 dark:text-dark-text">{b.criteria}</span>
                        <span className="text-sm font-mono text-ink-700 dark:text-dark-text">
                          {b.predictedScore} / {b.maxScore}
                        </span>
                      </div>
                      <p className="text-xs text-ink-600 dark:text-dark-textMuted leading-relaxed">{b.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 优缺点 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-emerald-200 dark:border-emerald-800/30 rounded-lg p-3 bg-emerald-50/50 dark:bg-emerald-900/10">
                  <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">👍 优点</div>
                  {prediction.strengths.map((s, i) => (
                    <div key={i} className="text-xs text-ink-700 dark:text-dark-text leading-relaxed">• {s}</div>
                  ))}
                </div>
                <div className="border border-orange-200 dark:border-orange-800/30 rounded-lg p-3 bg-orange-50/50 dark:bg-orange-900/10">
                  <div className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">⚠️ 不足</div>
                  {prediction.weaknesses.map((w, i) => (
                    <div key={i} className="text-xs text-ink-700 dark:text-dark-text leading-relaxed">• {w}</div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setPrediction(null)}
                className="w-full text-xs text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text transition"
              >
                重新预测
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}