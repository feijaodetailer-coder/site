"use client";
import { withBase } from "@/lib/base";
import { apiFetch } from "@/lib/api";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ArrowUpRight, CalendarDays, Check, CircleCheck, Clock3, MessageCircle, Plus, Search, X, CircleDollarSign } from "lucide-react";
import SiteShell from "./site-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "./services.css";
import "./customer-area-catalog.css";
import { serviceDetails } from "./service-details";
import CustomerPage from "./customer";
import VisitInfo from "./visit-info";
import { serviceCategories as categories } from "../lib/service-categories";
import { catalogTabs, type SiteDisplay } from "../lib/site-display";


const whatsapp = (items: string[], custom = false) => "https://wa.me/5531993444280?text=" + encodeURIComponent(custom
  ? `Olá! Vim pelo site da Feijão Detailer e gostaria de um orçamento para um pacote personalizado com estes serviços:\n\n${items.map(name => `• ${name}`).join("\n")}\n\nPodemos conversar sobre os valores e a disponibilidade?`
  : `Olá! Vim pelo site da Feijão Detailer e tenho interesse no serviço: ${items[0]}. Gostaria de saber mais sobre os valores e a disponibilidade.`);

const serviceImage = (name: string) => {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const image = normalized.includes("moto") ? "motos-premium-v2.png"
    : /banco|couro|higien|odor|carpete|forro|intern|tecido|motor|chassi/.test(normalized) ? "tratamentos-premium-v2.png"
    : /polimento|pintura|vitrifica|enceramento|farol|vidro/.test(normalized) ? "polimento-premium-v2.png"
    : /pacote/.test(normalized) ? "pacotes-premium-v2.png"
    : "limpeza-premium-v2.png";
  return withBase(`/service-images/${image}`);
};
const fallbackFeatured = categories[0].items.slice(0, 3);
type PricedService={id:number;name:string;category:string;price:number;duration:number};
const packageBase=(name:string)=>name.replace(" · Popular","").replace(" · SUV","").replace(" · Caminhonete","").replace(" · 5 lugares","").replace(" · 7 lugares","");
const variantLabel=(name:string)=>name.match(/ · (Popular|SUV|Caminhonete|5 lugares|7 lugares)$/u)?.[1]||"Valor inicial";
const brl=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value/100);
const serviceTime=(minutes:number)=>minutes>=1440?String(Math.ceil(minutes/1440))+(minutes/1440>1?" dias úteis":" dia útil"):minutes>=60?String(Math.floor(minutes/60))+" h"+(minutes%60?" "+(minutes%60)+" min":""):minutes+" min";
const detailCatalogBase=(name:string)=>{
  const label=name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
  const rules:[RegExp,string][]=[
    [/higienizacao dos bancos de tecido|higienizacao interna completa/,"Higienização de Tecidos"],
    [/limpeza e tratamento de couro/,"Tratamento de Couro"],
    [/limpeza e tratamento de motor/,"Tratamento do Motor"],
    [/polimento comercial/,"Polimento Comercial"],
    [/polimento tecnico/,"Polimento Técnico"],
    [/vitrificacao de pintura/,"Vitrificação"],
    [/limpeza tecnica com protecao/,"Limpeza Técnica"],
    [/lavagem detalhada interna e externa|detalhamento interno|detalhamento externo/,"Limpeza Detalhada"],
    [/moto.*correcao|correcao.*pintura/,"Moto · Correção de Pintura"],
    [/moto.*detalha|lavagem.*moto/,"Moto · Limpeza Detalhada"],
  ];
  return rules.find(([pattern])=>pattern.test(label))?.[1]||"";
};

