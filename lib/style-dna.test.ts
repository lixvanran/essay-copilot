/**
 * style-dna.ts 单元测试
 */
import { describe, it, expect } from 'vitest';
import { extractStyleDNA, dnaToStyleDescription } from './style-dna';
import type { StyleDNA } from './style-dna';

describe('extractStyleDNA', () => {
  it('throws on empty samples', () => {
    expect(() => extractStyleDNA([])).toThrow();
  });
  it('extracts basic DNA from single sample', () => {
    const dna = extractStyleDNA(['这是一段测试文本，需要足够长的内容才能触发分析逻辑。它包含了一些关键的句子结构和词汇。']);
    expect(dna).toBeDefined();
    expect(dna.sampleCount).toBe(1);
    expect(dna.totalChars).toBeGreaterThan(40);
    expect(dna.avgSentenceLen).toBeGreaterThan(0);
  });
  it('captures sentence length distribution', () => {
    const dna = extractStyleDNA(['这是第一句。这是第二句稍微长一点。这是一句很长很长的内容，用来测试句长分布。']);
    expect(dna.sentenceLenDist.short).toBeGreaterThanOrEqual(0);
    expect(dna.sentenceLenDist.medium).toBeGreaterThanOrEqual(0);
    expect(dna.sentenceLenDist.long).toBeGreaterThanOrEqual(0);
    const sum = dna.sentenceLenDist.short + dna.sentenceLenDist.medium + dna.sentenceLenDist.long;
    expect(Math.abs(sum - 1)).toBeLessThan(0.05);
  });
  it('detects first-person perspective', () => {
    const dna = extractStyleDNA([
      '我今天去了学校。我看到了一只小狗。我觉得这件事很有意思。我决定写下来。'
    ]);
    expect(dna.viewpoint.firstPersonRatio).toBeGreaterThan(0.005);
  });
  it('detects third-person perspective', () => {
    const dna = extractStyleDNA([
      '他今天去了学校。她看到了一只小猫。他们觉得这很有意思。于是他决定写下来。'
    ]);
    expect(dna.viewpoint.thirdPersonRatio).toBeGreaterThan(0.005);
  });
  it('detects rhetorical questions', () => {
    const dna = extractStyleDNA([
      '这难道不是显而易见吗？怎么可能这样？为什么不试试？'
    ]);
    expect(dna.sentencePatterns.rhetoricalQuestionRatio).toBeGreaterThan(0);
  });
  it('detects contrast patterns (不是...而是...)', () => {
    const dna = extractStyleDNA([
      '问题不是简单，而是复杂。'
    ]);
    expect(dna.sentencePatterns.contrastRatio).toBeGreaterThan(0);
  });
  it('extracts functional words with jieba', () => {
    const dna = extractStyleDNA([
      '这些年的变化太大了。我们的生活在改变。一切都在变化。'
    ]);
    // 应该有功能词提取
    expect(dna.topFunctionalWords).toBeDefined();
    expect(Array.isArray(dna.topFunctionalWords)).toBe(true);
  });
  it('produces fingerprint', () => {
    const dna = extractStyleDNA(['测试文本测试文本测试文本测试文本测试文本测试文本测试文本']);
    expect(dna.fingerprint).toBeTruthy();
    expect(dna.fingerprintParagraphs).toBeDefined();
  });
  it('handles multiple samples', () => {
    const samples = [
      '这是第一篇样本的内容。我喜欢读书。',
      '这是第二篇样本的内容。她喜欢跑步。',
      '这是第三篇样本的内容。他们喜欢音乐。'
    ];
    const dna = extractStyleDNA(samples);
    expect(dna.sampleCount).toBe(3);
    expect(dna.totalChars).toBeGreaterThan(30);
  });
});

describe('dnaToStyleDescription', () => {
  it('generates readable description', () => {
    const dna: StyleDNA = {
      sampleCount: 1, totalChars: 100,
      avgSentenceLen: 15, sentenceLenDist: { short: 0.3, medium: 0.5, long: 0.2 },
      sentenceLenStd: 5, paragraphLenAvg: 80, paragraphLenStd: 10,
      viewpoint: { firstPersonRatio: 0.01, secondPersonRatio: 0, thirdPersonRatio: 0, impliedSubjectRatio: 0 },
      dialogueRatio: 0,
      sentencePatterns: { parallelRatio: 0.1, contrastRatio: 0.05, rhetoricalQuestionRatio: 0.05, exclamatoryRatio: 0, progressiveRatio: 0 },
      topSentenceTemplates: [],
      rhetoricalDevices: { metaphor: 1, personification: 0, parallelism: 1 },
      modalParticles: [],
      punctuation: { exclamation: 0.5, question: 0.5, ellipsis: 0, dash: 0, semicolon: 0 },
      rhythm: { longShortAlternation: 0.3, sentenceVariability: 0.5 },
      toneScore: 0.3, formalityScore: 0.5,
      vocabRichness: 0.5, vocabDiversity: 5,
      topFunctionalWords: [],
      topConnectives: [],
      fingerprintParagraphs: [], fingerprint: 'test'
    };
    const desc = dnaToStyleDescription(dna);
    expect(desc).toContain('语言习惯');
    expect(desc).toContain('修辞');
    expect(desc.length).toBeGreaterThan(50);
  });
  it('handles empty DNA gracefully', () => {
    const dna: StyleDNA = {
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
    const desc = dnaToStyleDescription(dna);
    expect(desc).toBeDefined();
    expect(desc.length).toBeGreaterThan(0);
  });
});