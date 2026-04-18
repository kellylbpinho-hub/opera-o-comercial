// Centraliza as mensagens de WhatsApp do Zé Vendas por perfil de cliente.
// Regra de identificação automática a partir do contato (tabela `contacts`).

export type ClientProfile = "PROSPECT" | "INACTIVE" | "ACTIVE";

export const WHATSAPP_MESSAGES: Record<ClientProfile, string> = {
  // Mensagem 1 — Cliente NOVO (vindo do Maps / fora da carteira)
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
};

/**
 * Identifica o perfil do cliente para escolher a mensagem correta.
 *
 * Aceita o objeto contact (com category, days_without_buying, last_order_date)
 * ou um objeto leve { isProspect: true } para resultados ainda não importados
 * (ex.: tela de Prospecção Google Maps).
 */
export function getClientProfile(contact: {
  category?: string | null;
  days_without_buying?: number | null;
  last_order_date?: string | null;
  isProspect?: boolean;
} | null | undefined): ClientProfile {
  if (!contact) return "PROSPECT";

  // Lead vindo do Maps que ainda não foi importado para a carteira
  if (contact.isProspect) return "PROSPECT";

  const cat = (contact.category || "").toUpperCase();

  // Categorias de prospecção (fora da carteira)
  if (cat === "NOVO_MAPS" || cat === "NOVO_MANUAL" || cat === "PROSPECT") {
    return "PROSPECT";
  }

  // Categoria explicitamente inativo
  if (cat === "INATIVO" || cat === "INACTIVE") return "INACTIVE";

  // Heurística: cliente da carteira sem comprar há 60+ dias = inativo
  if (typeof contact.days_without_buying === "number" && contact.days_without_buying >= 60) {
    return "INACTIVE";
  }
  if (contact.last_order_date) {
    const days = Math.floor(
      (Date.now() - new Date(contact.last_order_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days >= 60) return "INACTIVE";
  }

  // Categoria ativo ou cliente da carteira que comprou recentemente
  if (cat === "ATIVO" || cat === "ACTIVE") return "ACTIVE";

  // Fallback: se está na carteira (categoria definida) trata como ativo,
  // senão trata como prospect.
  return cat ? "ACTIVE" : "PROSPECT";
}

export function getWhatsappMessage(contact: Parameters<typeof getClientProfile>[0]): string {
  return WHATSAPP_MESSAGES[getClientProfile(contact)];
}

export const PROFILE_LABELS: Record<ClientProfile, string> = {
  PROSPECT: "Prospecção (cliente novo)",
  INACTIVE: "Reativação (cliente parado)",
  ACTIVE: "Relacionamento (cliente ativo)",
};

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