export default function ServicesPage({ initialTab = "destaques" }: { initialTab?: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState(initialTab === "agendar" ? "agendar" : initialTab === "pacote" ? "pacote" : initialTab === "planos" ? "planos" : initialTab === "todos" ? "todos" : "destaques");
  const [query, setQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [expandedPackageCategories, setExpandedPackageCategories] = useState<string[]>([]);
  const [serviceBookingOpen,setServiceBookingOpen]=useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteDisplay | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const visibleCategories = categories.filter(category => siteSettings && !siteSettings.hiddenCategories.includes(category.id)).map(category => ({ ...category, items: category.items.filter(name => !siteSettings!.hiddenEditorialServices.includes(name)) })).filter(category => category.items.length > 0);
  const allServices = visibleCategories.flatMap(category => category.items);
  const visibleTabs = catalogTabs.filter(tab => siteSettings && !siteSettings.hiddenTabs.includes(tab.id));
  const activeView = view === "agendar" && serviceBookingOpen ? "agendar" : visibleTabs.some(tab => tab.id === view) ? view : visibleTabs[0]?.id ?? "";
  const tabVisible = (id: string) => visibleTabs.some(tab => tab.id === id);
  const [popular, setPopular] = useState<Array<{ service_name: string; clicks: number }>>([]);
  const [catalogServices,setCatalogServices]=useState<PricedService[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [showServicePrice,setShowServicePrice]=useState(false);
  const [bookingServiceId,setBookingServiceId]=useState<number|null>(null);
  const toggle = (name: string) => setSelected(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name]);
  useEffect(() => {
    let active = true;
    apiFetch("/api/public", { cache: "no-store" }).then(response => response.ok ? response.json() as Promise<{ popular?: Array<{ service_name: string; clicks: number }>; services?:PricedService[]; settings?:SiteDisplay }> : null)
      .then(data => { if (active && Array.isArray(data?.popular)) setPopular(data.popular);if(active&&Array.isArray(data?.services))setCatalogServices(data.services); if(active){if(data?.settings)setSiteSettings(data.settings);else setCatalogError(true);} }).catch(() => {if(active)setCatalogError(true);});
    return () => { active = false; };
  }, []);
  const featured = useMemo(() => [...new Set([...popular.map(item => item.service_name).filter(name => allServices.includes(name)), ...fallbackFeatured.filter(name => allServices.includes(name)), ...allServices])].slice(0, 3), [popular, siteSettings]);
  const filtered = useMemo(() => allServices.filter(name => name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))), [query, siteSettings]);
  const packageServices=useMemo(()=>catalogServices.filter(service=>!["Pacotes","Planos mensais"].includes(service.category)),[catalogServices]);
  const packageCategories=useMemo(()=>[...new Set(packageServices.map(service=>service.category))].map(category=>({category,items:packageServices.filter(service=>service.category===category)})),[packageServices]);
  const selectedOffers=packageServices.filter(service=>selected.includes(service.name));
  const subtotal=selectedOffers.reduce((sum,service)=>sum+service.price,0);
  const distinctCategories=new Set(selectedOffers.map(service=>service.category)).size;
  const discountRate=selectedOffers.length<2||distinctCategories<2?0:selectedOffers.length===2?0.05:selectedOffers.length===3?0.08:0.10;
  const discount=Math.min(Math.round(subtotal*discountRate),15000);
  const packageTotal=subtotal-discount;
  const packageWhatsapp="https://wa.me/5531993444280?text="+encodeURIComponent(["Olá! Vim pelo site da Feijão Detailer e gostaria de um orçamento para este pacote personalizado:","",...selectedOffers.map(service=>"• "+service.name+" — "+brl(service.price)+" · "+serviceTime(service.duration)),"","Subtotal: "+brl(subtotal),"Desconto estimado: −"+brl(discount),"Total estimado: "+brl(packageTotal),"","Podemos confirmar os valores e a disponibilidade após avaliar o veículo?"].join("\n"));
  const togglePackageService=(service:PricedService)=>setSelected(current=>current.includes(service.name)?current.filter(item=>item!==service.name):[...current.filter(item=>!(packageServices.some(other=>other.name===item&&other.category===service.category&&packageBase(other.name)===packageBase(service.name)))),service.name]);
  const openService = (name: string) => {
    setSelectedService(name);
    setShowServicePrice(false);
    void apiFetch("/api/public", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "interest", serviceName: name }) }).catch(() => {});
  };
  const detailOffers=selectedService?(()=>{const base=detailCatalogBase(selectedService);return base?catalogServices.filter(service=>packageBase(service.name)===base):[]})():[];
  const detailWhatsapp=selectedService?"https://wa.me/5531993444280?text="+encodeURIComponent(`Olá! Vim pelo site da Feijão Detailer e gostaria de conversar sobre ${selectedService}. ${detailOffers.length?"Gostaria de confirmar qual opção e valor se aplicam ao meu veículo.":"Gostaria de receber um orçamento para este serviço."}`):"#";
  const bookSelectedService=()=>{const id=detailOffers[0]?.id||null;setBookingServiceId(id);setSelectedService(null);setServiceBookingOpen(true);setView("agendar")};

  return <SiteShell current="services"><main className="services-page services-page-compact customer-area-catalog">
    <header className="services-heading services-heading-compact designer-hero">
      <div className="designer-hero-copy"><p className="services-eyebrow">FEIJÃO DETAILER · ESTÉTICA AUTOMOTIVA</p><h1>Seu carro merece<br/>esse <em>cuidado.</em></h1><p>Do primeiro brilho à proteção que fica. Encontre o cuidado ideal para o seu veículo, com atenção a cada detalhe.</p><div className="designer-hero-detail"><span/>Explore os serviços. Escolha no seu tempo.</div></div>
      <div className="designer-hero-photo"><img src={withBase("/service-images/limpeza-editorial.webp")} alt="Cuidado detalhado com a limpeza da carroceria de um veículo" fetchPriority="high"/><span className="designer-photo-caption">CUIDADO EM CADA DETALHE <ArrowUpRight size={20}/></span></div>
    </header>
    <Tabs value={activeView} onValueChange={next => { setServiceBookingOpen(false); setView(next); }} className="services-tabs">
      <TabsList className="services-tab-list" aria-label="Explore serviços e planos">{visibleTabs.map(tab => <TabsTrigger value={tab.id} key={tab.id}>{tab.id === "agendar" && <CalendarDays size={16}/ >}{tab.id === "pacote" && <Plus size={17}/ >}{tab.label}{tab.id === "pacote" && selected.length > 0 && <span className="selection-count">{selected.length}</span>}</TabsTrigger>)}</TabsList>
      {!siteSettings ? <p role="status" className="services-empty">{catalogError ? "Não foi possível carregar os serviços. Atualize a página para tentar novamente." : "Carregando serviços..."}</p> : !visibleTabs.length && <p className="services-empty">O catálogo está temporariamente indisponível. Fale com a equipe pelo WhatsApp.</p>}
      <TabsContent value="agendar"><div className="catalog-booking-intro"><div><p className="services-eyebrow">AGENDA ONLINE</p><h2>Escolha seu cuidado e reserve a chegada</h2><p>Veja os horários livres para o seu serviço. A previsão de conclusão e o valor inicial aparecem antes da confirmação.</p></div></div><CustomerPage key={bookingServiceId??"catalog"} mode="services" embedded initialServiceId={bookingServiceId??undefined}/></TabsContent>
      <TabsContent value="destaques">
        <section className="service-featured" aria-labelledby="featured-services-title"><div className="service-featured-heading"><div><p className="services-eyebrow">{popular.length ? "MAIS CONSULTADOS" : "SELEÇÃO FEIJÃO DETAILER"}</p><h2 id="featured-services-title">{popular.length ? "Cuidados que despertam interesse" : "Um bom lugar para começar"}</h2><p>Conheça os detalhes de cada serviço e descubra o que combina com seu veículo.</p></div><span className="service-featured-count">{String(featured.length).padStart(2, "0")} opções</span></div>
          <div className="service-featured-grid">{featured.map((name, index) => <button className="service-featured-card" key={name} onClick={() => openService(name)}><span className="designer-service-image"><img src={serviceImage(name)} alt="" loading="lazy"/><span className="service-featured-number">0{index + 1}</span></span><span className="service-featured-copy"><strong>{name}</strong><small><Clock3 size={14}/>{serviceDetails[name]?.duration ? `Estimativa · ${serviceDetails[name].duration}` : "Tempo sob avaliação"}</small></span><span className="service-featured-link">Conhecer serviço <ArrowUpRight size={16}/></span></button>)}</div>
        </section>
        <div className="service-featured-actions">{tabVisible("todos") && <button onClick={() => setView("todos")}>Mais serviços <ArrowUpRight size={16}/></button>}{tabVisible("pacote") && <button className="service-build-package" onClick={() => setView("pacote")}><Plus size={17}/> Monte seu pacote</button>}{tabVisible("agendar") && <button className="service-online-booking" onClick={() => setView("agendar")}><CalendarDays size={17}/> Agendar horário</button>}</div>
      </TabsContent>
      <TabsContent value="todos">
        <div className="services-catalog-heading"><div><h2>Todos os serviços</h2><p>Clique em uma categoria para ver os serviços.</p></div><label className="services-search"><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar serviço" aria-label="Buscar serviço"/></label></div>
        {query ? <section className="services-category services-category-compact"><header><div><h2>Resultados</h2><p>{filtered.length} serviço(s) encontrado(s).</p></div></header>{filtered.length ? <div className="clean-service-grid">{filtered.map(name => <ServiceCard key={name} name={name} onOpen={openService}/>)}</div> : <p className="services-empty">Nenhum serviço encontrado. Tente outro termo.</p>}</section> : visibleCategories.map((category, index) => { const expanded = expandedCategories.includes(category.id); return <section className="services-category services-category-compact" id={category.id} key={category.id}><header className="service-category-disclosure"><h2><button type="button" aria-expanded={expanded} aria-controls={`services-${category.id}`} onClick={() => setExpandedCategories(current => expanded ? current.filter(id => id !== category.id) : [...current, category.id])}><span className="service-index">0{index + 1}</span><span className="service-category-copy"><span>{category.name}</span><small>{category.intro}</small></span><ChevronDown className={expanded ? "is-expanded" : ""} size={22}/></button></h2></header><div id={`services-${category.id}`} hidden={!expanded}><div className="clean-service-grid">{expanded && category.items.map(name => <ServiceCard key={name} name={name} onOpen={openService}/>)}</div></div></section>; })}
      </TabsContent>
      <TabsContent value="pacote"><div className="package-heading"><h2>Seu veículo. Seu pacote.</h2><p>Escolha cuidados de categorias diferentes e veja uma estimativa com desconto progressivo.</p></div><div className="package-layout"><div>{packageCategories.length===0?<p className="services-empty">Nenhum serviço disponível no momento.</p>:packageCategories.map(category=>{const expanded=expandedPackageCategories.includes(category.category);const selectedCount=category.items.filter(service=>selected.includes(service.name)).length;return <section className="package-category" key={category.category}><h3><button type="button" aria-expanded={expanded} aria-controls={`package-${category.category}`} onClick={()=>setExpandedPackageCategories(current=>expanded?current.filter(name=>name!==category.category):[...current,category.category])}><span>{category.category}</span>{selectedCount>0&&<small>{selectedCount} selecionado{selectedCount===1?"":"s"}</small>}<ChevronDown className={expanded?"is-expanded":""} size={20}/></button></h3><div id={`package-${category.category}`} className="package-options" hidden={!expanded}>{expanded&&category.items.map(service=>{const id="custom-service-"+service.id;return <div className={selected.includes(service.name)?"package-option is-selected":"package-option"} key={service.id}><label htmlFor={id}><Checkbox id={id} checked={selected.includes(service.name)} onCheckedChange={()=>togglePackageService(service)}/><span>{service.name}<small>{brl(service.price)} · {serviceTime(service.duration)}</small></span></label></div>})}</div></section>})}</div><aside className="package-summary"><h3>Seu pacote</h3><p aria-live="polite">{selectedOffers.length===0?"Escolha os serviços ao lado para começar.":selectedOffers.length+ (selectedOffers.length===1?" serviço selecionado":" serviços selecionados")}</p>{selectedOffers.length>0&&<><ul>{selectedOffers.map(service=><li key={service.id}><Check size={16}/><span>{service.name}<small>{brl(service.price)}</small></span><button onClick={()=>togglePackageService(service)} aria-label={"Remover "+service.name}><X size={16}/></button></li>)}</ul><button className="clear-package" onClick={()=>setSelected([])}>Limpar seleção</button><div className="package-price-row"><span>Subtotal</span><strong>{brl(subtotal)}</strong></div><div className="package-price-row"><span>Desconto estimado</span><strong>−{brl(discount)}</strong></div><div className="package-price-row package-price-total"><span>Total estimado</span><strong>{brl(packageTotal)}</strong></div></>}<p className="package-note">Junte serviços de categorias diferentes: 2 serviços dão 5%, 3 dão 8% e 4 ou mais dão 10% de desconto, limitado a R$ 150. O desconto estimado não vale para pacotes prontos nem planos.</p>{selectedOffers.length?<a className="package-send" href={packageWhatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/>Pedir orçamento no WhatsApp</a>:<button className="package-send" disabled>Selecione pelo menos um serviço</button>}<small>Os valores são iniciais. A equipe confirma o orçamento após avaliar o veículo.</small></aside></div>{selectedOffers.length>0&&<div className="package-mobile-dock"><span><strong>{brl(packageTotal)}</strong><span>{discount>0?"Com desconto estimado":"Estimativa do pacote"}</span></span><a aria-label="Pedir orçamento do pacote pelo WhatsApp" href={packageWhatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>Ver orçamento</a></div>}</TabsContent>
      <TabsContent value="planos"><div className="catalog-plan-intro"><h2>Cuidados contínuos, no seu ritmo</h2><p>Compare os planos mensais e veja as condições antes de solicitar a ativação.</p></div><CustomerPage mode="plans" embedded/></TabsContent>
    </Tabs>
    <VisitInfo/>
    <footer className="services-footer"><span>Feijão Detailer · Cuidado em cada detalhe.</span><a href={withBase("/sobre-nos/")}>Conheça nossa história <ArrowUpRight size={16}/></a></footer>
    <Dialog open={!!selectedService} onOpenChange={open => { if (!open) setSelectedService(null); }}><DialogContent className="service-spec-dialog"><DialogHeader><DialogTitle>{selectedService}</DialogTitle><DialogDescription>Escolha como quer seguir com este serviço</DialogDescription></DialogHeader>{selectedService&&<><ul className="service-spec-list">{(serviceDetails[selectedService]?.items||[]).map(item=><li key={item}><CircleCheck size={18}/><span>{item}</span></li>)}</ul><div className="service-duration"><Clock3 size={16}/><span>{serviceDetails[selectedService]?.duration?<>Tempo estimado: <strong>{serviceDetails[selectedService].duration}</strong></>:"Tempo sob avaliação"}</span></div><div className="service-choice-actions"><button className="service-choice-book" onClick={bookSelectedService}><CalendarDays size={18}/>Agendar serviço</button><a className="service-choice-whatsapp" href={detailWhatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>Chamar no WhatsApp</a><button className="service-choice-price" aria-expanded={showServicePrice} onClick={()=>setShowServicePrice(value=>!value)}><CircleDollarSign size={18}/>{showServicePrice?"Ocultar valores":"Mostrar valor"}</button></div>{showServicePrice&&<div className="service-price-panel" aria-live="polite">{detailOffers.length?<><strong>Valores iniciais por veículo</strong><ul>{detailOffers.map(offer=><li key={offer.id}><span>{variantLabel(offer.name)}</span><strong>{brl(offer.price)}</strong></li>)}</ul><small>O valor final pode mudar após a avaliação do veículo.</small></>:<><strong>Orçamento sob avaliação</strong><p>Este item ainda não tem um preço cadastrado. A equipe confirma o valor pelo WhatsApp antes de iniciar.</p></>}</div>}</>}</DialogContent></Dialog>
  </main></SiteShell>;
}

function ServiceCard({ name, onOpen }: { name: string; onOpen: (name: string) => void }) {
  return <article className="clean-service-card compact-service-card"><h3>{name}</h3><p>{serviceDetails[name]?.duration ? `Estimativa · ${serviceDetails[name].duration}` : "Tempo sob avaliação"}</p><button onClick={() => onOpen(name)}>Ver especificação <ArrowUpRight size={16}/></button></article>;
}
