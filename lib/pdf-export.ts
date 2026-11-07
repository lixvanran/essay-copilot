/**
 * PDF 导出（v0.5.0）
 * 用 pdf-lib（纯 JS，不依赖 wkhtmltopdf / puppeteer）
 *
 * 支持中文字体：嵌入 NotoSansSC（开源、可商用）
 * 如果字体下载失败，回退到默认字体（英文显示 OK，中文显示成方块）
 */

import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';

// 远程字体 URL（CDN，可换成本地路径）
const FONT_URL = 'https://cdn.jsdelivr.net/npm/notofonts/notosans-sc@1.0.0/NotoSansSC-Regular.otf';

let cachedFont: PDFFont | null = null;
let cachedFontBytes: Uint8Array | null = null;

/**
 * 尝试加载中文字体（一次性，缓存）
 */
async function getChineseFont(pdf: PDFDocument): Promise<PDFFont | null> {
  if (cachedFont) return cachedFont;
  try {
    if (!cachedFontBytes) {
      const res = await fetch(FONT_URL);
      if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
      cachedFontBytes = new Uint8Array(await res.arrayBuffer());
    }
    cachedFont = await pdf.embedFont(cachedFontBytes, { subset: true });
    return cachedFont;
  } catch (e) {
    console.warn('[pdf-export] Failed to load Chinese font, using Helvetica fallback:', e);
    return null;
  }
}

export type EssayPdfOptions = {
  title?: string;
  topic?: string;
  essay: string;
  metadata?: { model?: string; aiScore?: number };
};

/**
 * 作文 → PDF Blob（浏览器端）
 */
export async function essayToPdf(opts: EssayPdfOptions): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.title || opts.topic || '生成的作文');
  pdf.setCreator('Essay Co-Pilot v0.6.1');
  pdf.setProducer('pdf-lib');

  // 字体
  const cnFont = await getChineseFont(pdf);
  const fallbackFont = await pdf.embedFont(StandardFonts.Helvetica);
  const font = cnFont || fallbackFont;

  // ⚠️ v0.6.1 修复：Helvetica 是 WinAnsi 编码，不支持中文字符。
  //   旧代码在字体下载失败时直接用 Helvetica 渲染中文 →
  //   drawText 抛 "Cannot encode" → 整个 PDF 导出 500（fallback 路径本身是坏的）。
  //   ⇒ 现在：没有中文字体 + 内容含中文 → 明确报错，让用户改用 Word/Markdown 导出。
  if (!cnFont && containsChinese(opts.essay) || (!cnFont && containsChinese(opts.title || opts.topic || ''))) {
    throw new Error(
      '中文字体加载失败（需要能访问 cdn.jsdelivr.net 下载 NotoSansSC）。' +
      '请检查网络后重试，或改用「导出 Word」/「导出 Markdown」。'
    );
  }

  // 页面设置
  const pageWidth = 595;   // A4
  const pageHeight = 842;
  const margin = 60;
  const lineHeight = 22;
  const maxWidth = pageWidth - margin * 2;

  // 标题
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  if (opts.title || opts.topic) {
    const titleText = opts.title || opts.topic || '';
    const titleSize = 18;
    y -= titleSize;
    page.drawText(titleText, {
      x: margin,
      y: y,
      size: titleSize,
      font,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth
    });
    y -= 20;

    // 元数据行
    if (opts.metadata && (opts.metadata.model || opts.metadata.aiScore !== undefined)) {
      const meta: string[] = [];
      if (opts.metadata.model) meta.push(`Model: ${opts.metadata.model}`);
      if (opts.metadata.aiScore !== undefined) meta.push(`AI Score: ${opts.metadata.aiScore}`);
      page.drawText(meta.join('  ·  '), {
        x: margin,
        y: y,
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5),
        maxWidth
      });
      y -= 20;
    }

    // 分隔线
    page.drawLine({
      start: { x: margin, y: y },
      end: { x: pageWidth - margin, y: y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7)
    });
    y -= 20;
  }

  // 段落
  const paragraphs = opts.essay.split(/\n\s*\n+/).map(p => p.trim()).filter(p => p.length > 0);
  const fontSize = 12;

  for (const para of paragraphs) {
    // 按字符换行（pdf-lib 不支持中文自动换行）
    const lines = wrapText(para, font, fontSize, maxWidth);

    for (const line of lines) {
      if (y < margin + lineHeight) {
        // 新页
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      // 安全网：即使前面的中文检测漏了，也不让单个字符炸掉整个导出
      try {
        page.drawText(line, {
          x: margin,
          y: y,
          size: fontSize,
          font,
          color: rgb(0.15, 0.15, 0.15),
          maxWidth
        });
      } catch (e) {
        console.warn('[pdf-export] skip unencodable line:', e);
      }
      y -= lineHeight;
    }

    // 段落间距
    y -= lineHeight * 0.5;

    // 检查是否需要新页（段末留点空）
    if (y < margin + lineHeight * 2) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  const pdfBytes = await pdf.save();
  // Buffer.from 让类型对齐（pdf-lib 输出 Uint8Array<ArrayBufferLike>，需要 ArrayBuffer）
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

/**
 * 触发浏览器下载 .pdf
 */
export async function downloadPdf(opts: EssayPdfOptions, filename?: string) {
  const blob = await essayToPdf(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `essay-${Date.now()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 判断文本是否含中日韩字符（fallback 字体不支持）
 */
function containsChinese(text: string): boolean {
  return /[　-鿿＀-￯]/.test(text);
}

/**
 * 中文换行（pdf-lib 不支持 auto-wrap）
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const ch of text) {
    const test = current + ch;
    try {
      const width = font.widthOfTextAtSize(test, fontSize);
      if (width > maxWidth && current.length > 0) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    } catch {
      // 字符不在字体里（fallback），按字切
      lines.push(current);
      current = ch;
    }
  }
  if (current) lines.push(current);
  return lines;
}