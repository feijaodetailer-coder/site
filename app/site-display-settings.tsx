"use client";
import { apiFetch } from "@/lib/api";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { catalogTabs, defaultSiteDisplay, type SiteDisplay } from "../lib/site-display";
import { serviceCategories } from "../lib/service-categories";
import "./site-display-settings.css";

type Offer = { id: number; name: string; category: string };
export default function SiteDisplaySettings({ services, catalogLoading }: { services: Offer[]; catalogLoading: boolean }) {
  const [settings, setSettings] = useState<SiteDisplay>(defaultSiteDisplay);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    setLoading(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/api/site-settings", { cache: "no-store" });
      const result = await response.json() as { settings: SiteDisplay; version: number; error?: string };
      if (!response.ok) throw new Error(result.error);
      setSettings(result.settings); setVersion(result.version); setDirty(false); setLoaded(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível carregar."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const change = (next: SiteDisplay) => { setSettings(next); setDirty(true); setNotice(""); };
  const toggle = (key: "hiddenTabs" | "hiddenCategories" | "hiddenEditorialServices", id: string, visible: boolean) =>
    change({ ...settings, [key]: visible ? settings[key].filter(item => item !== id) : [...settings[key], id] });
  const toggleOffer = (id: number, visible: boolean) => change({ ...settings, hiddenServiceIds: visible ? settings.hiddenServiceIds.filter(item => item !== id) : [...settings.hiddenServiceIds, id] });
  async function save() {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/api/site-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings, version }) });
      const result = await response.json() as { settings: SiteDisplay; version: number; error?: string };
      if (!response.ok) throw new Error(result.error);
      setVersion(result.version); setDirty(false); setNotice("Configurações salvas. A visibilidade já foi atualizada no site.");
      window.dispatchEvent(new Event("site-settings-changed"));
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  const offerList = (items: Offer[]) => items.map(service => <label className="site-visibility-option" key={service.id}><input type="checkbox" checked={!settings.hiddenServiceIds.includes(service.id)} onChange={event => toggleOffer(service.id, event.target.checked)}/><span>{service.name}</span><small>{settings.hiddenServiceIds.includes(service.id) ? "Oculto" : "Visível"}</small></label>);
  return <section className="ops-card site-visibility-settings">
    <h2>Exibição do site</h2>
    <p>Marque o que os clientes podem ver e clique em Salvar configurações. Ocultar não exclui serviços, planos, agendamentos nem históricos.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {notice && <p role="status" className="site-settings-notice">{notice}</p>}
    {loading && <p role="status">Carregando configurações...</p>}
    <fieldset disabled={loading || saving || !loaded}>
      <legend>Abas do catálogo da área do cliente</legend>
      <p>Ocultar “Agendar online” tira apenas a aba. O cliente ainda pode agendar a partir de um serviço.</p>
      <div className="site-visibility-grid">{catalogTabs.map(tab => <label className="site-visibility-option" key={tab.id}><input type="checkbox" checked={!settings.hiddenTabs.includes(tab.id)} onChange={event => toggle("hiddenTabs", tab.id, event.target.checked)}/><span>{tab.label}</span><small>{settings.hiddenTabs.includes(tab.id) ? "Oculta" : "Visível"}</small></label>)}</div>
      {settings.hiddenTabs.length === catalogTabs.length && <p>Todas as abas estão ocultas. O catálogo mostrará uma mensagem de indisponibilidade.</p>}
      <details className="site-visibility-section"><summary>Categorias e serviços de “Mais serviços”</summary><p>Essas escolhas também valem para a busca e os destaques.</p>{serviceCategories.map(category => <details key={category.id} className="site-visibility-category"><summary>{category.name}{settings.hiddenCategories.includes(category.id) ? " · Oculta" : ""}</summary><label className="site-visibility-option"><input type="checkbox" checked={!settings.hiddenCategories.includes(category.id)} onChange={event => toggle("hiddenCategories", category.id, event.target.checked)}/><span>Exibir esta categoria</span></label><div className="site-visibility-grid">{category.items.map(name => <label className="site-visibility-option" key={name}><input type="checkbox" checked={!settings.hiddenEditorialServices.includes(name)} onChange={event => toggle("hiddenEditorialServices", name, event.target.checked)}/><span>{name}</span></label>)}</div></details>)}</details>
      <details className="site-visibility-section"><summary>Serviços para agendamento e pacotes</summary><p>Escolha quais opções do catálogo de preços podem receber novas solicitações pelo site.</p>{catalogLoading ? <p>Carregando serviços...</p> : [...new Set(services.filter(service => service.category !== "Planos mensais").map(service => service.category))].map(category => <details className="site-visibility-category" key={category}><summary>{category}</summary><div className="site-visibility-grid">{offerList(services.filter(service => service.category === category))}</div></details>)}</details>
      <details className="site-visibility-section"><summary>Planos mensais disponíveis</summary><p>Planos ocultos deixam de receber novas solicitações. Assinaturas existentes continuam disponíveis na gestão e no histórico do cliente.</p><div className="site-visibility-grid">{catalogLoading ? <p>Carregando planos...</p> : offerList(services.filter(service => service.category === "Planos mensais"))}</div></details>
    </fieldset>
    <div className="site-settings-actions"><Button disabled={loading || saving || !loaded || !dirty} onClick={save}>{saving ? "Salvando..." : "Salvar configurações"}</Button><Button variant="outline" disabled={loading || saving} onClick={load}>Recarregar configurações</Button>{dirty && <span>Alterações ainda não salvas</span>}</div>
  </section>;
}
