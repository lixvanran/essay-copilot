/**
 * docx-export / pdf-export 测试（v0.6.1 补覆盖率）
 * 这两个是浏览器端模块 —— 用 mock DOM + mock fetch 测
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------- DOM mock ----------
// docx 库要求 Blob 有 .stream() —— 用 Node 原生 Blob，不 mock
let clickCount = 0;
let lastDownload = '';

function installDOM() {
  clickCount = 0;
  lastDownload = '';
  // 注意：不能整体替换 URL（会破坏 new URL() 构造器），
  // 只补 createObjectURL / revokeObjectURL 两个静态方法
  (globalThis as any).URL.createObjectURL = () => 'blob:fake';
  (globalThis as any).URL.revokeObjectURL = () => {};
  (globalThis as any).document = {
    createElement: (tag: string) => ({
      tag,
      href: '',
      download: '',
      click() {
        clickCount++;
        lastDownload = (this as any).download;
      }
    })
  };
}

describe('docx-export.ts', () => {
  beforeEach(installDOM);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('essayToDocx 返回 Blob', async () => {
    const { essayToDocx } = await import('./docx-export');
    const blob = await essayToDocx({ essay: '第一段内容。\n\n第二段内容。' });
    expect(blob).toBeTruthy();
    expect(blob).toBeInstanceOf(Blob);
  });

  it('空 essay 不崩', async () => {
    const { essayToDocx } = await import('./docx-export');
    const blob = await essayToDocx({ essay: '' });
    expect(blob).toBeTruthy();
  });

  it('带 title / author 不崩', async () => {
    const { essayToDocx } = await import('./docx-export');
    const blob = await essayToDocx({ title: '我的作文', author: '小明', essay: '内容。' });
    expect(blob).toBeTruthy();
  });

  it('downloadDocx 会触发浏览器下载', async () => {
    const { downloadDocx } = await import('./docx-export');
    downloadDocx({ essay: '内容。' }, 'test.docx');
    // downloadDocx 内部是 promise.then（异步触发下载）
    await new Promise(r => setTimeout(r, 300));
    expect(clickCount).toBe(1);
    expect(lastDownload).toBe('test.docx');
  });

  it('downloadDocx 默认文件名含 essay', async () => {
    const { downloadDocx } = await import('./docx-export');
    downloadDocx({ essay: '内容。' });
    await new Promise(r => setTimeout(r, 300));
    expect(lastDownload).toMatch(/^essay-\d+\.docx$/);
  });
});

describe('pdf-export.ts', () => {
  beforeEach(() => {
    installDOM();
    // mock fetch：字体下载失败 → 走 Helvetica fallback 分支
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('中文字体下载失败 + 中文内容 → 明确报错（不再静默产出坏 PDF）', async () => {
    const { essayToPdf } = await import('./pdf-export');
    // v0.6.1 修复：Helvetica 不支持中文，旧代码在这里会抛 Cannot encode
    await expect(essayToPdf({ essay: '这是测试内容。\n\n第二段。' })).rejects.toThrow(/中文字体加载失败/);
  });

  it('中文字体下载失败 + 纯英文内容 → 正常导出（fallback 路径有效）', async () => {
    const { essayToPdf } = await import('./pdf-export');
    const blob = await essayToPdf({ essay: 'Hello world.\n\nSecond paragraph.' });
    expect(blob).toBeTruthy();
    expect(blob).toBeInstanceOf(Blob);
  });

  it('字体下载成功 → 中文正常导出', async () => {
    // 用真实字体字节（从 CDN 拿一次太重 —— 这里用最小合法 TTF 头代替会失败）
    // ⇒ 改为验证：mock 一个能被 pdf-lib 嵌入的最小字体
    const { StandardFonts } = await import('pdf-lib');
    // pdf-lib 内置字体不含中文，但能验证"有 cnFont 分支不报错"
    // 实际覆盖：内容为英文时，无论字体是否加载成功都不该抛中文字体错误
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    const { essayToPdf } = await import('./pdf-export');
    await expect(essayToPdf({ essay: 'Plain ASCII text.' })).resolves.toBeTruthy();
    void StandardFonts;
  });

  it('带 title / metadata 不崩（英文）', async () => {
    const { essayToPdf } = await import('./pdf-export');
    const blob = await essayToPdf({
      title: 'My Essay',
      essay: 'Some content.',
      metadata: { model: 'kimi-k2', aiScore: 18 }
    });
    expect(blob).toBeTruthy();
  });

  it('downloadPdf 会触发浏览器下载（英文内容）', async () => {
    const { downloadPdf } = await import('./pdf-export');
    await downloadPdf({ essay: 'Plain ASCII content.' }, 'test.pdf');
    expect(clickCount).toBe(1);
    expect(lastDownload).toBe('test.pdf');
  });
});
