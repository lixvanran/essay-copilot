/**
 * 文风 DNA 提取器（v3 — 聚焦"语言习惯"而非"主题词"）
 *
 * 核心设计原则：
 * - 主题词（"贫富/枪毙"）随题目变，无价值 → 不提取
 * - 表达习惯（句式/修辞/视角/语气/标点/节奏）跨题目稳定 → 重点提取
 * - LLM 模仿的是"怎么讲"，不是"讲什么"
 */

export type StyleDNA = {
  sampleCount: number;
  totalChars: number;

  // ===== 基础句法（保留）=====
  avgSentenceLen: number;
  sentenceLenDist: { short: number; medium: number; long: number };
  sentenceLenStd: number;
  paragraphLenAvg: number;
  paragraphLenStd: number;

  // ===== 语言习惯（核心）=====

  // 视角偏好
  viewpoint: {
    firstPersonRatio: number;     // "我/我们" 出现频率
    secondPersonRatio: number;    // "你/你们" 出现频率
    thirdPersonRatio: number;     // "他/她/它/他们" 出现频率
    impliedSubjectRatio: number;  // 零主语句比例（"下雨了"）
  };

  // 对话/叙述比例
  dialogueRatio: number;          // 含 "..." 的字符占比

  // 句式模板（高复现的结构）
  sentencePatterns: {
    parallelRatio: number;        // 排比（连续 3+ 句相似结构）
    contrastRatio: number;         // 对比（"不是...而是..."）
    rhetoricalQuestionRatio: number; // 反问（问号+否定意）
    exclamatoryRatio: number;      // 感叹号结尾
    progressiveRatio: number;      // "X着X着" "越X越Y"
  };

  // 修辞手法
  rhetoricalDevices: {
    metaphor: number;              // "像/似/如/似的/仿佛" 比喻
    personification: number;       // 拟人（无生命名词+动词）
    parallelism: number;           // 排比
  };

  // 句式模板（前 5 个高复现）
  topSentenceTemplates: { pattern: string; count: number; example: string }[];

  // 语气词
  modalParticles: { word: string; count: number }[];

  // 标点习惯（每 100 字的频次）
  punctuation: {
    exclamation: number;     // !
    question: number;        // ?
    ellipsis: number;        // ……
    dash: number;            // ——
    semicolon: number;       // ；
  };

  // 节奏
  rhythm: {
    longShortAlternation: number;  // 长短句交替频率
    sentenceVariability: number;   // 句长变异系数 CV
  };

  // 语气 / 正式度
  toneScore: number;            // -1~1
  formalityScore: number;        // 0~1

  // 词汇丰富度（保留，纯结构特征）
  vocabRichness: number;

  // 常用连接词（保留，反映逻辑展开方式）
  topConnectives: { word: string; freq: number }[];

  // 指纹段落（few-shot 用）
  fingerprintParagraphs: string[];
  fingerprint: string;
};

// 中文语气词
const MODAL_PARTICLES = ['啊', '呢', '嘛', '吧', '呀', '哎', '哦', '哈', '哼', '嗯', '哟', '呀'];

// 中文连接词（反映逻辑展开方式）
const CONNECTIVE_WORDS = [
  '因为', '所以', '但是', '然而', '不过', '虽然', '即使', '尽管', '如果', '假如', '只要', '除非',
  '而且', '并且', '同时', '此外', '另外', '更重要的是', '事实上', '其实', '当然', '显然', '毫无疑问',
  '因此', '于是', '于是乎', '结果', '最后', '总之', '综上', '总而言之', '首先', '其次', '再者', '最后',
  '换句话说', '也就是说', '换言之', '反之', '相反', '例如', '比如', '譬如', '以至于', '从而', '进而',
  '无论', '不管', '只要', '一旦', '每当', '当', '在...时', '随着', '既...又', '不是...而是', '不仅...而且'
];

// 比喻/拟人/排比 关键词
const METAPHOR_MARKERS = ['像', '似', '如', '似的', '仿佛', '犹如', '宛如', '好比', '如同', '像是'];

