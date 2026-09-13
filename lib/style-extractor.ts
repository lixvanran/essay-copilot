/**
 * LLM 风格画像提取器
 *
 * 用 LLM 读范文，输出"质化"语言习惯画像
 * 补充规则提取的"量化" DNA（句长/词频等）
 *
 * 核心：LLM 擅长识别规则算不出的微妙特征
 *   - 讽刺 vs 真诚
 *   - 少年老成 vs 老气横秋
 *   - 冷峻克制 vs 温暖抒情
 *   - 标志性怪癖（"这人爱用但是""这人爱反问开篇"）
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export type StyleProfile = {
  perspective: 'first_person' | 'third_person' | 'observer' | 'mixed';
  emotionalTone: string;          // 1-3 个形容词
  rhetoricalStyle: string;        // 议论文/记叙文/抒情等
  signatureTechniques: string[];  // 3-5 个标志性技巧
  sentenceHabits: string;         // 短句急促/长句绵密/长短交错
  metaphorStyle: string;          // 朴素/适度/密集/创新
  voicePersonality: string;       // 1-3 个词，如"少年老成"
  paragraphStructure: string;     // 段落结构特征
  keyPhrases: { phrase: string; usage: string }[];  // 标志性短语 + 用法
  avoidPatterns: string[];        // 不用什么
  summary: string;                // 2-3 句话总结（要能让人一眼模仿）
};

const EXTRACTION_PROMPT = `你是一位资深的中文写作老师，擅长"一眼看出"一个学生的语言习惯。

请仔细阅读以下学生的作文，提取出这位学生的"语言习惯画像"——**只关注表达习惯，不关注主题词**。

# 学生作文

{ESSAYS}

# 你的任务

请输出一份**严格的 JSON**（不要 markdown 包装，不要解释），包含：

{
  "perspective": "first_person | third_person | observer | mixed 之一",
  "emotionalTone": "用 1-3 个形容词描述情感基调，如：冷峻/温情/讽刺/克制/激昂/克制中带温情",
  "rhetoricalStyle": "议论文 | 记叙文 | 抒情 | 夹叙夹议 | 说明文 | 对话体 | 其他（描述）",
  "signatureTechniques": ["3-5 个标志性技巧", "如：设问开篇", "先抑后扬", "夹叙夹议", "善用排比", "反问+举例组合"],
  "sentenceHabits": "短句急促 | 长句绵密 | 长短交错 | 善用问句 | 对仗工整 | 散文化",
  "metaphorStyle": "朴素（很少用比喻）| 适度（偶尔点睛）| 密集（很多修辞）| 创新（自造比喻）",
  "voicePersonality": "1-3 个词，如：少年老成 / 老辣尖锐 / 温柔克制 / 少年意气 / 学者腔",
  "paragraphStructure": "段落均匀 | 长短变化 | 起承转合 | 引述-分析-总结 | 时间顺序 | 空间顺序",
  "keyPhrases": [
    {"phrase": "这个学生爱用的标志性短语", "usage": "在什么场景用"},
    ...（2-4 个）
  ],
  "avoidPatterns": ["这个学生从不用的开头", "从不用的句式", "从不用的词（不是主题词，是表达习惯）", ...],
  "summary": "2-3 句话总结这个学生的语言风格。重点是**怎么讲**，让没看过原文的人能根据这段总结模仿出来"
}

# 重要原则

1. **只关注"怎么讲"，不关注"讲什么"**。不要提取主题词。
2. **质化优先**。宁可写"冷峻克制中偶尔泄出温情"也不要写"中性"。
3. **具体**。"善用反问后接自答"比"善用问句"好。
4. **避免空话**。不要说"语言流畅""结构清晰"——任何文章都能这么说。
5. **avoidPatterns 一定要填**——这个学生不用什么同样能说明他是谁。

只输出 JSON，不要其他内容。`;

// 内存缓存（同进程内）
const profileCache = new Map<string, StyleProfile>();

/**
 * 简单 hash 范文文本
 */
