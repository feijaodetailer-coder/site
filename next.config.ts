import type { NextConfig } from "next";

// Site estático para o GitHub Pages: https://feijaodetailer-coder.github.io/site/
// Em domínio próprio (ou no desenvolvimento local), defina NEXT_PUBLIC_BASE_PATH="" .
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (process.env.NODE_ENV === "production" ? "/site" : "");

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
