/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/webycitas', destination: '/', permanent: true },
      { source: '/demo-local', destination: '/', permanent: true },
      { source: '/mercado', destination: '/mercadosanpablosigua', permanent: true },
      {
        source: '/mercado/:path((?!.*\\.).*)',
        destination: '/mercadosanpablosigua/:path',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
