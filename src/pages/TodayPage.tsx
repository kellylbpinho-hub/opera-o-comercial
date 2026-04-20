import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Clock, UserPlus, Target, ChevronRight, Building2, Calendar, MessageCircle } from "lucide-react";
import { buildWhatsappLink, getWhatsappMessage } from "@/lib/whatsapp-messages";

/**
 * TodayPage — home mobile-first do app.
 *
 * Mostra um resumo do dia para o representante:
 *  - Carteira do dia (total de contatos no Kanban hoje + concluídos)
 *  - Follow-ups atrasados
 *  - Novos leads dos últimos 7 dias
 *  - Meta do dia (% de conclusão da carteira)
 *
 * No desktop esta tela é acessível via /today, mas a home segue sendo o Dashboard.
 * No mobile, a Bottom Nav aponta o ícone "Hoje" para esta página.
 */
export default function TodayPage() {
  const { industryId, industryName } = useIndustry();
  const today = new Date().toISOString().split("T")[0];

  // Lote do dia (carteira) — primeiro lote criado hoje para a marca selecionada
  const { data: todayBatch } = useQuery({
    queryKey: ["today-batch-summary", industryId, today],
    queryFn: async () => {
      if (!industryId) return null;
      const { data } = await supabase
        .from("daily_batches")
        .select("id, city_name")
        .eq("industry_id", industryId)
        .eq("batch_date", today)
        .limit(1);
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!industryId,
  });

  // Itens da carteira para calcular total e concluídos
  const { data: batchItems } = useQuery({
    queryKey: ["today-batch-items-summary", todayBatch?.id],
    queryFn: async () => {
      if (!todayBatch) return [];
      const { data } = await supabase
        .from("daily_batch_items")
        .select("lane")
        .eq("batch_id", todayBatch.id);
      return data ?? [];
    },
    enabled: !!todayBatch,
  });

  // Follow-ups atrasados (contagem global do usuário)
  const { data: overdueCount } = useQuery({
    queryKey: ["today-overdue-followups"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { count } = await supabase
        .from("interactions")
        .select("id", { count: "exact", head: true })
        .not("next_action_at", "is", null)
        .lte("next_action_at", now)
        .is("reply_at", null);
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  // Novos leads dos últimos 7 dias da marca atual
  const { data: newLeadsCount } = useQuery({
    queryKey: ["today-new-leads-7d", industryId],
    queryFn: async () => {
      if (!industryId) return 0;
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("industry_id", industryId)
        .in("category", ["NOVO_MAPS", "NOVO_MANUAL"])
        .gte("created_at", since)
        .is("deleted_at", null);
      return count ?? 0;
    },
    enabled: !!industryId,
  });

  // Próximos follow-ups agendados (próximos 5)
  const { data: upcomingFollowups } = useQuery({
    queryKey: ["today-upcoming-followups"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("interactions")
        .select("id, next_action_at, contact:contacts(id, company_name, phone_normalized, phone_raw)")
        .not("next_action_at", "is", null)
        .is("reply_at", null)
        .gt("next_action_at", now)
        .order("next_action_at", { ascending: true })
        .limit(5);
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const totalBatch = batchItems?.length ?? 0;
  // "Concluído" = saiu da fila A_CONTATAR (foi contatado, respondeu, qualificou ou sem interesse)
  const doneBatch = batchItems?.filter(i => i.lane !== "A_CONTATAR").length ?? 0;
  const completionPct = totalBatch > 0 ? Math.round((doneBatch / totalBatch) * 100) : 0;

  // Sem marca selecionada — direciona o usuário
  if (!industryId) {
    return (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Hoje</h1>
        <Card className="shadow-sm">
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Selecione uma marca para ver o resumo do seu dia.
            </p>
            <Button asChild size="sm">
              <Link to="/assistente">Selecionar marca</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hoje</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {industryName ? `${industryName} · ` : ""}
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        </p>
      </div>

      {/* Meta do dia — destaque no topo */}
      <Card className="shadow-sm border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-primary">
            <Target className="h-4 w-4" />
            Meta do dia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {totalBatch > 0 ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold">{completionPct}%</span>
                <span className="text-xs text-muted-foreground">{doneBatch} de {totalBatch} contatos</span>
              </div>
              <Progress value={completionPct} className="h-2" />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma carteira gerada hoje.{" "}
              <Link to="/lote" className="text-primary font-medium hover:underline">
                Gerar agora
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Carteira do dia */}
      <Link to="/lote" className="block">
        <Card className="shadow-sm hover:bg-muted/30 transition-colors">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Carteira do dia</p>
              {totalBatch > 0 ? (
                <p className="text-xs text-muted-foreground truncate">
                  {doneBatch} concluídos · {totalBatch - doneBatch} pendentes
                  {todayBatch?.city_name ? ` · ${todayBatch.city_name}` : ""}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma carteira gerada hoje</p>
              )}
            </div>
            <Badge variant="secondary" className="text-base px-2.5">{totalBatch}</Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      {/* Follow-ups atrasados */}
      <Link to="/interacoes" className="block">
        <Card className={`shadow-sm hover:bg-muted/30 transition-colors ${overdueCount && overdueCount > 0 ? "border-destructive/30" : ""}`}>
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${overdueCount && overdueCount > 0 ? "bg-destructive/10" : "bg-secondary"}`}>
              <Clock className={`h-5 w-5 ${overdueCount && overdueCount > 0 ? "text-destructive" : "text-secondary-foreground"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Follow-ups atrasados</p>
              <p className="text-xs text-muted-foreground">
                {overdueCount && overdueCount > 0
                  ? "Toque para resolver pendências"
                  : "Tudo em dia 🎉"}
              </p>
            </div>
            <Badge variant={overdueCount && overdueCount > 0 ? "destructive" : "secondary"} className="text-base px-2.5">
              {overdueCount ?? 0}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      {/* Novos leads (7 dias) */}
      <Link to="/leads" className="block">
        <Card className="shadow-sm hover:bg-muted/30 transition-colors">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
              <UserPlus className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Novos leads</p>
              <p className="text-xs text-muted-foreground">Cadastrados nos últimos 7 dias</p>
            </div>
            <Badge variant="secondary" className="text-base px-2.5">{newLeadsCount ?? 0}</Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <Button asChild variant="outline" size="lg" className="h-auto py-3 flex-col gap-1">
          <Link to="/prospeccao">
            <span className="text-xs font-semibold">Prospectar</span>
            <span className="text-[10px] text-muted-foreground">Google Maps</span>
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-auto py-3 flex-col gap-1">
          <Link to="/importacoes">
            <span className="text-xs font-semibold">Importar</span>
            <span className="text-[10px] text-muted-foreground">CSV</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
