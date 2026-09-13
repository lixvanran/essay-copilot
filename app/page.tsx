'use client';

import { useState, useCallback } from 'react';
import type { StyleDNA } from '@/lib/style-dna';
import type { AITraceScore } from '@/lib/ai-detector';
import type { StyleProfile } from '@/lib/style-extractor';
import UploadStep from '@/components/UploadStep';
import GenerateStep from '@/components/GenerateStep';
import CompareStep from '@/components/CompareStep';
import Header from '@/components/Header';

type Step = 'upload' | 'generate' | 'compare';

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
  const [step, setStep] = useState<Step>('upload');
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [alternatives, setAlternatives] = useState<GenerateResult[]>([]);

  const handleAnalyzed = useCallback((data: AnalysisData) => {
    setAnalysis(data);
    setStep('generate');
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

  const handlePickAlternative = useCallback((idx: number) => {
    if (!result || !alternatives[idx]) return;
    // 切换 best 到所选，其他保持
    const picked = alternatives[idx];
    const rest = [result, ...alternatives.filter((_, i) => i !== idx)];
    setResult(picked);
    setAlternatives(rest);
    setStep('compare');
  }, [result, alternatives]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header onReset={step !== 'upload' ? handleReset : undefined} />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        <StepIndicator current={step} />
        <div className="mt-8">
          {step === 'upload' && (
            <UploadStep onAnalyzed={handleAnalyzed} />
          )}
          {step === 'generate' && analysis && (
            <GenerateStep
              data={analysis}
              onGenerated={handleGenerated}
              onBack={() => setStep('upload')}
            />
          )}
          {step === 'compare' && result && (
            <CompareStep
              dna={analysis?.dna || ({} as StyleDNA)}
              result={result}
              alternatives={alternatives}
              onRegenerate={() => setStep('generate')}
              onRestart={handleReset}
              onPickAlternative={handlePickAlternative}
            />
          )}
        </div>
      </main>
      <footer className="border-t border-ink-100 py-4 text-center text-xs text-ink-400">
        作文副驾驶 · v0.2 · 你的样本只在内存中处理，刷新即丢
      </footer>
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
              ? 'bg-ink-800 text-ink-50'
              : i < currentIdx
              ? 'bg-ink-100 text-ink-600'
              : 'bg-ink-50 text-ink-400'
          }`}>
            <span className="font-mono text-xs">{i + 1}</span>
            <span>{s.label}</span>
          </div>
          {i < steps.length - 1 && <div className="w-8 h-px bg-ink-200" />}
        </div>
      ))}
    </div>
  );
}
