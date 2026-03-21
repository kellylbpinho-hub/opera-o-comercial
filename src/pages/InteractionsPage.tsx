import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function InteractionsPage() {
  const [filter, setFilter] = useState<"overdue" | "week">("overdue");

  const { data: interactions } = useQuery({
    queryKey: ["interactions-actions", filter],
    queryFn: async () => {
      const now = new Date();
      const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      let q = supabase.from("interactions").select("*, contacts(company_name, city_name, category)")
        .not("next_action_at", "is", null)
        .order("next_action_at", { ascending: true })
        .limit(100);

      if (filter === "overdue") {
        q = q.lte("next_action_at", now.toISOString());
      } else {
        q = q.lte("next_action_at", weekLater.toISOString());
      }

      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Interações / Próximas Ações</h1>

      <Select value={filter} onValueChange={v => setFilter(v as any)}>
        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
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
            {interactions?.map(i => {
              const contact = i.contacts as any;
              const isOverdue = i.next_action_at && new Date(i.next_action_at) < new Date();
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{contact?.company_name || "—"}</TableCell>
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
            {(!interactions || interactions.length === 0) && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma ação pendente.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
