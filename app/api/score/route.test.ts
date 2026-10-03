/**
 * /api/score 集成测试
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { POST } from './route';

const validDNA = {
  sampleCount: 1, totalChars: 100,
  avgSentenceLen: 20, sentenceLenDist: { short: 0.3, medium: 0.5, long: 0.2 },
  sentenceLenStd: 5, paragraphLenAvg: 80, paragraphLenStd: 10,
  viewpoint: { firstPersonRatio: 0.01, secondPersonRatio: 0, thirdPersonRatio: 0, impliedSubjectRatio: 0 },
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
  fingerprintParagraphs: [], fingerprint: 'test'
};

describe('POST /api/score', () => {
  beforeAll(() => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-test-key';
  });

  it('scores a short essay', async () => {
    const essay = '今天我去公园玩。看到了很多花。各种各样的颜色非常漂亮。然后我回家吃饭了。今天真是开心的一天，我想以后还会再来公园看看这些美丽的花朵。';
    const req = new Request('http://localhost/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ essay, dna: validDNA })
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBeDefined();
    expect(body.score.total).toBeGreaterThanOrEqual(0);
    expect(body.score.total).toBeLessThanOrEqual(100);
    expect(['human-like', 'slight-ai', 'obvious-ai', 'heavy-ai']).toContain(body.score.level);
  });

  it('rejects empty essay', async () => {
    const req = new Request('http://localhost/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ essay: '', dna: validDNA })
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});