import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";

export interface DupeCandidate {
  id: string;
  company_name: string;
  category: string;
  city_name: string;
  phone_raw?: string;
  confidence: number;
  match_type: string;
  suggested_action: string;
}

interface DupeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dupes: DupeCandidate[];
  onForceCreate: (justification: string) => void;
  isPending: boolean;
}

export default function DupeModal({ open, onOpenChange, dupes, onForceCreate, isPending }: DupeModalProps) {
  const [justification, setJustification] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />Possível duplicidade
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {dupes.map(d => (
            <Card key={d.id} className="shadow-sm">
              <CardContent className="p-3 text-sm space-y-1">
                <p className="font-medium">{d.company_name}</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">{d.category}</Badge>
                  <Badge variant="outline">{d.city_name}</Badge>
                  <Badge variant={d.confidence >= 0.9 ? "destructive" : "secondary"}>
                    {Math.round(d.confidence * 100)}% confiança
                  </Badge>
                </div>
                {d.phone_raw && <p className="text-xs text-muted-foreground">{d.phone_raw}</p>}
                <p className="text-xs text-muted-foreground">
                  Ação sugerida: {d.suggested_action === "REATIVACAO" ? "Reativação" : d.suggested_action === "BLOQUEAR" ? "Bloquear" : "Revisar"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-2">
          <Label>Justificativa para manter como novo:</Label>
          <Textarea value={justification} onChange={e => setJustification(e.target.value)} placeholder="Explique por que este não é duplicado..." />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Bloquear</Button>
          <Button variant="default" className="flex-1" disabled={!justification || isPending} onClick={() => onForceCreate(justification)}>
            Manter como novo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
