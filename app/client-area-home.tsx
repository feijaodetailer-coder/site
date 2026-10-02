"use client";
import { withBase } from "@/lib/base";
import { apiFetch } from "@/lib/api";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Car, ClipboardList, CreditCard, FileText, RefreshCw, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./client-area-home.css";

type RecordRow={id:string;kind:string;status:string;data:Record<string,any>;created_at:string};
type Booking={id:number;start_at:string;status:string;service_name:string};
type ClientData={signedIn:boolean;profile?:{name?:string;vehicle?:string;plate?:string}|null;records:RecordRow[];bookings:Booking[];plans:Array<{status:string;plan_name:string;expires_at?:string}>;accountKey?:string};
const date=(value?:string)=>value?new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:value.includes("T")?"short":undefined}).format(new Date(value.length===10?`${value}T12:00:00`:value)):"";

export default function ClientAreaHome({navigate}:{navigate:(tab:string)=>void}){
  const [data,setData]=useState<ClientData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const load=()=>{setLoading(true);apiFetch("/api/workflow",{cache:"no-store"}).then(async response=>{const result=await response.json() as ClientData&{error?:string};if(!response.ok||!result.signedIn)throw new Error(result.error||"Entre na sua conta para consultar seus dados.");setData(result);setError("")}).catch(e=>setError(e instanceof Error?e.message:"Não foi possível carregar seus dados.")).finally(()=>setLoading(false))};
  useEffect(()=>{load()},[]);
  const records=data?.records||[];
  const vehicles=records.filter(row=>row.kind==="vehicle");
  const completed=records.filter(row=>row.kind==="order"&&row.status==="entregue").sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const activeOrder=records.find(row=>row.kind==="order"&&!['entregue','cancelado'].includes(row.status));
  const orderWaiting=activeOrder?.status==="aguardando entrada";
  const activeOrderDescription=activeOrder?(activeOrder.data.title||"Serviço")+" · "+(orderWaiting&&activeOrder.data.delivery?"Chegada prevista: "+date(activeOrder.data.delivery):"Etapa: "+activeOrder.status):"";
  const pendingQuote=records.find(row=>row.kind==="quote"&&['enviado','solicitado'].includes(row.status));
  const nextBooking=useMemo(()=>[...(data?.bookings||[])].filter(row=>['agendado','solicitado'].includes(row.status)&&new Date(row.start_at).getTime()>=Date.now()).sort((a,b)=>a.start_at.localeCompare(b.start_at))[0],[data?.bookings]);
  const nextMaintenance=records.filter(row=>row.kind==="followup"&&row.status!=="concluído"&&row.data.date).sort((a,b)=>String(a.data.date).localeCompare(String(b.data.date)))[0];
  const activePlans=(data?.plans||[]).filter(plan=>plan.status==="ativo");
  const firstName=data?.profile?.name?.trim().split(/\s+/)[0]||"";
  const vehicle=vehicles[0]?.data?.title||data?.profile?.vehicle||"Seu veículo";

  return <main className="main client-home">
    <header className="client-home-head"><div><p className="client-home-eyebrow">ÁREA DO CLIENTE</p><h1>{firstName?`Olá, ${firstName}.` : "Bem-vindo à sua área."}</h1><p>Serviços, planos e informações do seu veículo em um só lugar.</p></div><span className="client-home-mark"><Sparkles size={22}/></span></header>
    {error&&<section className="client-home-state" role="alert"><p>{error}</p><Button variant="outline" onClick={load}><RefreshCw size={16}/> Tentar novamente</Button></section>}
    {loading?<p className="client-home-loading" role="status">Carregando sua área...</p>:data&&<>
      <section className="client-home-feature"><img className="client-home-editorial" src={withBase("/service-images/studio-editorial.webp")} alt="Veículo recebendo polimento cuidadoso em um estúdio claro"/><div className="client-home-feature-content"><div className="client-home-vehicle-icon"><Car size={25}/></div><div className="client-home-feature-copy"><span>VEÍCULO EM DESTAQUE</span><h2>{vehicle}</h2><p>{[vehicles[0]?.data?.plate||data.profile?.plate,completed[0]?`Último serviço: ${completed[0].data.title||completed[0].data.items?.[0]?.name||"Atendimento concluído"}`:null].filter(Boolean).join(" · ")||"Consulte serviços e encontre o próximo cuidado."}</p></div><Button onClick={()=>navigate("clientCatalog")}>Ver serviços e planos <ArrowUpRight size={16}/></Button></div></section>
      <div className="client-home-stats"><article><span><Wrench size={17}/> Serviços concluídos</span><strong>{completed.length}</strong></article><article><span><CalendarDays size={17}/> Próximo atendimento</span><strong>{nextBooking?date(nextBooking.start_at):"Sem agendamento"}</strong>{nextBooking&&<small>{nextBooking.service_name}</small>}</article><article><span><FileText size={17}/> Orçamentos aguardando</span><strong>{records.filter(row=>row.kind==="quote"&&['enviado','solicitado'].includes(row.status)).length}</strong></article><article><span><CreditCard size={17}/> Planos ativos</span><strong>{activePlans.length}</strong>{activePlans[0]&&<small>{activePlans[0].plan_name}</small>}</article></div>
      {(activeOrder||pendingQuote)&&<section className="client-home-next"><div><p className="client-home-eyebrow">CONTINUE DE ONDE PAROU</p><h2>{activeOrder?(orderWaiting?"Seu atendimento está agendado":"Seu atendimento está em andamento"):"Seu orçamento aguarda retorno"}</h2><p>{activeOrder?activeOrderDescription:(pendingQuote?.data.title||"Orçamento")+" · Consulte os detalhes e fale com a equipe."}</p></div><Button variant="outline" onClick={()=>navigate(activeOrder?(orderWaiting?"appointments":"tracking"):"myquotes")}>{activeOrder?(orderWaiting?"Ver agendamento":"Acompanhar atendimento"):"Ver orçamento"}</Button></section>}
      <section className="client-home-recommendation"><div className="client-home-rec-icon"><ShieldCheck size={21}/></div><div><p className="client-home-eyebrow">PRÓXIMO CUIDADO</p><h2>{nextMaintenance?nextMaintenance.data.title:"Escolha o cuidado que combina com seu veículo"}</h2><p>{nextMaintenance?`Manutenção prevista para ${date(nextMaintenance.data.date)}.`:completed.length?`Seu último atendimento foi ${completed[0].data.title||completed[0].data.items?.[0]?.name||"concluído"}. Veja as opções para manter o veículo bem cuidado.`:"Explore os serviços e planos disponíveis. Se tiver dúvidas, nossa equipe pode orientar pelo WhatsApp."}</p><button onClick={()=>navigate("clientCatalog")}>Explorar opções <ArrowUpRight size={15}/></button></div></section>
      <section className="client-home-actions"><div className="client-home-section-title"><div><p className="client-home-eyebrow">ACESSO RÁPIDO</p><h2>O que você precisa hoje?</h2></div></div><div className="client-home-action-grid"><button onClick={()=>navigate("clientCatalog")}><Wrench size={20}/><span><strong>Serviços e pacotes</strong><small>Veja especificações e monte uma combinação</small></span><ArrowUpRight size={16}/></button><button onClick={()=>navigate("clientCatalog")}><CreditCard size={20}/><span><strong>Planos mensais</strong><small>Compare opções e condições</small></span><ArrowUpRight size={16}/></button><button onClick={()=>navigate("appointments")}><CalendarDays size={20}/><span><strong>Agendamentos</strong><small>Consulte ou solicite um horário</small></span><ArrowUpRight size={16}/></button><button onClick={()=>navigate("vehiclehub")}><ClipboardList size={20}/><span><strong>Meu histórico</strong><small>Veja os atendimentos já registrados</small></span><ArrowUpRight size={16}/></button></div></section>
      {!vehicles.length&&!completed.length&&<p className="client-home-empty"><Car size={17}/> Seu histórico e veículos aparecerão aqui conforme forem cadastrados. Cadastros anteriores podem ser vinculados pela equipe após conferência.</p>}
      {!vehicles.length&&data.accountKey&&<p className="client-home-account-key">Se você já era cliente, envie este identificador à equipe para conferirem seu cadastro: <strong>{data.accountKey}</strong></p>}
    </>}
  </main>;
}


