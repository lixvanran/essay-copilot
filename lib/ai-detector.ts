/**
 * AI 痕迹自检器
 * 用启发式方法评估文本"AI 味"，输出 0-100 分（越低越像人写的）
 */

import type { StyleDNA } from './style-dna';

export type AITraceScore = {
  total: number;                       // 0-100
  level: 'human-like' | 'slight-ai' | 'obvious-ai' | 'heavy-ai';
  signals: {
    aiWordRatio: number;               // AI 高频词占比
    aiWordHits: { word: string; count: number }[];
    sentenceStartRepeat: number;       // 句首词重复度
    vocabRichness: number;             // TTR
    structurePredictability: number;   // 段落长度方差（越低越可预测）
    avgSentenceLen: number;            // 平均句长
    styleConsistency: number;          // 与用户 DNA 匹配度（如果有 dna）
  };
  flaggedSentences: { sentence: string; reason: string }[];
};

const AI_WORDS = [
  // 高确信 AI 词（罕见词 + AI 味重）
  '至关重要', '不言而喻', '毋庸置疑', '引人深思', '发人深省', '耐人寻味', '历久弥新',
  '显而易见', '不言自明', '举足轻重', '首当其冲', '无可替代', '不可分割',
  '紧密相连', '相辅相成', '息息相关', '密不可分', '环环相扣', '层层递进',
  '在当今社会', '在当今时代', '在新的时代', '在新时代的征程上', '在新形势下',
  '综上所述', '总而言之', '令我们', '值得我们',
  '正所谓', '常言道', '古语云', '古人说', '有道是',
  '不可置否', '无可否认', '事实证明', '实践表明', '赋能', '彰显'
];

// 中等确信 AI 词（在真人作文里偶尔出现，但高频使用 = AI 味）
const AI_WORDS_MEDIUM = [
  '深刻', '显著', '往往', '种种', '不可或缺', '与时俱进',
  '战略性', '全局性', '根本性', '系统性',
  '不由得', '不禁', '使人',
  '正如', '首先', '其次', '再次', '综上', '总之',
  '深远'  // 出现 2+ 次才算
];

// AI 倾向的"模板化"短语（出现就扣分）
const AI_PHRASES = [
  '不仅.{1,30}，?而且',  // 不仅...而且
  '既.{1,15}，?又',      // 既...又
  '只有.{1,30}，?(才|就)', // 只有...才
  '在.{2,8}的.{1,6}里',   // 在...里
  '如果.{1,40}，?(那么|就|则)', // 如果...就
  '^(首先|其次|再次|最后)[，,。]' // 句首模板
];

// 句式模板（AI 倾向的结构）
const SENTENCE_TEMPLATES = [
  /^首先[，,\s]/,
  /^其次[，,\s]/,
  /^再次[，,\s]/,
  /^最后[，,\s]/,
  /^总之[，,\s]/,
  /^因此[，,\s]/,
  /^所以[，,\s]/,
  /^然而[，,\s]/,
  /^不仅.{1,20}，?而且/,
  /^既.{1,15}，?又/,
  /^在.{2,10}的.{1,8}[里上下中]/,
  /^(这|那|此)\s*(一|个|种|些|时|刻|种|段|番)/,
  /^(我们|我)应该/,
  /^(我们|我)需要/,
  /^(我们|我)必须/,
  /^(我们|我)不能/,
  /^(只有|只要).{1,30}，?(就|才)/,
  /^(如果|假如|倘若).{1,40}，?(那么|就|则)/,
  /^.{1,5}是.{1,20}的[。，,\s]/
];

