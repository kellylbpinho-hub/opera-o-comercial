import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, MessageSquare, Star, CalendarCheck, MapPin } from "lucide-react";

export default function DashboardPage() {
  const { industryId } = useIndustry();

  const { data: batchToday } = useQuery({
    queryKey: ["dashboard-batch", industryId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      let q = supabase.from("daily_batches").select("id").eq("batch_date", today);
      if (industryId) q = q.eq("industry_id", industryId);
      const { data } = await q;
      return data?.length ?? 0;
    },
  });

  const { data: responsesToday } = useQuery({
    queryKey: ["dashboard-responses", industryId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      let q = supabase.from("interactions").select("id").gte("reply_at", today).not("reply_at", "is", null);
      const { data } = await q;
      return data?.length ?? 0;
    },
  });

  const { data: qualifiedToday } = useQuery({
    queryKey: ["dashboard-qualified", industryId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      let q = supabase.from("daily_batch_items").select("id").eq("lane", "QUALIFICADO").gte("created_at", today);
      const { data } = await q;
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

  const cards = [
    { label: "Lotes hoje", value: batchToday ?? 0, icon: Package, color: "text-primary" },
    { label: "Respostas hoje", value: responsesToday ?? 0, icon: MessageSquare, color: "text-accent" },
    { label: "Qualificados hoje", value: qualifiedToday ?? 0, icon: Star, color: "text-warning" },
    { label: "Follow-ups vencendo", value: overdueFollowups ?? 0, icon: CalendarCheck, color: "text-destructive" },
    { label: "Cidades ativas", value: activeCities ?? 0, icon: MapPin, color: "text-info" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-balance">Dashboard</h1>
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
    </div>
  );
}
