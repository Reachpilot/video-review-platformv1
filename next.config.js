/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@netlify/blobs'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('ffprobe-static', 'get-video-duration');
    }
    return config;
  },
};

module.exports = nextConfig;
