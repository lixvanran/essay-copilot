/**
 * 验证 prompt 模板渲染
 */

import { extractStyleDNA } from '../lib/style-dna';
import { buildSystemPrompt, buildUserPrompt } from '../lib/prompts';

const SAMPLE = `那天的阳光很好，好得让人有点恍惚。我坐在老屋门前的石阶上，手里攥着一封已经翻过很多遍的信。风从远处的山坳里吹过来，把信纸的边角掀起一个微小的弧度。

奶奶去世三个月了。我一直觉得她还在，只是去了一个我暂时去不了的地方。妈妈说，奶奶最疼你，你得好好读书，将来出息了，奶奶在那边也高兴。我没说话，把信塞回信封，塞得很慢。

后来我上了中学，离开了那个小山村。每年清明，我都会回去，给奶奶的坟头添一抔新土。村里的人说我孝顺，我知道不是。我只是害怕，害怕再过几年，连她的样子都记不清了。

现在我坐在大学宿舍里写这篇作文，窗外的梧桐树叶被风吹得沙沙响。忽然很想念那个小山村，想念那扇老木门，想念门前的石阶，还有那个永远等在门口的老人。`;

const dna = extractStyleDNA([SAMPLE]);
const systemPrompt = buildSystemPrompt(dna);
const userPrompt = buildUserPrompt({
  dna,
  topic: '那一刻，我长大了',
  requirements: '记叙文，要有具体细节和人物对话',
  targetLength: 800
});

console.log('=== SYSTEM PROMPT (前 1500 字符) ===\n');
console.log(systemPrompt.slice(0, 1500));
console.log('\n... [省略中间部分] ...\n');
console.log(systemPrompt.slice(-500));

console.log('\n\n=== USER PROMPT ===\n');
console.log(userPrompt);

console.log('\n=== 统计 ===');
console.log(`System prompt 长度: ${systemPrompt.length} 字符`);
console.log(`User prompt 长度: ${userPrompt.length} 字符`);
console.log(`Few-shot 段落数: ${dna.fingerprintParagraphs.length}`);
dna.fingerprintParagraphs.forEach((p, i) => {
  console.log(`  段落 ${i + 1}: ${p.length} 字`);
});
