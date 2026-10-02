"use client";
import { withBase } from "@/lib/base";

import { useContext, useState, type ReactNode } from "react";
import { WorkspaceContext } from "./workspace-context";
import { CreditCard, Info, LayoutDashboard, Menu, MessageCircle, Wrench, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Page = "services" | "plans" | "about" | "admin";
const pages = [
  { key: "services", href: withBase("/"), label: "Serviços", icon: Wrench },
  { key: "plans", href: withBase("/planos/"), label: "Planos mensais", icon: CreditCard },
  { key: "about", href: withBase("/sobre-nos/"), label: "Sobre nós", icon: Info },
  { key: "admin", href: withBase("/admin/"), label: "Gestão", icon: LayoutDashboard },
];
export default function SiteShell({ current, children, management }: { current: Page; children: ReactNode; management?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const workspace = useContext(WorkspaceContext);
  if (workspace) return <>{children}</>;
  const menu = <>
    <a className="brand" href={withBase("/")} aria-label="Feijão Detailer: início"><img className="brand-logo" src={withBase("/feijao-detailer-logo.png")} alt="Feijão Detailer" /></a>
    <div className="side-note">FEIJÃO DETAILER</div>
    <nav aria-label="Navegação principal">{pages.map(({ key, href, label, icon: Icon }) => <a key={key} href={href} className={current === key ? "nav active" : "nav"} aria-current={current === key ? "page" : undefined}><Icon size={18} aria-hidden="true" />{label}</a>)}</nav>
    {management && <><div className="side-note">CONTROLE</div>{management}</>}
    <div className="side-foot"><a className="side-contact" href="https://wa.me/5531993444280" target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" /> Fale pelo WhatsApp</a><span>Estética automotiva<br />Cuidado em cada detalhe.</span></div>
  </>;
  return <div className="site-shell">
    <a className="skip-navigation" href="#page-content">Pular para o conteúdo</a>
    <aside className="side site-sidebar">{menu}</aside>
    <div className="site-content" id="page-content" tabIndex={-1}>
      <div className="site-mobile-bar"><Sheet open={open} onOpenChange={setOpen}><SheetTrigger className="mobile-menu-button" aria-label="Abrir menu de navegação"><Menu size={22} />Menu</SheetTrigger><SheetContent side="left" className="site-mobile-drawer" showCloseButton={false}><SheetTitle className="sr-only">Navegação Feijão Detailer</SheetTitle><SheetClose className="mobile-close" aria-label="Fechar menu"><X size={22} /></SheetClose><div className="side mobile-side" onClick={event => { if ((event.target as HTMLElement).closest("a,button")) setOpen(false); }}>{menu}</div></SheetContent></Sheet><span>Feijão Detailer</span></div>
      {children}
    </div>
  </div>;
}
