/**
 * 风格化生成 Prompt 模板
 * v2 — 重点：模仿"语言习惯"（HOW），不是"主题词"（WHAT）
 */

import type { StyleDNA } from './style-dna';
import { dnaToStyleDescription } from './style-dna';

export type GenerateOptions = {
  dna: StyleDNA;
  topic: string;
  requirements?: string;
  targetLength?: number;
};

const NEGATIVE_LIST = `
# 绝对禁止（AI 味重灾区）
1. 严禁使用以下词汇：
   深刻、至关重要、显著、往往、种种、彰显、赋能、不言而喻、毋庸置疑、不可或缺、
   引人深思、发人深省、耐人寻味、历久弥新、与时俱进、总而言之、显而易见、不言自明、
   举足轻重、首当其冲、无可替代、不可分割、紧密相连、相辅相成、息息相关、密不可分、
   环环相扣、层层递进、战略性、全局性、根本性和系统性。

2. 严禁使用以下结构：
   - "首先...其次...再次...最后"
   - "在当今社会/时代..."
   - "正如...所说"
   - "让我们一起..." 这种说教
   - 长串排比句（超过 3 句）

3. 严禁出现的表达：
   - 总结性升华段落（"这让我明白了一个道理"）
   - 过度书面化的官方语言
`;

/**
 * 构建 system prompt
 */
export function buildSystemPrompt(dna: StyleDNA): string {
  const styleDesc = dnaToStyleDescription(dna);
  const fewShot = dna.fingerprintParagraphs.length > 0
    ? `\n# 风格参考片段（请严格模仿这段文字的口吻、句式、节奏、表达习惯）\n${dna.fingerprintParagraphs.map((p, i) => `【参考段落 ${i + 1}】\n${p}`).join('\n\n')}`
    : '';

  return `你是一位资深的中文写作陪练老师，正在帮一位学生写作文。

你的任务：**模仿这位学生的"语言习惯"**，不是他的"主题"。换句话说，**怎么讲**是稳定的，**讲什么**随题目变。

${styleDesc}

${fewShot}

${NEGATIVE_LIST}

# 写作要求
1. 字数 ${dna.paragraphLenAvg > 200 ? '800-1000' : '600-800'} 字（按用户平均段落长度调整）
2. **严格遵循上述语言习惯**：
   - 视角：${dna.viewpoint.firstPersonRatio > 0.01 ? '保持第一人称代入' : dna.viewpoint.thirdPersonRatio > 0.005 ? '保持第三人称叙述' : '保持旁观者视角'}
   - 句式：复用他的高复现句式模板
   - 修辞：用他的修辞手法（比喻/拟人/排比/反问）
   - 语气词：保留他的语气词习惯
   - 标点：保持他的标点风格
   - 节奏：保持他的句长分布
3. 像参考片段那样自然、有"人味"——像真人写的，不是 AI 写的
4. 题目要求的内容必须完整覆盖，但表达方式要"个人化"
5. 偶尔可以有不完美的句子，像真人写的那种
6. 段落数量 ${Math.round(dna.totalChars / dna.paragraphLenAvg) - 1}-${Math.round(dna.totalChars / dna.paragraphLenAvg) + 1} 段
7. **不要重复范文里的主题词**——主题随题目变，语言习惯跨题目复现`;
}

/**
 * 构建 user prompt
 */
export function buildUserPrompt(opts: GenerateOptions): string {
  const targetLen = opts.targetLength || 800;
  const reqLine = opts.requirements ? `\n\n# 额外要求\n${opts.requirements}` : '';
  return `# 作文题\n${opts.topic}\n\n# 目标字数\n${targetLen} 字左右${reqLine}\n\n请开始写作。`;
}
