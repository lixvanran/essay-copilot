'use client';

import { useState } from 'react';
import type { StyleDNA } from '@/lib/style-dna';
import type { AITraceScore } from '@/lib/ai-detector';
import DNACard from '@/components/DNACard';

type Props = {
  dna: StyleDNA;
  samples: string[];
  onGenerated: (r: { essay: string; model: string; aiScore: AITraceScore; durationMs: number }) => void;
  onBack: () => void;
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

// 模型选项（国区友好：国产模型优先）
const MODEL_OPTIONS = [
  { value: '', label: '自动 fallback（推荐 · 国产优先）' },
  { value: 'deepseek/deepseek-chat', label: '⭐ DeepSeek V3（国产，中文最强）' },
  { value: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B（通义千问旗舰）' },
  { value: 'qwen/qwen-2.5-32b-instruct', label: 'Qwen 2.5 32B' },
  { value: 'qwen/qwen-2.5-14b-instruct', label: 'Qwen 2.5 14B（更快）' },
  { value: 'moonshotai/kimi-k2', label: 'Kimi K2（月之暗面）' },
  { value: 'zhipu/glm-4-32b', label: 'GLM-4 32B（智谱）' },
  { value: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
  { value: 'meta-llama/llama-3.1-8b-instruct', label: 'Llama 3.1 8B' },
  { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash（国区可能不可用）' },
  { value: 'anthropic/claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet（国区可能不可用）' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o mini（国区可能不可用）' }
];

export default function GenerateStep({ dna, samples, onGenerated, onBack }: Props) {
  const [topic, setTopic] = useState('');
  const [requirements, setRequirements] = useState('');
  const [model, setModel] = useState('');
  const [multiSample, setMultiSample] = useState(true);
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
    setProgress(model ? `正在调用 ${model}...` : '正在尝试多个模型 (auto fallback)...');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dna,
          topic: topic.trim(),
          requirements: requirements.trim() || undefined,
          model: model || undefined,
          multiSample,
          attempts: multiSample ? 3 : 1
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '生成失败');
      if (multiSample) {
        setProgress(`已生成 3 个版本，挑出 AI 味最低的一个（${data.result.aiScore.total} 分）`);
      } else {
        setProgress('生成完成');
      }
      onGenerated(data.result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <DNACard dna={dna} />

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

        <label className="flex items-center gap-2 text-sm text-ink-600 cursor-pointer">
          <input
            type="checkbox"
            checked={multiSample}
            onChange={e => setMultiSample(e.target.checked)}
            className="rounded"
          />
          多采样（生成 3 篇，挑 AI 味最低的 · 慢一些但更稳）
        </label>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}
        {progress && !error && (
          <div className="text-sm text-ink-500 bg-ink-50 px-3 py-2 rounded-md">{progress}</div>
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
            {loading ? '生成中…' : '开始写作 →'}
          </button>
        </div>
      </div>
    </div>
  );
}
