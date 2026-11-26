import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pg-boss e suas dependencias usam modulos nativos do Node: fora do bundle.
  serverExternalPackages: ['@prisma/client', 'pg-boss', 'pg', 'cron'],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
