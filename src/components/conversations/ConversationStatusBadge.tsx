import { Badge } from "@/components/ui/badge";
import {
  CONVERSATION_STATUS_LABELS,
  CONVERSATION_STATUS_VARIANT,
  type ConversationStatus,
} from "@/lib/conversation-status";
import { cn } from "@/lib/utils";

export default function ConversationStatusBadge({
  status,
  className,
}: {
  status?: ConversationStatus | string | null;
  className?: string;
}) {
  const s = (status as ConversationStatus) || "NAO_ENVIADO";
  const label = CONVERSATION_STATUS_LABELS[s] ?? String(status);
  const variant = CONVERSATION_STATUS_VARIANT[s] ?? "bg-muted text-muted-foreground";
  return (
    <Badge variant="secondary" className={cn("text-[10px] py-0 px-1.5 border-0", variant, className)}>
      {label}
    </Badge>
  );
}
