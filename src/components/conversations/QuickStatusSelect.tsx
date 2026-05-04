import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONVERSATION_STATUS_OPTIONS,
  type ConversationStatus,
} from "@/lib/conversation-status";
import { useConversationStatus } from "@/hooks/useConversationStatus";

export default function QuickStatusSelect({
  contactId,
  current,
  className,
}: {
  contactId: string;
  current?: ConversationStatus | string | null;
  className?: string;
}) {
  const mutation = useConversationStatus();
  const value = (current as ConversationStatus) || "NAO_ENVIADO";
  return (
    <Select
      value={value}
      onValueChange={(v) =>
        mutation.mutate({
          contactId,
          newStatus: v as ConversationStatus,
          previousStatus: value,
        })
      }
    >
      <SelectTrigger className={className ?? "h-8 text-xs w-40"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONVERSATION_STATUS_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
