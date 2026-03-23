import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 50;

export default function InteractionsPage() {
  const { industryId } = useIndustry();
  const [filter, setFilter] = useState<"all" | "overdue" | "week">("all");
  const [page, setPage] = useState(0);

  const { data: result } = useQuery({
    queryKey: ["interactions-actions", filter, page, industryId],
    queryFn: async () => {
      const now = new Date();
      const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      let q = supabase.from("interactions").select("*, contacts(company_name, city_name, category, industry_id)", { count: "exact" })
        .not("next_action_at", "is", null)
        .is("reply_at", null)
        .order("next_action_at", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filter === "overdue") {
        q = q.lte("next_action_at", now.toISOString());
      } else if (filter === "week") {
        q = q.lte("next_action_at", weekLater.toISOString());
      }

      const { data, count } = await q;

      let filtered = data ?? [];
      if (industryId) {
        filtered = filtered.filter((i: any) => i.contacts?.industry_id === industryId);
      }

      return { interactions: filtered, total: count ?? 0 };
    },
  });

  const interactions = result?.interactions ?? [];
  const totalPages = Math.ceil((result?.total ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Interações / Próximas Ações</h1>

      <Select value={filter} onValueChange={v => { setFilter(v as any); setPage(0); }}>
        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas pendentes</SelectItem>
          <SelectItem value="overdue">Vencidas</SelectItem>
          <SelectItem value="week">Próximos 7 dias</SelectItem>
        </SelectContent>
      </Select>

      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Estágio</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Próxima ação</TableHead>
              <TableHead>Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {interactions.map(i => {
              const contact = i.contacts as any;
              const isOverdue = i.next_action_at && new Date(i.next_action_at) < new Date();
              return (
                <TableRow key={i.id} className={isOverdue ? "bg-destructive/5" : ""}>
                  <TableCell className={`font-medium ${isOverdue ? "text-destructive" : ""}`}>{contact?.company_name || "—"}</TableCell>
                  <TableCell>{contact?.city_name || "—"}</TableCell>
                  <TableCell>{i.channel}</TableCell>
                  <TableCell>{i.stage || "—"}</TableCell>
                  <TableCell>{i.outcome || "—"}</TableCell>
                  <TableCell>
                    {i.next_action_at ? (
                      <Badge variant={isOverdue ? "destructive" : "secondary"}>
                        {new Date(i.next_action_at).toLocaleDateString("pt-BR")}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{i.next_action_type || "—"}</TableCell>
                </TableRow>
              );
            })}
            {interactions.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma ação pendente.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
