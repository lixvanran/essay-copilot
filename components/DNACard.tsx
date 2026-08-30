'use client';

import type { StyleDNA } from '@/lib/style-dna';

type Props = { dna: StyleDNA };

export default function DNACard({ dna }: Props) {
  const dominant = Object.entries(dna.sentenceLenDist).sort((a, b) => b[1] - a[1])[0];
  const dominantLabel: Record<string, string> = {
    short: '短句为主',
    medium: '中句为主',
    long: '长句为主'
  };
  const toneLabel = dna.toneScore > 0.2 ? '偏感性' : dna.toneScore < -0.2 ? '偏理性' : '中性';
  const formalityLabel = dna.formalityScore > 0.6 ? '偏书面' : dna.formalityScore < 0.4 ? '偏口语' : '中等';

  // 视角
  const vp = dna.viewpoint;
  const totalVP = vp.firstPersonRatio + vp.secondPersonRatio + vp.thirdPersonRatio;
  const vpMain = totalVP > 0
    ? (vp.firstPersonRatio > vp.thirdPersonRatio && vp.firstPersonRatio > vp.secondPersonRatio
        ? { label: '我 (1st)', ratio: vp.firstPersonRatio, color: 'bg-emerald-400' }
        : vp.thirdPersonRatio > vp.secondPersonRatio
        ? { label: '他/她 (3rd)', ratio: vp.thirdPersonRatio, color: 'bg-sky-400' }
        : { label: '你 (2nd)', ratio: vp.secondPersonRatio, color: 'bg-violet-400' })
    : { label: '隐含', ratio: 0, color: 'bg-ink-300' };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-ink-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-ink-700">语言习惯画像</h3>
        <span className="text-xs text-ink-400 font-mono">{dna.fingerprint.slice(0, 8)}</span>
      </div>
      <p className="text-xs text-ink-400 mb-4 -mt-2">HOW you write（不是 WHAT）</p>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="样本" value={`${dna.sampleCount} 篇`} />
        <Stat label="总字数" value={`${dna.totalChars}`} />
        <Stat label="平均句长" value={`${dna.avgSentenceLen} 字`} />
        <Stat label="句长偏好" value={dominantLabel[dominant[0]]} />
        <Stat label="句长变异" value={dna.rhythm.sentenceVariability.toFixed(2)} />
        <Stat label="段落平均" value={`${dna.paragraphLenAvg} 字`} />
        <Stat label="语气" value={toneLabel} />
        <Stat label="正式度" value={formalityLabel} />
      </div>

      <div className="mt-4 pt-4 border-t border-ink-100">
        <div className="text-xs text-ink-500 mb-1.5">句长分布</div>
        <div className="flex h-2 rounded-full overflow-hidden bg-ink-50">
          <div className="bg-emerald-400" style={{ width: `${dna.sentenceLenDist.short * 100}%` }} title={`短句 ${(dna.sentenceLenDist.short * 100).toFixed(0)}%`} />
          <div className="bg-sky-400" style={{ width: `${dna.sentenceLenDist.medium * 100}%` }} title={`中句 ${(dna.sentenceLenDist.medium * 100).toFixed(0)}%`} />
          <div className="bg-violet-400" style={{ width: `${dna.sentenceLenDist.long * 100}%` }} title={`长句 ${(dna.sentenceLenDist.long * 100).toFixed(0)}%`} />
        </div>
        <div className="flex justify-between text-[10px] text-ink-400 mt-1">
          <span>短 {(dna.sentenceLenDist.short * 100).toFixed(0)}%</span>
          <span>中 {(dna.sentenceLenDist.medium * 100).toFixed(0)}%</span>
          <span>长 {(dna.sentenceLenDist.long * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-ink-100">
        <div className="text-xs text-ink-500 mb-2">视角</div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-ink-50 rounded p-2">
            <div className="text-ink-400">我 (1st)</div>
            <div className="text-ink-700 font-mono mt-0.5">{(vp.firstPersonRatio * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-ink-50 rounded p-2">
            <div className="text-ink-400">你 (2nd)</div>
            <div className="text-ink-700 font-mono mt-0.5">{(vp.secondPersonRatio * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-ink-50 rounded p-2">
            <div className="text-ink-400">他/她 (3rd)</div>
            <div className="text-ink-700 font-mono mt-0.5">{(vp.thirdPersonRatio * 100).toFixed(1)}%</div>
          </div>
        </div>
        {dna.dialogueRatio > 0.02 && (
          <div className="text-xs text-ink-500 mt-2">
            对话占比: <span className="font-mono">{(dna.dialogueRatio * 100).toFixed(1)}%</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-ink-100">
        <div className="text-xs text-ink-500 mb-2">句式偏好</div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {dna.sentencePatterns.parallelRatio > 0.1 && <Tag>排比 {(dna.sentencePatterns.parallelRatio * 100).toFixed(0)}%</Tag>}
          {dna.sentencePatterns.contrastRatio > 0.05 && <Tag>对比 {(dna.sentencePatterns.contrastRatio * 100).toFixed(0)}%</Tag>}
          {dna.sentencePatterns.rhetoricalQuestionRatio > 0.05 && <Tag>反问 {(dna.sentencePatterns.rhetoricalQuestionRatio * 100).toFixed(0)}%</Tag>}
          {dna.sentencePatterns.exclamatoryRatio > 0.05 && <Tag>感叹 {(dna.sentencePatterns.exclamatoryRatio * 100).toFixed(0)}%</Tag>}
          {dna.sentencePatterns.progressiveRatio > 0.05 && <Tag>渐进</Tag>}
          {dna.topSentenceTemplates.length > 0 && dna.topSentenceTemplates.slice(0, 3).map(t => (
            <Tag key={t.pattern} highlight>{t.pattern} ×{t.count}</Tag>
          ))}
        </div>
      </div>

      {dna.modalParticles.length > 0 && (
        <div className="mt-4 pt-4 border-t border-ink-100">
          <div className="text-xs text-ink-500 mb-1.5">语气词习惯</div>
          <div className="flex flex-wrap gap-1.5">
            {dna.modalParticles.map(p => (
              <span key={p.word} className="text-xs px-2 py-0.5 bg-ink-50 text-ink-700 rounded">
                {p.word} <span className="text-ink-400">{p.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {(dna.punctuation.exclamation > 0.3 || dna.punctuation.question > 0.3 || dna.punctuation.ellipsis > 0.2) && (
        <div className="mt-4 pt-4 border-t border-ink-100">
          <div className="text-xs text-ink-500 mb-1.5">标点习惯 (/100字)</div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {dna.punctuation.exclamation > 0.3 && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded">! {dna.punctuation.exclamation.toFixed(1)}</span>}
            {dna.punctuation.question > 0.3 && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded">? {dna.punctuation.question.toFixed(1)}</span>}
            {dna.punctuation.ellipsis > 0.2 && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded">… {dna.punctuation.ellipsis.toFixed(1)}</span>}
            {dna.punctuation.dash > 0.2 && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded">— {dna.punctuation.dash.toFixed(1)}</span>}
          </div>
        </div>
      )}

      {dna.topConnectives.length > 0 && (
        <div className="mt-4 pt-4 border-t border-ink-100">
          <div className="text-xs text-ink-500 mb-1.5">常用连接词（反映逻辑展开）</div>
          <div className="flex flex-wrap gap-1.5">
            {dna.topConnectives.slice(0, 5).map(c => (
              <span key={c.word} className="text-xs px-2 py-0.5 bg-sky-50 text-sky-700 rounded">
                {c.word}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-ink-400 uppercase tracking-wider">{label}</div>
      <div className="text-ink-800 font-medium mt-0.5">{value}</div>
    </div>
  );
}

function Tag({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${highlight ? 'bg-violet-50 text-violet-700' : 'bg-ink-50 text-ink-600'}`}>
      {children}
    </span>
  );
}
