/**
 * Rate limiting（v0.4.1）
 *
 * 基于 IP + 路径的内存计数器（生产可换 Redis）
 * 防止 API 滥用（每分钟/每小时限制）
 */

type RateLimitConfig = {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 窗口内最大请求数 */
  maxRequests: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

// 内存桶（生产应换 Redis 或 Upstash）
const buckets = new Map<string, Bucket>();

/**
 * 检查是否超限
 * @returns {{ ok: boolean, remaining: number, resetIn: number }}
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { ok: boolean; remaining: number; resetIn: number; limit: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    // 新桶 或 过期桶
    buckets.set(key, {
      count: 1,
      resetAt: now + config.windowMs
    });
    return { ok: true, remaining: config.maxRequests - 1, resetIn: config.windowMs, limit: config.maxRequests };
  }

  bucket.count++;
  const remaining = Math.max(0, config.maxRequests - bucket.count);
  const resetIn = bucket.resetAt - now;

  return {
    ok: bucket.count <= config.maxRequests,
    remaining,
    resetIn,
    limit: config.maxRequests
  };
}

/**
 * 预设限额
 */
export const RATE_LIMITS = {
  // 作文生成（重型 LLM 调用）
  generate: { windowMs: 60 * 1000, maxRequests: 30 },         // 30/min
  // 段落重写
  rewrite: { windowMs: 60 * 1000, maxRequests: 60 },          // 60/min
  // AI 味消除（最重）
  deauto: { windowMs: 60 * 1000, maxRequests: 10 },           // 10/min
  // AI 题目生成
  topicGen: { windowMs: 60 * 1000, maxRequests: 20 },          // 20/min
  // 风格画像提取
  analyze: { windowMs: 60 * 1000, maxRequests: 30 },           // 30/min
  // 其他
  default: { windowMs: 60 * 1000, maxRequests: 60 }            // 60/min
} as const;

/**
 * 从请求提取客户端 IP
 *
 * 安全考虑：x-forwarded-for 是用户可控的，不能直接信任
 * - 单一信任源策略：只信最上游 proxy 设的（避免取最左值被客户端伪造）
 * - 未知时用 'unknown'，所有未知 IP 共用桶（防止 IP 切分绕过限流）
 *
 * 生产环境应配置 trusted proxy（Next.js 部署文档）并直接用 req.ip
 */
export function getClientIP(req: { headers: Headers }): string {
  // 1. 优先 x-real-ip（nginx 等可信代理设置）
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp && isValidIp(realIp)) return realIp;

  // 2. 其次 cf-connecting-ip（Cloudflare）
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp && isValidIp(cfIp)) return cfIp;

  // 3. 最后 x-forwarded-for（**最右值**才是真实客户端 IP，因为每跳 proxy 追加到左边）
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map(s => s.trim()).filter(isValidIp);
    // 取最后一个（最接近用户的）
    if (parts.length > 0) return parts[parts.length - 1];
  }

  // 4. 未知：所有未识别 IP 共用桶
  return 'unknown';
}

/**
 * 简单 IP 格式校验（防 header 注入）
 */
function isValidIp(ip: string): boolean {
  // IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;
  // IPv6（简化校验）
  if (/^[0-9a-fA-F:]+$/.test(ip) && ip.includes(':')) return true;
  return false;
}

/**
 * 标准响应：超限返回 429
 */
export function rateLimitHeaders(result: { remaining: number; resetIn: number; limit: number }): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetIn / 1000))
  };
}