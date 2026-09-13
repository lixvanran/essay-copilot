'use client';

import { useState } from 'react';
import type { StyleDNA } from '@/lib/style-dna';
import type { StyleProfile } from '@/lib/style-extractor';
import type { AITraceScore } from '@/lib/ai-detector';
import DNACard from '@/components/DNACard';

type Props = {
  data: {
    dna: StyleDNA;
    profile: StyleProfile | null;
    profileError: string | null;
    samples: string[];
  };
  onGenerated: (r: GenerateResult, alternatives?: GenerateResult[]) => void;
  onBack: () => void;
};

type GenerateResult = {
  essay: string;
  model: string;
  aiScore: AITraceScore;
  durationMs: number;
};

const TOPIC_PRESETS = [
  '那一刻，我长大了',
  '原来，温暖一直都在',
  '最好的礼物',
  '那束光照亮了我',
  '我读懂了你',
  '在那个转弯处',
  '谢谢那个为我提灯的人',
  '那一刻，我没有回头'
];

const MODEL_OPTIONS = [
  { value: '', label: '自动 fallback（推荐 · 国产优先）' },
  { value: 'moonshotai/kimi-k2', label: '⭐ Kimi K2（中文写作实测最佳）' },
  { value: 'deepseek/deepseek-chat', label: 'DeepSeek V3（速度最快）' },
  { value: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B' },
  { value: 'qwen/qwen-2.5-32b-instruct', label: 'Qwen 2.5 32B' },
  { value: 'qwen/qwen-2.5-14b-instruct', label: 'Qwen 2.5 14B（更快）' },
  { value: 'zhipu/glm-4-32b', label: 'GLM-4 32B（智谱）' },
  { value: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
  { value: 'meta-llama/llama-3.1-8b-instruct', label: 'Llama 3.1 8B' }
];

// 3 个推荐模型做"对比"模式（v0.2.0 实测：Kimi 最强、DeepSeek 最快、Qwen 中间）
const COMPARE_MODELS = [
  'moonshotai/kimi-k2',
  'deepseek/deepseek-chat',
  'qwen/qwen-2.5-72b-instruct'
];

export default function GenerateStep({ data, onGenerated, onBack }: Props) {
  const { dna, profile, samples } = data;
  const [topic, setTopic] = useState('');
  const [requirements, setRequirements] = useState('');
  const [model, setModel] = useState('');
  const [mode, setMode] = useState<'multi' | 'compare' | 'single'>('multi');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('请填写作文题');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (mode === 'compare') {
        // 多模型对比：同时跑 3 个模型，让用户挑最好的
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

        // 排序：AI 味最低的为 best
        successes.sort((a, b) =>
          a.result.result.aiScore.total - b.result.result.aiScore.total
        );
        const best = successes[0].result.result;
        const alts = successes.slice(1).map(s => s.result.result);

        setProgress(`对比完成 · 最佳 ${best.aiScore.total} 分（${best.model}）`);
        onGenerated(best, alts);
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
        if (mode === 'multi' && data.alternatives) {
          setProgress(`✅ 生成 3 篇，挑出 AI 味最低的（${data.result.aiScore.total} 分）`);
          onGenerated(data.result, data.alternatives);
        } else {
          setProgress(`✅ 生成完成（${data.result.aiScore.total} 分）`);
          onGenerated(data.result);
        }
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
    if (detail) {
      return `${msg}（${detail.slice(0, 120)}）`;
    }
    return msg;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <DNACard
          dna={dna}
          profile={profile}
          profileError={data.profileError}
        />

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-ink-100">
          <h3 className="text-sm font-medium text-ink-700 mb-3">范文样本（{samples.length} 篇）</h3>
          <details className="text-xs text-ink-500">
            <summary className="cursor-pointer hover:text-ink-800">查看原文</summary>
            <div className="mt-2 space-y-3 max-h-64 overflow-y-auto">
              {samples.map((s, i) => (
                <div key={i} className="bg-ink-50 rounded p-3 leading-relaxed">
                  <div className="text-ink-400 mb-1">样本 {i + 1} · {s.length} 字</div>
                  <div className="text-ink-700 whitespace-pre-wrap line-clamp-6">{s}</div>
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-8 shadow-sm border border-ink-100 space-y-5">
        <div>
          <h2 className="text-2xl font-semibold mb-1">第二步：让 AI 替你写</h2>
          <p className="text-ink-500 text-sm">填个题目，AI 会按你的文风写一篇。</p>
        </div>

        <div>
          <label className="text-sm text-ink-700 block mb-2">作文题</label>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="例：那一刻，我长大了"
            className="w-full px-4 py-2.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-ink-800"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TOPIC_PRESETS.map(t => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className="text-xs px-2.5 py-1 bg-ink-50 hover:bg-ink-100 text-ink-600 rounded-full transition"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-ink-700 block mb-2">额外要求 <span className="text-ink-400">（可选）</span></label>
          <textarea
            value={requirements}
            onChange={e => setRequirements(e.target.value)}
            placeholder="比如：要写记叙文、要有具体细节、800 字左右..."
            className="w-full px-4 py-2.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-ink-800 h-20 resize-none"
          />
        </div>

        <div>
          <label className="text-sm text-ink-700 block mb-2">生成模式</label>
          <div className="grid grid-cols-3 gap-2">
            <ModeButton
              active={mode === 'multi'}
              onClick={() => setMode('multi')}
              title="多采样"
              desc="1 模型 3 篇，挑 AI 味最低"
              badge="稳"
            />
            <ModeButton
              active={mode === 'compare'}
              onClick={() => setMode('compare')}
              title="多模型对比"
              desc="DeepSeek/Qwen/Kimi 同时跑"
              badge="推荐"
            />
            <ModeButton
              active={mode === 'single'}
              onClick={() => setMode('single')}
              title="单篇"
              desc="1 模型 1 篇，最快"
              badge="快"
            />
          </div>
        </div>

        {mode !== 'compare' && (
          <div>
            <label className="text-sm text-ink-700 block mb-2">模型</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full px-4 py-2.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-ink-800 bg-white"
            >
              {MODEL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md leading-relaxed">
            {error}
          </div>
        )}
        {progress && !error && loading && (
          <div className="text-sm text-ink-700 bg-ink-50 px-3 py-2 rounded-md flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-ink-400 border-t-ink-800 rounded-full animate-spin" />
            {progress}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onBack}
            disabled={loading}
            className="px-4 py-2.5 text-sm text-ink-500 hover:text-ink-800 transition"
          >
            ← 返回
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="flex-1 px-6 py-2.5 bg-ink-800 text-ink-50 rounded-lg hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium"
          >
            {loading ? '生成中…' : mode === 'compare' ? '🚀 三模型对比' : '开始写作 →'}
          </button>
        </div>
      </div>
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
          ? 'border-ink-800 bg-ink-50'
          : 'border-ink-200 hover:border-ink-300'
      }`}
    >
      {badge && (
        <span className={`absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded ${
          badge === '推荐' ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-600'
        }`}>
          {badge}
        </span>
      )}
      <div className="text-sm font-medium text-ink-800">{title}</div>
      <div className="text-[11px] text-ink-500 mt-0.5 leading-relaxed">{desc}</div>
    </button>
  );
}
