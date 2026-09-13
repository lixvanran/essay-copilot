/**
 * jieba 分词 helper（用 jieba-wasm — 纯 Rust+WASM 实现）
 *
 * 提供：
 *   - jieba.cut(s)        真实中文分词
 *   - tokenize(s)         分词 + 过滤
 *   - classifyWord(w)     词性粗分类（基于词表，无 tag API）
 *   - isChineseStopWord   停用词判定
 *
 * 注：jieba-wasm 的 tag() API 不可用，所以自己实现分类
 */

// @ts-ignore - jieba-wasm 没有完美 TS 类型
import jiebaRaw from 'jieba-wasm';

const jieba: any = jiebaRaw;

let _ready: Promise<void> | null = null;
function ensureReady(): Promise<void> {
  if (!_ready) {
    _ready = (async () => {
      // 触发字典初始化
      jieba.cut('初始化');
    })();
  }
  return _ready;
}

// 词性简分类（用词表匹配实现）
type WordClass = 'conjunction' | 'modal' | 'adverb' | 'pronoun' | 'preposition' | 'auxiliary' | 'content';

const WORD_CLASSES = {
  // 连词 — 反映逻辑展开
  conjunction: [
    '因为', '所以', '但是', '然而', '不过', '虽然', '即使', '尽管', '如果', '假如', '只要', '除非',
    '而且', '并且', '同时', '此外', '另外', '更重要的是', '事实上', '其实', '当然', '显然', '毫无疑问',
    '因此', '于是', '于是乎', '结果', '最后', '总之', '综上', '总而言之', '首先', '其次', '再者',
    '换句话说', '也就是说', '换言之', '反之', '相反', '例如', '比如', '譬如', '以至于', '从而', '进而',
    '无论', '不管', '一旦', '每当', '当', '随着', '虽然', '可是', '但', '而', '但', '则', '并',
    '乃至', '以至', '既然', '否则', '不然', '以致', '甚至', '何况', '更何况'
  ],
  // 语气词
  modal: ['啊', '呢', '嘛', '吧', '呀', '哎', '哦', '哈', '哼', '嗯', '哟', '呸', '呜', '嚯'],
  // 副词
  adverb: [
    '很', '非常', '特别', '极其', '格外', '十分', '相当', '尤其', '更', '最', '比较', '越', '更',
    '都', '也', '还', '就', '才', '再', '又', '已', '已经', '曾', '曾经', '将', '将要', '正在',
    '不', '没', '没有', '别', '莫', '勿', '未', '未必', '不必', '不必', '不必', '不',
    '应该', '必须', '一定', '必然', '未必', '或许', '可能', '大概', '也许', '似乎', '仿佛', '好像',
    '终于', '终究', '始终', '永远', '常常', '经常', '往往', '总是', '老是', '一向', '一直', '一向',
    '忽然', '突然', '立刻', '马上', '立即', '随即', '顿时', '霎时', '瞬间', '刹那间', '顷刻间',
    '确实', '的确', '实在', '果然', '果真', '竟然', '居然', '甚至', '自然', '当然', '诚然', '固然',
    '只', '仅', '仅仅', '不过', '只是', '就是', '便是', '只', '惟', '唯'
  ],
  // 代词
  pronoun: [
    '我', '我们', '你', '你们', '他', '她', '它', '他们', '她们', '它们',
    '这', '这儿', '这里', '这边', '这个', '这次', '这点', '这位', '这些', '这样', '这么', '这样',
    '那', '那儿', '那里', '那边', '那个', '那次', '那位', '那些', '那样', '那么', '那样',
    '自己', '本人', '咱们', '大家', '某人', '某些', '什么', '谁', '哪', '怎么', '如何', '为什么'
  ],
  // 介词
  preposition: [
    '在', '从', '向', '往', '到', '于', '对', '对于', '关于', '至于', '至若', '至于',
    '为', '为了', '为着', '因为', '由于', '以', '以便', '以免', '以至', '借', '凭', '靠',
    '用', '通过', '经过', '据', '根据', '按照', '依照', '遵循', '遵照', '基于',
    '被', '让', '叫', '给', '把', '将', '拿',
    '跟', '和', '同', '与', '及', '以及', '兼',
    '除', '除了', '除去', '除非', '除去', '外', '以外', '之内', '之中', '之间'
  ],
  // 助词 — 反映语法化习惯
  auxiliary: ['的', '了', '着', '过', '们', '似的', '一样', '一般', '地', '得', '所', '为之']
};

const STOPWORDS = new Set([
  // 真正**无意义**的：标点/空白
  // 注意：不要把"了/着/的"放进来 — 它们是功能词，反映语法化习惯
  '，', '。', '！', '？', '；', '：',
  '\u201C', '\u201D', '\u2018', '\u2019',  // " " ' '
  '（', '）', '【', '】', '《', '》',
  '——', '……', '—',
  ' ', '\t', '\n', '\r'
]);

/**
 * 词性粗分类（基于词表）
 * 返回：连词/语气词/副词/代词/介词/助词/实词
 */
export function classifyWord(word: string): WordClass {
  // 长度 < 2 的跳过（单字虚词命中率太低）
  if (word.length === 1) {
    // 但单字虚词（的/了/着/过/啊/呢/吧）有专门表
    for (const [cls, words] of Object.entries(WORD_CLASSES) as [WordClass, string[]][]) {
      if (words.includes(word)) return cls;
    }
    return 'content';
  }
  for (const [cls, words] of Object.entries(WORD_CLASSES)) {
    if ((words as string[]).includes(word)) return cls as WordClass;
  }
  return 'content';
}

/**
 * 中文停用词判定
 */
export function isChineseStopWord(word: string): boolean {
  return STOPWORDS.has(word);
}

/**
 * 简单分词 + 过滤
 */
export function tokenize(text: string): string[] {
  const words: string[] = jieba.cut(text);
  return words
    .map((w: string) => w.trim())
    .filter((w: string) => w.length > 0)
    .filter((w: string) => !/^[\p{P}\s]+$/u.test(w));  // 过滤纯标点
}

/**
 * 等同于 jieba.cut，但 await 初始化
 */
export async function cut(text: string): Promise<string[]> {
  await ensureReady();
  return jieba.cut(text);
}
