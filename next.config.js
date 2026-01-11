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
  // Exclude native modules from bundling (they run on server only)
  serverExternalPackages: ['dockerode', 'ssh2', 'cpu-features', 'node-pty'],
  webpack: (config, { isServer }) => {
    // Ignore the frontend directory
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/frontend/**', '**/backend/**'],
    };

    // Externalize server-side only modules
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        'dockerode',
        'ssh2',
        'cpu-features',
        'node-pty',
      ];
    }

    return config;
  },
}

module.exports = nextConfig
