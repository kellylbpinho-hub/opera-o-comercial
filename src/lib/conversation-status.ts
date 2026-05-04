export type ConversationStatus =
  | "NAO_ENVIADO"
  | "ENVIADO"
  | "RESPONDIDO"
  | "EM_NEGOCIACAO"
  | "AGENDADO"
  | "SEM_RESPOSTA"
  | "SEM_INTERESSE"
  | "PERDIDO"
  | "FECHADO";

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  NAO_ENVIADO: "Não enviado",
  ENVIADO: "Enviado",
  RESPONDIDO: "Respondido",
  EM_NEGOCIACAO: "Em negociação",
  AGENDADO: "Agendado",
  SEM_RESPOSTA: "Sem resposta",
  SEM_INTERESSE: "Sem interesse",
  PERDIDO: "Perdido",
  FECHADO: "Fechado",
};

export const CONVERSATION_STATUS_OPTIONS: { value: ConversationStatus; label: string }[] = (
  Object.keys(CONVERSATION_STATUS_LABELS) as ConversationStatus[]
).map((value) => ({ value, label: CONVERSATION_STATUS_LABELS[value] }));

// Tailwind classes for badges (using semantic tokens)
export const CONVERSATION_STATUS_VARIANT: Record<ConversationStatus, string> = {
  NAO_ENVIADO: "bg-muted text-muted-foreground",
  ENVIADO: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  RESPONDIDO: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  EM_NEGOCIACAO: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  AGENDADO: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  SEM_RESPOSTA: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  SEM_INTERESSE: "bg-muted text-muted-foreground",
  PERDIDO: "bg-destructive/15 text-destructive",
  FECHADO: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};
