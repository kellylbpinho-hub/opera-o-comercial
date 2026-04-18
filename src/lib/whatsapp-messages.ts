// Centraliza as mensagens de WhatsApp do Zé Vendas por perfil de cliente.
// Regra de identificação automática a partir do contato (tabela `contacts`).

export type ClientProfile =
  | "PROSPECT"        // Mensagem 1 — cliente novo / prospecção geral
  | "INACTIVE"        // Mensagem 2 — reativação
  | "ACTIVE"          // Mensagem 3 — relacionamento
  | "FINAL_NICHE"     // Mensagem 4 — cliente final (Academia / Indústria)
  | "ARCHITECT";      // Mensagem 5 — arquiteto (Imprimax)

export const WHATSAPP_MESSAGES: Record<ClientProfile, string> = {
  // Mensagem 1 — Cliente NOVO (prospecção geral, vindo do Maps / fora da carteira)
  PROSPECT: `Olá, tudo bem? 😊

Sou a Kelly, representante comercial da Kapazi, Forte Plástico e Imprimax aqui na sua região.

Trabalho com produtos que aumentam sua lucratividade e giro de estoque. Posso te mostrar como?

Me chama que a gente conversa! 👊`,

  // Mensagem 2 — Cliente INATIVO (na carteira mas sem comprar)
  INACTIVE: `Olá, tudo bem? 😊

Sou a Kelly, representante da Kapazi, Forte Plástico e Imprimax!

Faz um tempinho que a gente não se fala e queria te contar que a Kapazi acabou de lançar novidades em vários segmentos!

Tenho um catálogo fresquinho com tudo isso que pode agregar muito no seu negócio. Posso te enviar? 📲`,

  // Mensagem 3 — Cliente ATIVO (relacionamento)
  ACTIVE: `Olá, tudo bem? 😊

Sou a Kelly, representante da Kapazi, Forte Plástico e Imprimax!

Passando para te contar que temos lançamentos novos que vão combinar muito com o seu negócio!

Posso passar aí para te apresentar as novidades pessoalmente ou te envio o catálogo agora? 📲`,

  // Mensagem 4 — Cliente Final / Nicho Novo (Academia ou Indústria)
  FINAL_NICHE: `Olá, tudo bem? 😊

Sou a Kelly, representante comercial da Kapazi aqui na sua região.

Trabalho com produtos que podem reduzir seus custos de manutenção e conservação. Muitas empresas como a sua já estão comprando direto do representante e economizando bastante!

Posso te mostrar como funciona? Me chama que a gente conversa! 👊`,

  // Mensagem 5 — Arquiteto / Parceria profissional (Imprimax)
  ARCHITECT: `Olá, tudo bem? 😊

Sou a Kelly, representante comercial da Imprimax aqui na sua região.

Trabalho com Adesivo Vinílico de alta qualidade para decoração e acabamentos. Um material que tem transformado projetos de interiores com muito mais personalidade e custo acessível!

Posso te enviar nosso portfólio? Tenho certeza que vai agregar nos seus projetos! 📐✨`,
};

export const PROFILE_LABELS: Record<ClientProfile, string> = {
  PROSPECT: "Prospecção (cliente novo)",
  INACTIVE: "Reativação (cliente parado)",
  ACTIVE: "Relacionamento (cliente ativo)",
  FINAL_NICHE: "Cliente final (Academia/Indústria)",
  ARCHITECT: "Arquiteto (Imprimax)",
};

type ContactLike = {
  category?: string | null;
  days_without_buying?: number | null;
  last_order_date?: string | null;
  niche?: string | null;
  industry_tags?: string[] | null;
  isProspect?: boolean;
} | null | undefined;

