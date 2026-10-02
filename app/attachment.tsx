"use client";
import { useEffect, useState } from "react";
import { apiFetch, openProtectedFile } from "@/lib/api";

/** Imagem de um anexo privado, carregada com o login do usuário. */
export function AttachmentImage({ id, alt }: { id: string; alt: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let url = "", active = true;
    apiFetch(`/api/files?id=${encodeURIComponent(id)}`).then(async response => {
      if (!response.ok || !active) return;
      url = URL.createObjectURL(await response.blob());
      setSrc(url);
    }).catch(() => {});
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [id]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} /> : <span aria-hidden="true" />;
}

export function AttachmentLink({ id, children }: { id: string; children: React.ReactNode }) {
  return <a href="#" onClick={event => { event.preventDefault(); void openProtectedFile(`/api/files?id=${encodeURIComponent(id)}`); }}>{children}</a>;
}
