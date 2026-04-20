import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function CitiesBacklogPage() {
  const { industryKey } = useIndustry();
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const { data: regions } = useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data } = await supabase.from("regions").select("*").order("sort_order");
      return data ?? [];
    },
  });

  const { data: cities } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data } = await supabase.from("cities").select("*, regions(name)").order("name");
      return data ?? [];
    },
  });

  const filtered = cities?.filter(c => {
    if (regionFilter !== "all" && c.region_id !== regionFilter) return false;
    if (priorityFilter !== "all" && c.priority !== priorityFilter) return false;
    if (industryKey === "KAPAZI" && !c.is_kapazi_allowed) return false;
    return true;
  });

  const priorityColor = (p: string) => {
    if (p === "P0") return "bg-primary text-primary-foreground";
    if (p === "P1") return "bg-warning text-warning-foreground";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Cidades a trabalhar</h1>

      <div className="flex gap-3 flex-wrap">
        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Região" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as regiões</SelectItem>
            {regions?.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="P0">P0</SelectItem>
            <SelectItem value="P1">P1</SelectItem>
            <SelectItem value="P2">P2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cidade</TableHead>
              <TableHead>Região</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Kapazi</TableHead>
              <TableHead>Ativa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered?.map(city => (
              <TableRow key={city.id}>
                <TableCell className="font-medium">{city.name}</TableCell>
                <TableCell>{(city.regions as any)?.name}</TableCell>
                <TableCell>
                  <Badge className={priorityColor(city.priority)} variant="secondary">{city.priority}</Badge>
                </TableCell>
                <TableCell>{city.is_kapazi_allowed ? "✓" : "—"}</TableCell>
                <TableCell>{city.is_active ? "✓" : "—"}</TableCell>
              </TableRow>
            ))}
            {(!filtered || filtered.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhuma cidade encontrada com os filtros selecionados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
