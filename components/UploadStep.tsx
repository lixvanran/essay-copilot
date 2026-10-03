'use client';

import { useState, useRef, useEffect } from 'react';
import mammoth from 'mammoth';
import type { StyleDNA } from '@/lib/style-dna';
import type { StyleProfile } from '@/lib/style-extractor';
import { loadAnalysis, saveAnalysis, clearAnalysis, type SavedAnalysis } from '@/lib/storage';

type Props = {
  mode: 'generate' | 'polish';
  onAnalyzed: (data: { dna: StyleDNA; profile: StyleProfile | null; profileError: string | null; samples: string[] }) => void;
  onPolish?: (data: { dna: StyleDNA; profile: StyleProfile | null; samples: string[]; polishEssay: string }) => void;
};

const DEMO_SAMPLES = [
  `那天的阳光很好，好得让人有点恍惚。我坐在老屋门前的石阶上，手里攥着一封已经翻过很多遍的信。风从远处的山坳里吹过来，把信纸的边角掀起一个微小的弧度。

奶奶去世三个月了。我一直觉得她还在，只是去了一个我暂时去不了的地方。妈妈说，奶奶最疼你，你得好好读书，将来出息了，奶奶在那边也高兴。我没说话，把信塞回信封，塞得很慢。

后来我上了中学，离开了那个小山村。每年清明，我都会回去，给奶奶的坟头添一抔新土。村里的人说我孝顺，我知道不是。我只是害怕，害怕再过几年，连她的样子都记不清了。

现在我坐在大学宿舍里写这篇作文，窗外的梧桐树叶被风吹得沙沙响。忽然很想念那个小山村，想念那扇老木门，想念门前的石阶，还有那个永远等在门口的老人。`,
  `记得小时候，最怕的就是打雷。一到雷雨天，妈妈就会把我搂在怀里，一边轻轻拍我的背，一边哼着不知名的小调。那调子没有歌词，也没有什么旋律，就是"嗯嗯嗯"的，但奇怪的是，每次听着听着，我就不怕了。

后来上学了，胆子大了些，不再怕雷。但每逢雷雨天，还是会不自觉地竖起耳朵，听外面的动静。有一次半夜下暴雨，我被雷声惊醒，推开房门，看见妈妈一个人坐在客厅的沙发上。她没开灯，就那么坐着，像是在等什么。

我问妈妈怎么不睡。妈妈说，听见雷声了，想着你小时候怕雷，过来看看。我说我都这么大了，还怕什么呀。妈妈笑了笑，没说话。

那一刻我忽然意识到，无论我长到多大，在妈妈眼里，我依然是那个缩在她怀里、被雷声吓得不敢睡觉的小男孩。`,
  `我的语文老师姓李，是一个头发花白的老头儿。他讲课的时候有个习惯，喜欢在讲台上走来走去，一边走一边说，粉笔灰落在他灰色的中山装上，像下了一层薄薄的雪。

李老师教了我们三年，初一到初三。三年里，他几乎没换过衣服，永远是那件灰色的中山装，永远是那双黑布鞋。我们背地里叫他"老古董"，但谁也不敢当面叫，因为他的眼睛特别亮，亮得让你不敢撒谎。

有一次我考试作弊，被他抓到了。他没在班里说我，只是下课后把我叫到办公室，从抽屉里拿出一块糖给我。我愣住了，不知道什么意思。他说，吃吧，做了错事的孩子更需要糖。从那以后，我再也没作过弊。

毕业那天，李老师给我们每人写了一句话。我的那张纸上写着：愿你一生坦荡。`
];

