# ==========================================
# 作文副驾驶 - Docker 镜像
# ==========================================
# 多阶段构建：deps → builder → runner
# 最终镜像 ~150MB（用 Next.js standalone 输出，不复制完整 node_modules）
# ==========================================

# ===== Stage 1: 依赖安装 =====
FROM node:22-alpine AS deps
WORKDIR /app

# 国内加速
RUN npm config set registry https://registry.npmmirror.com

# 只 copy lockfile，最大化利用缓存
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit

# ===== Stage 2: 构建 =====
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建时需要占位 key（真正运行时用 runtime env 注入）
ENV NEXT_TELEMETRY_DISABLED=1
ENV OPENROUTER_API_KEY=sk-or-v1-build-time-placeholder

RUN npm run build

# ===== Stage 3: 运行 =====
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# standalone 输出：自带精简 node_modules + server.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# 静态资源与 public 要单独复制（standalone 不含）
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# package.json 供运行时读取 version
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# /api/set-key 会写 .env.local —— 需要可写目录
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app
VOLUME ["/app/data"]

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# standalone server.js 是生产服务器（不是 dev server）
CMD ["node", "server.js"]
