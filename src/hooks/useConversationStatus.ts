import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  CONVERSATION_STATUS_LABELS,
  type ConversationStatus,
} from "@/lib/conversation-status";

interface UpdateStatusParams {
  contactId: string;
  newStatus: ConversationStatus;
  previousStatus?: ConversationStatus | null;
  notes?: string;
  nextActionAt?: string | null;
  nextActionType?: string | null;
  silent?: boolean;
}

export function useConversationStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      contactId,
      newStatus,
      previousStatus,
      notes,
      nextActionAt,
      nextActionType,
    }: UpdateStatusParams) => {
      if (!user) throw new Error("Não autenticado.");

      // 1) Update contact
      const { error: upErr } = await supabase
        .from("contacts")
        .update({ conversation_status: newStatus })
        .eq("id", contactId);
      if (upErr) throw upErr;

      // 2) Append timeline entry
      const fromLabel = previousStatus
        ? CONVERSATION_STATUS_LABELS[previousStatus]
        : "—";
      const toLabel = CONVERSATION_STATUS_LABELS[newStatus];
      const summary = `Status: ${fromLabel} → ${toLabel}`;

      const { error: intErr } = await supabase.from("interactions").insert({
        contact_id: contactId,
        user_id: user.id,
        channel: "STATUS",
        stage: newStatus,
        outcome: newStatus,
        notes: notes ? `${summary}\n${notes}` : summary,
        next_action_at: nextActionAt ?? null,
        next_action_type: nextActionType ?? null,
      });
      if (intErr) throw intErr;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-timeline", vars.contactId] });
      queryClient.invalidateQueries({ queryKey: ["interactions-actions"] });
      if (!vars.silent) toast.success("Status atualizado");
    },
    onError: (err: any) => toast.error(err.message ?? "Erro ao atualizar status"),
  });
}
