import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CONVERSATION_STATUS_LABELS } from "@/lib/conversation-status";
import { MessageCircle, Clock, ArrowRight } from "lucide-react";

export default function ConversationTimeline({ contactId }: { contactId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["contact-timeline", contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from("interactions")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Carregando histórico...</p>;
  }
  if (!data || data.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem histórico ainda.</p>;
  }

  return (
    <ul className="space-y-2 max-h-72 overflow-auto">
      {data.map((i: any) => {
        const isStatus = i.channel === "STATUS";
        const stageLabel =
          CONVERSATION_STATUS_LABELS[i.stage as keyof typeof CONVERSATION_STATUS_LABELS] ??
          i.stage;
        return (
          <li
            key={i.id}
            className="rounded-md border bg-card p-2.5 text-xs space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 font-medium">
                {isStatus ? (
                  <ArrowRight className="h-3 w-3" />
                ) : (
                  <MessageCircle className="h-3 w-3" />
                )}
                {isStatus ? stageLabel : i.channel}
              </span>
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(i.created_at).toLocaleString("pt-BR")}
              </span>
            </div>
            {i.notes && <p className="whitespace-pre-line text-muted-foreground">{i.notes}</p>}
            {i.next_action_at && (
              <p className="text-muted-foreground">
                Próxima ação:{" "}
                {new Date(i.next_action_at).toLocaleString("pt-BR")}
                {i.next_action_type ? ` · ${i.next_action_type}` : ""}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
