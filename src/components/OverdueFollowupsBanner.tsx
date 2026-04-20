import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

export default function OverdueFollowupsBanner() {
  const { data: overdueCount } = useQuery({
    queryKey: ["overdue-followups-global"],
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

  if (!overdueCount || overdueCount === 0) return null;

  return (
    <Link
      to="/interacoes"
      className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-2 text-sm font-medium hover:bg-destructive/20 transition-colors"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span>{overdueCount} follow-up{overdueCount > 1 ? "s" : ""} atrasado{overdueCount > 1 ? "s" : ""}</span>
    </Link>
  );
}
