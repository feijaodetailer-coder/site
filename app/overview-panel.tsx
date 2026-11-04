"use client";
import {useState} from "react";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {ArrowUpRight,Bell,CalendarDays,ChartNoAxesCombined,ClipboardList,Clock3,FileText,Users,Wallet} from 'lucide-react';
import {cash,summarize,type FinanceData} from '../lib/finance';
import {completedDay,dayInBrazil,type HubRecord} from '../lib/vehicle-hub';
import {clientReturnAlerts} from '../lib/overview';
import {orderSummary} from '../lib/order-summary';
import './overview.css';

type OverviewData={
  records:HubRecord[];
  clients:{id:number;name:string;phone:string}[];
  bookings:{id:number;client_id:number;start_at:string;status:string;service_name:string;amount:number;paid:number}[];
  plans:{status:string}[];
};
const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
const day=(value:string)=>new Date(value+'T12:00:00').toLocaleDateString('pt-BR');

export default function OverviewPanel({data,finance,navigate}:{data:OverviewData;finance:FinanceData|null;navigate:(tab:string)=>void}){
  const [selected,setSelected]=useState<number|null>(null);
  const [search,setSearch]=useState('');
  const today=dayInBrazil();
  const month=today.slice(0,7)+'-01';
  const all=finance?summarize(finance,'',''):null;
  const current=finance?summarize(finance,month,today):null;
  const orders=data.records.filter(r=>r.kind==='order');
  const completed=orders.filter(r=>r.status==='entregue');
  const orderTotals=orderSummary(orders);
  const linkedBookings=new Set(orders.map(r=>Number(r.data.bookingId)).filter(Boolean));
  const completedAmounts=[...completed.filter(r=>!!completedDay(r,data.bookings)).map(r=>Number(r.data.total||0)),...data.bookings.filter(b=>b.status==='concluido'&&!linkedBookings.has(b.id)).map(b=>b.amount)];
  const ticket=completedAmounts.length?Math.round(completedAmounts.reduce((sum,amount)=>sum+amount,0)/completedAmounts.length):0;
  const completedClients=new Set<number>(completed.map(r=>r.client_id).filter((id):id is number=>!!id));
  data.bookings.filter(b=>b.status==='concluido'&&!linkedBookings.has(b.id)).forEach(b=>completedClients.add(b.client_id));
  const completedToday=completed.filter(r=>completedDay(r,data.bookings)===today).length+
    data.bookings.filter(b=>b.status==='concluido'&&!linkedBookings.has(b.id)&&b.start_at.slice(0,10)===today).length;
  const todayBookings=data.bookings.filter(b=>b.start_at.slice(0,10)===today&&b.status!=='cancelado');
  const upcoming=data.bookings.filter(b=>b.start_at.slice(0,10)>=today&&!['cancelado','concluido'].includes(b.status)).sort((a,b)=>a.start_at.localeCompare(b.start_at)).slice(0,5);
  const alerts=clientReturnAlerts(data.records,data.bookings,today);
  const clientById=new Map(data.clients.map(c=>[c.id,c]));
  const cards=[
    {label:'Faturamento total',value:all?money(all.income):'—',detail:'Entradas recebidas · todo o período',icon:Wallet},
    {label:'Ticket médio',value:money(ticket),detail:'Serviços concluídos · todo o período',icon:ChartNoAxesCombined},
    {label:'OS em andamento',value:String(orders.filter(r=>!['entregue','cancelado'].includes(r.status)).length),detail:'Ainda não entregues',icon:ClipboardList},
    {label:'Agendamentos hoje',value:String(todayBookings.length),detail:'Confirmados ou solicitados',icon:CalendarDays},
    {label:'Serviços concluídos hoje',value:String(completedToday),detail:'Atendimentos finalizados',icon:Clock3},
    {label:'Clientes atendidos',value:String(completedClients.size),detail:'Clientes distintos · todo o período',icon:Users},
    {label:'Faturamento no mês',value:current?money(current.income):'—',detail:'Entradas recebidas neste mês',icon:Wallet},
    {label:'Orçamentos pendentes',value:String(data.records.filter(r=>r.kind==='quote'&&['solicitado','enviado'].includes(r.status)).length),detail:'Aguardando análise ou resposta',icon:FileText},
    {label:'Valor total das OS',value:money(orderTotals.total),detail:'Todas as ordens, exceto canceladas',icon:ClipboardList},
    {label:'A receber nas OS',value:money(orderTotals.outstanding),detail:'Saldo pendente, inclusive ordens entregues',icon:Wallet},
  ];
  type DetailRow={id:string;title:string;description:string;amount?:number};
  const customer=(id:number|null)=>id?clientById.get(id)?.name||'Cliente não encontrado':'Sem cliente vinculado';
  const orderRow=(r:HubRecord):DetailRow=>({id:r.id,title:String(r.data.title||'Atendimento'),description:`${customer(r.client_id)} · ${r.status} · ${completedDay(r,data.bookings)?day(completedDay(r,data.bookings)!):'Sem data de conclusão'}`,amount:Number(r.data.total||0)});
  const bookingRow=(b:OverviewData['bookings'][number]):DetailRow=>({id:`booking:${b.id}`,title:b.service_name,description:`${customer(b.client_id)} · ${b.status} · ${new Date(b.start_at).toLocaleString('pt-BR')}`,amount:b.amount});
  const received=(from=''):DetailRow[] => (finance?.transactions||[]).filter(t=>t.kind==='entrada'&&cash(t)>0&&(!from||((t.paidDate||t.date)>=from&&(t.paidDate||t.date)<=today))).map(t=>({id:String(t.id),title:t.description,description:`${day(t.paidDate||t.date)} · ${t.category} · ${t.payment_method} · ${t.financial_status==='parcial'?'Recebimento parcial':'Recebido'}`,amount:cash(t)}));
  const completedRows=[...completed.filter(r=>!!completedDay(r,data.bookings)).map(orderRow),...data.bookings.filter(b=>b.status==='concluido'&&!linkedBookings.has(b.id)).map(bookingRow)];
  const details:DetailRow[][]=[
    received(),
    completedRows,
    orders.filter(r=>!['entregue','cancelado'].includes(r.status)).map(orderRow),
    todayBookings.map(bookingRow),
    [...completed.filter(r=>completedDay(r,data.bookings)===today).map(orderRow),...data.bookings.filter(b=>b.status==='concluido'&&!linkedBookings.has(b.id)&&b.start_at.slice(0,10)===today).map(bookingRow)],
    [...completedClients].map(id=>({id:String(id),title:customer(id),description:clientById.get(id)?.phone||'Telefone não informado'})),
    received(month),
    data.records.filter(r=>r.kind==='quote'&&['solicitado','enviado'].includes(r.status)).map(orderRow),
    orders.filter(r=>r.status!=='cancelado').map(orderRow),
    orders.filter(r=>r.status!=='cancelado'&&Number(r.data.total||0)>Number(r.data.paid||0)).map(r=>({...orderRow(r),amount:Number(r.data.total||0)-Number(r.data.paid||0)})),
  ];
  const destinations=['financeiro','orders','orders','schedule','orders','clientes','financeiro','quotes','orders','orders'];
  const selectedCard=selected===null?null:cards[selected];
  const selectedRows=selected===null?[]:details[selected];
  const matchingRows=selectedRows.filter(row=>`${row.title} ${row.description}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')));
  return <div className="overview-clean">
    <div className="overview-heading"><div><h2>Empresa em um olhar</h2><p>Indicadores atualizados com os registros de serviços, agenda e financeiro.</p></div><span>{day(today)}</span></div>
    <div className="overview-metrics">{cards.map(({label,value,detail,icon:Icon},index)=><button type="button" className="overview-metric" key={label} onClick={()=>{setSelected(index);setSearch('')}} aria-label={`Ver detalhes: ${label}`}><div className="overview-metric-top"><span>{label}</span><Icon size={19} aria-hidden="true"/></div><strong>{value}</strong><small>{detail}</small><span className="overview-card-action">Ver detalhes <ArrowUpRight size={14}/></span></button>)}</div>
    <Dialog open={selected!==null} onOpenChange={open=>{if(!open)setSelected(null)}}><DialogContent className="overview-detail-dialog"><DialogHeader><DialogTitle>{selectedCard?.label}</DialogTitle><DialogDescription>{selectedCard?.detail}. {selectedRows.length} registro(s).</DialogDescription></DialogHeader>
      <p className="overview-detail-total">{selectedCard?.value}</p>
      {selected===1&&<p>A média considera os valores dos atendimentos abaixo, sem duplicar agendamentos vinculados a uma OS.</p>}
      <Input aria-label="Buscar nos detalhes" placeholder="Buscar por descrição, cliente ou data" value={search} onChange={e=>setSearch(e.target.value)}/>
      <div className="overview-detail-list">{matchingRows.length?<ul>{matchingRows.map(row=><li key={row.id}><div><strong>{row.title}</strong><small>{row.description}</small></div>{row.amount!==undefined&&<span>{money(row.amount)}</span>}</li>)}</ul>:<p>Nenhum registro encontrado{search?' para esta busca':' neste período'}.</p>}</div>
      <button type="button" className="overview-link" onClick={()=>{if(selected!==null)navigate(destinations[selected]);setSelected(null)}}>Abrir área de gestão <ArrowUpRight size={16}/></button>
    </DialogContent></Dialog>
    <div className="overview-lower">
      <section className="overview-panel"><div className="overview-panel-heading"><div><h2><Bell size={20} aria-hidden="true"/> Retorno de clientes</h2><p>Um aviso por cliente, contado desde o último serviço concluído.</p></div><span className="overview-counter">{alerts.length}</span></div>
        {!alerts.length?<p className="overview-empty">Nenhum cliente atingiu 15 dias sem novo serviço.</p>:<div className="overview-alerts">{alerts.map(alert=>{const client=clientById.get(alert.clientId);return <article className="overview-alert" key={alert.id}><div><span className={`overview-stage ${alert.stage===30?'eligible':''}`}>{alert.stage===30?'30 dias · oferta de 10%':'15 dias · lembrete'}</span><h3>{client?.name||'Cliente'} <span>· {alert.daysSinceService} dias</span></h3><p>Último serviço concluído em {day(alert.lastServiceDay)}.</p></div><button type="button" className="overview-link" onClick={()=>navigate('messages')}>Ver mensagem <ArrowUpRight size={16}/></button></article>})}</div>}
        <p className="overview-footnote">As mensagens ficam prontas na aba Mensagens para revisão e envio manual. Um serviço concluído mais recente reinicia a contagem.</p>
      </section>
      <section className="overview-panel"><div className="overview-panel-heading"><div><h2><CalendarDays size={20} aria-hidden="true"/> Próximos atendimentos</h2><p>Agenda confirmada ou em solicitação.</p></div></div>{!upcoming.length?<p className="overview-empty">Nenhum atendimento futuro na agenda.</p>:<div className="overview-upcoming">{upcoming.map(b=><div key={b.id}><div><strong>{b.service_name}</strong><small>{clientById.get(b.client_id)?.name||'Cliente'}</small></div><span>{new Date(b.start_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</span></div>)}</div>}<button type="button" className="overview-link" onClick={()=>navigate('schedule')}>Abrir agenda <ArrowUpRight size={16}/></button></section>
    </div>
  </div>;
}
