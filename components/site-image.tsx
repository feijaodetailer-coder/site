import Image, { type ImageProps } from "next/image";
import { BASE_PATH } from "@/lib/base";

// Intrinsic dimensions of the public assets; CSS still controls their displayed size.
const dimensions: Record<string, { width: number; height: number }> = {
  '/feijao-detailer-logo.png': { width: 2172, height: 724 },
  '/service-images/limpeza-editorial.webp': { width: 1000, height: 563 },
  '/service-images/limpeza-premium-v2.png': { width: 1672, height: 941 },
  '/service-images/limpeza.png': { width: 589, height: 832 },
  '/service-images/motos-premium-v2.png': { width: 1774, height: 887 },
  '/service-images/motos.png': { width: 400, height: 626 },
  '/service-images/pacotes-editorial.webp': { width: 1000, height: 563 },
  '/service-images/pacotes-premium-v2.png': { width: 1672, height: 941 },
  '/service-images/pacotes.png': { width: 609, height: 860 },
  '/service-images/planos.png': { width: 922, height: 1383 },
  '/service-images/polimento-editorial.webp': { width: 1000, height: 563 },
  '/service-images/polimento-premium-v2.png': { width: 1672, height: 941 },
  '/service-images/polimento.png': { width: 600, height: 900 },
  '/service-images/studio-editorial.webp': { width: 1200, height: 800 },
  '/service-images/tratamentos-premium-v2.png': { width: 1672, height: 941 },
  '/service-images/tratamentos.png': { width: 376, height: 251 },
};

type SiteImageProps = Omit<ImageProps, "src" | "width" | "height"> & { src: string };

export function SiteImage({ src, alt, loading = "eager", decoding = "auto", ...props }: SiteImageProps) {
  const path = BASE_PATH && src.startsWith(`${BASE_PATH}/`) ? src.slice(BASE_PATH.length) : src;
  const size = dimensions[path];
  if (!size) throw new Error(`Dimensões da imagem não cadastradas: ${path}`);
  return <Image {...props} alt={alt} src={src} {...size} loading={loading} decoding={decoding} unoptimized />;
}
