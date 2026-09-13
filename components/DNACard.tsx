'use client';

import { useState } from 'react';
import type { StyleDNA } from '@/lib/style-dna';
import type { StyleProfile } from '@/lib/style-extractor';

type Props = {
  dna: StyleDNA;
  profile: StyleProfile | null;
  profileLoading?: boolean;
  profileError?: string | null;
};

export default function DNACard({ dna, profile, profileLoading, profileError }: Props) {
  const [tab, setTab] = useState<'rules' | 'profile'>('profile');

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-ink-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">你的文风 DNA</h3>
        <div className="text-xs text-ink-400">{dna.sampleCount} 篇样本 · {dna.totalChars} 字</div>
      </div>

      <div className="flex gap-1 mb-4 bg-ink-50 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('profile')}
          className={`px-3 py-1 text-xs rounded transition ${
            tab === 'profile' ? 'bg-white shadow-sm font-medium' : 'text-ink-500'
          }`}
        >
          LLM 风格画像
        </button>
        <button
          onClick={() => setTab('rules')}
          className={`px-3 py-1 text-xs rounded transition ${
            tab === 'rules' ? 'bg-white shadow-sm font-medium' : 'text-ink-500'
          }`}
        >
          规则数据
        </button>
      </div>

      {tab === 'profile' ? (
        <ProfileView
          profile={profile}
          loading={profileLoading}
          error={profileError}
        />
      ) : (
        <RulesView dna={dna} />
      )}
    </div>
  );
}

