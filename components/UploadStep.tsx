'use client';

import { useState, useRef } from 'react';
import type { StyleDNA } from '@/lib/style-dna';

type Props = {
  onAnalyzed: (dna: StyleDNA, samples: string[]) => void;
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

export default function UploadStep({ onAnalyzed }: Props) {
  const [texts, setTexts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyStatus, setKeyStatus] = useState<{ hasKey: boolean; length?: number; isPlaceholder?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyMessage, setKeyMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 打开高级设置时加载 key 状态
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

  // 保存 key 到 .env.local
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

  const handleFile = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 1_000_000) {
        setError(`文件 ${file.name} 超过 1MB，跳过`);
        continue;
      }
      const text = await file.text();
      addText(text);
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
      if (!res.ok) throw new Error(data.error || '分析失败');
      onAnalyzed(data.dna, texts);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDemo = () => {
    setTexts(DEMO_SAMPLES);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-ink-100">
        <h2 className="text-2xl font-semibold mb-2">第一步：喂 AI 读懂你的文风</h2>
        <p className="text-ink-500 text-sm leading-relaxed">
          粘贴或上传你过去写过的作文（3-10 篇效果最好）。AI 会提取你的高频词、句长偏好、语气温度……生成你的"文风 DNA"。
          <span className="text-ink-400"> · 不会保存到任何地方</span>
        </p>

        <div className="mt-6 space-y-3">
          {texts.map((t, i) => (
            <div key={i} className="relative bg-ink-50 rounded-lg p-4 pr-12 group">
              <div className="text-xs text-ink-400 mb-1">范文 {i + 1} · {t.length} 字</div>
              <div className="text-sm text-ink-700 line-clamp-3">{t.slice(0, 200)}...</div>
              <button
                onClick={() => removeText(i)}
                className="absolute top-3 right-3 text-ink-400 hover:text-ink-800 text-sm"
              >
                ✕
              </button>
            </div>
          ))}

          {texts.length === 0 && (
            <div className="border-2 border-dashed border-ink-200 rounded-lg p-8 text-center text-ink-400 text-sm">
              还没有添加范文 · 点击下方按钮添加
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg border border-ink-200 hover:bg-ink-50 text-sm transition"
            >
              📁 上传文件 (.txt / .md)
            </button>
            <button
              onClick={async () => {
                const text = prompt('粘贴一段作文（至少 100 字）：');
                if (text) addText(text);
              }}
              className="px-4 py-2 rounded-lg border border-ink-200 hover:bg-ink-50 text-sm transition"
            >
              ✏️ 直接粘贴
            </button>
            <button
              onClick={loadDemo}
              className="px-4 py-2 rounded-lg border border-ink-200 hover:bg-ink-50 text-sm transition"
            >
              🎭 加载示例（3 篇）
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain"
              multiple
              hidden
              onChange={e => handleFile(e.target.files)}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <div className="text-xs text-ink-400">已添加 {texts.length} 篇</div>
          <button
            onClick={handleAnalyze}
            disabled={loading || texts.length === 0}
            className="px-6 py-2.5 bg-ink-800 text-ink-50 rounded-lg hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium"
          >
            {loading ? '分析中…' : '开始分析 →'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-ink-100">
        <button
          onClick={toggleAdvanced}
          className="flex items-center justify-between w-full text-sm"
        >
          <span className="text-ink-500">⚙️ OpenRouter API Key</span>
          <span className="text-ink-400">
            {showAdvanced ? '收起' : (keyStatus?.hasKey ? '✓ 已配置' : '点此填入')}
          </span>
        </button>
        {showAdvanced && (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-ink-500 text-xs">
              填入后自动保存到 <code className="bg-ink-100 px-1.5 py-0.5 rounded">.env.local</code>，
              下次启动自动读取，不用每次重新填。
              去 <a className="text-ink-700 underline" href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a> 申请。
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="sk-or-v1-..."
                className="flex-1 px-3 py-2 border border-ink-200 rounded-lg text-sm font-mono"
              />
              <button
                onClick={handleSaveKey}
                disabled={!keyInput.trim() || saving}
                className="px-4 py-2 bg-ink-800 text-ink-50 rounded-lg hover:bg-ink-700 disabled:opacity-40 text-sm transition"
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
              <div className="text-xs text-ink-400">
                当前 .env.local 里已有 key（{keyStatus.length} 字符）
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
