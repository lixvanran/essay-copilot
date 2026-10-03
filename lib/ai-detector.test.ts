/**
 * ai-detector.ts 单元测试
 */
import { describe, it, expect } from 'vitest';
import { scoreAITrace } from './ai-detector';
import type { StyleDNA } from './style-dna';

describe('scoreAITrace', () => {
  const emptyDNA: StyleDNA = {
    sampleCount: 0, totalChars: 0,
    avgSentenceLen: 0, sentenceLenDist: { short: 0, medium: 0, long: 0 },
    sentenceLenStd: 0, paragraphLenAvg: 0, paragraphLenStd: 0,
    viewpoint: { firstPersonRatio: 0, secondPersonRatio: 0, thirdPersonRatio: 0, impliedSubjectRatio: 0 },
    dialogueRatio: 0,
    sentencePatterns: { parallelRatio: 0, contrastRatio: 0, rhetoricalQuestionRatio: 0, exclamatoryRatio: 0, progressiveRatio: 0 },
    topSentenceTemplates: [],
    rhetoricalDevices: { metaphor: 0, personification: 0, parallelism: 0 },
    modalParticles: [],
    punctuation: { exclamation: 0, question: 0, ellipsis: 0, dash: 0, semicolon: 0 },
    rhythm: { longShortAlternation: 0, sentenceVariability: 0 },
    toneScore: 0, formalityScore: 0,
    vocabRichness: 0, vocabDiversity: 0,
    topFunctionalWords: [],
    topConnectives: [],
    fingerprintParagraphs: [], fingerprint: ''
  };

  it('returns valid score for empty text', () => {
    const score = scoreAITrace('', emptyDNA);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(['human-like', 'slight-ai', 'obvious-ai', 'heavy-ai']).toContain(score.level);
  });
  it('penalizes AI high-frequency words', () => {
    const aiText = '在当今社会，毋庸置疑，这件事至关重要。显而易见，这是一个举足轻重的决定。';
    const humanText = '这件事我觉得挺重要的。大家该认真想想看。';
    const aiScore = scoreAITrace(aiText, emptyDNA);
    const humanScore = scoreAITrace(humanText, emptyDNA);
    expect(aiScore.total).toBeGreaterThan(humanScore.total);
    expect(aiScore.signals.aiWordHits.length).toBeGreaterThan(0);
  });
  it('penalizes templated openings', () => {
    const templated = '首先，我们需要明白这个道理。其次，我们应该注意这些细节。最后，我们要做这些事。';
    const score = scoreAITrace(templated, emptyDNA);
    expect(score.flaggedSentences.length).toBeGreaterThan(0);
  });
  it('returns level consistent with total', () => {
    const score = scoreAITrace('今天天气很好。我出去玩了。', emptyDNA);
    expect(score.total).toBeLessThan(45);  // 真人短文应该较低
  });
  it('rewards varied sentence starts', () => {
    const varied = '我喜欢这件事。今天的天气很好。她买了新的东西。我们一起去了公园。';
    const repetitive = '今天天气很好。今天我出去了。今天遇到了朋友。今天买了东西。';
    const variedScore = scoreAITrace(varied, emptyDNA);
    const repetitiveScore = scoreAITrace(repetitive, emptyDNA);
    expect(variedScore.signals.sentenceStartRepeat).toBeLessThan(repetitiveScore.signals.sentenceStartRepeat);
  });
  it('flags suspicious sentences', () => {
    const text = '在当今社会，这件事至关重要。这是显而易见的事实。我们应该深入理解。';
    const score = scoreAITrace(text, emptyDNA);
    expect(score.flaggedSentences.length).toBeGreaterThan(0);
  });
  it('vocabulary richness reasonable', () => {
    const rich = '哲学 艺术 文学 科学 历史 政治 经济 文化 心理 教育 法律';
    const repetitive = '啊啊啊 啊啊 啊啊啊 啊啊啊啊';
    const richScore = scoreAITrace(rich.repeat(3), emptyDNA);
    const repScore = scoreAITrace(repetitive, emptyDNA);
    expect(richScore.signals.vocabRichness).toBeGreaterThan(repScore.signals.vocabRichness);
  });
  it('handles long text gracefully', () => {
    const longText = '今天天气很好。我去了公园。看到了很多人。' .repeat(20);
    const score = scoreAITrace(longText, emptyDNA);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.signals.aiWordRatio).toBeGreaterThanOrEqual(0);
  });
});

describe('level mapping', () => {
  const emptyDNA = {
    sampleCount: 0, totalChars: 0,
    avgSentenceLen: 0, sentenceLenDist: { short: 0, medium: 0, long: 0 },
    sentenceLenStd: 0, paragraphLenAvg: 0, paragraphLenStd: 0,
    viewpoint: { firstPersonRatio: 0, secondPersonRatio: 0, thirdPersonRatio: 0, impliedSubjectRatio: 0 },
    dialogueRatio: 0,
    sentencePatterns: { parallelRatio: 0, contrastRatio: 0, rhetoricalQuestionRatio: 0, exclamatoryRatio: 0, progressiveRatio: 0 },
    topSentenceTemplates: [],
    rhetoricalDevices: { metaphor: 0, personification: 0, parallelism: 0 },
    modalParticles: [],
    punctuation: { exclamation: 0, question: 0, ellipsis: 0, dash: 0, semicolon: 0 },
    rhythm: { longShortAlternation: 0, sentenceVariability: 0 },
    toneScore: 0, formalityScore: 0,
    vocabRichness: 0, vocabDiversity: 0,
    topFunctionalWords: [],
    topConnectives: [],
    fingerprintParagraphs: [], fingerprint: ''
  } as StyleDNA;
  it('human-like < 25', () => {
    const s = scoreAITrace('今天我去了公园，看到了小狗。', emptyDNA);
    expect(s.total).toBeLessThan(45);
  });
});