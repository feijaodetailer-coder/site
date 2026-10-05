import type { NextConfig } from "next";

// O GitHub Pages recebe /site pelo workflow pages.yml. Outros hosts, como o Vercel,
// usam a raiz do domínio e por isso ficam sem prefixo por padrão.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
