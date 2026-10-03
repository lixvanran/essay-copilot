# 作文副驾驶 · v0.6.0

> Not "write the best", but "write the most like you".

AI essay writing that mimics **YOUR** style — not generic AI style.

通过提取你的文风，注入 Agent 的 prompt（后期升级为 RAG），让 AI 写出**完全像你本人**的作文，规避反 AI 检测。

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-lixvanran%2Fessay--copilot-black.svg)](https://github.com/lixvanran/essay-copilot)
[![Tests](https://img.shields.io/badge/tests-38_passing-brightgreen.svg)]()
[![Coverage](https://img.shields.io/badge/coverage-90%25+-brightgreen.svg)]()

**国区 OpenRouter 优化**：默认走国产模型（Kimi K2 / DeepSeek V3 / Qwen），国区账户也能用。

---

## v0.5.0 重大升级

### 🔥 三大核心功能

1. **大纲模式（Outline Mode）** — 学生最需要：先出大纲（立意 + 段落 + 论据），再展开成全文
2. **评分预测** — 杀手锏：丢一篇作文 + 评分标准 → AI 预测会得几分（带维度分解）
3. **历史记录面板** — 之前留的尾巴，补上 UI。侧栏打开，最近 5 篇可调出

### 📦 部署 + 工程化

- **Docker 镜像**（多阶段构建，最终 ~150MB，含 HEALTHCHECK）
- **docker-compose.yml**（一键启动）
- **GitHub Actions CI**（typecheck + lint + test + build）
- **PWA**（service worker + manifest，离线可用）
- **PDF 导出**（嵌入中文字体，pdf-lib 纯 JS）
- **集成测试**（API routes）

### v0.5.0 三大新接口

```
POST /api/outline           ← 大纲生成（结构 + 论点）
POST /api/outline-to-essay  ← 大纲展开成全文
POST /api/predict-score     ← 评分预测（带维度分解 + AI 嫌疑检测）
```

### 完整 API 路由（11 个）

```
POST /api/analyze           风格提取
POST /api/deauto-essay      AI 味自动消除（杀手锏）
POST /api/generate          生成
POST /api/generate-topic    AI 题目生成
GET  /api/health            健康检查
POST /api/outline           大纲生成（新）
POST /api/outline-to-essay  大纲展开（新）
POST /api/polish            润色
POST /api/predict-score     评分预测（新）
POST /api/rewrite-segment   段落重写
POST /api/score             AI 评分
POST /api/set-key           Key 管理
```

---

## 一键启动（Windows）

**双击 `启动.vbs`** —— 一个文件搞定。

如果双击后弹出一个黑色 cmd 窗口，窗口里跑 4 步检查 + 看到 `Ready in Xs`，就成功了。浏览器开 `http://localhost:3000`。

按 **Ctrl+C** 停服务。

### 为什么用 .vbs 而不是 .bat？

Node.js v24 在某些 Windows 上会接管 `.bat` 文件关联，导致双击 .bat 后内容被 Node REPL 切碎执行（看到 `'xxx' 不是外部或内部命令` + `Welcome to Node.js`），这是系统层问题脚本层面修不了。

`.vbs` 文件在 Windows 上**始终关联 `wscript.exe`**，与 Node 完全无关——绝对不会被接管。

---

## Mac / Linux

```bash
cd 作文副驾驶
./启动.sh
```

或者：

```bash
cd 作文副驾驶
node start.js
```

---

## 使用流程

### 模式 A：写新作文（默认）

1. **上传范文**（.txt / .md / .docx）— 自动用 jieba 提取分词 + LLM 提取风格画像
2. **生成作文**（输入题目，选生成模式）
   - **多采样**：1 个模型生成 3 篇，挑 AI 味最低的
   - **多模型对比**：DeepSeek / Qwen / Kimi 同时跑，挑最佳的（推荐）
   - **单篇**：最快
3. **查看 & 精调结果**
   - AI 痕迹评分（实时更新）
   - 可疑句标红
   - **⚡ 一键消除 AI 味**（杀手锏按钮，10 秒降到 ≤ 25 分）
   - **段落级重写**（鼠标悬停段落 → "重写这段" → AI 重写）
   - **可疑句一键重写**（FlaggedPanel 右侧 ✏️ 按钮）
   - **撤销上一步**（顶部 ↶ 按钮，10 步历史）
   - 一键复制 / 下载 .txt / 下载 .docx / 下载 .md

### 模式 B：润色现有作文

1. 顶部切到 "💎 润色现有"
2. 上传 1-3 篇范文（作为风格参考）
3. 粘贴你想润色的全文
4. AI 按你的风格打磨每一句（不重写）
5. 进入同样的结果页精调

### 🪄 AI 题目生成器

第二步点 "🪄 AI 出题" → 输入关键词（如"成长 父爱 失败"）+ 选学段 → 自动出 3-5 个题目候选 → 点选填入。

### 🌙 暗色主题

Header 右侧 🌙 / ☀️ 一键切换，自动 localStorage 持久化。

---

## 配置 OpenRouter API Key

**方式 A：写入 .env.local**（推荐）

编辑项目根目录的 `.env.local`：
```
OPENROUTER_API_KEY=sk-or-v1-你的key
```

**方式 B：UI 高级设置里临时填**（不持久化）

启动后点击首页"⚙️ Advanced Settings"展开，填进去。

去 https://openrouter.ai/keys 申请一个 key。

---

## 故障排查

| 症状 | 怎么办 |
|---|---|
| 双击 .bat 看到 "不是外部命令" / "Welcome to Node.js" | 改双击 `启动.vbs` |
| 双击 .vbs 没反应 | Windows 禁用了 WSH。试 PowerShell：`启动.ps1`（右键 → "用 PowerShell 运行"） |
| 浏览器开 http://localhost:3000 后看到 "OPENROUTER_API_KEY not configured" | 编辑 `.env.local` 或 UI 高级设置里填 |
| 装依赖卡住很久 | 网络问题；脚本默认走 npmmirror 国内镜像 |
| 端口 3000 被占用 | 跑 `停止.vbs`（或 `./停止.sh`）杀掉旧进程 |

跑 `诊断.vbs`（或 `./诊断.sh`）会生成 `diagnose.txt` 报告。

---

## 文件清单

```
作文副驾驶/
├── 启动.vbs           ← Windows 用户：双击这个
├── 启动.sh            ← Mac/Linux 用户：./启动.sh
├── 停止.vbs / 停止.sh ← 兜底清理
├── 诊断.vbs / 诊断.sh ← 出问题时生成报告
├── start.js           ← Node 启动器（vbs/sh 都调它）
├── .env.example       ← 环境变量模板
├── app/               ← Next.js 代码
├── components/        ← React 组件
├── lib/               ← 文风 DNA / AI 痕迹 / LLM 客户端
└── MVP_PLAN.md        ← 规划文档
```

---

## 隐私

v0.5 阶段：
- **localStorage 持久化**：范文/DNA/历史（仅你本机，7 天自动过期）
- **不上传服务器**：.docx 文件解析在浏览器端（mammoth.js）
- **LLM 调用**：直接到 OpenRouter，不经过中间存储
- **AI 题目生成**：关键词不上传，仅用于 OpenRouter
- **不做用户系统**：无账号，无登录

## 协议

[MIT](LICENSE) © 2026 [lixvanran](https://github.com/lixvanran)

## 链接

- GitHub: https://github.com/lixvanran/essay-copilot
- 报告问题: https://github.com/lixvanran/essay-copilot/issues
