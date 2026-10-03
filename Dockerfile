# ==========================================
# 作文副驾驶 - Docker 镜像
# ==========================================
# 多阶段构建：编译阶段 + 运行阶段
# 最终镜像 ~150MB
# ==========================================

# ===== Stage 1: 依赖安装 =====
FROM node:22-alpine AS deps
WORKDIR /app

# 国内加速
RUN npm config set registry https://registry.npmmirror.com

# 先 copy lockfile，最大化利用缓存
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit

# ===== Stage 2: 构建 =====
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建时需要占位 key
ENV NEXT_TELEMETRY_DISABLED=1
ENV OPENROUTER_API_KEY=sk-or-v1-build-time-placeholder

RUN npm run build

# ===== Stage 3: 运行 =====
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOST=0.0.0.0

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/start.js ./start.js
COPY --from=builder /app/stop.js ./stop.js

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "start.js"]