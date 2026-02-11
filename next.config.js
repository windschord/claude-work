const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server-side only packages (native modules that can't be bundled)
  serverExternalPackages: ['node-pty', 'better-sqlite3'],
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
  // Transpile packages that have Turbopack compatibility issues
  transpilePackages: ['react-diff-viewer-continued'],
  // Turbopack設定（Next.js 16でデフォルト有効）
  turbopack: {
    // react-diff-viewer-continuedがWorkerで.tsファイルを参照しようとする問題を回避
    resolveAlias: {
      './computeWorker.ts': './computeWorker.js',
    },
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  webpack: (config, { isServer }) => {
    // Ignore the frontend directory
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/frontend/**', '**/backend/**'],
    };

    // react-diff-viewer-continuedがWorkerで.tsファイルを参照しようとする問題を回避
    // NormalModuleReplacementPluginで.ts参照を.jsに置き換える
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /\.\/computeWorker\.ts$/,
        './computeWorker.js'
      )
    );

    // サーバー側ビルドでネイティブモジュールを外部化
    if (isServer) {
      const nativeExternals = {
        'node-pty': 'commonjs node-pty',
        'better-sqlite3': 'commonjs better-sqlite3',
      };
      if (typeof config.externals === 'function') {
        config.externals = [config.externals, nativeExternals];
      } else if (Array.isArray(config.externals)) {
        config.externals.push(nativeExternals);
      } else if (config.externals) {
        config.externals = [config.externals, nativeExternals];
      } else {
        config.externals = [nativeExternals];
      }
    }

    return config;
  },
}

module.exports = nextConfig