function splitSentences(text: string): string[] {
  return text
    .replace(/[\r\n]+/g, '。')
    .split(/(?<=[。！？!?；;\.\n])/g)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+|\r\n\s*\r\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

function tokenize(text: string): string[] {
  const cleaned = text.replace(/[\s\p{P}]+/gu, '');
  const tokens: string[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    tokens.push(cleaned.slice(i, i + 2));
  }
  return tokens;
}

/**
 * 评估 AI 痕迹
 */
export function scoreAITrace(essay: string, userDNA?: StyleDNA): AITraceScore {
  const sentences = splitSentences(essay);
  const paragraphs = splitParagraphs(essay);
  const tokens = tokenize(essay);

  // 1. AI 高频词命中率（高确信词每次命中都计，中确信词只计 2+ 次）
  const aiWordHits: { word: string; count: number }[] = [];
  let totalHits = 0;
  for (const word of AI_WORDS) {
    const count = (essay.match(new RegExp(word, 'g')) || []).length;
    if (count > 0) {
      aiWordHits.push({ word, count });
      totalHits += count;
    }
  }
  for (const word of AI_WORDS_MEDIUM) {
    const count = (essay.match(new RegExp(word, 'g')) || []).length;
    if (count >= 2) {  // 出现 2+ 次才算（容忍偶发）
      aiWordHits.push({ word, count });
      totalHits += count;
    }
  }
  aiWordHits.sort((a, b) => b.count - a.count);
  const totalChars = essay.replace(/\s/g, '').length || 1;
  const aiWordRatio = totalHits / totalChars * 100;  // 每 100 字的命中数

  // 1.5 模板化短语命中（只数 unique 数，不重复计）
  let templateHits = 0;
  for (const tmpl of AI_PHRASES) {
    const matches = essay.match(new RegExp(tmpl, 'gm')) || [];
    if (matches.length > 0) templateHits += matches.length;
  }

  // 2. 句首重复度
  const sentenceStarts = sentences.map(s => s.slice(0, 3));
  const startCounts = new Map<string, number>();
  for (const start of sentenceStarts) {
    if (start.length === 3) {
      startCounts.set(start, (startCounts.get(start) || 0) + 1);
    }
  }
  const repeatedStarts = Array.from(startCounts.values()).filter(c => c > 1);
  const totalStarts = sentenceStarts.filter(s => s.length === 3).length || 1;
  const sentenceStartRepeat = repeatedStarts.reduce((a, b) => a + b, 0) / totalStarts;

  // 3. 词汇丰富度
  const wordSet = new Set(tokens);
  const vocabRichness = tokens.length > 0 ? wordSet.size / tokens.length : 0;

  // 4. 段落结构可预测性（段落长度方差）
  const paraLengths = paragraphs.map(p => p.length);
  const paraAvg = paraLengths.length > 0
    ? paraLengths.reduce((a, b) => a + b, 0) / paraLengths.length
    : 0;
  const paraStd = paraLengths.length > 0
    ? Math.sqrt(paraLengths.reduce((sum, l) => sum + Math.pow(l - paraAvg, 2), 0) / paraLengths.length)
    : 0;
  // CV (变异系数) 越低越可预测
  const structurePredictability = paraAvg > 0 ? Math.max(0, 1 - paraStd / paraAvg) : 0;

  // 5. 平均句长
  const sentenceLengths = sentences.map(s => s.length);
  const avgSentenceLen = sentenceLengths.length > 0
    ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
    : 0;

  // 6. 与用户 DNA 的一致性（如果提供）
  let styleConsistency = 0.5;
  if (userDNA) {
    const lenDiff = Math.abs(avgSentenceLen - userDNA.avgSentenceLen) / Math.max(avgSentenceLen, userDNA.avgSentenceLen, 1);
    const vocabDiff = Math.abs(vocabRichness - userDNA.vocabRichness);
    styleConsistency = Math.max(0, 1 - (lenDiff * 0.6 + vocabDiff * 0.4));
  }

  // 打分合成（每项 0-25 分，加权求和）
  let score = 0;

  // AI 词命中率：每 100 字 > 1.5 个 → 满分 25
  const aiWordScore = Math.min(25, aiWordRatio * 16);
  score += aiWordScore;

  // 模板化短语：每个命中 3 分，最多 15
  const templateScore = Math.min(15, templateHits * 3);
  score += templateScore;

  // 句首重复：> 40% → 满分 25
  const repeatScore = Math.min(25, sentenceStartRepeat * 60);
  score += repeatScore;

  // 词汇丰富度低（< 0.3）：AI 倾向
  const vocabScore = Math.max(0, (0.3 - vocabRichness) * 80);
  score += Math.min(20, vocabScore);

  // 结构可预测（CV 接近 0）
  const structScore = structurePredictability * 15;
  score += structScore;

  // 与用户 DNA 不一致
  if (userDNA) {
    const consistencyScore = (1 - styleConsistency) * 15;
    score += consistencyScore;
  }

  // 截断到 0-100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // 标出可疑句
  const flaggedSentences: { sentence: string; reason: string }[] = [];
  for (const sentence of sentences) {
    const reasons: string[] = [];
    for (const word of AI_WORDS) {
      if (sentence.includes(word)) {
        reasons.push(`含 AI 高频词"${word}"`);
        break;
      }
    }
    if (!reasons.length) {
      for (const word of AI_WORDS_MEDIUM) {
        if (sentence.includes(word)) {
          reasons.push(`含 AI 倾向词"${word}"`);
          break;
        }
      }
    }
    for (const tmpl of SENTENCE_TEMPLATES) {
      if (tmpl.test(sentence)) {
        reasons.push('句式模板化');
        break;
      }
    }
    if (reasons.length > 0) {
      flaggedSentences.push({ sentence, reason: reasons.join('；') });
    }
  }

  const level: AITraceScore['level'] =
    score < 25 ? 'human-like' :
    score < 45 ? 'slight-ai' :
    score < 65 ? 'obvious-ai' : 'heavy-ai';

  return {
    total: score,
    level,
    signals: {
      aiWordRatio: Math.round(aiWordRatio * 100) / 100,
      aiWordHits: aiWordHits.slice(0, 10),
      sentenceStartRepeat: Math.round(sentenceStartRepeat * 100) / 100,
      vocabRichness: Math.round(vocabRichness * 1000) / 1000,
      structurePredictability: Math.round(structurePredictability * 100) / 100,
      avgSentenceLen: Math.round(avgSentenceLen * 10) / 10,
      styleConsistency: Math.round(styleConsistency * 100) / 100
    },
    flaggedSentences
  };
}
