/**
 * Markdown 导出（v0.4.0）
 */

export function essayToMarkdown(opts: {
  title?: string;
  topic?: string;
  essay: string;
  metadata?: { model?: string; aiScore?: number };
}): string {
  const lines: string[] = [];

  if (opts.title) {
    lines.push(`# ${opts.title}`);
    lines.push('');
  } else if (opts.topic) {
    lines.push(`# ${opts.topic}`);
    lines.push('');
  }

  if (opts.metadata && (opts.metadata.model || opts.metadata.aiScore !== undefined)) {
    const parts: string[] = [];
    if (opts.metadata.model) parts.push(`生成模型：${opts.metadata.model}`);
    if (opts.metadata.aiScore !== undefined) parts.push(`AI 痕迹评分：${opts.metadata.aiScore}`);
    if (parts.length > 0) {
      lines.push(`> ${parts.join(' · ')}`);
      lines.push('');
    }
  }

  // 段落按双换行切
  const paragraphs = opts.essay
    .split(/\n\s*\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  for (const p of paragraphs) {
    lines.push(p);
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadMarkdown(opts: Parameters<typeof essayToMarkdown>[0], filename?: string) {
  const md = essayToMarkdown(opts);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `essay-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}