function hashEssays(samples: string[]): string {
  const full = samples.join('\n---\n');
  // 简单 djb2 hash
  let hash = 5381;
  for (let i = 0; i < full.length; i++) {
    hash = ((hash << 5) + hash) + full.charCodeAt(i);
    hash = hash & hash;
  }
  return `p${samples.length}-${full.length}-${(hash >>> 0).toString(36)}`;
}

/**
 * 提取风格画像（带缓存）
 */
export async function extractStyleProfile(
  samples: string[],
  apiKey: string,
  options: {
    model?: string;
    useCache?: boolean;
  } = {}
): Promise<StyleProfile> {
  if (samples.length === 0) {
    throw new Error('At least one sample is required');
  }

  const cacheKey = hashEssays(samples);
  if (options.useCache !== false && profileCache.has(cacheKey)) {
    return profileCache.get(cacheKey)!;
  }

  const model = options.model || 'qwen/qwen-2.5-72b-instruct';
  const fullText = samples.join('\n\n---\n\n');

  // 截断超长文本（避免超 token）
  const truncated = fullText.length > 8000 ? fullText.slice(0, 8000) + '\n\n...[已截断]...' : fullText;
  const prompt = EXTRACTION_PROMPT.replace('{ESSAYS}', truncated);

  const start = Date.now();
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://essay-copilot.local',
      'X-Title': 'Essay Co-Pilot Style Extractor'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,   // 低温度，要稳定的 JSON 输出
      max_tokens: 1500,
      top_p: 0.9,
      response_format: { type: 'json_object' }  // 强制 JSON 输出
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data: any = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from LLM');
  }

  // 解析 JSON（response_format 应该保证是 JSON，但稳妥起见再 try 一次）
  let profile: StyleProfile;
  try {
    profile = JSON.parse(content);
  } catch {
    // 提取 JSON 块
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Failed to parse JSON: ' + content.slice(0, 200));
    profile = JSON.parse(match[0]);
  }

  // 简单验证
  if (!profile.perspective || !profile.summary) {
    throw new Error('Incomplete profile from LLM: ' + content.slice(0, 200));
  }

  // 缓存
  profileCache.set(cacheKey, profile);

  console.log(`[style-extractor] extracted profile in ${Date.now() - start}ms using ${model}`);
  return profile;
}

/**
 * 把 profile 转成 prompt 用的描述（注入到 system prompt）
 */
export function profileToPromptSection(profile: StyleProfile): string {
  const lines: string[] = [];
  lines.push('# LLM 风格画像（这是这位学生最鲜明的"文风指纹"）');
  lines.push('');
  lines.push(`**情感基调**：${profile.emotionalTone}`);
  lines.push(`**修辞类型**：${profile.rhetoricalStyle}`);
  lines.push(`**声音人格**：${profile.voicePersonality}`);
  lines.push(`**视角**：${profile.perspective}`);
  lines.push('');
  lines.push(`**标志性技巧**：${profile.signatureTechniques.join(' / ')}`);
  lines.push('');
  lines.push(`**句式习惯**：${profile.sentenceHabits}`);
  lines.push(`**比喻风格**：${profile.metaphorStyle}`);
  lines.push(`**段落结构**：${profile.paragraphStructure}`);
  lines.push('');
  if (profile.keyPhrases.length > 0) {
    lines.push(`**标志性短语**（用得自然不刻意）：`);
    for (const kp of profile.keyPhrases) {
      lines.push(`  - "${kp.phrase}" —— ${kp.usage}`);
    }
    lines.push('');
  }
  if (profile.avoidPatterns.length > 0) {
    lines.push(`**避免**：${profile.avoidPatterns.join(' / ')}`);
    lines.push('');
  }
  lines.push(`**风格总结**：${profile.summary}`);
  return lines.join('\n');
}