function ProfileView({
  profile, loading, error
}: {
  profile: StyleProfile | null;
  loading?: boolean;
  error?: string | null;
}) {
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-4 bg-ink-100 rounded w-2/3" />
        <div className="h-4 bg-ink-100 rounded w-1/2" />
        <div className="h-20 bg-ink-100 rounded" />
        <div className="h-4 bg-ink-100 rounded w-3/4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
        <div className="font-medium mb-1">LLM 风格画像提取失败</div>
        <div className="text-xs text-amber-700">{error}</div>
        <div className="text-xs text-ink-500 mt-1">
          没关系，会用规则数据继续生成。配置好 OpenRouter Key 后重试即可。
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-sm text-ink-400 italic">
        未提取风格画像（需要 OpenRouter Key）
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="text-xs text-ink-400 mb-1">情感基调</div>
        <div className="text-ink-800 font-medium">{profile.emotionalTone}</div>
      </div>

      <div>
        <div className="text-xs text-ink-400 mb-1">声音人格</div>
        <div className="text-ink-800 font-medium">{profile.voicePersonality}</div>
      </div>

      <div>
        <div className="text-xs text-ink-400 mb-1">修辞类型</div>
        <div className="text-ink-800">{profile.rhetoricalStyle}</div>
      </div>

      <div>
        <div className="text-xs text-ink-400 mb-1">标志性技巧</div>
        <div className="flex flex-wrap gap-1.5">
          {profile.signatureTechniques.map((t, i) => (
            <span key={i} className="text-xs px-2 py-0.5 bg-ink-100 text-ink-700 rounded">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-ink-400 mb-1">句式 / 比喻 / 段落</div>
        <div className="text-ink-700 text-xs space-y-0.5">
          <div>句式：{profile.sentenceHabits}</div>
          <div>比喻：{profile.metaphorStyle}</div>
          <div>段落：{profile.paragraphStructure}</div>
        </div>
      </div>

      {profile.keyPhrases.length > 0 && (
        <div>
          <div className="text-xs text-ink-400 mb-1">标志性短语</div>
          <div className="space-y-1.5">
            {profile.keyPhrases.map((kp, i) => (
              <div key={i} className="text-xs">
                <span className="text-ink-800 font-medium">"{kp.phrase}"</span>
                <span className="text-ink-500"> — {kp.usage}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {profile.avoidPatterns.length > 0 && (
        <div>
          <div className="text-xs text-ink-400 mb-1">避免的写法</div>
          <div className="text-xs text-ink-600 space-y-0.5">
            {profile.avoidPatterns.map((p, i) => (
              <div key={i}>· {p}</div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-ink-100">
        <div className="text-xs text-ink-400 mb-1">综合判断</div>
        <div className="text-xs text-ink-700 leading-relaxed italic">
          {profile.summary}
        </div>
      </div>
    </div>
  );
}

function RulesView({ dna }: { dna: StyleDNA }) {
  // 视角
  const vp = dna.viewpoint;
  const vpDesc: string[] = [];
  if (vp.firstPersonRatio > 0.01) vpDesc.push(`1st ${(vp.firstPersonRatio * 100).toFixed(1)}%`);
  if (vp.thirdPersonRatio > 0.005) vpDesc.push(`3rd ${(vp.thirdPersonRatio * 100).toFixed(1)}%`);
  if (vp.secondPersonRatio > 0.005) vpDesc.push(`2nd ${(vp.secondPersonRatio * 100).toFixed(1)}%`);

  // 句式
  const sp = dna.sentencePatterns;
  const spDesc: string[] = [];
  if (sp.parallelRatio > 0.1) spDesc.push('排比');
  if (sp.contrastRatio > 0.05) spDesc.push('对比');
  if (sp.rhetoricalQuestionRatio > 0.05) spDesc.push('反问');
  if (sp.exclamatoryRatio > 0.05) spDesc.push('感叹');
  if (sp.progressiveRatio > 0.05) spDesc.push('渐进');

  // 节奏
  const dominant = Object.entries(dna.sentenceLenDist).sort((a, b) => b[1] - a[1])[0][0];

  return (
    <div className="space-y-2 text-sm">
      <Row label="句长" value={`${dna.avgSentenceLen} 字（σ=${dna.sentenceLenStd}）`} />
      <Row label="段落均长" value={`${dna.paragraphLenAvg} 字`} />
      <Row label="句长分布" value={`短 ${(dna.sentenceLenDist.short*100).toFixed(0)}% / 中 ${(dna.sentenceLenDist.medium*100).toFixed(0)}% / 长 ${(dna.sentenceLenDist.long*100).toFixed(0)}%（${dominant} 为主）`} />
      {vpDesc.length > 0 && <Row label="视角" value={vpDesc.join(' · ')} />}
      {spDesc.length > 0 && <Row label="句式偏好" value={spDesc.join(' / ')} />}
      {dna.topSentenceTemplates.length > 0 && (
        <Row
          label="句式模板"
          value={dna.topSentenceTemplates.slice(0, 3).map(t => `${t.pattern}×${t.count}`).join(' · ')}
        />
      )}
      {dna.rhetoricalDevices.metaphor > 0 && (
        <Row
          label="修辞"
          value={`比喻 ${dna.rhetoricalDevices.metaphor} · 拟人 ${dna.rhetoricalDevices.personification} · 排比 ${dna.rhetoricalDevices.parallelism}`}
        />
      )}
      {dna.modalParticles.length > 0 && (
        <Row label="语气词" value={dna.modalParticles.slice(0, 5).map(p => `${p.word}×${p.count}`).join(' · ')} />
      )}
      <Row
        label="标点 / 100字"
        value={`! ${dna.punctuation.exclamation.toFixed(1)} · ? ${dna.punctuation.question.toFixed(1)} · … ${dna.punctuation.ellipsis.toFixed(1)} · — ${dna.punctuation.dash.toFixed(1)}`}
      />
      <Row
        label="语气 / 正式度"
        value={`${dna.toneScore > 0.2 ? '偏感性' : dna.toneScore < -0.2 ? '偏理性' : '中性'} · ${dna.formalityScore > 0.6 ? '书面' : dna.formalityScore < 0.4 ? '口语' : '中性'}`}
      />
      {dna.topFunctionalWords && dna.topFunctionalWords.length > 0 && (
        <Row
          label="功能词（jieba）"
          value={dna.topFunctionalWords.slice(0, 8).map(w => `${w.word}[${w.pos}]×${w.freq}`).join(' · ')}
        />
      )}
      {dna.topConnectives.length > 0 && (
        <Row
          label="连接词"
          value={dna.topConnectives.slice(0, 5).map(c => `${c.word}×${c.freq}`).join(' · ')}
        />
      )}
      <Row
        label="词汇丰富度"
        value={`TTR ${dna.vocabRichness.toFixed(3)} · Diversity ${dna.vocabDiversity?.toFixed(1) || '?'}`}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 items-baseline">
      <div className="text-xs text-ink-400 flex-shrink-0 w-20">{label}</div>
      <div className="text-ink-700 text-xs flex-1">{value}</div>
    </div>
  );
}
