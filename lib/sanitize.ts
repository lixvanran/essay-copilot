/**
 * 输入净化（v0.5.1）
 *
 * 防护 prompt injection：用户输入直接拼到 system prompt 是危险的
 * 检测并清洗可疑指令（如"忽略上述指令"、"system:"、"Assistant:"）
 */

const SUSPICIOUS_PATTERNS = [
  // 经典注入
  /忽略.{0,10}(指令|命令|以上)/i,
  /forget.{0,10}(previous|above|all)/i,
  /ignore.{0,10}(previous|above|instructions)/i,
  // 试图冒充 system
  /\bsystem\s*:/i,
  /\bassistant\s*:/i,
  /\buser\s*:/i,
  // 试图跳出 fenced code
  /```\s*$/m,
  // 试图插入代码注入
  /<\/?(script|iframe|img|svg|object|embed)/i
];

export type SanitizeResult = {
  text: string;
  suspicious: boolean;
  reasons: string[];
};

/**
 * 检查用户输入是否包含可疑的注入尝试
 * 注意：只检测，不修改 —— 修改会破坏用户原文（学生写"system"是合法的）
 */
export function detectInjection(input: string): SanitizeResult {
  const reasons: string[] = [];
  for (const pattern of SUSPICIOUS_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      reasons.push(`Suspicious pattern: ${match[0]}`);
    }
  }

  // 检查异常长度（> 5000 字符可能是 DoS 或 prompt 污染）
  if (input.length > 5000) {
    reasons.push(`Input too long (${input.length} chars, max 5000)`);
  }

  // 检查异常换行数（用来分隔 prompt 段）
  const lineBreaks = (input.match(/\n/g) || []).length;
  if (lineBreaks > 100) {
    reasons.push(`Excessive line breaks (${lineBreaks})`);
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