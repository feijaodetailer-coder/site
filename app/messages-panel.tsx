import {useState} from 'react';
import {MessageCircle,Tag,Clock3,ArrowUpRight,Check,Search} from 'lucide-react';
import {dayInBrazil,type HubRecord} from '../lib/vehicle-hub';
import {clientReturnAlerts,returnMessage,whatsappNumber} from '../lib/overview';
import {apiFetch} from '../lib/api';
import {Button} from '@/components/ui/button';
import './messages.css';

type MessageData={records:HubRecord[];clients:{id:number;name:string;phone:string}[];bookings:{id:number;client_id:number;start_at:string;status:string;service_name:string;amount:number;paid:number}[]};
const day=(value:string)=>new Date(value+'T12:00:00').toLocaleDateString('pt-BR');
export default function MessagesPanel({data,onRefresh}:{data:MessageData;onRefresh:()=>Promise<void>}){
  const [view,setView]=useState<'pending'|'sent'>('pending'),[search,setSearch]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[opened,setOpened]=useState<string[]>([]);
  const alerts=clientReturnAlerts(data.records,data.bookings,dayInBrazil());
  const clients=new Map(data.clients.map(client=>[client.id,client]));
  const sent=data.records.filter(r=>r.kind==='message_sent').sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const matches=(id:number|null)=>{const c=clients.get(id||0);return `${c?.name||''} ${c?.phone||''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));};
  const act=async(id:string,undo=false)=>{setBusy(id);setError('');try{const r=await apiFetch('/api/workflow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(undo?{action:'undo_message_sent',id}:{action:'message_sent',alertId:id})});const j=await r.json();if(!r.ok)throw Error(j.error||'Não foi possível salvar.');await onRefresh();}catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.');}finally{setBusy('');}};
  const visibleAlerts=alerts.filter(a=>matches(a.clientId)),visibleSent=sent.filter(r=>matches(r.client_id));
  return <div className="messages-page">
    <header className="messages-intro"><div><p>RELACIONAMENTO COM CLIENTES</p><h2>Cada retorno, acompanhado</h2><span>Abra a mensagem no WhatsApp e, após enviar, marque como enviada. O registro fica salvo para você não repetir o contato.</span></div><div className="messages-totals"><div><Clock3 size={18}/><strong>{alerts.filter(a=>a.stage===15).length}</strong><span>Pendentes · 15 dias</span></div><div><Tag size={18}/><strong>{alerts.filter(a=>a.stage===30).length}</strong><span>Pendentes · 30 dias</span></div></div></header>
    <div className="message-controls"><div role="group" aria-label="Status das mensagens"><Button variant={view==='pending'?'default':'outline'} onClick={()=>setView('pending')}>Pendentes ({alerts.length})</Button><Button variant={view==='sent'?'default':'outline'} onClick={()=>setView('sent')}>Enviadas ({sent.length})</Button></div><label><Search size={18}/><input aria-label="Buscar mensagens por cliente" placeholder="Buscar cliente ou telefone" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="messages-list">{view==='pending'?visibleAlerts.map(alert=>{
      const client=clients.get(alert.clientId),phone=whatsappNumber(client?.phone),message=returnMessage(client?.name||'',alert.stage);
      return <article className="messages-card" key={alert.id}><div className="messages-card-top"><div><span className={alert.stage===30?'messages-badge offer':'messages-badge'}>{alert.stage===30?'30 dias · 10% de desconto':'15 dias · lembrete'}</span><h3>{client?.name||'Cliente'}</h3><p>Último serviço: {day(alert.lastServiceDay)} · há {alert.daysSinceService} dias</p></div><MessageCircle size={21}/></div><div className="messages-preview"><small>PRÉVIA DA MENSAGEM</small><p>{message}</p></div><div className="messages-card-bottom">{phone?<a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" onClick={()=>setOpened(current=>[...current,alert.id])}>Abrir no WhatsApp <ArrowUpRight size={16}/></a>:<span>Cadastre um WhatsApp válido para este cliente.</span>}<Button disabled={!!busy} variant="outline" onClick={()=>void act(alert.id)}><Check size={16}/>{busy===alert.id?'Salvando...':'Marcar como enviada'}</Button></div>{opened.includes(alert.id)&&<p className="message-return-hint" role="status">Enviou pelo WhatsApp? Confirme acima para tirar esta mensagem das pendências.</p>}</article>;
    }):visibleSent.map(r=><article className="messages-card message-sent" key={r.id}><span className="messages-badge"><Check size={14}/> Mensagem enviada · {r.data.stage} dias</span><h3>{clients.get(r.client_id||0)?.name||'Cliente'}</h3><p>Registrada em {new Date(String(r.data.sentAt||r.created_at)).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p><small>Referente ao atendimento de {day(String(r.data.lastServiceDay))}</small><Button variant="outline" disabled={!!busy} onClick={()=>void act(r.id,true)}>{busy===r.id?'Salvando...':'Desfazer marcação'}</Button></article>)}</div>
    {!(view==='pending'?visibleAlerts.length:visibleSent.length)&&<div className="messages-empty"><MessageCircle size={24}/><h3>{search?'Nenhum resultado para essa busca':view==='pending'?'Nenhuma mensagem pendente':'Nenhuma mensagem marcada como enviada'}</h3><p>{view==='pending'?'Os lembretes aparecem aos 15 e 30 dias do último atendimento.':'Os contatos confirmados aparecerão aqui com a data de envio.'}</p></div>}
  </div>;
}
