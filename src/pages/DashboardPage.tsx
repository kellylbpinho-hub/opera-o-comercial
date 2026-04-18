import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, MessageSquare, Star, CalendarCheck, MapPin, TrendingUp, AlertTriangle, Rocket } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";

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
  const [period, setPeriod] = useState<"7" | "14" | "30">("7");

  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split("T")[0];
  };
  const periodStart = daysAgo(Number(period));

  // --- KPI queries ---
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
      const { data } = await supabase.from("interactions").select("id").lte("next_action_at", now).not("next_action_at", "is", null).is("reply_at", null);
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

  const { data: totalContacts } = useQuery({
    queryKey: ["dashboard-total-contacts", industryId],
    queryFn: async () => {
      let q = supabase.from("contacts").select("id", { count: "exact", head: true }).is("deleted_at", null);
      if (industryId) q = q.eq("industry_id", industryId);
      const { count } = await q;
      return count ?? 0;
    },
  });

  // --- Maps → WhatsApp pipeline ---
  const { data: mapsPipeline } = useQuery({
    queryKey: ["dashboard-maps-pipeline", industryId, periodStart],
    queryFn: async () => {
      let q = supabase.from("contacts").select("id, status, source")
        .is("deleted_at", null)
        .eq("source", "MAPS")
        .gte("created_at", periodStart);
      if (industryId) q = q.eq("industry_id", industryId);
      const { data } = await q;
      if (!data) return { total: 0, contatado: 0, respondeu: 0, qualificado: 0 };
      const total = data.length;
      const contatado = data.filter(c => c.status !== "NAO_CONTATADO").length;
      const respondeu = data.filter(c => ["RESPONDEU", "QUALIFICADO"].includes(c.status)).length;
      const qualificado = data.filter(c => c.status === "QUALIFICADO").length;
      return { total, contatado, respondeu, qualificado };
    },
  });
  const { data: conversionData } = useQuery({
    queryKey: ["dashboard-conversion", industryId, periodStart],
    queryFn: async () => {
      let q = supabase.from("daily_batch_items").select("lane, batch_id, daily_batches(industry_id, batch_date)")
        .gte("created_at", periodStart);
      const { data } = await q;
      if (!data) return { total: 0, contatado: 0, respondeu: 0, qualificado: 0, sem_interesse: 0 };

      let items = data as any[];
      if (industryId) items = items.filter(i => i.daily_batches?.industry_id === industryId);

      const total = items.length;
      const contatado = items.filter(i => i.lane !== "A_CONTATAR").length;
      const respondeu = items.filter(i => ["RESPONDEU", "QUALIFICADO"].includes(i.lane)).length;
      const qualificado = items.filter(i => i.lane === "QUALIFICADO").length;
      const sem_interesse = items.filter(i => i.lane === "SEM_INTERESSE").length;

      return { total, contatado, respondeu, qualificado, sem_interesse };
    },
  });

  const pct = (n: number, d: number) => d > 0 ? `${Math.round((n / d) * 100)}%` : "—";

  // --- Daily trend ---
  const { data: dailyTrend } = useQuery({
    queryKey: ["dashboard-daily-trend", industryId, periodStart],
    queryFn: async () => {
      const { data: batches } = await supabase.from("daily_batches").select("id, batch_date, industry_id").gte("batch_date", periodStart);
      if (!batches || batches.length === 0) return [];

      let filtered = batches;
      if (industryId) filtered = filtered.filter(b => b.industry_id === industryId);
      const batchIds = filtered.map(b => b.id);
      if (batchIds.length === 0) return [];

      const { data: items } = await supabase.from("daily_batch_items").select("batch_id, lane").in("batch_id", batchIds);

      const dayMap: Record<string, { date: string; total: number; contatado: number; respondeu: number; qualificado: number }> = {};
      for (const b of filtered) {
        if (!dayMap[b.batch_date]) dayMap[b.batch_date] = { date: b.batch_date, total: 0, contatado: 0, respondeu: 0, qualificado: 0 };
      }
      for (const item of items ?? []) {
        const batch = filtered.find(b => b.id === item.batch_id);
        if (!batch) continue;
        const d = dayMap[batch.batch_date];
        d.total++;
        if (item.lane !== "A_CONTATAR") d.contatado++;
        if (["RESPONDEU", "QUALIFICADO"].includes(item.lane)) d.respondeu++;
        if (item.lane === "QUALIFICADO") d.qualificado++;
      }
      return Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
    },
  });

  // --- Top cities ---
  const { data: topCities } = useQuery({
    queryKey: ["dashboard-top-cities", industryId, periodStart],
    queryFn: async () => {
      let q = supabase.from("contacts").select("city_name").is("deleted_at", null).gte("created_at", periodStart);
      if (industryId) q = q.eq("industry_id", industryId);
      const { data } = await q;
      if (!data) return [];
      const counts: Record<string, number> = {};
      for (const c of data) { counts[c.city_name ?? "—"] = (counts[c.city_name ?? "—"] || 0) + 1; }
      return Object.entries(counts).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count).slice(0, 8);
    },
  });

  // --- Top assistants ---
  const { data: topAssistants } = useQuery({
    queryKey: ["dashboard-top-assistants", periodStart],
    queryFn: async () => {
      const { data: batches } = await supabase.from("daily_batches").select("id, industry_id, industries(name)").gte("batch_date", periodStart);
      if (!batches || batches.length === 0) return [];
      const batchIds = batches.map(b => b.id);
      const { data: items } = await supabase.from("daily_batch_items").select("batch_id, lane").in("batch_id", batchIds);

      const map: Record<string, { name: string; total: number; qualificado: number }> = {};
      for (const b of batches) {
        const name = (b.industries as any)?.name ?? "—";
        if (!map[b.industry_id]) map[b.industry_id] = { name, total: 0, qualificado: 0 };
      }
      for (const item of items ?? []) {
        const batch = batches.find(b => b.id === item.batch_id);
        if (!batch) continue;
        map[batch.industry_id].total++;
        if (item.lane === "QUALIFICADO") map[batch.industry_id].qualificado++;
      }
      return Object.values(map).sort((a, b) => b.qualificado - a.qualificado);
    },
  });

  // --- By Assistant (today) ---
  const { data: byAssistant } = useQuery({
    queryKey: ["dashboard-by-assistant"],
    queryFn: async () => {
      const { data: batches } = await supabase.from("daily_batches").select("id, industry_id, industries(name)").eq("batch_date", today);
      if (!batches || batches.length === 0) return [];
      const batchIds = batches.map(b => b.id);
      const { data: items } = await supabase.from("daily_batch_items").select("batch_id, lane").in("batch_id", batchIds);
      const map: Record<string, { name: string; lanes: Record<string, number>; total: number }> = {};
      for (const b of batches) {
        const name = (b.industries as any)?.name ?? "—";
        if (!map[b.industry_id]) map[b.industry_id] = { name, lanes: {}, total: 0 };
      }
      for (const item of items ?? []) {
        const batch = batches.find(b => b.id === item.batch_id);
        if (!batch) continue;
        map[batch.industry_id].lanes[item.lane] = (map[batch.industry_id].lanes[item.lane] || 0) + 1;
        map[batch.industry_id].total++;
      }
      return Object.values(map);
    },
  });

  const cards = [
    { label: "Lotes hoje", value: batchToday ?? 0, icon: Package, color: "text-primary" },
    { label: "Respostas hoje", value: responsesToday ?? 0, icon: MessageSquare, color: "text-accent" },
    { label: "Qualificados hoje", value: qualifiedToday ?? 0, icon: Star, color: "text-yellow-500" },
    { label: "Follow-ups atrasados", value: overdueFollowups ?? 0, icon: overdueFollowups && overdueFollowups > 0 ? AlertTriangle : CalendarCheck, color: overdueFollowups && overdueFollowups > 0 ? "text-destructive" : "text-muted-foreground" },
    { label: "Cidades ativas", value: activeCities ?? 0, icon: MapPin, color: "text-blue-500" },
  ];

  const hasNoData = (totalContacts ?? 0) === 0 && (batchToday ?? 0) === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-balance">
          Dashboard {industryName ? `— ${industryName}` : ""}
        </h1>
        <div className="flex gap-2">
          <Select value={period} onValueChange={v => setPeriod(v as any)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Onboarding card when no data */}
      {hasNoData && (
        <Card className="shadow-sm border-primary/20 bg-primary/5">
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
            <Rocket className="h-12 w-12 text-primary" />
            <div>
              <p className="text-lg font-semibold">Bem-vindo ao Zé Vendas!</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Para começar, siga estes passos:
              </p>
              <ol className="text-sm text-muted-foreground mt-3 text-left max-w-md space-y-1">
                <li>1. Selecione um <strong>assistente</strong> no menu lateral</li>
                <li>2. Importe sua base de <strong>clientes ativos e inativos</strong> via CSV</li>
                <li>3. Cadastre <strong>leads novos</strong> pelo Maps ou manualmente</li>
                <li>4. Gere o <strong>Lote do Dia</strong> e comece a prospectar!</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map(c => (
          <Card key={c.label} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent><p className="text-3xl font-bold tabular-nums">{c.value}</p></CardContent>
          </Card>
        ))}
      </div>

      {/* Conversion funnel */}
      {conversionData && conversionData.total > 0 && (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Taxa de Conversão ({period} dias)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{pct(conversionData.contatado, conversionData.total)}</p>
                <p className="text-xs text-muted-foreground">Contato → Contatado</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{pct(conversionData.respondeu, conversionData.contatado)}</p>
                <p className="text-xs text-muted-foreground">Contatado → Respondeu</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{pct(conversionData.qualificado, conversionData.respondeu)}</p>
                <p className="text-xs text-muted-foreground">Respondeu → Qualificado</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{pct(conversionData.qualificado, conversionData.total)}</p>
                <p className="text-xs text-muted-foreground">Total → Qualificado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily trend chart */}
      {dailyTrend && dailyTrend.length > 1 && (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Evolução Diária</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tickFormatter={d => new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip labelFormatter={d => new Date(d + "T12:00:00").toLocaleDateString("pt-BR")} />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="contatado" name="Contatados" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="qualificado" name="Qualificados" stroke="#eab308" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top cities + Top assistants */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topCities && topCities.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-base">Top Cidades (novos contatos)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topCities} layout="vertical">
                  <XAxis type="number" className="text-xs" />
                  <YAxis type="category" dataKey="city" width={120} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="count" name="Contatos" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {topAssistants && topAssistants.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-base">Ranking Assistentes</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assistente</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Qualificados</TableHead>
                    <TableHead className="text-center">Taxa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topAssistants.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-center">{a.total}</TableCell>
                      <TableCell className="text-center">{a.qualificado}</TableCell>
                      <TableCell className="text-center">{pct(a.qualificado, a.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* By Assistant (today) */}
      {byAssistant && byAssistant.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Kanban por Assistente (hoje)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assistente</TableHead>
                    {Object.keys(LANE_LABELS).map(l => <TableHead key={l} className="text-center">{LANE_LABELS[l]}</TableHead>)}
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byAssistant.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      {Object.keys(LANE_LABELS).map(l => (
                        <TableCell key={l} className="text-center"><Badge variant="secondary">{row.lanes[l] || 0}</Badge></TableCell>
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

      {/* Maps → WhatsApp pipeline */}
      {mapsPipeline && mapsPipeline.total > 0 && (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" />Pipeline Maps → WhatsApp ({period} dias)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{mapsPipeline.total}</p>
                <p className="text-xs text-muted-foreground">Leads do Maps</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{pct(mapsPipeline.contatado, mapsPipeline.total)}</p>
                <p className="text-xs text-muted-foreground">Contatados via WhatsApp</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{pct(mapsPipeline.respondeu, mapsPipeline.contatado)}</p>
                <p className="text-xs text-muted-foreground">Taxa de Resposta</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{pct(mapsPipeline.qualificado, mapsPipeline.total)}</p>
                <p className="text-xs text-muted-foreground">Maps → Qualificado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
