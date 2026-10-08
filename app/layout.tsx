import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./site-layout.css";
import { withBase } from "@/lib/base";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: "Feijão Detailer | Estética automotiva",
  description: "Conheça os serviços, planos mensais e a história da Feijão Detailer.",
  icons: {
    icon: withBase("/favicon.svg"),
    shortcut: withBase("/favicon.svg"),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
