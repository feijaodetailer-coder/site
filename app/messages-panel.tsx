import {MessageCircle,Tag,Clock3,ArrowUpRight} from 'lucide-react';
import {dayInBrazil,type HubRecord} from '../lib/vehicle-hub';
import {clientReturnAlerts,returnMessage,whatsappNumber} from '../lib/overview';
import './messages.css';

type MessageData={
  records:HubRecord[];
  clients:{id:number;name:string;phone:string}[];
  bookings:{id:number;client_id:number;start_at:string;status:string;service_name:string;amount:number;paid:number}[];
};
const day=(value:string)=>new Date(value+'T12:00:00').toLocaleDateString('pt-BR');

export default function MessagesPanel({data}:{data:MessageData}){
  const alerts=clientReturnAlerts(data.records,data.bookings,dayInBrazil());
  const clients=new Map(data.clients.map(client=>[client.id,client]));
  const reminders=alerts.filter(alert=>alert.stage===15).length;
  const offers=alerts.filter(alert=>alert.stage===30).length;
  return <div className="messages-page">
    <header className="messages-intro"><div><p>ACOMPANHAMENTO AUTOMÁTICO</p><h2>Mensagens prontas para enviar</h2><span>O sistema prepara um rascunho por cliente, considerando o último serviço concluído. Você revisa e envia pelo WhatsApp quando quiser.</span></div><div className="messages-totals"><div><Clock3 size={18}/><strong>{reminders}</strong><span>Lembretes de 15 dias</span></div><div><Tag size={18}/><strong>{offers}</strong><span>Ofertas de 30 dias</span></div></div></header>
    {!alerts.length?<div className="messages-empty"><MessageCircle size={24}/><h3>Nenhuma mensagem pendente por enquanto</h3><p>Os rascunhos aparecem quando um cliente completa 15 ou 30 dias desde o último serviço concluído.</p></div>:<div className="messages-list">{alerts.map(alert=>{
      const client=clients.get(alert.clientId);
      const phone=whatsappNumber(client?.phone);
      const message=returnMessage(client?.name||'',alert.stage);
      return <article className="messages-card" key={alert.id}><div className="messages-card-top"><div><span className={alert.stage===30?'messages-badge offer':'messages-badge'}>{alert.stage===30?'30 dias · 10% de desconto':'15 dias · lembrete'}</span><h3>{client?.name||'Cliente'}</h3><p>Último serviço: {day(alert.lastServiceDay)} · {alert.daysSinceService} dias sem novo atendimento</p></div><MessageCircle size={21} aria-hidden="true"/></div><div className="messages-preview"><small>PRÉVIA DA MENSAGEM</small><p>{message}</p></div><div className="messages-card-bottom"><small>Nenhum envio automático será feito.</small>{phone?<a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Abrir no WhatsApp <ArrowUpRight size={16}/></a>:<span>Cadastre um WhatsApp válido para este cliente.</span>}</div></article>;
    })}</div>}
  </div>;
}
