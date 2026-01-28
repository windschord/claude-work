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
