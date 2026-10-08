import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Gera um site estático (pasta out/), que roda em qualquer hospedagem.
  // Quando o servidor socket.io existir, ele roda à parte (server/).
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
