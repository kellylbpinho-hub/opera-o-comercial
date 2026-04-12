import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function RealtimeNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("interaction-replies")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "interactions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          if (newRow.reply_at && !oldRow.reply_at) {
            toast.info("📩 Um contato respondeu!", {
              description: newRow.reply_text?.substring(0, 80) || "Nova resposta recebida",
              duration: 8000,
            });
            queryClient.invalidateQueries({ queryKey: ["interactions-actions"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-responses"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return null;
}
