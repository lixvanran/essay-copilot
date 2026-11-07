const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // v0.6.1：standalone 输出 —— Docker 镜像不需要把 400MB node_modules 塞进去
  // 产物：.next/standalone/ （含精简 node_modules）+ server.js
  output: 'standalone',
  experimental: {
    // v0.6.1 修复：限制 server actions 的 origin（防 CSRF）
    // 生产环境通过 ALLOWED_ORIGIN 环境变量注入（逗号分隔）
    // 默认只允许本地开发端口
    serverActions: {
      allowedOrigins: process.env.ALLOWED_ORIGIN
        ? process.env.ALLOWED_ORIGIN.split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : ['localhost:3000', '127.0.0.1:3000']
    }
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'jieba-wasm': 'commonjs jieba-wasm'
      });
    }
    return config;
  },

  // v0.5.1: 安全 headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // 防 XSS：禁用 inline script（Next.js 自己的 inline 会自动加 nonce）
          // 这里只允许 'self'，但 mammoth 的 eval 怎么办？
          // → mammoth 是 npm 包，不在浏览器 inline eval
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",  // Next.js 需要 unsafe-inline
              "style-src 'self' 'unsafe-inline'",  // Tailwind utility classes
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://openrouter.ai https://api.openrouter.ai https://cdn.jsdelivr.net",
              "worker-src 'self' blob:",
              "manifest-src 'self'"
            ].join('; ')
          },
          // 防 clickjacking
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // 防 MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // 防 XSS
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // 强制 HTTPS（生产）
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Referrer
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
        ]
      }
    ];
  }
};

module.exports = withBundleAnalyzer(nextConfig);