// 单字停用词
const SINGLE_STOP = new Set([
  '的', '了', '是', '在', '有', '和', '就', '不', '都', '也', '到', '说', '要', '去', '会', '着', '那', '这', '把', '他', '她', '它',
  '得', '地', '过', '上', '下', '里', '个', '们', '为', '从', '向', '以', '被', '让', '并', '且', '但', '而', '或', '若', '虽', '已', '将', '可', '应', '须', '必',
  '我', '你', '他', '她', '它', '们'
]);

/**
 * 分句
 */
function splitSentences(text: string): string[] {
  return text
    .replace(/[\r\n]+/g, '。')
    .split(/(?<=[。！？!?；;…\.])/g)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * 分段
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+|\r\n\s*\r\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * 视角分析：统计人称代词密度
 */
function analyzeViewpoint(text: string) {
  const chars = text.length || 1;
  const firstPerson = (text.match(/我|我们/g) || []).length;
  const secondPerson = (text.match(/你|你们/g) || []).length;
  const thirdPerson = (text.match(/他|她|它|他们|她们|它们/g) || []).length;
  return {
    firstPersonRatio: firstPerson / chars,
    secondPersonRatio: secondPerson / chars,
    thirdPersonRatio: thirdPerson / chars,
    impliedSubjectRatio: 0  // 简化：暂不算
  };
}

/**
 * 对话密度（含 "..." 的字符占比）
 */
function calcDialogueRatio(text: string): number {
  const dialogueMatches = text.match(/[「『"'""].*?[」』""'']/gs) || [];
  const totalDialogueChars = dialogueMatches.reduce((sum, d) => sum + d.length, 0);
  return totalDialogueChars / (text.length || 1);
}

/**
 * 检测句式模板
 */
function detectSentenceTemplates(sentences: string[]): { pattern: string; count: number; example: string }[] {
  const templates: Record<string, { count: number; example: string }> = {};

  // "X不X" "X了X"
  const repeated = /\b(.+?)\1\b/g;
  for (const s of sentences) {
    // 排比（找连续相似的 3+ 字开头）
    // 简化：找"不是...而是..."结构
    if (/不是.+?而是/.test(s)) {
      templates['不是...而是...'] = templates['不是...而是...'] || { count: 0, example: s };
      templates['不是...而是...'].count++;
    }
    if (/不仅.+?而且/.test(s)) {
      templates['不仅...而且...'] = templates['不仅...而且...'] || { count: 0, example: s };
      templates['不仅...而且...'].count++;
    }
    if (/既.+?又/.test(s)) {
      templates['既...又...'] = templates['既...又...'] || { count: 0, example: s };
      templates['既...又...'].count++;
    }
    if (/只有.+?(才|就)/.test(s)) {
      templates['只有...才...'] = templates['只有...才...'] || { count: 0, example: s };
      templates['只有...才...'].count++;
    }
    if (/如果.+?，?(那么|就|则)/.test(s)) {
      templates['如果...就...'] = templates['如果...就...'] || { count: 0, example: s };
      templates['如果...就...'].count++;
    }
    // "X着X着"
    if (/.+?着.+?着/.test(s)) {
      templates['X着X着'] = templates['X着X着'] || { count: 0, example: s };
      templates['X着X着'].count++;
    }
    // "越X越Y"
    if (/越.+?越/.test(s)) {
      templates['越X越Y'] = templates['越X越Y'] || { count: 0, example: s };
      templates['越X越Y'].count++;
    }
    // "一会儿...一会儿..."
    if (/一会儿.+?一会儿/.test(s)) {
      templates['一会儿...一会儿...'] = templates['一会儿...一会儿...'] || { count: 0, example: s };
      templates['一会儿...一会儿...'].count++;
    }
  }

  return Object.entries(templates)
    .filter(([_, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([pattern, v]) => ({ pattern, count: v.count, example: v.example }));
}

/**
 * 句式比例
 */
function analyzeSentencePatterns(sentences: string[]) {
  const total = sentences.length || 1;
  const questionCount = sentences.filter(s => /[？?]$/.test(s)).length;
  const exclamatoryCount = sentences.filter(s => /[！!]$/.test(s)).length;
  // 反问：句末问号 + 包含否定词
  const rhetoricalCount = sentences.filter(s => /[？?]$/.test(s) && /(难道|怎么会|怎么可能|不是|怎么)/.test(s)).length;
  // 排比：粗略检测（连续 3 句有相同起始词）
  let parallelCount = 0;
  for (let i = 0; i < sentences.length - 2; i++) {
    const start1 = sentences[i].slice(0, 2);
    const start2 = sentences[i + 1].slice(0, 2);
    const start3 = sentences[i + 2].slice(0, 2);
    if (start1 && start1 === start2 && start2 === start3) parallelCount++;
  }
  // 对比："不是...而是..."
  const contrastCount = sentences.filter(s => /不是.+?而是/.test(s)).length;
  // 渐进："X着X着" "越X越Y"
  const progressiveCount = sentences.filter(s => /(.+?)\1|^越.+?越/.test(s)).length;

  return {
    parallelRatio: parallelCount / total,
    contrastRatio: contrastCount / total,
    rhetoricalQuestionRatio: rhetoricalCount / total,
    exclamatoryRatio: exclamatoryCount / total,
    progressiveRatio: progressiveCount / total
  };
}

/**
 * 修辞手法
 */
function analyzeRhetoricalDevices(sentences: string[]) {
  let metaphor = 0;
  let personification = 0;
  let parallelism = 0;

  for (const s of sentences) {
    // 比喻：含比喻词
    if (METAPHOR_MARKERS.some(m => s.includes(m))) metaphor++;
    // 拟人：粗略检测（无生命名词 + 动作动词）
    // 简化：含"仿佛/似乎"+动词
    if (/(风|雨|雪|月|花|树|山|水|星|云|夜|光|影子)(轻轻|悄悄|默默|慢慢|静静|缓缓|偷偷|独自|默默|低低)/.test(s)) {
      personification++;
    }
    // 排比：连续逗号分隔的相似结构（3+ 项）
    if (s.split('，').length >= 3 && s.split(/[，,]/).every(part => part.length >= 2 && part.length <= 6)) {
      parallelism++;
    }
  }
  return { metaphor, personification, parallelism };
}

/**
 * 语气词统计
 */
function analyzeModalParticles(text: string): { word: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const p of MODAL_PARTICLES) {
    const c = (text.match(new RegExp(p, 'g')) || []).length;
    if (c > 0) counts[p] = c;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));
}

/**
 * 标点习惯
 */
function analyzePunctuation(text: string) {
  const chars = (text.length || 1) / 100;
  return {
    exclamation: (text.match(/[!！]/g) || []).length / chars,
    question: (text.match(/[?？]/g) || []).length / chars,
    ellipsis: (text.match(/[…]{2,}|……/g) || []).length / chars,
    dash: (text.match(/[—–-]{2}/g) || []).length / chars,
    semicolon: (text.match(/[;；]/g) || []).length / chars
  };
}

/**
 * 节奏
 */
function analyzeRhythm(sentences: string[]) {
  const lengths = sentences.map(s => s.length);
  const avg = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
  const std = Math.sqrt(lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / (lengths.length || 1));
  const cv = avg > 0 ? std / avg : 0;

  // 长短句交替：相邻两句长度差 > 50% 算"交替"
  let alternations = 0;
  for (let i = 0; i < lengths.length - 1; i++) {
    if (lengths[i] > 0 && Math.abs(lengths[i + 1] - lengths[i]) / lengths[i] > 0.5) {
      alternations++;
    }
  }
  return {
    longShortAlternation: alternations / (lengths.length || 1),
    sentenceVariability: cv
  };
}

/**
 * 情感倾向
 */
function calcToneScore(text: string): number {
  const positiveWords = ['温暖', '美好', '幸福', '感动', '快乐', '希望', '梦想', '喜欢', '爱', '感谢', '感激', '欣慰', '幸福', '美好', '美丽', '温柔', '善良'];
  const negativeWords = ['难过', '悲伤', '痛苦', '失望', '绝望', '孤独', '寂寞', '恐惧', '害怕', '担心', '焦虑', '痛苦', '残酷', '冷漠', '无情'];
  let score = 0;
  for (const w of positiveWords) {
    score += (text.match(new RegExp(w, 'g')) || []).length * 0.1;
  }
  for (const w of negativeWords) {
    score -= (text.match(new RegExp(w, 'g')) || []).length * 0.1;
  }
  return Math.max(-1, Math.min(1, score));
}

/**
 * 正式度
 */
function calcFormalityScore(text: string): number {
  const formalMarkers = ['因此', '然而', '此外', '事实上', '然而', '可见', '可知', '显然', '毋庸置疑', '显然', '尽管'];
  const informalMarkers = ['挺', '蛮', '还好', '搞', '弄', '吧', '啊', '呢', '嘛', '哈', '哎', '嗯', '哦', '哇', '嘿'];
  let score = 0.5;
  for (const m of formalMarkers) {
    score += (text.match(new RegExp(m, 'g')) || []).length * 0.05;
  }
  for (const m of informalMarkers) {
    score -= (text.match(new RegExp(m, 'g')) || []).length * 0.05;
  }
  return Math.max(0, Math.min(1, score));
}

/**
 * 提取常用连接词（保留，反映逻辑展开方式）
 */
function analyzeConnectives(text: string): { word: string; freq: number }[] {
  const counts: { word: string; freq: number }[] = [];
  for (const conn of CONNECTIVE_WORDS) {
    const count = (text.match(new RegExp(conn, 'g')) || []).length;
    if (count > 0) {
      counts.push({ word: conn, freq: count });
    }
  }
  return counts.sort((a, b) => b.freq - a.freq).slice(0, 8);
}

/**
 * 词汇丰富度（粗略）
 */
function calcVocabRichness(text: string): number {
  const cleaned = text.replace(/[\s\p{P}]+/gu, '');
  const chars: string[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    chars.push(cleaned.slice(i, i + 2));
  }
  if (chars.length === 0) return 0;
  return new Set(chars).size / chars.length;
}

/**
 * 提取 DNA（核心入口）
 */
export function extractStyleDNA(samples: string[]): StyleDNA {
  if (samples.length === 0) {
    throw new Error('At least one sample is required');
  }
  const fullText = samples.join('\n\n');
  const sentences = splitSentences(fullText);
  const paragraphs = splitParagraphs(fullText);

  // 基础句法
  const sentenceLengths = sentences.map(s => s.length);
  const avgSentenceLen = sentenceLengths.length > 0
    ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
    : 0;
  const sentenceLenStd = sentenceLengths.length > 0
    ? Math.sqrt(sentenceLengths.reduce((sum, l) => sum + Math.pow(l - avgSentenceLen, 2), 0) / sentenceLengths.length)
    : 0;
  const short = sentenceLengths.filter(l => l <= 15).length;
  const medium = sentenceLengths.filter(l => l > 15 && l <= 35).length;
  const long = sentenceLengths.filter(l => l > 35).length;
  const totalS = sentenceLengths.length || 1;

  const paragraphLengths = paragraphs.map(p => p.length);
  const paragraphLenAvg = paragraphLengths.length > 0
    ? paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length
    : 0;
  const paragraphLenStd = paragraphLengths.length > 0
    ? Math.sqrt(paragraphLengths.reduce((sum, l) => sum + Math.pow(l - paragraphLenAvg, 2), 0) / paragraphLengths.length)
    : 0;

  // 视角 / 对话
  const viewpoint = analyzeViewpoint(fullText);
  const dialogueRatio = calcDialogueRatio(fullText);

  // 句式
  const sentencePatterns = analyzeSentencePatterns(sentences);
  const topSentenceTemplates = detectSentenceTemplates(sentences);

  // 修辞
  const rhetoricalDevices = analyzeRhetoricalDevices(sentences);

  // 语气词 / 标点 / 节奏
  const modalParticles = analyzeModalParticles(fullText);
  const punctuation = analyzePunctuation(fullText);
  const rhythm = analyzeRhythm(sentences);

  // 语气 / 词汇
  const toneScore = calcToneScore(fullText);
  const formalityScore = calcFormalityScore(fullText);
  const vocabRichness = calcVocabRichness(fullText);
  const topConnectives = analyzeConnectives(fullText);

  // Few-shot 段落
  const sortedParas = paragraphs
    .filter(p => p.length >= 50)
    .sort((a, b) => Math.abs(a.length - 200) - Math.abs(b.length - 200));
  const fingerprintParagraphs = sortedParas.slice(0, 3);

  const fingerprint = Buffer.from(`${samples.length}|${fullText.length}|${avgSentenceLen.toFixed(1)}|${vocabRichness.toFixed(3)}`).toString('base64');

  return {
    sampleCount: samples.length,
    totalChars: fullText.length,
    avgSentenceLen: Math.round(avgSentenceLen * 10) / 10,
    sentenceLenDist: {
      short: short / totalS,
      medium: medium / totalS,
      long: long / totalS
    },
    sentenceLenStd: Math.round(sentenceLenStd * 10) / 10,
    paragraphLenAvg: Math.round(paragraphLenAvg),
    paragraphLenStd: Math.round(paragraphLenStd),
    viewpoint,
    dialogueRatio: Math.round(dialogueRatio * 1000) / 1000,
    sentencePatterns: {
      parallelRatio: Math.round(sentencePatterns.parallelRatio * 1000) / 1000,
      contrastRatio: Math.round(sentencePatterns.contrastRatio * 1000) / 1000,
      rhetoricalQuestionRatio: Math.round(sentencePatterns.rhetoricalQuestionRatio * 1000) / 1000,
      exclamatoryRatio: Math.round(sentencePatterns.exclamatoryRatio * 1000) / 1000,
      progressiveRatio: Math.round(sentencePatterns.progressiveRatio * 1000) / 1000
    },
    topSentenceTemplates,
    rhetoricalDevices,
    modalParticles,
    punctuation: {
      exclamation: Math.round(punctuation.exclamation * 100) / 100,
      question: Math.round(punctuation.question * 100) / 100,
      ellipsis: Math.round(punctuation.ellipsis * 100) / 100,
      dash: Math.round(punctuation.dash * 100) / 100,
      semicolon: Math.round(punctuation.semicolon * 100) / 100
    },
    rhythm: {
      longShortAlternation: Math.round(rhythm.longShortAlternation * 1000) / 1000,
      sentenceVariability: Math.round(rhythm.sentenceVariability * 1000) / 1000
    },
    toneScore: Math.round(toneScore * 100) / 100,
    formalityScore: Math.round(formalityScore * 100) / 100,
    vocabRichness: Math.round(vocabRichness * 1000) / 1000,
    topConnectives,
    fingerprintParagraphs,
    fingerprint
  };
}

/**
 * 把 DNA 转成风格描述（重点：表达习惯）
 */
export function dnaToStyleDescription(dna: StyleDNA): string {
  const lines: string[] = [];

  lines.push('# 用户的语言习惯档案（HOW，不是 WHAT）');
  lines.push('');

  // 视角
  const vp = dna.viewpoint;
  const vpDesc = [];
  if (vp.firstPersonRatio > 0.01) vpDesc.push(`第一人称代入强（"我"出现 ${(vp.firstPersonRatio * 100).toFixed(1)}%）`);
  else if (vp.firstPersonRatio < 0.003) vpDesc.push('几乎不用第一人称（旁观者视角）');
  if (vp.thirdPersonRatio > 0.005) vpDesc.push(`第三人称叙述多（"他/她"${(vp.thirdPersonRatio * 100).toFixed(1)}%）`);
  if (vp.secondPersonRatio > 0.005) vpDesc.push(`第二人称对话多（"你"${(vp.secondPersonRatio * 100).toFixed(1)}%）`);
  if (vpDesc.length > 0) lines.push(`- 视角：${vpDesc.join('，')}`);
  if (dna.dialogueRatio > 0.05) lines.push(`- 对话密度高（${(dna.dialogueRatio * 100).toFixed(1)}% 的字符是对话）`);

  // 句式
  const sp = dna.sentencePatterns;
  const spDesc = [];
  if (sp.parallelRatio > 0.1) spDesc.push('爱用排比');
  if (sp.contrastRatio > 0.05) spDesc.push('爱用对比（"不是X而是Y"）');
  if (sp.rhetoricalQuestionRatio > 0.05) spDesc.push('爱用反问');
  if (sp.exclamatoryRatio > 0.05) spDesc.push('爱用感叹');
  if (sp.progressiveRatio > 0.05) spDesc.push('爱用渐进句式（"X着X着""越X越Y"）');
  if (spDesc.length > 0) lines.push(`- 句式偏好：${spDesc.join('、')}`);

  if (dna.topSentenceTemplates.length > 0) {
    lines.push(`- 高复现句式模板：${dna.topSentenceTemplates.map(t => `"${t.pattern}"(${t.count}次)`).join('、')}`);
  }

  // 修辞
  const rd = dna.rhetoricalDevices;
  const rdDesc = [];
  if (rd.metaphor > 0) rdDesc.push(`比喻 ${rd.metaphor} 处`);
  if (rd.personification > 0) rdDesc.push(`拟人 ${rd.personification} 处`);
  if (rd.parallelism > 0) rdDesc.push(`排比 ${rd.parallelism} 处`);
  if (rdDesc.length > 0) lines.push(`- 修辞：${rdDesc.join('、')}`);

  // 语气词
  if (dna.modalParticles.length > 0) {
    lines.push(`- 语气词习惯：${dna.modalParticles.map(p => `${p.word}×${p.count}`).join('、')}`);
  }

  // 标点
  const punctDesc = [];
  if (dna.punctuation.exclamation > 0.5) punctDesc.push(`感叹号 ${dna.punctuation.exclamation.toFixed(1)}/100字`);
  if (dna.punctuation.question > 0.5) punctDesc.push(`问号 ${dna.punctuation.question.toFixed(1)}/100字`);
  if (dna.punctuation.ellipsis > 0.3) punctDesc.push(`省略号 ${dna.punctuation.ellipsis.toFixed(1)}/100字`);
  if (dna.punctuation.dash > 0.3) punctDesc.push(`破折号 ${dna.punctuation.dash.toFixed(1)}/100字`);
  if (punctDesc.length > 0) lines.push(`- 标点习惯：${punctDesc.join('、')}`);

  // 节奏
  const dominant = Object.entries(dna.sentenceLenDist).sort((a, b) => b[1] - a[1])[0][0];
  const lenMap: Record<string, string> = {
    short: '短句为主，节奏急促',
    medium: '中句为主，节奏平稳',
    long: '长句为主，行文绵密'
  };
  lines.push(`- 节奏：${lenMap[dominant]}`);
  if (dna.rhythm.longShortAlternation > 0.3) lines.push(`- 长短句交替频繁（${(dna.rhythm.longShortAlternation * 100).toFixed(0)}% 相邻句长度差 > 50%）`);
  if (dna.rhythm.sentenceVariability > 0.5) lines.push(`- 句长变化大（变异系数 ${dna.rhythm.sentenceVariability.toFixed(2)}）`);

  // 语气
  const toneLabel = dna.toneScore > 0.2 ? '偏感性，有温度' : dna.toneScore < -0.2 ? '偏理性，冷静克制' : '中性';
  const formalityLabel = dna.formalityScore > 0.6 ? '偏书面，正式' : dna.formalityScore < 0.4 ? '偏口语，自然亲切' : '口语与书面之间';
  lines.push(`- 语气温度：${toneLabel}`);
  lines.push(`- 正式度：${formalityLabel}`);

  // 连接词
  if (dna.topConnectives.length > 0) {
    lines.push(`- 常用连接词：${dna.topConnectives.slice(0, 5).map(c => c.word).join('、')}`);
  }

  return lines.join('\n');
}