/** Normaliza string para comparação (sem acento, lowercase) */
function norm(s: string | null | undefined): string {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Extrai todos os nichos relevantes do contato (campo `niche` + tags). */
function getNiches(contact: ContactLike): string[] {
  if (!contact) return [];
  const niches: string[] = [];
  if (contact.niche) niches.push(norm(contact.niche));
  if (Array.isArray(contact.industry_tags)) {
    for (const tag of contact.industry_tags) {
      // tags vêm no formato "MARCA:Nicho" — pegamos o nicho
      const parts = tag.split(":");
      const nicheName = parts.length > 1 ? parts.slice(1).join(":") : tag;
      niches.push(norm(nicheName));
    }
  }
  return niches;
}

/**
 * Identifica o perfil do cliente seguindo a ordem de prioridade:
 * 1. Nicho = Arquiteto              → ARCHITECT (Mensagem 5)
 * 2. Nicho = Academia ou Indústria  → FINAL_NICHE (Mensagem 4)
 * 3. category NOVO_MAPS / NOVO_MANUAL → PROSPECT (Mensagem 1)
 * 4. category INATIVO ou days_without_buying >= 60 → INACTIVE (Mensagem 2)
 * 5. category ATIVO → ACTIVE (Mensagem 3)
 * 6. Fallback → PROSPECT (Mensagem 1)
 */
export function getClientProfile(contact: ContactLike): ClientProfile {
  if (!contact) return "PROSPECT";

  const niches = getNiches(contact);

  // 1) Arquiteto tem prioridade máxima
  if (niches.some(n => n.includes("arquiteto"))) return "ARCHITECT";

  // 2) Academia ou Indústria
  if (niches.some(n => n.includes("academia") || n.includes("industria"))) {
    return "FINAL_NICHE";
  }

  const cat = norm(contact.category);

  // 3) Prospecção / cliente novo
  if (
    contact.isProspect ||
    cat === "novo_maps" ||
    cat === "novo_manual" ||
    cat === "prospect"
  ) {
    return "PROSPECT";
  }

  // 4) Inativo (categoria explícita ou heurística >= 60 dias)
  if (cat === "inativo" || cat === "inactive") return "INACTIVE";
  if (typeof contact.days_without_buying === "number" && contact.days_without_buying >= 60) {
    return "INACTIVE";
  }
  if (contact.last_order_date) {
    const days = Math.floor(
      (Date.now() - new Date(contact.last_order_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days >= 60) return "INACTIVE";
  }

  // 5) Ativo
  if (cat === "ativo" || cat === "active") return "ACTIVE";

  // 6) Fallback — prospecção
  return "PROSPECT";
}

export function getWhatsappMessage(contact: ContactLike): string {
  return WHATSAPP_MESSAGES[getClientProfile(contact)];
}

/**
 * Monta o link wa.me já com a mensagem pré-preenchida.
 * Aceita telefone em qualquer formato — só os dígitos serão usados.
 */
export function buildWhatsappLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // Se já tiver DDI 55, não duplica
  const withDdi = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withDdi}?text=${encodeURIComponent(message)}`;
}

// ============================================================================
// Catálogo de indústrias e nichos (usado pela UI de seleção no perfil)
// ============================================================================

export interface IndustryOption {
  brand: "KAPAZI" | "FORTE_PLASTICO" | "IMPRIMAX";
  brandLabel: string;
  niches: string[];
}

export const INDUSTRY_CATALOG: IndustryOption[] = [
  {
    brand: "KAPAZI",
    brandLabel: "Kapazi",
    niches: ["Home Center", "Material de Construção", "Ferragens", "Academia", "Indústria"],
  },
  {
    brand: "FORTE_PLASTICO",
    brandLabel: "Forte Plástico",
    niches: ["Varejo", "Atacado", "Home Center"],
  },
  {
    brand: "IMPRIMAX",
    brandLabel: "Imprimax",
    niches: ["Decoração", "Automotivo", "Arquiteto"],
  },
];

/** Retorna lista única e ordenada de todas as tags possíveis no formato "MARCA:Nicho". */
export function getAllIndustryTags(): string[] {
  const tags: string[] = [];
  for (const ind of INDUSTRY_CATALOG) {
    for (const n of ind.niches) tags.push(`${ind.brand}:${n}`);
  }
  return tags;
}

/** Formata uma tag "KAPAZI:Home Center" para exibição "Kapazi · Home Center". */
export function formatTag(tag: string): string {
  const [brand, ...rest] = tag.split(":");
  const ind = INDUSTRY_CATALOG.find(i => i.brand === brand);
  return ind ? `${ind.brandLabel} · ${rest.join(":")}` : tag;
}
