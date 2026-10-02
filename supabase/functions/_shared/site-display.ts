export const catalogTabs = [
  { id: "agendar", label: "Agendar online" },
  { id: "destaques", label: "Destaques" },
  { id: "todos", label: "Mais serviços" },
  { id: "pacote", label: "Monte seu pacote" },
  { id: "planos", label: "Planos mensais" },
];

export type SiteDisplay = {
  hiddenTabs: string[];
  hiddenCategories: string[];
  hiddenEditorialServices: string[];
  hiddenServiceIds: number[];
};

export const defaultSiteDisplay: SiteDisplay = {
  hiddenTabs: ["agendar"], hiddenCategories: [], hiddenEditorialServices: [], hiddenServiceIds: [],
};

export function parseSiteDisplay(value: unknown): SiteDisplay {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Configurações inválidas.");
  const input = value as Record<string, unknown>;
  const strings = (key: string) => {
    const items = input[key] ?? [];
    if (!Array.isArray(items) || items.length > 500 || items.some(item => typeof item !== "string" || item.length > 160)) throw new Error("Lista de visibilidade inválida.");
    return [...new Set(items)] as string[];
  };
  const ids = input.hiddenServiceIds ?? [];
  if (!Array.isArray(ids) || ids.length > 2000 || ids.some(id => !Number.isSafeInteger(id) || id < 1)) throw new Error("Serviços inválidos.");
  const hiddenTabs = strings("hiddenTabs");
  if (hiddenTabs.some(id => !catalogTabs.some(tab => tab.id === id))) throw new Error("Aba inválida.");
  return { hiddenTabs, hiddenCategories: strings("hiddenCategories"), hiddenEditorialServices: strings("hiddenEditorialServices"), hiddenServiceIds: [...new Set(ids)] as number[] };
}

export const offerIsVisible = (settings: SiteDisplay, service: { id: number; category: string }) =>
  !settings.hiddenServiceIds.includes(service.id) && !(service.category === "Planos mensais" && settings.hiddenTabs.includes("planos"));
