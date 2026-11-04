"use client";
import {useState} from 'react';
import {Search,X,LayoutDashboard,CalendarDays,Users,ClipboardList,FileText,Wallet,Package,CreditCard,Settings,MessageCircle,Wrench,Car,ChevronRight} from 'lucide-react';
import './admin-navigation.css';

export const adminSections=[
 {title:'Dia a dia',items:[
  {id:'overview',label:'Visão geral',icon:LayoutDashboard,description:'Acompanhe os indicadores e abra os cartões para consultar os detalhes.'},
  {id:'schedule',label:'Agenda',icon:CalendarDays,description:'Consulte horários, organize atendimentos e gerencie os bloqueios da agenda.'},
  {id:'clientes',label:'Clientes',icon:Users,description:'Encontre cadastros, veículos e o histórico de cada cliente.'},
  {id:'quotes',label:'Orçamentos',icon:FileText,description:'Prepare propostas e acompanhe aprovações, recusas e prazos.'},
  {id:'orders',label:'Ordens de serviço',icon:ClipboardList,description:'Acompanhe cada atendimento, da chegada à entrega do veículo.'},
 ]},
 {title:'Financeiro e produtos',items:[
  {id:'finance',label:'Financeiro',icon:Wallet,description:'Veja entradas, saídas e valores a receber. Clique nos indicadores para detalhar.'},
  {id:'financeiro',label:'Lançamentos rápidos',icon:Wallet,description:'Registre movimentações e consulte o histórico com filtros de período e situação.'},
  {id:'inventory',label:'Rendimento de produtos',icon:Package,description:'Acompanhe compras, consumo e rendimento dos produtos utilizados.'},
  {id:'reports',label:'Relatórios',icon:FileText,description:'Consulte o resultado por atendimento e exporte os registros.'},
 ]},
 {title:'Relacionamento e serviços',items:[
  {id:'messages',label:'Mensagens e campanhas',icon:MessageCircle,description:'Revise lembretes de retorno e prepare campanhas para seus clientes.'},
  {id:'followups',label:'Manutenção de vitrificação',icon:MessageCircle,description:'Organize os próximos cuidados e acompanhe os retornos previstos.'},
  {id:'subscriptions',label:'Assinaturas',icon:CreditCard,description:'Confira solicitações, planos ativos e o histórico de assinaturas.'},
  {id:'servicos',label:'Catálogo e preços',icon:Wrench,description:'Gerencie os serviços, preços e a duração dos atendimentos.'},
 ]},
 {title:'Preferências',items:[
  {id:'settings',label:'Configurações',icon:Settings,description:'Ajuste a exibição do site, os dados da empresa e os vínculos de clientes.'},
  {id:'customerPreview',label:'Prévia da área do cliente',icon:Car,description:'Explore a demonstração da experiência oferecida aos clientes.'},
 ]},
];
export const isAdminSection=(id:string)=>adminSections.some(group=>group.items.some(item=>item.id===id));
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');

export function AdminNavigation({active,navigate}:{active:string;navigate:(id:string)=>void}){
 const [query,setQuery]=useState('');
 const groups=adminSections.map(group=>({...group,items:group.items.filter(item=>normalize(`${group.title} ${item.label} ${item.description}`).includes(normalize(query.trim())))})).filter(group=>group.items.length);
 return <div className="admin-navigation"><label className="admin-nav-search"><Search size={16} aria-hidden="true"/><input aria-label="Buscar seção da gestão" placeholder="Encontrar uma seção…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" aria-label="Limpar busca de seções" onClick={()=>setQuery('')}><X size={15}/></button>}</label>
 {groups.length?groups.map(group=><section className="admin-nav-group" key={group.title}><h2>{group.title}</h2>{group.items.map(({id,label,icon:Icon})=><button type="button" className={`nav ${active===id?'active':''}`} aria-current={active===id?'page':undefined} key={id} onClick={()=>{navigate(id);setQuery('')}}><Icon size={18} aria-hidden="true"/><span>{label}</span>{active===id&&<ChevronRight className="admin-nav-chevron" size={14}/>}</button>)}</section>):<p className="admin-nav-empty" role="status">Nenhuma seção encontrada. Tente “agenda”, “clientes” ou “financeiro”.</p>}</div>;
}

export function AdminSectionHeader({active,navigate}:{active:string;navigate:(id:string)=>void}){
 const group=adminSections.find(group=>group.items.some(item=>item.id===active));
 const item=group?.items.find(item=>item.id===active);
 if(!group||!item)return null;
 return <header className="admin-section-header"><div className="admin-section-heading"><div><p className="admin-breadcrumb">Gestão <ChevronRight size={12}/> {group.title}</p><h1>{item.label}</h1><p className="admin-section-description">{item.description}</p></div><span className="admin-section-icon"><item.icon size={24}/></span></div><nav className="admin-section-tabs" aria-label={`Seções de ${group.title}`}>{group.items.map(section=><button type="button" key={section.id} aria-current={section.id===active?'page':undefined} onClick={()=>navigate(section.id)}>{section.label}</button>)}</nav></header>;
}
