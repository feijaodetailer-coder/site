type CatalogItem={category:string;name:string;price:number;duration:number;bookingDuration?:number;description:string};
const variants=(category:string,base:string,prices:[number,number,number],duration:number,description:string):CatalogItem[]=>
  ["Popular","SUV","Caminhonete"].map((size,i)=>({category,name:`${base} · ${size}`,price:prices[i],duration,bookingDuration:30,description}));

export const catalog:CatalogItem[]=[
  ...variants("Limpeza","Limpeza Premium",[12000,15000,18000],180,"Rodas, limpeza interna e externa básica, cera líquida premium, plásticos externos e pneus. Entrega em 3 horas."),
  ...variants("Limpeza","Limpeza Técnica",[18000,20000,22000],300,"Pré-lavagem, limpeza externa detalhada, interna básica, descontaminação e selagem da pintura por até 12 meses. Entrega em 5 horas."),
  ...variants("Limpeza","Limpeza Detalhada",[25000,27000,30000],240,"Limpeza minuciosa interna e externa, rodas, emblemas, grades, borrachas, cera blend e revitalização. Entrega em 4 horas."),
  {category:"Tratamentos",name:"Higienização de Tecidos · 5 lugares",price:38000,duration:300,description:"Bancos: limpeza, descontaminação, odores, ácaros, fungos e bactérias. Entrega em 5 horas."},
  {category:"Tratamentos",name:"Higienização de Tecidos · 7 lugares",price:45000,duration:300,description:"Bancos: limpeza, descontaminação, odores, ácaros, fungos e bactérias. Entrega em 5 horas."},
  {category:"Tratamentos",name:"Tratamento do Motor",price:18000,duration:240,description:"A partir de R$ 180. Inspeção, isolamento, limpeza do cofre e proteção dos componentes; inclui limpeza básica do veículo. Entrega em 4 horas."},
  {category:"Tratamentos",name:"Tratamento de Couro · 5 lugares",price:18000,duration:180,description:"Limpeza de manchas e sujeiras, seguida de hidratação para evitar ressecamento."},
  {category:"Tratamentos",name:"Tratamento de Couro · 7 lugares",price:22000,duration:210,description:"Limpeza de manchas e sujeiras, seguida de hidratação para evitar ressecamento."},
  ...variants("Polimento e proteção","Polimento Comercial",[60000,75000,90000],1440,"Correção parcial de até 70% das imperfeições, descontaminação e proteção com cera. Entrega em 1 dia."),
  ...variants("Polimento e proteção","Polimento Técnico",[100000,120000,140000],2880,"Correção completa do verniz, descontaminação e proteção com cera. Entrega em 2 dias."),
  {category:"Polimento e proteção",name:"Vitrificação",price:180000,duration:2880,description:"A partir de R$ 1.800. Inclui polimento técnico e proteção da pintura. Entrega em 2 dias."},
  ...variants("Pacotes","Pacote Bronze",[170000,200000,230000],2880,"Limpeza premium, higienização interna, polimento comercial e revitalização de plásticos. Entrega em 2 dias."),
  ...variants("Pacotes","Pacote Prata",[240000,280000,320000],4320,"Limpeza detalhada, higienização de bancos, polimento técnico, couro, vitrificação até 3 anos e plásticos. Entrega em 3 dias."),
  ...variants("Pacotes","Pacote Diamante",[290000,330000,380000],4320,"Polimento técnico e vitrificação de pintura, rodas, plásticos, parabrisa, faróis e lanternas. Entrega em 3 dias."),
  {category:"Motos",name:"Moto · Limpeza Detalhada",price:15000,duration:120,description:"A partir de R$ 150. Limpeza detalhada, plásticos, selante de pintura por 5 meses e selante antiderrapante. Entrega em 2 horas."},
  {category:"Motos",name:"Moto · Correção de Pintura",price:35000,duration:300,description:"A partir de R$ 350. Correção do verniz e selagem de pintura por 8 meses. Entrega em 5 horas."},
  {category:"Planos mensais",name:"Plano FD Basic",price:14000,duration:60,description:"2 limpezas Standard por mês, para 1 carro."},
  {category:"Planos mensais",name:"Plano FD Gold",price:26000,duration:60,description:"4 limpezas Standard por mês, divididas entre até 2 carros."},
  {category:"Planos mensais",name:"Plano FD Black",price:29500,duration:60,description:"3 limpezas Standard e 1 limpeza com proteção de pintura por mês, para até 2 carros."},
  {category:"Planos mensais",name:"Plano FD Platinum",price:39500,duration:60,description:"3 limpezas Standard e 1 limpeza detalhada com proteção por mês, para até 2 carros."},
];
