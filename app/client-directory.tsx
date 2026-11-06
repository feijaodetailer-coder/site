import {useState} from 'react';
import {Users,Car,MessageCircle,ArrowUpRight,Pencil,Link2,Check} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {apiFetch} from '@/lib/api';
import {whatsappNumber} from '@/lib/overview';
import {dayInBrazil} from '@/lib/vehicle-hub';
import './client-directory.css';
type Client={id:number;name:string;phone:string;vehicle:string;plate:string;user_id?:string|null};
export default function ClientDirectory<T extends Client>({clients,allClients,visits,onOpen,onEdit,onRefresh}:{clients:T[];allClients:T[];visits:Map<number,string>;onOpen:(client:T)=>void;onEdit:(client:T)=>void;onRefresh:()=>Promise<void>}){
 const [page,setPage]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const groups=new Map<string,T[]>();for(const c of allClients){const key=whatsappNumber(c.phone);if(key)groups.set(key,[...(groups.get(key)||[]),c]);}
 const duplicates=[...groups.entries()].filter(([,rows])=>rows.length>1);
 const merge=async(source:T,target:T)=>{
   if(!window.confirm(`Confirme que ${source.name} e ${target.name} são a mesma pessoa. Unir os cadastros preservará o histórico no cadastro de ${target.name}${target.user_id?' e permitirá que essa conta veja o histórico anterior':''}.`))return;
   setBusy(true);setError('');try{const r=await apiFetch('/api/workflow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'merge_clients',sourceId:source.id,targetId:target.id})});const j=await r.json();if(!r.ok)throw Error(j.error||'Não foi possível unir.');await onRefresh();}catch(e){setError(e instanceof Error?e.message:'Não foi possível unir.');}finally{setBusy(false);}
 };
 const pages=Math.max(1,Math.ceil(clients.length/12)),current=Math.min(page,pages);
 return <div className="client-directory">
 {error&&<p role="alert" className="error">{error}</p>}
 {duplicates.length>0&&<details className="client-duplicates" open><summary><Link2 size={18}/>{duplicates.length} {duplicates.length===1?'telefone com cadastros repetidos':'telefones com cadastros repetidos'}</summary><p>O telefone identifica a coincidência. Confira os nomes antes de liberar o histórico para uma conta do site.</p>{duplicates.map(([phone,rows])=>{const target=rows.find(c=>c.user_id)||rows[0];return <div key={phone}><span><strong>{rows.map(c=>c.name).join(' / ')}</strong><small>+{phone} · {rows.length} cadastros</small></span>{rows.filter(c=>c.id!==target.id).map(source=>source.user_id?<small key={source.id}>Duas contas com acesso: revise os telefones.</small>:<Button key={source.id} disabled={busy} variant="outline" onClick={()=>void merge(source,target)}><Link2 size={15}/>Unir {source.name}</Button>)}</div>})}</details>}
 <div className="client-directory-grid">{clients.slice((current-1)*12,current*12).map(c=>{const last=visits.get(c.id),phone=whatsappNumber(c.phone),days=last?Math.max(0,Math.floor((Date.parse(dayInBrazil()+'T12:00:00Z')-Date.parse(last+'T12:00:00Z'))/86400000)):null;return <article className="directory-card" key={c.id}><header><span className="directory-avatar">{c.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toLocaleUpperCase('pt-BR')}</span><div><h3>{c.name}</h3><span className={c.user_id?'directory-account linked':'directory-account'}>{c.user_id?<Check size={12}/>:<Users size={12}/>} {c.user_id?'Cadastro com acesso ao site':'Cadastro da gestão'}</span></div><Button variant="ghost" size="icon" aria-label={`Editar cadastro de ${c.name}`} onClick={()=>onEdit(c)}><Pencil size={16}/></Button></header><div className="directory-information"><p><MessageCircle size={16}/>{c.phone||'Telefone não informado'}</p><p><Car size={16}/>{[c.vehicle,c.plate].filter(Boolean).join(' · ')||'Abra o histórico para ver os veículos'}</p></div><div className={`directory-last ${days!==null&&days>=30?'return-due':''}`}><span>Último atendimento</span><strong>{days===null?'Ainda sem serviço concluído':days===0?'Hoje':`Há ${days} ${days===1?'dia':'dias'}`}</strong>{last&&<small>{new Date(last+'T12:00:00').toLocaleDateString('pt-BR')}</small>}</div><footer><Button variant="outline" onClick={()=>onOpen(c)}>Ver histórico <ArrowUpRight size={15}/></Button>{phone&&<a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" aria-label={`Conversar com ${c.name} no WhatsApp`}><MessageCircle size={16}/>WhatsApp</a>}</footer></article>})}</div>
 {!clients.length&&<p className="clients-empty">Nenhum cliente encontrado. Ajuste a busca ou cadastre um cliente.</p>}
 {pages>1&&<nav className="directory-pagination" aria-label="Páginas de clientes"><Button variant="outline" disabled={current===1} onClick={()=>setPage(current-1)}>Anterior</Button><span>Página {current} de {pages}</span><Button variant="outline" disabled={current===pages} onClick={()=>setPage(current+1)}>Próxima</Button></nav>}
 </div>;
}
