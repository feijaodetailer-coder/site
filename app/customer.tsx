"use client";
import { withBase } from "@/lib/base";
import { apiFetch } from "@/lib/api";

import { useEffect, useMemo, useRef, useState } from "react";
import SiteShell from "./site-shell";
import type { SiteDisplay } from "../lib/site-display";
import { ArrowRight, CalendarDays, Check, Clock3, Copy, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import "./customer-area-booking.css";

type Service={id:number;name:string;category:string;price:number;duration:number;booking_duration:number;description:string};
type Group={key:string;category:string;name:string;description:string;variants:Service[];starting:number};
type Form={name:string;phone:string;vehicle:string;plate:string;desiredAt:string;notes:string;paid:boolean;website:string};
type SavedVehicle={id:string;title:string;plate?:string};
type CustomerProfile={name?:string;phone?:string;vehicle?:string;plate?:string};
const emptyForm:Form={name:"",phone:"",vehicle:"",plate:"",desiredAt:"",notes:"",paid:false,website:""};
const categoryOrder=["Limpeza","Tratamentos","Polimento e proteção","Pacotes","Motos"];
const whatsappUrl="https://wa.me/5531993444280?text=Ol%C3%A1%2C%20vim%20pelo%20site%20da%20Feij%C3%A3o%20Detailer%20e%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es.";
const instagramUrl="https://www.instagram.com/";
const categoryMeta:Record<string,{image:string;intro:string}>={
  "Limpeza":{image:withBase("/service-images/limpeza-premium-v2.png"),intro:"Limpeza cuidadosa e proteção para o dia a dia."},
  "Tratamentos":{image:withBase("/service-images/tratamentos-premium-v2.png"),intro:"Cuidados especializados para tecidos, couro e motor."},
  "Polimento e proteção":{image:withBase("/service-images/polimento-premium-v2.png"),intro:"Correção do verniz e proteção da pintura."},
  "Pacotes":{image:withBase("/service-images/pacotes-premium-v2.png"),intro:"Combinações completas para renovar seu veículo."},
  "Motos":{image:withBase("/service-images/motos-premium-v2.png"),intro:"Limpeza e proteção pensadas para motos."},
};
const price=(cents:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents/100);
const todayLocal=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const durationLabel=(minutes:number)=>minutes>=1440?String(Math.ceil(minutes/1440))+(minutes/1440>1?" dias úteis":" dia útil"):minutes>=60?String(Math.floor(minutes/60))+" h"+(minutes%60?" "+(minutes%60)+" min":""):minutes+" min";
const baseName=(name:string)=>name.replace(/ · (Popular|SUV|Caminhonete|5 lugares|7 lugares)$/u,"");
const variantLabel=(name:string)=>name.match(/ · (Popular|SUV|Caminhonete|5 lugares|7 lugares)$/u)?.[1]||"Valor inicial";

export default function CustomerPage({mode,embedded=false,initialServiceId}:{mode:"services"|"plans";embedded?:boolean;initialServiceId?:number}){
  const [services,setServices]=useState<Service[]>([]);
  const [profile,setProfile]=useState<CustomerProfile|null>(null);
  const [savedVehicles,setSavedVehicles]=useState<SavedVehicle[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [rules,setRules]=useState<{id:string;data:string}[]>([]);
  const [selected,setSelected]=useState<Group|null>(null);
  const [serviceId,setServiceId]=useState("");
  const [sending,setSending]=useState(false);
  const [success,setSuccess]=useState<number|null>(null);
  const [appointmentDay,setAppointmentDay]=useState("");
  const [availableSlots,setAvailableSlots]=useState<string[]>([]);
  const [slotsLoading,setSlotsLoading]=useState(false);
  const [copied,setCopied]=useState(false);
  const [form,setForm]=useState<Form>(emptyForm);
  const initialServiceHandled=useRef(false);

  useEffect(()=>{
    let active=true;
    apiFetch("/api/public").then(async response=>{
      const result=await response.json() as {settings?:SiteDisplay;services?:Service[];rules?:{id:string;data:string}[];error?:string};
      if(!response.ok)throw new Error(result.error||"Catálogo indisponível");
      if(active){setServices(mode === "plans" && result.settings?.hiddenTabs.includes("planos") ? [] : result.services||[]);setRules(result.rules||[])}
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Catálogo indisponível")}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[]);

  useEffect(()=>{
    let active=true;
    apiFetch("/api/workflow",{cache:"no-store"}).then(async response=>{if(!response.ok)return null;return await response.json() as {profile?:CustomerProfile|null;records?:Array<{id:string;kind:string;data:{title?:string;plate?:string}}>}}).then(result=>{
      if(!active||!result)return;
      const profile=result.profile||null;
      const vehicles=(result.records||[]).filter(row=>row.kind==="vehicle").map(row=>({id:row.id,title:row.data.title||"Veículo",plate:row.data.plate||""}));
      if(profile?.vehicle&&!vehicles.some(vehicle=>vehicle.title===profile.vehicle&&vehicle.plate===(profile.plate||"")))vehicles.unshift({id:"profile-vehicle",title:profile.vehicle,plate:profile.plate||""});
      setProfile(profile);setSavedVehicles(vehicles);
    }).catch(()=>{});
    return()=>{active=false};
  },[]);

  useEffect(()=>{
    if(mode!=="services"||!selected||!serviceId||!appointmentDay){setAvailableSlots([]);return}
    let active=true;setSlotsLoading(true);setAvailableSlots([]);setForm(current=>({...current,desiredAt:""}));
    apiFetch("/api/public?availability=1&serviceId="+encodeURIComponent(serviceId)+"&date="+encodeURIComponent(appointmentDay),{cache:"no-store"})
      .then(async response=>{const result=await response.json() as {slots?:string[];error?:string};if(!response.ok)throw new Error(result.error||"Horários indisponíveis");if(active)setAvailableSlots(result.slots||[])})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:"Não foi possível carregar os horários")})
      .finally(()=>{if(active)setSlotsLoading(false)});
    return()=>{active=false};
  },[mode,selected,serviceId,appointmentDay]);

  const groups=useMemo(()=>{
    const map=new Map<string,Group>();
    for(const service of services.filter(s=>s.category!=="Planos mensais")){
      const name=baseName(service.name),key=`${service.category}:${name}`;
      const current=map.get(key);
      if(current){current.variants.push(service);current.starting=Math.min(current.starting,service.price)}
      else map.set(key,{key,category:service.category,name,description:service.description,variants:[service],starting:service.price});
    }
    return [...map.values()];
  },[services]);
  const plans=services.filter(s=>s.category==="Planos mensais");
  const open=(group:Group)=>{setSelected(group);setServiceId(String(group.variants[0]?.id||""));setSuccess(null);setError("");setCopied(false);setAppointmentDay(todayLocal());setAvailableSlots([]);setForm({...emptyForm,name:profile?.name||"",phone:profile?.phone||"",vehicle:savedVehicles[0]?.title||profile?.vehicle||"",plate:savedVehicles[0]?.plate||profile?.plate||""})};
  const close=()=>{setSelected(null);setSuccess(null);setForm(emptyForm);setAppointmentDay("");setAvailableSlots([])};

  useEffect(()=>{
    if(initialServiceHandled.current||mode!=="services"||!initialServiceId||!groups.length)return;
    const group=groups.find(item=>item.variants.some(service=>service.id===initialServiceId));
    if(group){initialServiceHandled.current=true;open(group)}
  },[groups,initialServiceId,mode]);

  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!selected||!serviceId||(mode==="services"&&!form.desiredAt))return;
    setSending(true);setError("");
    try{
      const response=await apiFetch("/api/public",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:mode==="plans"?"plan":"booking",serviceId:Number(serviceId),...form})});
      const result=await response.json() as {error?:string;requestId?:number};
      if(!response.ok)throw new Error(result.error||"Não foi possível enviar");
      setSuccess(result.requestId||0);
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível enviar")}
    finally{setSending(false)}
  };
  const copyPix=async()=>{try{await navigator.clipboard.writeText("31993444280");setCopied(true)}catch{setCopied(false)}};

  const Content=embedded?"div":"main";
  return <SiteShell current={mode}><div className={`customer-site${embedded?" customer-site-embedded":""}`}>

    <Content><>{!embedded&&<header className="top"><div><div className="eyebrow">FEIJÃO DETAILER</div><h1>{mode === "services" ? "Serviços" : "Planos mensais"}</h1></div></header>}
      {!embedded&&<div className="customer-hero">
        <div><span className="customer-kicker"><Sparkles size={13}/> EXPERIÊNCIA FEIJÃO DETAILER</span><h2>{mode==="services"?"Seu veículo com presença de novo.":"Cuidado contínuo. Brilho o mês inteiro."}</h2><p>{mode==="services"?"Escolha o cuidado ideal, envie sua preferência de horário e deixe o restante com quem entende de detalhes.":"Escolha um plano, faça o Pix e solicite a ativação. O cadastro é liberado depois da nossa conferência."}</p><div className="hero-actions"><a className="hero-primary" href={mode==="services"?"#catalogo":"#planos"}>{mode==="services"?"Explorar serviços":"Conhecer planos"}<ArrowRight size={17}/></a><a className="hero-secondary" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={17}/> Falar no WhatsApp</a></div><div className="hero-points"><span><ShieldCheck size={17}/> Atendimento personalizado</span><span><CalendarDays size={17}/> Solicitação online</span></div></div>
        <img src={mode==="services"?withBase("/service-images/pacotes.png"):withBase("/service-images/planos.png")} alt={mode==="services"?"Veículo esportivo no estúdio":"Veículo esportivo"}/>
      </div>}
      {mode==="services"?<>
        <div className="customer-section-heading" id="catalogo"><span className="customer-kicker">CATÁLOGO</span><h2>Escolha o próximo cuidado</h2><p>Os preços são <strong>a partir dos valores exibidos</strong>. O orçamento final pode mudar após a avaliação das condições e necessidades do veículo.</p></div>
        {loading?<p className="customer-state">Carregando serviços...</p>:error&&!selected?<p className="customer-state error" role="alert">{error}</p>:categoryOrder.map(category=>{
          const categoryGroups=groups.filter(g=>g.category===category);if(!categoryGroups.length)return null;
          const meta=categoryMeta[category];
          return <section className="category-section" key={category}>
            <div className="category-intro"><div><span className="category-number">{String(categoryOrder.indexOf(category)+1).padStart(2,"0")} / {String(categoryOrder.length).padStart(2,"0")}</span><h3>{category}</h3><p>{meta.intro}</p><span className="category-detail">Cuidado técnico • Acabamento premium</span></div><img src={meta.image} alt={`Imagem de ${category.toLowerCase()}`}/></div>
            <div className="service-grid">{categoryGroups.map(group=><article className="customer-card" key={group.key}>
              <div className="card-image"><img src={meta.image} alt=""/><span>{group.category}</span></div><div className="card-content"><h4>{group.name}</h4><p>{group.description}</p>
              <div className="variant-row">{group.variants.map(v=><span key={v.id}>{variantLabel(v.name)}: <strong>{price(v.price)}</strong></span>)}</div><p className="service-time-note"><Clock3 size={15}/>Previsão: {durationLabel(group.variants[0]?.duration||0)}</p>
              <div className="card-bottom"><div><small>A partir de</small><strong>{price(group.starting)}</strong></div><Button onClick={()=>open(group)}>Agendar <ArrowRight size={16}/></Button></div></div>
            </article>)}</div>
          </section>;
        })}
      </>:<>
        <div className="customer-section-heading" id="planos"><span className="customer-kicker">PLANOS MENSAIS</span><h2>Escolha o seu plano</h2><p>O plano começa somente depois que você fizer o Pix e a Feijão Detailer confirmar o pagamento e autorizar a ativação.</p></div>
        <div className="plans-steps"><div><b>01</b><span>Escolha o plano</span></div><div><b>02</b><span>Faça o Pix</span></div><div><b>03</b><span>Solicite a ativação</span></div><div><b>04</b><span>Aguarde a autorização</span></div></div>
        {loading?<p className="customer-state">Carregando planos...</p>:error&&!selected?<p className="customer-state error" role="alert">{error}</p>:<div className="plan-grid">{plans.map(plan=><article className="plan-card" key={plan.id}>
          <img src={withBase("/service-images/planos.png")} alt="Veículo cuidado pela Feijão Detailer"/><div className="plan-body"><span className="customer-kicker">PLANO MENSAL</span><h3>{plan.name}</h3><p>{plan.description}</p>{(()=>{const found=rules.find(r=>r.id===`rule-${plan.id}`);if(!found)return <p>Serviços incluídos, frequência e condições: confirme com a Feijão Detailer antes de contratar.</p>;const rule=JSON.parse(found.data);return <dl className="plan-conditions">{[['Atendimentos',rule.visits],['Inclui',rule.included],['Frequência',rule.frequency],['Validade',rule.validity],['Renovação',rule.renewal],['Cancelamento',rule.cancellation],['Agendamento',rule.scheduling]].filter(([,v])=>v).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>})()}<div className="plan-price"><strong>{price(plan.price)}</strong><span>/ mês</span></div><Button onClick={()=>open({key:String(plan.id),name:plan.name,category:plan.category,description:plan.description,variants:[plan],starting:plan.price})}>Contratar plano <ArrowRight size={16}/></Button></div>
        </article>)}</div>}
      </>}
      {!embedded&&<><div className="customer-note"><ShieldCheck size={22}/><div><strong>Valores claros antes do serviço.</strong><p>Para serviços avulsos, o preço mostrado é inicial. A avaliação do veículo define o orçamento final, informado antes de começar.</p></div></div>
      <section className="contact-showcase"><div><span className="customer-kicker">FALE COM A FEIJÃO</span><h2>Seu carro merece esse cuidado.</h2><p>Tire dúvidas, peça uma orientação ou acompanhe nossos trabalhos pelas redes sociais.</p></div><div className="contact-buttons"><a className="contact-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={20}/><span><small>ATENDIMENTO DIRETO</small>Chamar no WhatsApp</span><ArrowRight size={18}/></a><a className="contact-instagram" href={instagramUrl} target="_blank" rel="noreferrer"><b className="ig-mark">IG</b><span><small>ACOMPANHE OS DETALHES</small>Acessar Instagram</span><ArrowRight size={18}/></a></div></section></>}
    </></Content>
    {!embedded&&<><div className="social-float" aria-label="Canais de contato"><a className="whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Conversar com a Feijão Detailer pelo WhatsApp"><MessageCircle size={21}/></a><a className="instagram" href={instagramUrl} target="_blank" rel="noreferrer" aria-label="Acessar o Instagram"><b className="ig-mark">IG</b></a></div>
    <footer className="customer-footer"><img src={withBase("/feijao-detailer-logo.png")} alt="Feijão Detailer"/><span>Estética automotiva feita com técnica, presença e atenção aos detalhes.</span><div><a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a><a href={instagramUrl} target="_blank" rel="noreferrer">Instagram</a></div></footer></>}
    <Dialog open={Boolean(selected)} onOpenChange={opened=>{if(!opened)close()}}><DialogContent className="request-dialog"><DialogHeader><DialogTitle>{mode==="plans"?"Solicitar ativação do plano":"Solicitar agendamento"}</DialogTitle><DialogDescription>{selected?.name}</DialogDescription></DialogHeader>
      {success!==null?<div className="request-success"><span><Check size={30}/></span><h3>{mode==="plans"?"Solicitação enviada":"Horário confirmado"}</h3><p>{mode==="plans"?"Seu pedido está pendente. A Feijão Detailer vai conferir o Pix e autorizar o plano.":"Sua chegada está marcada para "+new Date(form.desiredAt).toLocaleString("pt-BR",{dateStyle:"full",timeStyle:"short"})+". A previsão do serviço é "+durationLabel(selected?.variants.find(v=>String(v.id)===serviceId)?.duration||0)+". O valor final será confirmado após avaliar o veículo."}</p><small>Protocolo #{success}</small><Button onClick={close}>Concluir</Button></div>:<form onSubmit={submit} className="request-form">
        <div className="request-summary"><strong>{selected?.name}</strong><span>{mode==="plans"?`${price(selected?.starting||0)} por mês`:`A partir de ${price(selected?.starting||0)}`}</span></div>
        {selected&&selected.variants.length>1&&<label>Tipo de veículo<Select value={serviceId} onValueChange={value=>{setServiceId(value);setForm(current=>({...current,desiredAt:""}))}}><SelectTrigger className="w-full"><SelectValue placeholder="Escolha a opção"/></SelectTrigger><SelectContent>{selected.variants.map(v=><SelectItem key={v.id} value={String(v.id)}>{variantLabel(v.name)} · {price(v.price)}</SelectItem>)}</SelectContent></Select></label>}
        {mode==="plans"&&<div className="pix-box"><div><small>CHAVE PIX</small><strong>(31) 99344-4280</strong></div><Button type="button" variant="outline" onClick={()=>void copyPix()}><Copy size={15}/>{copied?"Copiado":"Copiar"}</Button><p>Faça o Pix do valor do plano. O cadastro fica pendente até a conferência e autorização da Feijão Detailer.</p></div>}
        <div className="request-fields"><label>Nome completo<Input required minLength={2} maxLength={80} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>WhatsApp<Input required type="tel" inputMode="tel" placeholder="(31) 99999-9999" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>{savedVehicles.length>1?<label>Veículo<Select value={form.vehicle} onValueChange={value=>{const saved=savedVehicles.find(item=>item.title===value);setForm({...form,vehicle:value,plate:saved?.plate||""})}}><SelectTrigger className="w-full"><SelectValue placeholder="Escolha seu veículo"/></SelectTrigger><SelectContent>{savedVehicles.map(vehicle=><SelectItem key={vehicle.id} value={vehicle.title}>{vehicle.title}{vehicle.plate?" · "+vehicle.plate:""}</SelectItem>)}</SelectContent></Select></label>:<label>Veículo<Input required maxLength={80} placeholder="Modelo e ano" value={form.vehicle} onChange={e=>setForm({...form,vehicle:e.target.value})}/></label>}<label>Placa (opcional)<Input maxLength={12} value={form.plate} onChange={e=>setForm({...form,plate:e.target.value})}/></label></div>
        {mode==="services"?<><div className="request-time-estimate"><Clock3 size={16}/><span>Previsão do serviço: <strong>{durationLabel(selected?.variants.find(v=>String(v.id)===serviceId)?.duration||0)}</strong></span></div><label>Dia do atendimento<Input required type="date" min={todayLocal()} value={appointmentDay} onChange={e=>{setAppointmentDay(e.target.value);setForm(current=>({...current,desiredAt:""}))}}/></label><fieldset className="booking-slots"><legend>Horários disponíveis</legend>{slotsLoading?<p>Consultando a agenda...</p>:availableSlots.length?<div className="booking-slot-grid">{availableSlots.map(slot=><button type="button" key={slot} aria-pressed={form.desiredAt===slot} className={form.desiredAt===slot?"booking-slot is-selected":"booking-slot"} onClick={()=>setForm(current=>({...current,desiredAt:slot}))}>{slot.slice(11)}</button>)}</div>:<p>{appointmentDay?"Não há horários disponíveis neste dia. Escolha outra data.":"Escolha um dia para ver os horários."}</p>}</fieldset><p className="request-hours">Segunda a sexta, das 15h às 19h · sábado, das 8h às 18h. O horário reserva sua chegada ao estúdio; a previsão de conclusão varia conforme o serviço e o estado do veículo.</p><label>Observações sobre o veículo<Input maxLength={400} placeholder="Conte o que precisa de atenção" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label><p className="request-disclaimer">A reserva do horário é confirmada na hora. O valor mostrado é inicial e pode mudar depois da avaliação do veículo, sempre antes de começar o serviço.</p></>:<label className="request-check"><input type="checkbox" required checked={form.paid} onChange={e=>setForm({...form,paid:e.target.checked})}/><span>Já fiz o Pix e entendo que o plano só será ativado após conferência e autorização.</span></label>}
        <input className="request-honeypot" tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>setForm({...form,website:e.target.value})} aria-hidden="true"/>
        <div aria-live="polite">{error&&<p className="request-error">{error}</p>}</div><Button type="submit" disabled={sending||!serviceId||(mode==="services"&&(!form.desiredAt||slotsLoading))} className="w-full">{sending?"Enviando...":mode==="plans"?"Enviar pedido de ativação":"Confirmar agendamento"}</Button>
      </form>}
    </DialogContent></Dialog>
  </div></SiteShell>;
}
