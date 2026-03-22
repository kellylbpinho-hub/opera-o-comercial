import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, MessageSquare, Star, CalendarCheck, MapPin } from "lucide-react";

const LANE_LABELS: Record<string, string> = {
  A_CONTATAR: "A Contatar",
  CONTATADO: "Contatado",
  RESPONDEU: "Respondeu",
  QUALIFICADO: "Qualificado",
  SEM_INTERESSE: "Sem Interesse",
};

export default function DashboardPage() {
  const { industryId, industryName } = useIndustry();
  const today = new Date().toISOString().split("T")[0];

  // --- KPI cards ---
  const { data: batchToday } = useQuery({
    queryKey: ["dashboard-batch", industryId],
    queryFn: async () => {
      let q = supabase.from("daily_batches").select("id").eq("batch_date", today);
      if (industryId) q = q.eq("industry_id", industryId);
      const { data } = await q;
      return data?.length ?? 0;
    },
  });

  const { data: responsesToday } = useQuery({
    queryKey: ["dashboard-responses", industryId],
    queryFn: async () => {
      const { data } = await supabase.from("interactions").select("id").gte("reply_at", today).not("reply_at", "is", null);
      return data?.length ?? 0;
    },
  });

  const { data: qualifiedToday } = useQuery({
    queryKey: ["dashboard-qualified", industryId],
    queryFn: async () => {
      const { data } = await supabase.from("daily_batch_items").select("id").eq("lane", "QUALIFICADO").gte("created_at", today);
      return data?.length ?? 0;
    },
  });

  const { data: overdueFollowups } = useQuery({
    queryKey: ["dashboard-followups"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase.from("interactions").select("id").lte("next_action_at", now).not("next_action_at", "is", null);
      return data?.length ?? 0;
    },
  });

  const { data: activeCities } = useQuery({
    queryKey: ["dashboard-cities"],
    queryFn: async () => {
      const { data } = await supabase.from("cities").select("id").eq("is_active", true);
      return data?.length ?? 0;
    },
  });

  // --- Metrics by assistant ---
  const { data: byAssistant } = useQuery({
    queryKey: ["dashboard-by-assistant"],
    queryFn: async () => {
      const { data: batches } = await supabase
        .from("daily_batches")
        .select("id, industry_id, industries(name)")
        .eq("batch_date", today);
      if (!batches || batches.length === 0) return [];

      const batchIds = batches.map((b) => b.id);
      const { data: items } = await supabase
        .from("daily_batch_items")
        .select("batch_id, lane")
        .in("batch_id", batchIds);

      const map: Record<string, { name: string; lanes: Record<string, number>; total: number }> = {};
      for (const b of batches) {
        const name = (b.industries as any)?.name ?? "—";
        if (!map[b.industry_id]) map[b.industry_id] = { name, lanes: {}, total: 0 };
      }
      for (const item of items ?? []) {
        const batch = batches.find((b) => b.id === item.batch_id);
        if (!batch) continue;
        const entry = map[batch.industry_id];
        entry.lanes[item.lane] = (entry.lanes[item.lane] || 0) + 1;
        entry.total++;
      }
      return Object.values(map);
    },
  });

  // --- Metrics by city ---
  const { data: byCity } = useQuery({
    queryKey: ["dashboard-by-city", industryId],
    queryFn: async () => {
      let q = supabase.from("daily_batches").select("id, city_name").eq("batch_date", today);
      if (industryId) q = q.eq("industry_id", industryId);
      const { data: batches } = await q;
      if (!batches || batches.length === 0) return [];

      const batchIds = batches.map((b) => b.id);
      const { data: items } = await supabase
        .from("daily_batch_items")
        .select("batch_id, lane")
        .in("batch_id", batchIds);

      const map: Record<string, { city: string; lanes: Record<string, number>; total: number }> = {};
      for (const b of batches) {
        if (!map[b.id]) map[b.id] = { city: b.city_name ?? "—", lanes: {}, total: 0 };
      }
      for (const item of items ?? []) {
        const entry = map[item.batch_id];
        if (!entry) continue;
        entry.lanes[item.lane] = (entry.lanes[item.lane] || 0) + 1;
        entry.total++;
      }
      return Object.values(map);
    },
  });

  const cards = [
    { label: "Lotes hoje", value: batchToday ?? 0, icon: Package, color: "text-primary" },
    { label: "Respostas hoje", value: responsesToday ?? 0, icon: MessageSquare, color: "text-accent" },
    { label: "Qualificados hoje", value: qualifiedToday ?? 0, icon: Star, color: "text-yellow-500" },
    { label: "Follow-ups vencendo", value: overdueFollowups ?? 0, icon: CalendarCheck, color: "text-destructive" },
    { label: "Cidades ativas", value: activeCities ?? 0, icon: MapPin, color: "text-blue-500" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-balance">
        Dashboard {industryName ? `— ${industryName}` : ""}
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* By Assistant */}
      {byAssistant && byAssistant.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Kanban por Assistente (hoje)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assistente</TableHead>
                    {Object.keys(LANE_LABELS).map((l) => (
                      <TableHead key={l} className="text-center">{LANE_LABELS[l]}</TableHead>
                    ))}
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byAssistant.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      {Object.keys(LANE_LABELS).map((l) => (
                        <TableCell key={l} className="text-center">
                          <Badge variant="secondary">{row.lanes[l] || 0}</Badge>
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-semibold">{row.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* By City */}
      {byCity && byCity.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Kanban por Cidade (hoje)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cidade</TableHead>
                    {Object.keys(LANE_LABELS).map((l) => (
                      <TableHead key={l} className="text-center">{LANE_LABELS[l]}</TableHead>
                    ))}
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCity.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.city}</TableCell>
                      {Object.keys(LANE_LABELS).map((l) => (
                        <TableCell key={l} className="text-center">
                          <Badge variant="secondary">{row.lanes[l] || 0}</Badge>
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-semibold">{row.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
