/**
 * profile-db 测试（v0.6.1 补覆盖率）
 * 用 fake-indexeddb 在 Node 环境模拟浏览器 IndexedDB
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

import {
  saveProfile,
  loadProfile,
  listProfiles,
  deleteProfile,
  addFavorite,
  listFavorites,
  deleteFavorite,
  type StyleProfile_
} from './profile-db';

/** 用真实 extractStyleDNA 生成合法 DNA（保证字段完整） */
async function makeDNA() {
  const { extractStyleDNA } = await import('./style-dna');
  return extractStyleDNA([
    '那时候我大概七岁，第一次学着骑自行车。车子是父亲留下的旧物，锈迹斑斑，我扶了好几次才跨上去。\n\n' +
    '刚蹬了两下就摔了，膝盖火辣辣地疼。父亲站在门口看着，没有过来扶，只说了一句："再来。"\n\n' +
    '我咬着牙爬起来，又跨上去。这一次骑出了十几米，可是没敢回头。回头一看，我才发现自己的手心全是汗。'
  ]);
}

describe('profile-db 多风格档案', () => {
  beforeEach(async () => {
    const profiles = await listProfiles();
    for (const p of profiles) await deleteProfile(p.id);
    const favs = await listFavorites();
    for (const f of favs) await deleteFavorite(f.id);
  });

  it('保存 + 读取档案', async () => {
    const dna = await makeDNA();
    const profile: StyleProfile_ = {
      id: 'test-1',
      name: '议论文高分范本',
      type: 'argument',
      dna,
      profile: null,
      samples: ['这是第一篇范文。'.repeat(30)],
      savedAt: Date.now()
    };
    await saveProfile(profile);
    const loaded = await loadProfile('test-1');
    expect(loaded).toBeTruthy();
    expect(loaded?.name).toBe('议论文高分范本');
    expect(loaded?.type).toBe('argument');
    expect(loaded?.samples.length).toBe(1);
  });

  it('列出所有档案（按时间倒序）', async () => {
    const dna = await makeDNA();
    const p1: StyleProfile_ = { id: 'p1', name: 'A', type: 'argument', dna, profile: null, samples: [], savedAt: 1000 };
    const p2: StyleProfile_ = { id: 'p2', name: 'B', type: 'narrative', dna, profile: null, samples: [], savedAt: 2000 };
    await saveProfile(p1);
    await saveProfile(p2);
    const list = await listProfiles();
    expect(list.length).toBe(2);
    expect(list[0].id).toBe('p2'); // 较新的在前
  });

  it('删除档案', async () => {
    const dna = await makeDNA();
    const p: StyleProfile_ = { id: 'del-1', name: 'X', type: 'lyric', dna, profile: null, samples: [], savedAt: 0 };
    await saveProfile(p);
    expect(await loadProfile('del-1')).toBeTruthy();
    await deleteProfile('del-1');
    expect(await loadProfile('del-1')).toBeNull();
  });

  it('读取不存在的档案返回 null', async () => {
    expect(await loadProfile('nope')).toBeNull();
  });

  it('配额保护：超大档案应抛错', async () => {
    const dna = await makeDNA();
    const bigSamples = Array(100).fill('a'.repeat(50000)).join('');
    const p: StyleProfile_ = {
      id: 'big-1', name: 'Big', type: 'argument', dna, profile: null, samples: [bigSamples], savedAt: 0
    };
    await expect(saveProfile(p)).rejects.toThrow(/档案太大/);
  });
});

describe('profile-db 题目收藏', () => {
  beforeEach(async () => {
    const favs = await listFavorites();
    for (const f of favs) await deleteFavorite(f.id);
  });

  it('添加收藏 + 列出', async () => {
    await addFavorite('母爱是一束光', '亲情', '适合记叙文');
    const list = await listFavorites();
    expect(list.length).toBe(1);
    expect(list[0].topic).toBe('母爱是一束光');
    expect(list[0].notes).toBe('适合记叙文');
  });

  it('topic 前后空格被 trim', async () => {
    const f = await addFavorite('  题目  ');
    expect(f.topic).toBe('题目');
  });

  it('空 topic 应抛错', async () => {
    await expect(addFavorite('', undefined, undefined)).rejects.toThrow(/题目不能为空/);
    await expect(addFavorite('   ', undefined, undefined)).rejects.toThrow(/题目不能为空/);
  });

  it('超长 topic 应抛错', async () => {
    await expect(addFavorite('a'.repeat(201), undefined, undefined)).rejects.toThrow(/不能超过 200/);
  });

  it('超长 notes 应抛错', async () => {
    await expect(addFavorite('正常题目', undefined, 'a'.repeat(501))).rejects.toThrow(/备注/);
  });

  it('删除收藏', async () => {
    const f = await addFavorite('题目', '分类', '备注');
    expect((await listFavorites()).length).toBe(1);
    await deleteFavorite(f.id);
    expect((await listFavorites()).length).toBe(0);
  });

  it('多条收藏按时间倒序', async () => {
    await addFavorite('题目一');
    await new Promise(r => setTimeout(r, 5));
    await addFavorite('题目二');
    const list = await listFavorites();
    expect(list[0].topic).toBe('题目二');
  });
});
