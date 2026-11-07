'use client';

import { useState, useCallback, useEffect } from 'react';
import type { StyleDNA } from '@/lib/style-dna';
import { scoreAITrace, type AITraceScore } from '@/lib/ai-detector';
import type { StyleProfile } from '@/lib/style-extractor';
import UploadStep from '@/components/UploadStep';
import ProfileSelector from '@/components/ProfileSelector';
import { saveProfile, type StyleProfile_ } from '@/lib/profile-db';
import GenerateStep from '@/components/GenerateStep';
import OutlineStep from '@/components/OutlineStep';
import CompareStep from '@/components/CompareStep';
import Header from '@/components/Header';
import HistoryPanel from '@/components/HistoryPanel';
import { loadHistory } from '@/lib/storage';

type Step = 'upload' | 'generate' | 'outline' | 'compare';
type Mode = 'generate' | 'polish';

type GenerateResult = {
  essay: string;
  model: string;
  aiScore: AITraceScore;
  durationMs: number;
};

type AnalysisData = {
  dna: StyleDNA;
  profile: StyleProfile | null;
  profileError: string | null;
  samples: string[];
};

export default function Home() {
  const [mode, setMode] = useState<Mode>('generate');
  const [step, setStep] = useState<Step>('upload');
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [topic, setTopic] = useState<string>('');
  const [alternatives, setAlternatives] = useState<GenerateResult[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);

  useEffect(() => {
    setHistoryCount(loadHistory().length);
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleAnalyzed = useCallback((data: AnalysisData) => {
    setAnalysis(data);
    setStep('generate');
  }, []);

  const [polishing, setPolishing] = useState(false);

  const handlePolish = useCallback(async (data: { dna: StyleDNA; profile: StyleProfile | null; samples: string[]; polishEssay: string }) => {
    setAnalysis({ dna: data.dna, profile: data.profile, profileError: null, samples: data.samples });
    setPolishing(true);
    try {
      const res = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dna: data.dna,
          profile: data.profile,
          essay: data.polishEssay
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '润色失败');

      // 前端实时算分
      const aiScore = scoreAITrace(json.essay, data.dna);
      const r: GenerateResult = {
        essay: json.essay,
        model: json.model,
        aiScore,
        durationMs: json.durationMs
      };
      setResult(r);
      setTopic('润色结果');
      setStep('compare');
    } catch (e: any) {
      console.error('Polish error:', e.message);
      alert('润色失败：' + e.message);
    } finally {
      setPolishing(false);
    }
  }, []);

  const handleGenerated = useCallback((r: GenerateResult, alts: GenerateResult[] = []) => {
    setResult(r);
    setAlternatives(alts);
    setStep('compare');
  }, []);

  const handleReset = useCallback(() => {
    setStep('upload');
    setAnalysis(null);
    setResult(null);
    setAlternatives([]);
  }, []);

  const handleSaveCurrentProfile = useCallback(async (name: string, type: StyleProfile_['type']) => {
    if (!analysis) return;
    await saveProfile({
      id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      type,
      dna: analysis.dna,
      profile: analysis.profile,
      samples: analysis.samples,
      savedAt: Date.now()
    });
  }, [analysis]);

  const handleSwitchProfile = useCallback((p: StyleProfile_ | null) => {
    if (!p) return;
    setAnalysis({
      dna: p.dna,
      profile: p.profile,
      profileError: null,
      samples: p.samples
    });
    setStep('generate');
  }, []);

  const handlePickAlternative = useCallback((idx: number) => {
    if (!result || !alternatives[idx]) return;
    const picked = alternatives[idx];
    const rest = [result, ...alternatives.filter((_, i) => i !== idx)];
    setResult(picked);
    setAlternatives(rest);
  }, [result, alternatives]);

  const handleSwitchMode = (newMode: Mode) => {
    setMode(newMode);
    handleReset();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        onReset={step !== 'upload' ? handleReset : undefined}
        onShowHistory={() => setHistoryOpen(true)}
        historyCount={historyCount}
      />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {/* 模式 tab */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <StepIndicator current={step} />
          <div className="flex items-center gap-2">
            {analysis && (
              <ProfileSelector
                current={{ dna: analysis.dna, profile: analysis.profile, samples: analysis.samples }}
                onSwitch={handleSwitchProfile}
                onSave={handleSaveCurrentProfile}
              />
            )}
            <ModeTab mode={mode} onChange={handleSwitchMode} />
          </div>
        </div>

        <div className="mt-2">
          {step === 'upload' && (
            <UploadStep
              mode={mode}
              onAnalyzed={handleAnalyzed}
              onPolish={handlePolish}
            />
          )}
          {step === 'generate' && analysis && mode === 'generate' && (
            <GenerateStep
              data={analysis}
              onGenerated={(r, alts) => {
                handleGenerated(r, alts);
                const input = document.querySelector('input[type="text"][placeholder*="例"]') as HTMLInputElement;
                setTopic(input?.value || '');
              }}
              onSwitchToOutline={(t) => {
                setTopic(t);
                setStep('outline');
              }}
              onBack={() => setStep('upload')}
            />
          )}
          {step === 'outline' && analysis && (
            <OutlineStep
              data={analysis}
              topic={topic}
              onGenerated={(r) => {
                handleGenerated(r);
              }}
              onBack={() => setStep('upload')}
            />
          )}
          {step === 'compare' && result && analysis && (
            <CompareStep
              dna={analysis.dna}
              profile={analysis.profile}
              result={result}
              alternatives={alternatives}
              topic={topic}
              onRegenerate={() => setStep('generate')}
              onRestart={handleReset}
              onPickAlternative={handlePickAlternative}
            />
          )}
        </div>
      </main>
      <footer className="border-t border-ink-100 dark:border-dark-border py-4 text-center text-xs text-ink-400 dark:text-dark-textSubtle">
        作文副驾驶 · v0.6.1 · 数据仅在本地浏览器，刷新即丢
      </footer>

      {/* 历史记录侧栏 */}
      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onPick={(entry) => {
          // 把历史 essay 加载成 result
          const aiScore = scoreAITrace(entry.essay, analysis?.dna);
          setResult({
            essay: entry.essay,
            model: entry.model,
            aiScore,
            durationMs: 0
          });
          setTopic(entry.topic);
          setStep('compare');
          setHistoryOpen(false);
        }}
      />

      {/* Polish 加载浮窗 */}
      {polishing && (
        <div className="fixed inset-0 bg-black/30 dark:bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-surface rounded-2xl p-6 shadow-2xl max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-block w-5 h-5 border-2 border-ink-400 border-t-ink-800 dark:border-dark-textMuted dark:border-t-dark-text rounded-full animate-spin" />
              <div className="text-sm font-medium text-ink-800 dark:text-dark-text">正在润色…</div>
            </div>
            <div className="text-xs text-ink-500 dark:text-dark-textMuted">
              AI 正在按你的风格重新打磨每一个句子，约 5-10 秒
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: '上传范文' },
    { key: 'generate', label: '生成作文' },
    { key: 'compare', label: '查看结果' }
  ];
  const currentIdx = steps.findIndex(s => s.key === current);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition ${
            i === currentIdx
              ? 'bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg'
              : i < currentIdx
              ? 'bg-ink-100 dark:bg-dark-surfaceHover text-ink-600 dark:text-dark-text'
              : 'bg-ink-50 dark:bg-dark-surface text-ink-400 dark:text-dark-textSubtle'
          }`}>
            <span className="font-mono text-xs">{i + 1}</span>
            <span>{s.label}</span>
          </div>
          {i < steps.length - 1 && <div className="w-8 h-px bg-ink-200 dark:bg-dark-border" />}
        </div>
      ))}
    </div>
  );
}

function ModeTab({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex bg-ink-50 dark:bg-dark-surface rounded-lg p-1">
      <button
        onClick={() => onChange('generate')}
        className={`px-3 py-1.5 text-xs rounded transition ${
          mode === 'generate'
            ? 'bg-white dark:bg-dark-surfaceHover text-ink-800 dark:text-dark-text font-medium shadow-sm'
            : 'text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text'
        }`}
      >
        ✏️ 写新作文
      </button>
      <button
        onClick={() => onChange('polish')}
        className={`px-3 py-1.5 text-xs rounded transition ${
          mode === 'polish'
            ? 'bg-white dark:bg-dark-surfaceHover text-ink-800 dark:text-dark-text font-medium shadow-sm'
            : 'text-ink-500 dark:text-dark-textMuted hover:text-ink-800 dark:hover:text-dark-text'
        }`}
      >
        💎 润色现有
      </button>
    </div>
  );
}