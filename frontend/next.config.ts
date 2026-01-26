import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/login',
        destination: '/auth/login',
        permanent: true,
      },
      {
        source: '/register',
        destination: '/auth/register',
        permanent: true,
      },
    ];
  },
  // Otimização de Bundle Size (compatível com Turbopack)
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion'],
  },
  // Turbopack config (Next.js 16 usa Turbopack por padrão)
  turbopack: {},
  // Configuração para evitar ChunkLoadError em produção
  // O Next.js gera automaticamente um build ID baseado no conteúdo
  // Se precisares de um ID customizado, descomenta abaixo:
  // generateBuildId: async () => {
  //   return process.env.BUILD_ID || 'default-build-id';
  // },
  // SEO e Headers de cache
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
