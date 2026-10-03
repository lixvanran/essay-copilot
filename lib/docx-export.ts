/**
 * 生成 .docx 文件（浏览器端用 docx 库）
 * 用途：让用户能把生成的作文导出为 Word 格式
 */
import {
  Document, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Packer
} from 'docx';

export type EssayDocxOptions = {
  title?: string;
  author?: string;
  essay: string;
};

/**
 * 把作文转成 .docx Blob（浏览器端）
 */
export async function essayToDocx(opts: EssayDocxOptions): Promise<Blob> {
  const paragraphs = opts.essay
    .split(/\n\s*\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(text =>
      new Paragraph({
        children: [new TextRun({ text, size: 24 /* 12pt = 24 half-points */ })],
        spacing: { before: 100, after: 100, line: 360 },
        alignment: AlignmentType.JUSTIFIED
      })
    );

  const doc = new Document({
    creator: opts.author || 'Essay Co-Pilot',
    title: opts.title || '生成的作文',
    description: '由 作文副驾驶 v0.3.0 生成',
    sections: [{
      properties: {},
      children: [
        // 标题
        new Paragraph({
          children: [new TextRun({
            text: opts.title || '生成的作文',
            bold: true,
            size: 32  // 16pt
          })],
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 }
        }),
        ...paragraphs
      ]
    }]
  });

  return await Packer.toBlob(doc);
}

/**
 * 触发浏览器下载 .docx
 */
export function downloadDocx(opts: EssayDocxOptions, filename?: string) {
  essayToDocx(opts).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `essay-${Date.now()}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  });
}