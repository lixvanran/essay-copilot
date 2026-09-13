# 作文副驾驶 · v0.2.0

> Not "write the best", but "write the most like you".

AI essay writing that mimics **YOUR** style — not generic AI style.

通过提取你的文风，注入 Agent 的 prompt（后期升级为 RAG），让 AI 写出**完全像你本人**的作文，规避反 AI 检测。

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-lixvanran%2Fessay--copilot-black.svg)](https://github.com/lixvanran/essay-copilot)

**国区 OpenRouter 优化**：默认走国产模型（Kimi K2 / DeepSeek V3 / Qwen），国区账户也能用。

---

## v0.2.0 重大升级

| 模块 | v0.1.0 | v0.2.0 |
|---|---|---|
| **分词** | 简单双字切分（噪声大） | **jieba-wasm 真实分词** |
| **风格提取** | 纯规则 | **规则 + LLM 风格画像**（质化+量化） |
| **功能词** | 无 | 提取**真实的连词/语气词/副词**（jieba 词表） |
| **生成模式** | 单模型 | **多采样 / 多模型对比（DeepSeek+Qwen+Kimi）/ 单篇** |
| **实测试** | 13 分 | **Kimi 18 分 · Qwen 30 · DeepSeek 37** |
| **复制/下载** | 无 | 一键复制 + 下载 .txt |
| **错误提示** | 技术性 | 友好化（余额不足/Key 错误/限流 都有明确指引） |
| **加载状态** | 死板 spinner | 进度文字 + 旋转图标 |

**v0.2.0 核心**：**LLM 风格画像 + jieba 真实分词** —— 文风模仿的两大引擎都装上了。

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

## 三步使用流程

1. **上传范文**（1-10 篇你过去的作文）— 自动用 jieba 提取分词 + LLM 提取风格画像
2. **生成作文**（输入题目，选生成模式）
   - **多采样**：1 个模型生成 3 篇，挑 AI 味最低的
   - **多模型对比**：DeepSeek / Qwen / Kimi 同时跑，挑最佳的（推荐）
   - **单篇**：最快
3. **查看结果**（AI 痕迹评分 + 可疑句标红 + 一键复制/下载）

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

v0.2 阶段：
- 不保存任何数据到磁盘
- 不做用户系统
- 范文仅在内存中处理，刷新即丢
- LLM 调用直接到 OpenRouter，不经过中间存储
- **风格画像有内存缓存**（同进程内相同范文不重复调 LLM），重启即清空

## 协议

[MIT](LICENSE) © 2026 [lixvanran](https://github.com/lixvanran)

## 链接

- GitHub: https://github.com/lixvanran/essay-copilot
- 报告问题: https://github.com/lixvanran/essay-copilot/issues
