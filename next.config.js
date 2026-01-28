/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude frontend directory from build (used by Syncthing sync)
  typescript: {
    // Ignore build errors in excluded directories
    ignoreBuildErrors: false,
  },
  eslint: {
    // Ignore eslint errors in excluded directories
    ignoreDuringBuilds: false,
  },
  // Exclude specific directories from being processed
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  // Turbopack設定（Next.js 16でデフォルト有効）
  turbopack: {
    // 必要に応じてTurbopack固有の設定を追加
  },
  webpack: (config, { _isServer }) => {
    // Ignore the frontend directory
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/frontend/**', '**/backend/**'],
    };
    return config;
  },
}

module.exports = nextConfig
