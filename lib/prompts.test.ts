/**
 * prompts.ts 单元测试
 */
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from './prompts';
import type { StyleDNA } from './style-dna';
import type { StyleProfile } from './style-extractor';

const baseDNA: StyleDNA = {
  sampleCount: 1, totalChars: 100,
  avgSentenceLen: 20, sentenceLenDist: { short: 0.3, medium: 0.5, long: 0.2 },
  sentenceLenStd: 5, paragraphLenAvg: 80, paragraphLenStd: 10,
  viewpoint: { firstPersonRatio: 0.01, secondPersonRatio: 0, thirdPersonRatio: 0.005, impliedSubjectRatio: 0 },
  dialogueRatio: 0,
  sentencePatterns: { parallelRatio: 0.1, contrastRatio: 0.05, rhetoricalQuestionRatio: 0.05, exclamatoryRatio: 0, progressiveRatio: 0 },
  topSentenceTemplates: [{ pattern: '不是...而是', count: 3, example: '不是A而是B' }],
  rhetoricalDevices: { metaphor: 1, personification: 0, parallelism: 1 },
  modalParticles: [{ word: '啊', count: 2 }],
  punctuation: { exclamation: 0.5, question: 0.5, ellipsis: 0, dash: 0, semicolon: 0 },
  rhythm: { longShortAlternation: 0.3, sentenceVariability: 0.5 },
  toneScore: 0.2, formalityScore: 0.5,
  vocabRichness: 0.5, vocabDiversity: 5,
  topFunctionalWords: [{ word: '的', pos: '助词', freq: 10 }],
  topConnectives: [{ word: '但是', freq: 3 }],
  fingerprintParagraphs: ['这是一个参考段落。'],
  fingerprint: 'test'
};

const baseProfile: StyleProfile = {
  perspective: 'first_person',
  emotionalTone: '冷峻/克制',
  rhetoricalStyle: '议论文',
  signatureTechniques: ['设问开篇', '反问+举例'],
  sentenceHabits: '长短交错',
  metaphorStyle: '适度',
  voicePersonality: '老辣尖锐',
  paragraphStructure: '起承转合',
  keyPhrases: [{ phrase: '迟早要毁掉', usage: '表达担忧' }],
  avoidPatterns: ['不用抒情开头'],
  summary: '冷峻克制中带温情'
};

describe('buildSystemPrompt', () => {
  it('includes LLM profile when provided', () => {
    const prompt = buildSystemPrompt(baseDNA, baseProfile);
    expect(prompt).toContain('冷峻');
    expect(prompt).toContain('老辣尖锐');
    expect(prompt).toContain('LLM 风格画像');
  });
  it('works without profile', () => {
    const prompt = buildSystemPrompt(baseDNA, null);
    expect(prompt).toContain('语言习惯');
    expect(prompt.length).toBeGreaterThan(50);
  });
  it('includes negative list (banned words)', () => {
    const prompt = buildSystemPrompt(baseDNA, null);
    expect(prompt).toContain('严禁');
    expect(prompt).toContain('深刻');
    expect(prompt).toContain('不言而喻');
  });
  it('includes length guidance based on DNA', () => {
    const longDNA = { ...baseDNA, paragraphLenAvg: 300 };
    const prompt = buildSystemPrompt(longDNA, null);
    expect(prompt).toMatch(/\d+/);
    expect(prompt).toContain('字');
  });
  it('respects avoid patterns when present', () => {
    const prompt = buildSystemPrompt(baseDNA, baseProfile);
    expect(prompt).toContain('不用抒情开头');
  });
});

describe('buildUserPrompt', () => {
  it('includes topic', () => {
    const prompt = buildUserPrompt({ dna: baseDNA, topic: '那一刻，我长大了' });
    expect(prompt).toContain('那一刻');
  });
  it('includes requirements when provided', () => {
    const prompt = buildUserPrompt({ dna: baseDNA, topic: '题', requirements: '800 字' });
    expect(prompt).toContain('800 字');
  });
  it('omits requirements section when empty', () => {
    const prompt = buildUserPrompt({ dna: baseDNA, topic: '题' });
    expect(prompt).not.toContain('额外要求');
  });
  it('uses targetLength default', () => {
    const prompt = buildUserPrompt({ dna: baseDNA, topic: '题' });
    expect(prompt).toMatch(/目标字数/);
  });
});