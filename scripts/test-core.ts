/**
 * 核心逻辑本地测试（不依赖 LLM）
 * 运行：npx tsx scripts/test-core.ts
 */

import { extractStyleDNA, dnaToStyleDescription } from '../lib/style-dna';
import { scoreAITrace } from '../lib/ai-detector';

const SAMPLE_HUMAN = `那天的阳光很好，好得让人有点恍惚。我坐在老屋门前的石阶上，手里攥着一封已经翻过很多遍的信。风从远处的山坳里吹过来，把信纸的边角掀起一个微小的弧度。

奶奶去世三个月了。我一直觉得她还在，只是去了一个我暂时去不了的地方。妈妈说，奶奶最疼你，你得好好读书，将来出息了，奶奶在那边也高兴。我没说话，把信塞回信封，塞得很慢。

后来我上了中学，离开了那个小山村。每年清明，我都会回去，给奶奶的坟头添一抔新土。村里的人说我孝顺，我知道不是。我只是害怕，害怕再过几年，连她的样子都记不清了。

现在我坐在大学宿舍里写这篇作文，窗外的梧桐树叶被风吹得沙沙响。忽然很想念那个小山村，想念那扇老木门，想念门前的石阶，还有那个永远等在门口的老人。`;

const SAMPLE_AI = `在当今社会，成长是每个人必须面对的重要课题。每个人的成长历程都深刻地反映了时代的变迁，这种经历不仅展现了个人奋斗的重要性，更体现了家庭教育的深远影响。

首先，我们应该认识到，成长不仅仅意味着年龄的增长，更重要的是心智的成熟。其次，在成长的道路上，家庭扮演着至关重要的角色。事实证明，良好的家庭教育能够为孩子的未来奠定坚实的基础。

此外，学校教育同样不可或缺。毋庸置疑，学校是孩子学习知识、培养能力的重要场所。只有通过家校共育，才能真正促进学生的全面发展。让我们携手共进，为孩子的成长保驾护航。

总之，成长是一个复杂而深刻的过程，需要家庭、学校和社会共同努力。只有这样，我们才能培养出更多优秀的人才，为社会的发展做出更大的贡献。`;

console.log('=== 文风 DNA 提取测试 ===\n');

// 真人作文
const dna1 = extractStyleDNA([SAMPLE_HUMAN]);
console.log('【真人作文 DNA】');
console.log(dnaToStyleDescription(dna1));
console.log('高 DNA 句式模板:', dna1.topSentenceTemplates.map(t => `${t.pattern}(${t.count})`).join(', '));
console.log('视角:', `我 ${(dna1.viewpoint.firstPersonRatio * 100).toFixed(2)}% / 你 ${(dna1.viewpoint.secondPersonRatio * 100).toFixed(2)}% / 他 ${(dna1.viewpoint.thirdPersonRatio * 100).toFixed(2)}%`);
console.log('修辞:', dna1.rhetoricalDevices);
console.log('句长分布:');
console.log(`  短句 ${(dna1.sentenceLenDist.short * 100).toFixed(0)}%`);
console.log(`  中句 ${(dna1.sentenceLenDist.medium * 100).toFixed(0)}%`);
console.log(`  长句 ${(dna1.sentenceLenDist.long * 100).toFixed(0)}%`);

console.log('\n=== AI 痕迹自检测试 ===\n');

const score1 = scoreAITrace(SAMPLE_HUMAN, dna1);
console.log('【真人作文】');
console.log(`总分: ${score1.total} (${score1.level})`);
console.log(`  AI 词占比: ${score1.signals.aiWordRatio} 次/百字`);
console.log(`  句首重复: ${score1.signals.sentenceStartRepeat}`);
console.log(`  词汇丰富度: ${score1.signals.vocabRichness}`);
console.log(`  文风匹配: ${score1.signals.styleConsistency}`);
console.log(`  可疑句数: ${score1.flaggedSentences.length}`);

const score2 = scoreAITrace(SAMPLE_AI);
console.log('\n【AI 风格作文】');
console.log(`总分: ${score2.total} (${score2.level})`);
console.log(`  AI 词占比: ${score2.signals.aiWordRatio} 次/百字`);
console.log(`  句首重复: ${score2.signals.sentenceStartRepeat}`);
console.log(`  词汇丰富度: ${score2.signals.vocabRichness}`);
console.log(`  段落可预测: ${score2.signals.structurePredictability}`);
console.log(`  命中 AI 词: ${score2.signals.aiWordHits.map(h => `${h.word}×${h.count}`).join(', ')}`);
console.log(`  可疑句数: ${score2.flaggedSentences.length}`);
if (score2.flaggedSentences.length > 0) {
  console.log('  样例:');
  score2.flaggedSentences.slice(0, 3).forEach(f => {
    console.log(`    - ${f.sentence.slice(0, 40)}... (${f.reason})`);
  });
}

console.log('\n=== 验证 ===');
if (score1.total < score2.total) {
  console.log('✓ 真人作文 AI 味分（' + score1.total + '）< AI 作文分（' + score2.total + '），检测器有效');
} else {
  console.log('✗ 检测器失效：真人分 ≥ AI 分');
}
