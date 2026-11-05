import {jsPDF} from 'jspdf';
export type QuoteDocument={id:string;title?:string;client:string;phone:string;validUntil?:string;executionTime?:number|string;executionUnit?:string;items:{name:string;qty:number;price:number}[];discount?:number;total?:number;notes?:string};
export function quotePdf(q:QuoteDocument){
 const doc=new jsPDF();let y=22;
 const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
 const line=(text:string,size=11)=>{doc.setFontSize(size);for(const row of doc.splitTextToSize(text,174)){if(y>275){doc.addPage();y=22}doc.text(row,18,y);y+=7}};
 line('FEIJÃO DETAILER',20);line('ORÇAMENTO #'+q.id.slice(-8).toUpperCase(),14);y+=5;
 line(q.title||'Orçamento');line('Cliente: '+q.client);
 if(q.validUntil)line('Validade: '+q.validUntil.split('-').reverse().join('/'));
 if(q.executionTime)line(`Tempo médio de execução: ${q.executionTime} ${q.executionUnit==='dias'?'dias':'horas'}`);
 y+=5;for(const item of q.items)line(`${item.name} — ${item.qty} x ${money(item.price)} = ${money(item.qty*item.price)}`);
 y+=5;line('Desconto: '+money(q.discount||0));line('Total: '+money(q.total||0),15);
 if(q.notes){y+=5;line(q.notes)}
 return new File([doc.output('blob')],`orcamento-${q.id.slice(-8)}.pdf`,{type:'application/pdf'});
}
export async function shareQuote(q:QuoteDocument){
 const digits=q.phone.replace(/\D/g,'');const phone=/^55\d{10,11}$/.test(digits)?digits:/^\d{10,11}$/.test(digits)?'55'+digits:null;
 if(!phone)throw Error('Cadastre um telefone válido para o cliente antes de enviar.');
 const file=quotePdf(q);const text=`Olá, ${q.client}! Segue seu orçamento da Feijão Detailer. Estamos à disposição para esclarecer dúvidas e agendar o serviço.`;
 if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Orçamento Feijão Detailer',text});return 'Selecione o WhatsApp e a conversa do cliente para concluir o envio.'}
 const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');
 return 'PDF baixado. Anexe o arquivo na conversa do WhatsApp aberta com a mensagem.';
}
