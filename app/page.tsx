'use client';

import { useState, useCallback } from 'react';
import type { StyleDNA } from '@/lib/style-dna';
import type { AITraceScore } from '@/lib/ai-detector';
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

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  const [dna, setDna] = useState<StyleDNA | null>(null);
  const [samples, setSamples] = useState<string[]>([]);
  const [result, setResult] = useState<GenerateResult | null>(null);

  const handleAnalyzed = useCallback((d: StyleDNA, s: string[]) => {
    setDna(d);
    setSamples(s);
    setStep('generate');
  }, []);

  const handleGenerated = useCallback((r: GenerateResult) => {
    setResult(r);
    setStep('compare');
  }, []);

  const handleReset = useCallback(() => {
    setStep('upload');
    setDna(null);
    setSamples([]);
    setResult(null);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header onReset={step !== 'upload' ? handleReset : undefined} />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        <StepIndicator current={step} />
        <div className="mt-8">
          {step === 'upload' && (
            <UploadStep onAnalyzed={handleAnalyzed} />
          )}
          {step === 'generate' && dna && (
            <GenerateStep
              dna={dna}
              samples={samples}
              onGenerated={handleGenerated}
              onBack={() => setStep('upload')}
            />
          )}
          {step === 'compare' && dna && result && (
            <CompareStep
              dna={dna}
              result={result}
              onRegenerate={() => setStep('generate')}
              onRestart={handleReset}
            />
          )}
        </div>
      </main>
      <footer className="border-t border-ink-100 py-4 text-center text-xs text-ink-400">
        作文副驾驶 · v0.1 MVP · 你的样本只在内存中处理，刷新即丢
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
