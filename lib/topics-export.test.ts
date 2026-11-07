/**
 * topics.ts / markdown-export.ts 测试（v0.6.1 补覆盖率）
 */
import { describe, it, expect } from 'vitest';
import { TOPIC_PRESETS, topicsByCategory } from './topics';
import { essayToMarkdown } from './markdown-export';

describe('topics.ts', () => {
  it('有足够多的预设题目（>= 30）', () => {
    expect(TOPIC_PRESETS.length).toBeGreaterThanOrEqual(30);
  });

  it('每个题目都有非空 topic 和合法 category', () => {
    const valid: string[] = ['中考', '高考', '竞赛', '日常'];
    for (const t of TOPIC_PRESETS) {
      expect(t.topic.trim().length).toBeGreaterThan(1);
      expect(valid).toContain(t.category);
    }
  });

  it('题目不重复', () => {
    const set = new Set(TOPIC_PRESETS.map(t => t.topic));
    expect(set.size).toBe(TOPIC_PRESETS.length);
  });

  it('四个分类都有题目', () => {
    const grouped = topicsByCategory();
    expect(grouped['中考'].length).toBeGreaterThan(0);
    expect(grouped['高考'].length).toBeGreaterThan(0);
    expect(grouped['竞赛'].length).toBeGreaterThan(0);
    expect(grouped['日常'].length).toBeGreaterThan(0);
  });

  it('分组总数等于总数（没有漏归类的）', () => {
    const grouped = topicsByCategory();
    const total = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
    expect(total).toBe(TOPIC_PRESETS.length);
  });

  it('分组是每次新建（不共享可变引用）', () => {
    const a = topicsByCategory();
    const b = topicsByCategory();
    expect(a['中考']).not.toBe(b['中考']);
  });
});

describe('markdown-export.ts', () => {
  it('有 title 时用 title 作一级标题', () => {
    const md = essayToMarkdown({ title: '我的标题', essay: '正文内容。' });
    expect(md.startsWith('# 我的标题')).toBe(true);
  });

  it('无 title 但有 topic 时用 topic', () => {
    const md = essayToMarkdown({ topic: '我的题目', essay: '正文内容。' });
    expect(md.startsWith('# 我的题目')).toBe(true);
  });

  it('title 优先于 topic', () => {
    const md = essayToMarkdown({ title: 'T', topic: 'P', essay: '正文。' });
    expect(md).toContain('# T');
    expect(md).not.toContain('# P');
  });

  it('metadata 渲染为引用行', () => {
    const md = essayToMarkdown({ essay: '正文。', metadata: { model: 'kimi-k2', aiScore: 18 } });
    expect(md).toContain('>');
    expect(md).toContain('kimi-k2');
    expect(md).toContain('18');
  });

  it('段落按空行切分并保留', () => {
    const md = essayToMarkdown({ essay: '第一段。\n\n第二段。\n\n\n第三段。' });
    expect(md).toContain('第一段。');
    expect(md).toContain('第二段。');
    expect(md).toContain('第三段。');
  });

  it('空段落被剔除', () => {
    const md = essayToMarkdown({ topic: 'T', essay: '正文。\n\n\n\n   \n\n' });
    // 标题 1 行 + 正文 1 行
    expect(md.split('\n').filter(l => l.trim()).length).toBe(2);
  });

  it('空 essay 不崩', () => {
    const md = essayToMarkdown({ essay: '' });
    expect(typeof md).toBe('string');
  });

  it('无 metadata 时不产生引用行', () => {
    const md = essayToMarkdown({ essay: '正文。' });
    expect(md).not.toContain('>');
  });
});
