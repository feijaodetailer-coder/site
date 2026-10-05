"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { RefreshCw, Send, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./customer-reviews.css";

type RecordRow = { id: string; kind: string; status: string; data: Record<string, any>; created_at: string };
type Service = { id: number; name: string };
type ReviewData = { signedIn: boolean; records: RecordRow[]; services: Service[] };
type ReviewForm = { rating: number; comment: string };

export default function CustomerReviews() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [forms, setForms] = useState<Record<string, ReviewForm>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = () => {
    setLoading(true);
    apiFetch("/api/workflow", { cache: "no-store" })
      .then(async response => {
        const result = await response.json() as ReviewData & { error?: string };
        if (!response.ok || !result.signedIn) throw new Error(result.error || "Entre na sua conta para avaliar seus serviços.");
        setData(result);
        setError("");
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Não foi possível carregar suas avaliações."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const completedOrders = useMemo(() => (data?.records || []).filter(row => row.kind === "order" && row.status === "entregue"), [data]);
  const published = useMemo(() => new Set((data?.records || []).filter(row => row.kind === "review").map(row => row.id)), [data]);
  const eligible = useMemo(() => completedOrders.flatMap(order => {
    const items = Array.isArray(order.data.items) ? order.data.items : [];
    return items.flatMap((item: { name?: string }) => {
      const service = data?.services.find(candidate => candidate.name === item?.name);
      if (!service) return [];
      const id = `review:${order.id}:${service.id}`;
      return published.has(id) ? [] : [{ id, orderId: order.id, serviceId: service.id, serviceName: service.name, completedAt: order.data.completedDate || order.updated_at }];
    });
  }).filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id) === index), [completedOrders, data, published]);

  const submit = async (item: typeof eligible[number]) => {
    const form = forms[item.id] || { rating: 5, comment: "" };
    if (!form.rating) { setError("Escolha uma nota antes de enviar."); return; }
    setSending(item.id); setError(""); setNotice("");
    try {
      const response = await apiFetch("/api/public", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "review", orderId: item.orderId, serviceId: item.serviceId, rating: form.rating, comment: form.comment }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível publicar sua avaliação.");
      setNotice("Sua avaliação foi publicada e já pode aparecer na página inicial.");
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível publicar sua avaliação.");
    } finally { setSending(""); }
  };

  return <main className="main customer-reviews">
    <header className="customer-reviews-head"><p className="customer-reviews-eyebrow">SUA EXPERIÊNCIA</p><h1>Avaliações</h1><p>Avalie cada serviço depois que ele for concluído. Sua opinião é publicada automaticamente.</p></header>
    {error && <section role="alert" className="customer-reviews-message is-error">{error}<Button variant="outline" onClick={load}><RefreshCw size={15}/> Tentar novamente</Button></section>}
    {notice && <p role="status" className="customer-reviews-message is-success">{notice}</p>}
    {loading ? <p role="status" className="customer-reviews-empty">Carregando seus serviços...</p> : eligible.length ? <div className="customer-review-list">{eligible.map(item => {
      const form = forms[item.id] || { rating: 5, comment: "" };
      return <article className="customer-review-card" key={item.id}>
        <div><span className="customer-review-label">SERVIÇO CONCLUÍDO</span><h2>{item.serviceName}</h2><p>Concluído em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(item.completedAt))}</p></div>
        <fieldset className="customer-review-rating"><legend>Sua nota</legend><div>{[1, 2, 3, 4, 5].map(value => <button type="button" key={value} aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`} aria-pressed={form.rating === value} onClick={() => setForms(current => ({ ...current, [item.id]: { ...form, rating: value } }))}><Star size={25} fill={value <= form.rating ? "currentColor" : "none"}/></button>)}</div></fieldset>
        <label className="customer-review-comment">Comentário (opcional)<textarea maxLength={500} value={form.comment} onChange={event => setForms(current => ({ ...current, [item.id]: { ...form, comment: event.target.value } }))} placeholder="Conte como foi sua experiência"/></label>
        <Button className="customer-review-submit" disabled={sending === item.id} onClick={() => submit(item)}><Send size={16}/>{sending === item.id ? "Publicando..." : "Publicar avaliação"}</Button>
      </article>;
    })}</div> : <section className="customer-reviews-empty"><Star size={22}/><h2>Nenhum serviço aguardando avaliação</h2><p>Quando um serviço da sua conta for concluído, ele aparecerá aqui para você avaliar.</p></section>}
    {!loading && (data?.records || []).some(row => row.kind === "review") && <section className="customer-reviews-published"><h2>Suas avaliações publicadas</h2><ul>{data!.records.filter(row => row.kind === "review").map(row => <li key={row.id}><span>{row.data.serviceName}</span><span>{"★".repeat(Number(row.data.rating) || 0)}{"☆".repeat(5 - (Number(row.data.rating) || 0))}</span></li>)}</ul></section>}
  </main>;
}
