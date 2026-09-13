/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ['*'] }
  },
  // jieba-wasm 是 native WASM，不应该被 Next.js bundle
  // 让它在运行时从 node_modules 加载
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'jieba-wasm': 'commonjs jieba-wasm'
      });
    }
    return config;
  }
};

module.exports = nextConfig;