export default function UploadStep({ mode, onAnalyzed, onPolish }: Props) {
  const [texts, setTexts] = useState<string[]>([]);
  const [polishEssay, setPolishEssay] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyStatus, setKeyStatus] = useState<{ hasKey: boolean; length?: number; isPlaceholder?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyMessage, setKeyMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savedSession, setSavedSession] = useState<SavedAnalysis | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const polishFileRef = useRef<HTMLInputElement>(null);

  // 启动时检查 localStorage
  useEffect(() => {
    const saved = loadAnalysis();
    if (saved) setSavedSession(saved);
  }, []);

  const toggleAdvanced = async () => {
    const next = !showAdvanced;
    setShowAdvanced(next);
    if (next && keyStatus === null) {
      try {
        const res = await fetch('/api/set-key');
        const data = await res.json();
        setKeyStatus(data);
      } catch {}
    }
  };

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return;
    setSaving(true);
    setKeyMessage(null);
    try {
      const res = await fetch('/api/set-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setKeyMessage({
          type: 'ok',
          text: 'Key saved to .env.local. ' + (data.message || 'If the dev server was already running, restart it (Ctrl+C in the launch window, then double-click 启动.vbs again).')
        });
        setKeyInput('');
        setKeyStatus({ hasKey: true, length: keyInput.trim().length });
      } else {
        setKeyMessage({ type: 'err', text: data.error || 'Failed to save' });
      }
    } catch (e: any) {
      setKeyMessage({ type: 'err', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const addText = (text: string) => {
    if (text.trim().length < 100) {
      setError('每篇范文至少 100 字');
      return;
    }
    setTexts(prev => [...prev, text.trim()]);
    setError(null);
  };

  const removeText = (idx: number) => {
    setTexts(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFile = async (files: FileList | null, target: 'samples' | 'polish' = 'samples') => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 2_000_000) {
        setError(`文件 ${file.name} 超过 2MB，跳过`);
        continue;
      }

      // MIME 校验：防止恶意文件伪装成 .docx / .txt
      // DOCX 的合法 MIME: application/vnd.openxmlformats-officedocument.wordprocessingml.document
      // 或者 application/zip（.docx 本质是 zip）
      const lower = file.name.toLowerCase();
      const mime = file.type || '';
      const isDocx = lower.endsWith('.docx');
      const isText = lower.endsWith('.txt') || lower.endsWith('.md');

      if (isDocx && mime && !mime.includes('zip') && !mime.includes('word') && mime !== '') {
        setError(`${file.name} MIME 类型不安全（${mime}），已跳过`);
        continue;
      }
      if (!isDocx && !isText) {
        setError(`${file.name} 不支持的扩展名（仅支持 .txt / .md / .docx）`);
        continue;
      }

      try {
        let text: string;
        if (isDocx) {
          const arrayBuffer = await file.arrayBuffer();
          // 双重校验：ZIP 文档魔数是 PK (0x504B0304)
          const view = new Uint8Array(arrayBuffer, 0, 4);
          if (view[0] !== 0x50 || view[1] !== 0x4B) {
            setError(`${file.name} 不是真正的 .docx 文件（缺失 ZIP 魔数）`);
            continue;
          }
          const result = await mammoth.extractRawText({ arrayBuffer });
          text = result.value;
          if (result.messages.length > 0) {
            console.warn(`[${file.name}] mammoth warnings:`, result.messages);
          }
        } else {
          text = await file.text();
        }
        if (target === 'samples') {
          addText(text);
        } else {
          setPolishEssay(text);
          setError(null);
        }
      } catch (e: any) {
        setError(`${file.name} 解析失败：${e.message}`);
      }
    }
  };

  const handleAnalyze = async () => {
    if (texts.length < 1) {
      setError('请至少添加 1 篇范文');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samples: texts })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(friendlyError(data.error));
      const result = {
        dna: data.dna,
        profile: data.profile || null,
        profileError: data.profileError || null,
        samples: texts
      };
      // 持久化
      saveAnalysis({
        ...result,
        savedAt: Date.now()
      });
      onAnalyzed(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePolishStart = async () => {
    if (texts.length < 1) {
      setError('请至少添加 1 篇范文（用作风格来源）');
      return;
    }
    if (polishEssay.trim().length < 100) {
      setError('待润色的作文至少 100 字');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samples: texts })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(friendlyError(data.error));
      const result = {
        dna: data.dna,
        profile: data.profile || null,
        samples: texts,
        polishEssay: polishEssay.trim()
      };
      saveAnalysis({
        dna: result.dna,
        profile: result.profile,
        samples: result.samples,
        savedAt: Date.now()
      });
      onPolish?.(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreSession = () => {
    if (!savedSession) return;
    setTexts(savedSession.samples);
    onAnalyzed({
      dna: savedSession.dna,
      profile: savedSession.profile,
      profileError: null,
      samples: savedSession.samples
    });
  };

  const handleClearSaved = () => {
    clearAnalysis();
    setSavedSession(null);
  };

  const friendlyError = (msg?: string): string => {
    if (!msg) return '分析失败';
    if (/OPENROUTER_API_KEY/.test(msg)) {
      return '需要 OpenRouter Key 才能提取风格画像。请展开下方"OpenRouter API Key"设置填入。';
    }
    if (/at least 100 characters/.test(msg)) {
      return '每篇范文至少 100 字';
    }
    return msg;
  };

  const loadDemo = () => {
    setTexts(DEMO_SAMPLES);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {savedSession && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="text-sm">
            <div className="text-amber-900 dark:text-amber-200 font-medium">检测到上次会话</div>
            <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              {savedSession.samples.length} 篇范文 · {new Date(savedSession.savedAt).toLocaleString('zh-CN')}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClearSaved}
              className="text-xs px-3 py-1.5 text-amber-700 hover:text-amber-900 transition"
            >
              丢弃
            </button>
            <button
              onClick={handleRestoreSession}
              className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium"
            >
              ↻ 恢复
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-dark-surface rounded-2xl p-8 shadow-sm border border-ink-100 dark:border-dark-border">
        <h2 className="text-2xl font-semibold mb-2">
          {mode === 'generate' ? '第一步：喂 AI 读懂你的文风' : '润色模式：贴一篇 + 参考风格'}
        </h2>
        <p className="text-ink-500 dark:text-dark-textMuted text-sm leading-relaxed">
          {mode === 'generate'
            ? '粘贴或上传你过去写过的作文（1-10 篇）。AI 会提取你的文风 DNA，再帮你生成一篇。'
            : '上传或粘贴一篇你想润色的作文，同时上传 1-3 篇范文作为风格参考。AI 会按你的风格润色这篇。'
          }
          <span className="text-ink-400"> · 不会上传到服务器</span>
        </p>

        {/* 范文列表（两种模式都要） */}
        <div className="mt-6 space-y-3">
          <div className="text-xs text-ink-500 font-medium">范文（{texts.length} 篇 · 至少 1 篇）</div>
          {texts.map((t, i) => (
            <div key={i} className="relative bg-ink-50 dark:bg-dark-surfaceHover rounded-lg p-4 pr-12 group">
              <div className="text-xs text-ink-400 dark:text-dark-textSubtle mb-1">范文 {i + 1} · {t.length} 字</div>
              <div className="text-sm text-ink-700 dark:text-dark-text line-clamp-3">{t.slice(0, 200)}...</div>
              <button
                onClick={() => removeText(i)}
                className="absolute top-3 right-3 text-ink-400 hover:text-ink-800 dark:hover:text-dark-text"
              >
                ✕
              </button>
            </div>
          ))}

          {texts.length === 0 && (
            <div className="border-2 border-dashed border-ink-200 dark:border-dark-borderLight rounded-lg p-6 text-center text-ink-400 dark:text-dark-textSubtle text-sm">
              还没有添加范文 · 点击下方按钮添加
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg border border-ink-200 dark:border-dark-borderLight hover:bg-ink-50 dark:hover:bg-dark-surfaceHover text-sm transition"
            >
              📁 上传文件 (.txt / .md / .docx)
            </button>
            <button
              onClick={async () => {
                const text = prompt('粘贴一段作文（至少 100 字）：');
                if (text) addText(text);
              }}
              className="px-4 py-2 rounded-lg border border-ink-200 dark:border-dark-borderLight hover:bg-ink-50 dark:hover:bg-dark-surfaceHover text-sm transition"
            >
              ✏️ 直接粘贴
            </button>
            <button
              onClick={loadDemo}
              className="px-4 py-2 rounded-lg border border-ink-200 dark:border-dark-borderLight hover:bg-ink-50 dark:hover:bg-dark-surfaceHover text-sm transition"
            >
              🎭 加载示例（3 篇）
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.docx,text/plain"
              multiple
              hidden
              onChange={e => handleFile(e.target.files, 'samples')}
            />
          </div>
        </div>

        {/* 润色模式：额外加"待润色作文" */}
        {mode === 'polish' && (
          <div className="mt-6 space-y-3">
            <div className="text-xs text-ink-500 font-medium">待润色作文</div>
            <textarea
              value={polishEssay}
              onChange={e => setPolishEssay(e.target.value)}
              placeholder="粘贴你想润色的全文……"
              className="w-full px-4 py-3 border border-ink-200 dark:border-dark-borderLight dark:bg-dark-surfaceHover rounded-lg text-sm focus:outline-none focus:border-ink-800 dark:focus:border-dark-text min-h-[180px] resize-y"
            />
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => polishFileRef.current?.click()}
                className="px-4 py-2 rounded-lg border border-ink-200 dark:border-dark-borderLight hover:bg-ink-50 dark:hover:bg-dark-surfaceHover text-sm transition"
              >
                📁 上传待润色文件
              </button>
              <input
                ref={polishFileRef}
                type="file"
                accept=".txt,.md,.docx,text/plain"
                hidden
                onChange={e => handleFile(e.target.files, 'polish')}
              />
              <div className="text-xs text-ink-400 self-center">
                {polishEssay.length} 字
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md">{error}</div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <div className="text-xs text-ink-400">
            {mode === 'polish' ? '范文 + 待润色作文 都要填' : '已添加 ' + texts.length + ' 篇'}
          </div>
          <button
            onClick={mode === 'polish' ? handlePolishStart : handleAnalyze}
            disabled={loading || texts.length === 0 || (mode === 'polish' && polishEssay.trim().length < 100)}
            className="px-6 py-2.5 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded-lg hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium"
          >
            {loading ? '处理中…' : (mode === 'polish' ? '开始润色 →' : '开始分析 →')}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-ink-100 dark:border-dark-border">
        <button
          onClick={toggleAdvanced}
          className="flex items-center justify-between w-full text-sm"
        >
          <span className="text-ink-500 dark:text-dark-textMuted">⚙️ OpenRouter API Key</span>
          <span className="text-ink-400 dark:text-dark-textSubtle">
            {showAdvanced ? '收起' : (keyStatus?.hasKey ? '✓ 已配置' : '点此填入')}
          </span>
        </button>
        {showAdvanced && (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-ink-500 dark:text-dark-textMuted text-xs">
              填入后自动保存到 <code className="bg-ink-100 dark:bg-dark-surfaceHover px-1.5 py-0.5 rounded">.env.local</code>，
              下次启动自动读取，不用每次重新填。
              去 <a className="text-ink-700 dark:text-dark-text underline" href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a> 申请。
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="sk-or-v1-..."
                className="flex-1 px-3 py-2 border border-ink-200 dark:border-dark-borderLight dark:bg-dark-surfaceHover rounded-lg text-sm font-mono"
              />
              <button
                onClick={handleSaveKey}
                disabled={!keyInput.trim() || saving}
                className="px-4 py-2 bg-ink-800 dark:bg-dark-text text-ink-50 dark:text-dark-bg rounded-lg hover:bg-ink-700 disabled:opacity-40 text-sm transition"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
            {keyMessage && (
              <div className={`text-xs px-2 py-1.5 rounded ${keyMessage.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {keyMessage.text}
              </div>
            )}
            {keyStatus?.hasKey && (
              <div className="text-xs text-ink-400 dark:text-dark-textSubtle">
                当前 .env.local 里已有 key（{keyStatus.length} 字符）
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}