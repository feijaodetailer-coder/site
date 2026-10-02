"use client";

import { CheckCircle2, Clock3, ExternalLink, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type Client={id:number;name:string;phone:string;vehicle:string;plate:string};
type Service={id:number;name:string;price:number};
type Plan={id:number;client_id:number;plan_service_id:number;status:string;amount:number;requested_at:string;authorized_at:string|null;expires_at:string|null};
const money=(amount:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(amount/100);
const date=(value:string)=>new Date(value).toLocaleDateString("pt-BR",{dateStyle:"short"});

export default function PlanManagement({plans,clients,services,saving,onAction}:{plans:Plan[];clients:Client[];services:Service[];saving:boolean;onAction:(id:number,action:"authorize"|"reject")=>Promise<void>}){
  const pending=plans.filter(p=>p.status==="pendente");
  const active=plans.filter(p=>p.status==="ativo"&&(!p.expires_at||p.expires_at>new Date().toISOString()));
  const history=plans.filter(p=>p.status==="recusado"||(p.status==="ativo"&&Boolean(p.expires_at&&p.expires_at<=new Date().toISOString())));
  const client=(id:number)=>clients.find(c=>c.id===id);
  const planName=(id:number)=>services.find(s=>s.id===id)?.name||"Plano";
  const card=(plan:Plan)=>{const customer=client(plan.client_id);const phone=customer?.phone?.replace(/\D/g,"")||"";return <article className="plan-admin-card" key={plan.id}>
    <div className="plan-admin-main"><div className="plan-admin-head"><strong>{customer?.name||"Cliente"}</strong><span className={`plan-state ${plan.status}`}>{plan.status==="ativo"&&plan.expires_at&&plan.expires_at<=new Date().toISOString()?"Vencido":plan.status}</span></div><p>{planName(plan.plan_service_id)} · {money(plan.amount)}/mês</p><small>{customer?.vehicle||"Veículo não informado"}{customer?.plate?` · ${customer.plate}`:""}</small><small>Solicitado em {date(plan.requested_at)}{plan.expires_at?` · válido até ${date(plan.expires_at)}`:""}</small></div>
    <div className="plan-admin-actions">{phone&&<a href={`https://wa.me/55${phone}`} target="_blank" rel="noreferrer"><ExternalLink size={15}/> WhatsApp</a>}{plan.status==="pendente"&&<>
      <AlertDialog><AlertDialogTrigger asChild><Button size="sm" disabled={saving}><CheckCircle2 size={16}/> Autorizar</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar pagamento e ativar plano?</AlertDialogTitle><AlertDialogDescription>Confira no seu banco o Pix de {money(plan.amount)} para {planName(plan.plan_service_id)}. A autorização ativa o plano por um mês e registra a entrada no caixa.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={()=>void onAction(plan.id,"authorize")}>Pix conferido: autorizar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="outline" disabled={saving}><XCircle size={16}/> Recusar</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Recusar solicitação?</AlertDialogTitle><AlertDialogDescription>O plano de {customer?.name||"este cliente"} não será ativado. Use esta opção quando o pagamento não for confirmado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={()=>void onAction(plan.id,"reject")}>Recusar pedido</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>}</div>
  </article>};
  return <div className="plan-management"><div className="plan-management-lead"><div><span className="eyebrow">ASSINATURAS</span><h2>Gerenciamento de planos</h2><p>Confira o Pix antes de autorizar. Pedidos enviados pelos clientes ficam pendentes até sua decisão.</p></div><ShieldCheck size={38}/></div>
    <div className="plan-admin-stats"><div><Clock3 size={19}/><strong>{pending.length}</strong><span>Pendentes</span></div><div><CheckCircle2 size={19}/><strong>{active.length}</strong><span>Ativos</span></div><div><XCircle size={19}/><strong>{history.length}</strong><span>Histórico</span></div></div>
    <Tabs defaultValue="pendentes"><TabsList><TabsTrigger value="pendentes">Pendentes ({pending.length})</TabsTrigger><TabsTrigger value="ativos">Ativos ({active.length})</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger></TabsList><TabsContent value="pendentes"><div className="plan-admin-list">{pending.length?pending.map(card):<p className="empty">Nenhum Pix aguardando conferência.</p>}</div></TabsContent><TabsContent value="ativos"><div className="plan-admin-list">{active.length?active.map(card):<p className="empty">Nenhum plano ativo.</p>}</div></TabsContent><TabsContent value="historico"><div className="plan-admin-list">{history.length?history.map(card):<p className="empty">Ainda não há histórico.</p>}</div></TabsContent></Tabs>
  </div>;
}
