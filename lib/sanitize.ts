/**
 * 输入净化（v0.5.1 引入，v0.6.1 集成到路由）
 *
 * 防护 prompt injection：用户输入直接拼到 system prompt 是危险的
 * 检测并清洗可疑指令（如"忽略上述指令"、"system:"、"Assistant:"）
 *
 * v0.6.1 修正：
 * - maxLength 可配置（作文 10000 字不该被当成注入）
 * - strict=false 时只查"忽略指令"类模式（用于学生自己的范文，
 *   避免误伤作文里引用的英文对话 "Assistant: ..."）
 */

/** 明确的注入模式（任何场景都要查） */
const INJECTION_PATTERNS = [
  // 经典注入：忽略指令（覆盖"忽略指令/命令/要求/规则/设定/之前的…"
  // 以及"忽略上面的…"这类自然变体）
  /忽略.{0,6}(指令|命令|要求|规则|设定|约束|限制|之前|以上|上面|前面|提示词|系统)/i,
  /别管.{0,6}(上面|之前|规则|指令)/i,
  /不要遵守.{0,6}(规则|指令|要求)/i,
  /无需遵守.{0,6}(规则|指令)/i,
  /forget.{0,10}(previous|above|all)/i,
  /ignore.{0,10}(previous|above|instructions)/i,
  /disregard.{0,10}(previous|above|all)/i,
  // 试图跳出 fenced code
  /```\s*$/m,
  // 试图插入代码注入
  /<\/?(script|iframe|img|svg|object|embed)/i
];

/** 冒充角色的模式（仅 strict 模式查，避免误伤引文） */
const ROLE_PATTERNS = [
  /\bsystem\s*:/i,
  /\bassistant\s*:/i,
  /\buser\s*:/i,
  /\[\/?(INST|SYS|SYSTEM)\]/i,
  /<\/?(system|assistant|user)>/i
];

export type SanitizeResult = {
  text: string;
  suspicious: boolean;
  reasons: string[];
};

export type SanitizeOptions = {
  /** 输入长度上限（超过视为可疑） */
  maxLength?: number;
  /** 换行数上限 */
  maxLineBreaks?: number;
  /**
   * strict = true（默认）：查全部模式（含角色冒充）
   * strict = false：只查明确注入模式（用于用户自己写的范文）
   */
  strict?: boolean;
};

/**
 * 检查用户输入是否包含可疑的注入尝试
 * 注意：只检测，不修改 —— 修改会破坏用户原文（学生写"system"是合法的）
 */
export function detectInjection(input: string, options: SanitizeOptions = {}): SanitizeResult {
  const { maxLength = 5000, maxLineBreaks = 100, strict = true } = options;
  const reasons: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      reasons.push(`Suspicious pattern: ${match[0]}`);
    }
  }

  if (strict) {
    for (const pattern of ROLE_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        reasons.push(`Role impersonation: ${match[0]}`);
      }
    }
  }

  // 检查异常长度（可能是 DoS 或 prompt 污染）
  if (input.length > maxLength) {
    reasons.push(`Input too long (${input.length} chars, max ${maxLength})`);
  }

  // 检查异常换行数（用来分隔 prompt 段）
  const lineBreaks = (input.match(/\n/g) || []).length;
  if (lineBreaks > maxLineBreaks) {
    reasons.push(`Excessive line breaks (${lineBreaks}, max ${maxLineBreaks})`);
  }

  return {
    text: input,
    suspicious: reasons.length > 0,
    reasons
  };
}

/**
 * 限制并清理文本（防止单输入过大 / 注入过深）
 */
export function safeLength(input: string, max: number = 5000): string {
  if (input.length <= max) return input;
  // 截断并加提示
  return input.slice(0, max) + '\n\n[... 已截断，原文超过 ' + max + ' 字 ...]';
}
