# 作文副驾驶 (Style Co-Pilot) — MVP 规划 v0.1

> 不是写得最好，而是写得最像你。

## 一、MVP 范围（v0.1，只做"端到端跑通"）

**用户故事**：学生上传自己 3-5 篇过往作文 → 系统提取"文风 DNA" → 学生给一个作文题 → AI 用"像他本人"的口吻写一篇 → 显示 AI 味评分 + 和原文风格对比。

**做**：
- 单页 Web 应用（无登录、无数据库、本地跑也行）
- 文风 DNA 提取（高频词、句长分布、句式偏好、连接词、段落长度）
- 基于 OpenRouter 的风格化生成
- AI 痕迹自检（高频 AI 词 / 句式重复度 / 可预测性）
- 三屏流程：上传 → 生成 → 对比

**不做（v0.1 砍掉）**：
- 账号系统、历史记录
- 多用户 / 多任务管理
- 真正的反 AI 检测器对接（先用启发式打分）
- 移动端优化、UI 精修
- 异步队列、限流、监控

## 二、技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | **Next.js 14 (App Router) + TypeScript** | 一份代码搞定前后端 + API，部署简单 |
| LLM | **OpenRouter** | 用户指定，支持 Claude/GPT/Llama，灵活切换 |
| 文本分析 | **纯 JS（自实现）** | MVP 阶段不引重依赖，可控可调 |
| 样式 | **Tailwind CSS** | 快速出 UI |
| 文件上传 | 浏览器原生 `<input type=file>` + 内存读取 | MVP 不需要上传到对象存储 |
| 数据存储 | **不存储**（v0.1 一次性会话） | 简化隐私问题，专注核心效果 |

## 三、架构

```
┌────────────────────────────────────────────────┐
│  Browser                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ 上传区    │→ │ 生成区    │→ │ 对比区    │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
└───────┼─────────────┼─────────────┼────────────┘
        │             │             │
        ▼             ▼             ▼
   /api/analyze  /api/generate  /api/score
        │             │             │
        ▼             ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌──────────┐
   │ Style   │  │ OpenRouter│ │ AI-detect│
   │ DNA     │  │ (LLM)    │  │ heuristic│
   │ Extractor│  │          │  │          │
   └─────────┘  └──────────┘  └──────────┘
```

## 四、核心模块设计

### 1. 文风 DNA 提取器 (`lib/style-dna.ts`)

输入：一组用户范文（≥3 篇，建议 5+）
输出：结构化 DNA 对象

```typescript
type StyleDNA = {
  avgSentenceLen: number;          // 平均句长（字数）
  sentenceLenDist: number[];        // 句长分布（短/中/长 占比）
  vocabRichness: number;            // TTR（type-token ratio）
  topWords: { word: string; freq: number }[];  // 高频实词
  topConnectives: string[];         // 高频连接词（因为/所以/但是…）
  sentencePatterns: {              // 句式偏好
    questionRatio: number;          // 问句占比
    exclamatoryRatio: number;       // 感叹句占比
    rhetoricalQuestionRatio: number; // 反问占比
  };
  paragraphLenAvg: number;          // 平均段落长度
  toneScore: number;                // 情感倾向 (-1~1)
  formalityScore: number;           // 正式度 (0~1)
  fingerprintText: string;          // few-shot 用的代表段落拼接
};
```

### 2. 风格化生成 Prompt (`lib/prompts.ts`)

把 DNA 转成 system prompt 的"风格指南"：

```
你是一位中文写作助手，任务是根据用户提供的"文风档案"，写一篇完全像他本人写的作文。

# 用户文风档案
- 平均句长：XX 字
- 句长偏好：短句为主 / 长句为主 / 混合
- 词汇丰富度：XX
- 高频实词：XX、XX、XX
- 常用连接词：因为、所以、然而……
- 句式特征：问句占 X%，感叹句占 Y%
- 段落长度：平均 XX 字
- 语气温度：偏理性 / 偏感性
- 正式度：偏口语 / 偏书面

# 风格参考片段（few-shot）
<这里插入从原文中抽的 2-3 段典型段落>

# 写作要求
1. 严格遵循上述文风，不要使用文风档案外的华丽辞藻
2. 避免 AI 高频词：深刻、至关重要、显著、往往、种种、彰显、赋能……
3. 自然段落过渡，不要用"首先/其次/最后"这种结构
4. 题目：[用户给的题目]
5. 字数：800 字左右（中学生作文标准）
```

