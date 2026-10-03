'use client';

import { useState, useEffect } from 'react';
import type { StyleDNA } from '@/lib/style-dna';
import type { StyleProfile } from '@/lib/style-extractor';
import type { AITraceScore } from '@/lib/ai-detector';
import DNACard from '@/components/DNACard';
import MaterialsPanel from '@/components/MaterialsPanel';
import FavoritesPanel from '@/components/FavoritesPanel';
import { topicsByCategory, type TopicCategory } from '@/lib/topics';
import { addToHistory } from '@/lib/storage';

type Props = {
  data: {
    dna: StyleDNA;
    profile: StyleProfile | null;
    profileError: string | null;
    samples: string[];
  };
  onGenerated: (r: GenerateResult, alternatives?: GenerateResult[]) => void;
  onSwitchToOutline?: (topic: string) => void;
  onBack: () => void;
};

type GenerateResult = {
  essay: string;
  model: string;
  aiScore: AITraceScore;
  durationMs: number;
};

const MODEL_OPTIONS = [
  { value: '', label: '自动 fallback（推荐 · 国产优先）' },
  { value: 'moonshotai/kimi-k2', label: '⭐ Kimi K2（中文写作实测最佳）' },
  { value: 'deepseek/deepseek-chat', label: 'DeepSeek V3（速度最快）' },
  { value: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B' },
  { value: 'qwen/qwen-2.5-32b-instruct', label: 'Qwen 2.5 32B' },
  { value: 'qwen/qwen-2.5-14b-instruct', label: 'Qwen 2.5 14B（更快）' }
];

const COMPARE_MODELS = [
  'moonshotai/kimi-k2',
  'deepseek/deepseek-chat',
  'qwen/qwen-2.5-72b-instruct'
];

const GRADE_OPTIONS = [
  { value: '初中', label: '初中' },
  { value: '高中', label: '高中' },
  { value: '大学', label: '大学' }
];

export default function GenerateStep({ data, onGenerated, onSwitchToOutline, onBack }: Props) {
  const { dna, profile, samples } = data;
  const [topic, setTopic] = useState('');
  const [requirements, setRequirements] = useState('');
  const [showMaterials, setShowMaterials] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);

  // v0.6.0 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter: 触发生成（如果有 topic 且非 loading）
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const btn = document.querySelector<HTMLButtonElement>('[data-generate-btn]');
        if (btn && !btn.disabled) btn.click();
      }
      // Ctrl/Cmd + K: 打开素材库
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (topic.trim()) setShowMaterials(s => !s);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [topic]);
  const [model, setModel] = useState('');
  const [mode, setMode] = useState<'multi' | 'compare' | 'single'>('compare');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showAITopicGen, setShowAITopicGen] = useState(false);

  const grouped = topicsByCategory();

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('请填写作文题');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      let best: GenerateResult | null = null;
      let alternatives: GenerateResult[] = [];

      if (mode === 'compare') {
        setProgress('正在并发跑 3 个模型（DeepSeek / Qwen / Kimi）...');
        const promises = COMPARE_MODELS.map(m =>
          fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dna, profile,
              topic: topic.trim(),
              requirements: requirements.trim() || undefined,
              model: m,
              multiSample: false
            })
          }).then(r => r.json().then(d => ({ model: m, result: d })))
        );
        const results = await Promise.allSettled(promises);
        const successes = results
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map(r => r.value)
          .filter(v => v.result?.result?.essay);

        if (successes.length === 0) {
          const failures = results
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            .map(r => r.reason?.message || '未知错误');
          throw new Error('3 个模型都失败了：' + failures.join(' | '));
        }

        successes.sort((a, b) => a.result.result.aiScore.total - b.result.result.aiScore.total);
        const top = successes[0].result.result;
        best = top;
        alternatives = successes.slice(1).map(s => s.result.result);

        setProgress(`✅ 对比完成 · 最佳 ${top.aiScore.total} 分（${top.model.split('/').pop()}）`);
      } else {
        const label = mode === 'multi' ? '3 选 1（多采样）' : '单篇';
        setProgress(`正在生成（${label}）...`);
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dna, profile,
            topic: topic.trim(),
            requirements: requirements.trim() || undefined,
            model: model || undefined,
            multiSample: mode === 'multi',
            attempts: mode === 'multi' ? 3 : 1
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(friendlyError(data.error, data.detail));
        const r = data.result;
        best = r;
        if (mode === 'multi' && data.alternatives) {
          alternatives = data.alternatives;
          setProgress(`✅ 生成 3 篇，挑出 AI 味最低的（${r.aiScore.total} 分）`);
        } else {
          setProgress(`✅ 生成完成（${r.aiScore.total} 分）`);
        }
      }

      if (best) {
        addToHistory({
          id: Date.now().toString(),
          essay: best.essay,
          topic: topic.trim(),
          model: best.model,
          aiScore: best.aiScore.total,
          savedAt: Date.now()
        });
        onGenerated(best, alternatives);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const friendlyError = (msg?: string, detail?: string): string => {
    if (!msg) return '生成失败';
    if (/OPENROUTER_API_KEY.*not configured/.test(msg)) {
      return '⚠️ OpenRouter Key 没配置。请回上一步展开"OpenRouter API Key"填入。';
    }
    if (/placeholder/i.test(msg)) {
      return '⚠️ OpenRouter Key 是占位符。回上一步填入真实 key。';
    }
    if (/balance|402|fund/i.test(msg)) {
      return '💰 OpenRouter 账户余额不足。充值：openrouter.ai/credits';
    }
    if (/401|invalid.*key/i.test(msg)) {
      return '🔑 OpenRouter Key 无效。检查是否复制完整。';
    }
    if (/429|rate.*limit/i.test(msg)) {
      return '⏱️ 请求太快了。稍等几秒再试。';
    }
    if (detail) return `${msg}（${detail.slice(0, 120)}）`;
    return msg;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <DNACard dna={dna} profile={profile} profileError={data.profileError} />

        <div className="bg-white dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-ink-100 dark:border-dark-border">
          <h3 className="text-sm font-medium text-ink-700 dark:text-dark-text mb-3">范文样本（{samples.length} 篇）</h3>
          <details className="text-xs text-ink-500 dark:text-dark-textMuted">
            <summary className="cursor-pointer hover:text-ink-800 dark:hover:text-dark-text">查看原文</summary>
            <div className="mt-2 space-y-3 max-h-64 overflow-y-auto">
              {samples.map((s, i) => (
                <div key={i} className="bg-ink-50 dark:bg-dark-surfaceHover rounded p-3 leading-relaxed">
                  <div className="text-ink-400 dark:text-dark-textSubtle mb-1">样本 {i + 1} · {s.length} 字</div>
                  <div className="text-ink-700 dark:text-dark-text whitespace-pre-wrap line-clamp-6">{s}</div>
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-surface rounded-2xl p-8 shadow-sm border border-ink-100 dark:border-dark-border space-y-5">
        <div>
          <h2 className="text-2xl font-semibold mb-1">第二步：让 AI 替你写</h2>
          <p className="text-ink-500 dark:text-dark-textMuted text-sm">填个题目，AI 会按你的文风写一篇。</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-ink-700 dark:text-dark-text block">作文题</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFavorites(true)}
                className="text-xs text-ink-500 hover:text-ink-800 dark:text-dark-textMuted dark:hover:text-dark-text transition"
              >
                收藏夹
              </button>
              <button
                onClick={() => setShowAITopicGen(!showAITopicGen)}
                className="text-xs text-ink-500 hover:text-ink-800 dark:text-dark-textMuted dark:hover:text-dark-text transition"
              >
                {showAITopicGen ? '✕ 关闭 AI 出题' : '🪄 AI 出题'}
              </button>
            </div>
          </div>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="例：那一刻，我长大了"
            className="w-full px-4 py-2.5 border border-ink-200 dark:border-dark-borderLight dark:bg-dark-surfaceHover rounded-lg text-sm focus:outline-none focus:border-ink-800 dark:focus:border-dark-text"
          />
          {showAITopicGen && <AITopicGenerator onPick={t => { setTopic(t); setShowAITopicGen(false); }} />}
          {!showAITopicGen && (
            <div className="mt-3 space-y-2">
              {(Object.keys(grouped) as TopicCategory[]).map(cat => (
                <div key={cat}>
                  <div className="text-[10px] text-ink-400 dark:text-dark-textSubtle uppercase tracking-wider mb-1">{cat}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {grouped[cat].slice(0, 8).map(t => (
                      <button
                        key={t.topic}
                        onClick={() => setTopic(t.topic)}
                        className="text-xs px-2.5 py-1 bg-ink-50 dark:bg-dark-surfaceHover hover:bg-ink-100 dark:hover:bg-dark-surface text-ink-600 dark:text-dark-textMuted rounded-full transition"
                        title={t.brief || ''}
                      >
                        {t.topic}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-ink-700 dark:text-dark-text">额外要求 <span className="text-ink-400">（可选）</span></label>
            <button
              onClick={() => setShowMaterials(true)}
              disabled={!topic.trim()}
              className="text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 hover:bg-amber-200 transition disabled:opacity-40"
            >
              📚 打开素材库
            </button>
          </div>
          <textarea
            value={requirements}
            onChange={e => setRequirements(e.target.value)}
            placeholder="比如：要写记叙文、要有具体细节、800 字左右..."
            className="w-full px-4 py-2.5 border border-ink-200 dark:border-dark-borderLight dark:bg-dark-surfaceHover rounded-lg text-sm focus:outline-none focus:border-ink-800 dark:focus:border-dark-text h-20 resize-none"
          />
        </div>

        {showMaterials && (
          <MaterialsPanel
            topic={topic}
            onPick={m => {
              setRequirements(prev => {
                const cite = `[素材：${m.title} - ${m.brief}]`;
                return prev ? `${prev}\n${cite}` : cite;
              });
              setShowMaterials(false);
            }}
            onClose={() => setShowMaterials(false)}
          />
        )}

        {showFavorites && (
          <FavoritesPanel
            onPick={t => setTopic(t)}
            onClose={() => setShowFavorites(false)}
          />
        )}

        <div>
          <label className="text-sm text-ink-700 dark:text-dark-text block mb-2">生成模式</label>
          <div className="grid grid-cols-3 gap-2">
            <ModeButton active={mode === 'multi'} onClick={() => setMode('multi')} title="多采样" desc="1 模型 3 篇，挑 AI 味最低" badge="稳" />
            <ModeButton active={mode === 'compare'} onClick={() => setMode('compare')} title="多模型对比" desc="DeepSeek/Qwen/Kimi 同时跑" badge="推荐" />
            <ModeButton active={mode === 'single'} onClick={() => setMode('single')} title="单篇" desc="1 模型 1 篇，最快" badge="快" />
          </div>
        </div>

        {mode !== 'compare' && (
          <div>
            <label className="text-sm text-ink-700 dark:text-dark-text block mb-2">模型</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full px-4 py-2.5 border border-ink-200 dark:border-dark-borderLight dark:bg-dark-surfaceHover rounded-lg text-sm focus:outline-none focus:border-ink-800 dark:focus:border-dark-text bg-white dark:bg-dark-surface"
            >
              {MODEL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md leading-relaxed">{error}</div>}
        {progress && !error && loading && (
          <div className="text-sm text-ink-700 dark:text-dark-text bg-ink-50 dark:bg-dark-surfaceHover px-3 py-2 rounded-md flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-ink-400 border-t-ink-800 dark:border-dark-textMuted dark:border-t-dark-text rounded-full animate-spin" />
            {progress}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onBack}
            disabled={loading}
            className="px-4 py-2.5 text-sm text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text transition"
          >
            ← 返回
          </button>
          {onSwitchToOutline && topic.trim() && (
            <button
              onClick={() => onSwitchToOutline(topic.trim())}
              disabled={loading}
              className="px-4 py-2.5 text-sm text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text transition"
              title="先列大纲再展开"
            >
              📝 大纲模式
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            data-generate-btn
            className="flex-1 px-6 py-2.5 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded-lg hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium"
          >
            {loading ? '生成中…' : mode === 'compare' ? '🚀 三模型对比' : '开始写作 →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AITopicGenerator({ onPick }: { onPick: (topic: string) => void }) {
  const [keywords, setKeywords] = useState('');
  const [grade, setGrade] = useState('高中');
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<{ topic: string; hint?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGen = async () => {
    if (!keywords.trim()) {
      setError('请输入关键词');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywords.trim(), grade })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '生成失败');
      setTopics(data.topics || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 p-3 bg-ink-50 dark:bg-dark-surfaceHover rounded-lg space-y-2">
      <div className="flex gap-2">
        <input
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
          placeholder="关键词，如：成长 失败 父爱"
          className="flex-1 px-3 py-1.5 border border-ink-200 dark:border-dark-borderLight dark:bg-dark-surface rounded text-xs"
        />
        <select
          value={grade}
          onChange={e => setGrade(e.target.value)}
          className="px-2 py-1.5 border border-ink-200 dark:border-dark-borderLight dark:bg-dark-surface rounded text-xs"
        >
          {GRADE_OPTIONS.map(g => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
        <button
          onClick={handleGen}
          disabled={loading || !keywords.trim()}
          className="px-3 py-1.5 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded text-xs hover:bg-ink-700 disabled:opacity-40 transition"
        >
          {loading ? '出题中…' : '✨ 出题'}
        </button>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      {topics.length > 0 && (
        <div className="space-y-1">
          {topics.map((t, i) => (
            <button
              key={i}
              onClick={() => onPick(t.topic)}
              className="w-full text-left text-xs px-3 py-2 bg-white dark:bg-dark-surface border border-ink-200 dark:border-dark-borderLight rounded hover:border-ink-400 transition"
            >
              <div className="text-ink-800 dark:text-dark-text font-medium">{t.topic}</div>
              {t.hint && <div className="text-ink-500 dark:text-dark-textMuted text-[10px] mt-0.5">{t.hint}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModeButton({ active, onClick, title, desc, badge }: {
  active: boolean; onClick: () => void; title: string; desc: string; badge: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative p-3 rounded-lg border text-left transition ${
        active
          ? 'border-ink-800 dark:border-dark-text bg-ink-50 dark:bg-dark-surfaceHover'
          : 'border-ink-200 dark:border-dark-borderLight hover:border-ink-300'
      }`}
    >
      {badge && (
        <span className={`absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded ${
          badge === '推荐' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-ink-100 dark:bg-dark-surfaceHover text-ink-600 dark:text-dark-textMuted'
        }`}>
          {badge}
        </span>
      )}
      <div className="text-sm font-medium text-ink-800 dark:text-dark-text">{title}</div>
      <div className="text-[11px] text-ink-500 dark:text-dark-textMuted mt-0.5 leading-relaxed">{desc}</div>
    </button>
  );
}