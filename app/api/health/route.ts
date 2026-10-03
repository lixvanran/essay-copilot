/**
 * 健康检查端点
 * 用于部署监控、负载均衡、Kubernetes liveness/readiness probe
 *
 * 返回:
 * - 200: 健康
 * - 503: 不健康（缺 OPENROUTER_API_KEY 或关键模块异常）
 */

import { NextResponse } from 'next/server';

type HealthCheck = {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  uptime: number;
  checks: Record<string, {
    status: 'ok' | 'fail' | 'warn';
    message?: string;
  }>;
};

const startTime = Date.now();

export async function GET() {
  const checks: HealthCheck['checks'] = {};

  // 1. OPENROUTER_API_KEY 是否配置
  const key = process.env.OPENROUTER_API_KEY;
  checks.apiKey = key && !/placeholder|xxx/i.test(key)
    ? { status: 'ok', message: `${key.length} chars` }
    : { status: 'fail', message: 'OPENROUTER_API_KEY missing or placeholder' };

  // 2. Node 环境
  checks.node = { status: 'ok', message: process.version };

  // 3. jieba-wasm 字典是否可加载
  try {
    const m = await import('@/lib/jieba-helper');
    const tokens = await m.cut('健康检查');
    checks.jieba = tokens.length > 0
      ? { status: 'ok', message: `${tokens.length} tokens` }
      : { status: 'fail', message: 'jieba produced empty output' };
  } catch (e: any) {
    checks.jieba = { status: 'fail', message: e.message?.slice(0, 100) };
  }

  // 4. 内存使用
  const mem = process.memoryUsage();
  const memUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  checks.memory = memUsedMB < 500
    ? { status: 'ok', message: `${memUsedMB}MB heap` }
    : { status: 'warn', message: `${memUsedMB}MB heap (high)` };

  // 计算总体状态
  const failCount = Object.values(checks).filter(c => c.status === 'fail').length;
  const warnCount = Object.values(checks).filter(c => c.status === 'warn').length;
  const status: HealthCheck['status'] = failCount > 0 ? 'error' : warnCount > 0 ? 'degraded' : 'ok';

  const result: HealthCheck = {
    status,
    version: process.env.npm_package_version || 'unknown',
    uptime: Math.round((Date.now() - startTime) / 1000),
    checks
  };

  return NextResponse.json(result, {
    status: status === 'error' ? 503 : 200
  });
}