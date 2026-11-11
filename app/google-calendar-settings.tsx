import {useState} from 'react';
import {apiFetch} from '@/lib/api';
import {Button} from '@/components/ui/button';
export default function GoogleCalendarSettings(){
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false);
 const get=async()=>{setBusy(true);setError('');try{const r=await apiFetch('/api/calendar-manage',{cache:'no-store'}),j=await r.json();if(!r.ok)throw Error(j.error||'Não foi possível criar o link.');setUrl(j.url);}catch(e){setError(e instanceof Error?e.message:'Falha ao preparar a agenda.')}finally{setBusy(false)}};
 return <section className="ops-card"><h2>Google Agenda</h2><p>Veja os agendamentos ativos do site na sua agenda Google. As alterações e cancelamentos aparecem após a próxima atualização feita pelo Google.</p><Button disabled={busy} onClick={()=>void get()}>{busy?'Preparando...':'Gerar link privado da agenda'}</Button>{url&&<><p><strong>Link de assinatura</strong></p><input aria-label="Link privado da agenda" readOnly value={url} style={{width:'100%',padding:10}}/><Button variant="outline" onClick={async()=>{await navigator.clipboard.writeText(url);setCopied(true)}}>{copied?'Link copiado':'Copiar link'}</Button><p>No Google Agenda pelo computador: <strong>Outras agendas → + → A partir do URL</strong>. Cole o link e clique em <strong>Adicionar agenda</strong>.</p><p className="muted">Guarde este link: qualquer pessoa com ele poderá ver os nomes e horários dos agendamentos.</p></>}{error&&<p role="alert" className="error">{error}</p>}</section>;
}