### 3. AI 痕迹自检器 (`lib/ai-detector.ts`)

```typescript
type AITraceScore = {
  total: number;              // 0-100，越低越像人写的
  signals: {
    aiWordRatio: number;      // 高频 AI 词占比
    sentenceRepeatScore: number; // 句式模板重复度
    perplexityProxy: number;  // 用词多样性代理（越低越像AI）
    structurePredictability: number; // 段落结构可预测性
  };
  flaggedPhrases: string[];  // 标出的可疑句
};
```

判定规则（v0.1 启发式）：
- 命中 `AI_WORDS`（"深刻""至关重要""赋能""彰显""不言而喻""毋庸置疑"…）> 3 个 → 加分
- 句式首词重复率 > 30% → 加分
- TTR < 0.3 → 加分
- 段落长度方差 < 阈值（太均匀）→ 加分

### 4. OpenRouter 调用 (`lib/llm.ts`)

```typescript
async function generateEssay(opts: {
  styleDNA: StyleDNA;
  topic: string;
  requirements?: string;
  model?: string;  // 默认 anthropic/claude-3.5-sonnet
}): Promise<string>;
```

## 五、API 路由

| 路由 | 方法 | 入参 | 出参 |
|---|---|---|---|
| `/api/analyze` | POST | `{ samples: string[] }` | `{ dna: StyleDNA }` |
| `/api/generate` | POST | `{ dna, topic, requirements? }` | `{ essay: string, model: string }` |
| `/api/score` | POST | `{ essay: string, dna? }` | `{ score: AITraceScore }` |

## 六、UI 流程（3 屏）

**屏1：上传**
- 文件选择（支持多选 .txt / .md / 粘贴文本）
- 至少 3 篇，建议 5-10
- 按钮"开始分析"

**屏2：生成**
- 左侧显示提取的文风 DNA（可视化）
- 右侧：作文题输入框 + 额外要求
- 按钮"开始写作"（调 LLM，loading 状态）

**屏3：对比**
- 上：AI 生成的作文
- 下：AI 痕迹评分（圆形仪表盘 + 信号明细 + 标出的可疑句）
- "重新生成" / "换题目"

## 七、里程碑（按天）

| Day | 目标 |
|---|---|
| D0 | 规划 + 骨架 ✅（进行中） |
| D1 | 项目初始化 + 文风 DNA 提取器 + 单测 |
| D2 | OpenRouter 集成 + Prompt 模板 + 生成接口 |
| D3 | AI 痕迹自检器 + 评分接口 |
| D4 | 前端三屏 UI 串联 |
| D5 | 端到端测试 + 调优 + 打包 |

## 八、成功标准

1. 上传 3 篇范文，10 秒内看到文风 DNA
2. 给一个题目，30 秒内生成一篇 800 字作文
3. AI 痕迹评分 < 30（满分 100）
4. 给真人看分不出是 AI 写的（手工 spot check）

## 九、风险与对策

| 风险 | 对策 |
|---|---|
| LLM 写出来还是太"AI" | 1) prompt 强化负面清单 2) 多模型对比 3) 多次采样挑最不像 AI 的 |
| 文风 DNA 提取不准确 | 用真实范文持续调参；不追求量化完美，够 prompt 用就行 |
| OpenRouter 限流/超时 | 加 retry + 多个备选模型 |
| 隐私 | v0.1 不存储样本，全在内存处理，刷新即丢 |

## 十、待用户确认

1. **技术栈**：Next.js 14 + TypeScript + Tailwind，是否 OK？还是要 Python (FastAPI) 后端？
2. **部署形态**：本地跑（`npm run dev`）？还是部署到 Vercel？
3. **默认模型**：`anthropic/claude-3.5-sonnet` 写中文作文最强；要不要默认这个？
4. **OpenRouter Key**：你等会给，我先用环境变量占位
