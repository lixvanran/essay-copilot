import { describe, it, expect } from 'vitest';
import { ALL_MATERIALS, matchMaterials, materialsByType } from '../lib/materials';

describe('素材库', () => {
  it('至少有 30+ 个素材', () => {
    expect(ALL_MATERIALS.length).toBeGreaterThanOrEqual(30);
  });

  it('所有素材都有 title/brief/detail/topics', () => {
    for (const m of ALL_MATERIALS) {
      expect(m.title.length).toBeGreaterThan(2);
      expect(m.brief.length).toBeGreaterThan(5);
      expect(m.detail.length).toBeGreaterThan(30);
      expect(m.topics.length).toBeGreaterThan(0);
    }
  });

  it('三类齐全', () => {
    const grouped = materialsByType();
    expect(grouped.argument.length).toBeGreaterThan(5);
    expect(grouped.narrative.length).toBeGreaterThan(5);
    expect(grouped.lyric.length).toBeGreaterThan(3);
  });

  it('匹配素材：议论文 + 母爱 → 返回议论文素材', () => {
    const matched = matchMaterials('母爱', 'argument', 3);
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every(m => m.type === 'argument')).toBe(true);
  });

  it('匹配素材：记叙文 + 童年 → 返回记叙文素材', () => {
    const matched = matchMaterials('童年', 'narrative', 3);
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every(m => m.type === 'narrative')).toBe(true);
  });

  it('匹配素材：散文 + 春天 → 返回散文素材', () => {
    const matched = matchMaterials('春天', 'lyric', 3);
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every(m => m.type === 'lyric')).toBe(true);
  });

  it('无关键词：返回该类型前 N 个', () => {
    const matched = matchMaterials('😀😊😎', 'argument', 3);
    expect(matched.length).toBe(3);
    expect(matched.every(m => m.type === 'argument')).toBe(true);
  });

  it('limit 上限正常生效', () => {
    const matched = matchMaterials('素材', undefined, 3);
    expect(matched.length).toBe(3);
  });

  it('素材 id 唯一', () => {
    const ids = ALL_MATERIALS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('议论文素材含经典（苏轼/袁隆平）', () => {
    const titles = ALL_MATERIALS.map(m => m.title);
    expect(titles.some(t => t.includes('苏轼'))).toBe(true);
    expect(titles.some(t => t.includes('袁隆平'))).toBe(true);
  });
});