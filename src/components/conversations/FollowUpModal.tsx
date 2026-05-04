import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contactId: string;
  contactName?: string;
  currentStatus?: ConversationStatus | string | null;
}

const ACTION_TYPES = [
  { value: "WHATSAPP", label: "Enviar WhatsApp" },
  { value: "CALL", label: "Ligar" },
  { value: "VISIT", label: "Visita presencial" },
  { value: "OTHER", label: "Outro" },
];

export default function FollowUpModal({
  open,
  onOpenChange,
  contactId,
  contactName,
  currentStatus,
}: Props) {
  const mutation = useConversationStatus();
  const [status, setStatus] = useState<ConversationStatus>(
    (currentStatus as ConversationStatus) || "ENVIADO"
  );
  const [notes, setNotes] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextType, setNextType] = useState<string>("WHATSAPP");

  useEffect(() => {
    if (open) {
      setStatus((currentStatus as ConversationStatus) || "ENVIADO");
      setNotes("");
      setNextDate("");
      setNextType("WHATSAPP");
    }
  }, [open, currentStatus]);

  const handleSave = () => {
    mutation.mutate(
      {
        contactId,
        newStatus: status,
        previousStatus: (currentStatus as ConversationStatus) || null,
        notes: notes || undefined,
        nextActionAt: nextDate ? new Date(nextDate).toISOString() : null,
        nextActionType: nextDate ? nextType : null,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Registrar follow-up{contactName ? ` · ${contactName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Status da conversa</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ConversationStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONVERSATION_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: respondeu pedindo catálogo, marcado para terça às 14h..."
              className="min-h-24 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Próxima ação</Label>
              <Input
                type="datetime-local"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={nextType} onValueChange={setNextType} disabled={!nextDate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
