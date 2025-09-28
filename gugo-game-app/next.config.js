/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint during builds to allow deployment
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Enable experimental features if needed
  experimental: {
    // Add any experimental features here if needed
  },
  // Configure image domains for NFT images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig