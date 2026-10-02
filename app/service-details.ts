type ServiceDetail = { items: string[]; duration?: string };

// Durations and detailed procedures reuse the original catalogue where a
// matching service exists. New services retain an assessment-based duration.
export const serviceDetails: Record<string, ServiceDetail> = {
  "Lavagem detalhada interna e externa": { duration: "4 horas", items: ["Limpeza minuciosa interna e externa", "Limpeza de rodas, emblemas, grades e borrachas", "Aplicação de cera blend e revitalização"] },
  "Limpeza técnica com proteção de até 6 meses": { duration: "5 horas", items: ["Pré-lavagem e limpeza externa detalhada", "Limpeza interna básica", "Descontaminação e proteção da pintura por até 6 meses"] },
  "Manutenção de vitrificação": { duration: "2 horas", items: ["Limpeza para manutenção da pintura vitrificada", "Avaliação das condições da proteção existente"] },
  "Detalhamento interno": { duration: "3 horas", items: ["Limpeza detalhada das superfícies internas", "Atenção aos acabamentos e cantos do interior"] },
  "Higienização interna completa": { duration: "6 horas", items: ["Higienização do interior do veículo", "Limpeza dos revestimentos conforme o material"] },
  "Higienização interna com desmontagem": { duration: "1 a 2 dias", items: ["Desmontagem dos componentes definidos na avaliação", "Higienização das áreas acessíveis após desmontagem", "Remontagem dos componentes ao final"] },
  "Higienização dos bancos de tecido": { duration: "5 horas", items: ["Limpeza e descontaminação dos bancos de tecido", "Tratamento de sujeiras e odores nos bancos"] },
  "Limpeza e tratamento de couro": { duration: "3 horas", items: ["Limpeza de manchas e sujeiras no couro", "Hidratação para ajudar a evitar o ressecamento"] },
  "Higienização de carpetes e tapetes": { duration: "2 horas", items: ["Limpeza dos carpetes e tapetes", "Tratamento das sujeiras presentes nas fibras"] },
  "Neutralização de odores": { duration: "1 a 3 horas", items: ["Avaliação da origem do odor", "Tratamento para neutralização dos odores identificados"] },
  "Detalhamento externo": { duration: "3 horas", items: ["Limpeza minuciosa das superfícies externas", "Atenção a rodas, emblemas, grades e borrachas"] },
  "Limpeza e tratamento de motor": { duration: "4 horas", items: ["Inspeção e isolamento dos componentes", "Limpeza do cofre e proteção dos componentes", "Limpeza básica do veículo incluída"] },
  "Limpeza e tratamento de chassi": { duration: "3 horas", items: ["Limpeza do chassi", "Tratamento das áreas definido após avaliação"] },
  "Polimento comercial": { duration: "1 dia", items: ["Descontaminação da pintura", "Correção parcial das imperfeições", "Proteção e acabamento com cera"] },
  "Polimento técnico": { duration: "2 dias", items: ["Descontaminação da pintura", "Correção técnica das imperfeições do verniz", "Proteção e acabamento com cera"] },
  "Vitrificação de pintura": { duration: "2 dias", items: ["Polimento técnico incluído", "Aplicação de proteção vitrificada na pintura"] },
  "Enceramento técnico": { duration: "2 horas", items: ["Preparação da superfície para receber a cera", "Aplicação de cera para proteção e acabamento"] },
  "Polimento de faróis": { duration: "2 horas", items: ["Polimento da superfície dos faróis", "Acabamento para melhorar a transparência"] },
  "Restauração de faróis com proteção UV": { duration: "3 horas", items: ["Restauração da superfície dos faróis", "Aplicação de proteção UV"] },
  "Remoção de chuva ácida dos vidros": { duration: "1 a 2 horas", items: ["Avaliação das marcas presentes nos vidros", "Tratamento para remoção de marcas de chuva ácida"] },
  "Cristalização de vidros": { duration: "1 hora", items: ["Preparação e limpeza dos vidros", "Aplicação de proteção para repelência à água"] },
  "Polimento de vidros": { duration: "3 horas", items: ["Avaliação das imperfeições dos vidros", "Polimento das áreas indicadas na avaliação"] },
  "Vitrificação de plásticos externos": { duration: "2 horas", items: ["Limpeza e preparação dos plásticos externos", "Aplicação de proteção vitrificada"] },
  "Vitrificação de rodas": { duration: "3 horas", items: ["Limpeza e preparação das rodas", "Aplicação de proteção vitrificada"] },
  "Remoção de marcas superficiais e transferência de tinta": { duration: "1 a 2 horas", items: ["Avaliação da profundidade das marcas", "Tratamento de marcas superficiais e tinta transferida"] },
  "Detalhamento de rodas e caixas de roda": { duration: "2 horas", items: ["Limpeza detalhada das rodas", "Limpeza das caixas de roda"] },
  "Limpeza de forro de teto": { duration: "3 horas", items: ["Avaliação das condições do forro", "Limpeza do revestimento do teto"] },
};
