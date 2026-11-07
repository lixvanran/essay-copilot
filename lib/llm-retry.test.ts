/**
 * LLM 重试 / 退避 单元测试（v0.6.1）
 * 不发真实请求 —— 只测分类逻辑 + backoff 计算
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isTransientError } from './llm';

describe('isTransientError 分类', () => {
  it('429 限流 → transient（可重试）', () => {
    expect(isTransientError(new Error('OpenRouter error 429: rate limited'))).toBe(true);
  });

  it('500 / 502 / 503 → transient', () => {
    expect(isTransientError(new Error('OpenRouter error 500: server'))).toBe(true);
    expect(isTransientError(new Error('OpenRouter error 502: bad gateway'))).toBe(true);
    expect(isTransientError(new Error('OpenRouter error 503: unavailable'))).toBe(true);
  });

  it('401 未授权 → 不可重试', () => {
    expect(isTransientError(new Error('OpenRouter error 401: unauthorized'))).toBe(false);
  });

  it('402 欠费 → 不可重试', () => {
    expect(isTransientError(new Error('OpenRouter error 402: insufficient credits'))).toBe(false);
  });

  it('403 禁止 → 不可重试', () => {
    expect(isTransientError(new Error('OpenRouter error 403: forbidden'))).toBe(false);
  });

  it('404 模型不存在 → 不可重试', () => {
    expect(isTransientError(new Error('OpenRouter error 404: model not found'))).toBe(false);
  });

  it('TypeError（fetch 网络错误）→ transient', () => {
    const e = new TypeError('fetch failed');
    expect(isTransientError(e)).toBe(true);
  });

  it('AbortError（超时）→ transient', () => {
    const e = new Error('The operation was aborted');
    e.name = 'AbortError';
    expect(isTransientError(e)).toBe(true);
  });

  it('ECONNRESET → transient', () => {
    expect(isTransientError(new Error('read ECONNRESET'))).toBe(true);
  });

  it('普通业务错误 → 不可重试', () => {
    expect(isTransientError(new Error('All models failed'))).toBe(false);
    expect(isTransientError(new Error('Empty response'))).toBe(false);
  });

  it('null / undefined → 不可重试', () => {
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
  });
});

describe('generateEssay 重试行为（mock fetch）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** 用真实 extractStyleDNA 生成合法 DNA（保证字段完整） */
  async function makeDNA() {
    const { extractStyleDNA } = await import('./style-dna');
    return extractStyleDNA([
      '那时候我大概七岁，第一次学着骑自行车。车子是父亲留下的旧物，锈迹斑斑，我扶了好几次才跨上去。' +
      '刚蹬了两下就摔了，膝盖火辣辣地疼。父亲站在门口看着，没有过来扶，只说了一句："再来。"\n\n' +
      '我咬着牙爬起来，又跨上去。这一次骑出了十几米，可是没敢回头。回头一看，我才发现自己的手心全是汗。'
    ]);
  }

  it('429 后重试成功 → 返回结果，不抛错', async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call++;
      if (call === 1) {
        return new Response('rate limited', { status: 429 });
      }
      return new Response(
        JSON.stringify({
          model: 'test/model',
          choices: [{ index: 0, message: { role: 'assistant', content: '  这是生成的文章。  ' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { generateEssay } = await import('./llm');
    const dna = await makeDNA();

    const result = await generateEssay({
      dna,
      topic: '测试题目',
      apiKey: 'sk-or-v1-testtesttest',
      model: 'test/model',
      withFallback: false
    });

    expect(result.essay).toBe('这是生成的文章。');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('401 → 立即抛错（不重试）', async () => {
    const fetchMock = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const { generateEssay } = await import('./llm');
    const dna = await makeDNA();

    await expect(
      generateEssay({ dna, topic: '测试', apiKey: 'sk-or-v1-testtesttest', model: 'test/model', withFallback: false })
    ).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
