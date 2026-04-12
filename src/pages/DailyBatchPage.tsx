import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Copy, ExternalLink, CheckCircle, Send } from "lucide-react";

const LANES = [
  { key: "A_CONTATAR", label: "A Contatar", color: "bg-kanban-contatar" },
  { key: "CONTATADO", label: "Contatado", color: "bg-kanban-contatado" },
  { key: "RESPONDEU", label: "Respondeu", color: "bg-kanban-respondeu" },
  { key: "QUALIFICADO", label: "Qualificado", color: "bg-kanban-qualificado" },
  { key: "SEM_INTERESSE", label: "Sem Interesse", color: "bg-kanban-sem-interesse" },
];

export default function DailyBatchPage() {
  const { industryId, industryKey, modeId } = useIndustry();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCity, setSelectedCity] = useState("");
  const [whatsappDialog, setWhatsappDialog] = useState<{ contact: any; stage: string } | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  const { data: cities } = useQuery({
    queryKey: ["cities-batch", industryKey],
    queryFn: async () => {
      let q = supabase.from("cities").select("*").eq("is_active", true).order("name");
      if (industryKey === "KAPAZI") q = q.eq("is_kapazi_allowed", true);
      const { data } = await q;
      return data ?? [];
    },
  });

  const today = new Date().toISOString().split("T")[0];

  const { data: todayBatch } = useQuery({
    queryKey: ["today-batch", industryId, today],
    queryFn: async () => {
      if (!industryId) return null;
      const { data } = await supabase.from("daily_batches").select("*").eq("industry_id", industryId).eq("batch_date", today);
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!industryId,
  });

  const { data: batchItems } = useQuery({
    queryKey: ["batch-items", todayBatch?.id],
    queryFn: async () => {
      if (!todayBatch) return [];
      const { data } = await supabase.from("daily_batch_items").select("*, contacts(*)").eq("batch_id", todayBatch.id).order("order_index");
      return data ?? [];
    },
    enabled: !!todayBatch,
  });

  const generateBatchMutation = useMutation({
    mutationFn: async () => {
      if (!industryId || !selectedCity) throw new Error("Selecione assistente e cidade.");
      const city = cities?.find(c => c.id === selectedCity);
      if (!city) throw new Error("Cidade inválida.");

      const { data: batch, error: batchError } = await supabase.from("daily_batches").insert({
        industry_id: industryId,
        industry_mode_id: modeId || null,
        city_id: selectedCity,
        city_name: city.name,
        batch_date: today,
        created_by: user?.id,
      }).select().single();
      if (batchError) {
        if (batchError.code === "23505") throw new Error("Já existe um lote para esta cidade e assistente hoje.");
        throw batchError;
      }

      const categories = [
        { cat: "NOVO_MAPS", target: 15 },
        { cat: "INATIVO", target: 10 },
        { cat: "ATIVO", target: 5 },
      ];

      let orderIdx = 0;
      const items: any[] = [];

      for (const { cat, target } of categories) {
        let q = supabase.from("contacts").select("id")
          .eq("industry_id", industryId)
          .eq("category", cat)
          .eq("city_id", selectedCity)
          .eq("status", "NAO_CONTATADO")
          .is("deleted_at", null)
          .limit(target);
        let { data: cityContacts } = await q;
        const found = cityContacts ?? [];

        if (found.length < target) {
          const remaining = target - found.length;
          let q2 = supabase.from("contacts").select("id")
            .eq("industry_id", industryId)
            .eq("category", cat)
            .eq("status", "NAO_CONTATADO")
            .is("deleted_at", null)
            .neq("city_id", selectedCity)
            .limit(remaining);
          const { data: otherContacts } = await q2;
          found.push(...(otherContacts ?? []));
        }

        for (const c of found.slice(0, target)) {
          items.push({
            batch_id: batch.id,
            contact_id: c.id,
            lane: "A_CONTATAR",
            order_index: orderIdx++,
          });
        }
      }

      if (items.length > 0) {
        const { error } = await supabase.from("daily_batch_items").insert(items);
        if (error) throw error;
      }

      return { count: items.length };
    },
    onSuccess: (data) => {
      toast.success(`Lote gerado com ${data.count} contatos!`);
      queryClient.invalidateQueries({ queryKey: ["today-batch"] });
      queryClient.invalidateQueries({ queryKey: ["batch-items"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const scheduleFollowup = async (contactId: string, stage: string, outcome?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("schedule-followups", {
        body: { contact_id: contactId, user_id: user?.id, stage, outcome },
      });
      if (error) console.error("Follow-up error:", error);
      else if (data?.scheduled) toast.info(`Follow-up ${data.next_stage} agendado`);
    } catch (e) {
      console.error("Follow-up scheduling failed:", e);
    }
  };

  const updateLaneMutation = useMutation({
    mutationFn: async ({ itemId, lane, contactId, currentLane }: { itemId: string; lane: string; contactId?: string; currentLane?: string }) => {
      const { data, error } = await supabase.from("daily_batch_items").update({ lane }).eq("id", itemId).select().single();
      if (error) throw error;

      // Also update contact status
      const statusMap: Record<string, string> = {
        CONTATADO: "CONTATADO",
        RESPONDEU: "RESPONDEU",
        QUALIFICADO: "QUALIFICADO",
        SEM_INTERESSE: "SEM_INTERESSE",
      };
      if (statusMap[lane] && contactId) {
        await supabase.from("contacts").update({ status: statusMap[lane] }).eq("id", contactId);
      }

      return { data, lane, contactId, currentLane };
    },
    onMutate: async ({ itemId, lane }) => {
      await queryClient.cancelQueries({ queryKey: ["batch-items", todayBatch?.id] });
      const previous = queryClient.getQueryData(["batch-items", todayBatch?.id]);
      queryClient.setQueryData(["batch-items", todayBatch?.id], (old: any[] | undefined) =>
        old?.map(item => item.id === itemId ? { ...item, lane } : item) ?? []
      );
      return { previous };
    },
    onSuccess: async (result) => {
      const label = LANES.find(l => l.key === result.lane)?.label ?? result.lane;
      toast.success(`Movido para "${label}"`);
      queryClient.invalidateQueries({ queryKey: ["batch-items", todayBatch?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      // Schedule follow-up when moving to CONTATADO
      if (result.lane === "CONTATADO" && result.contactId) {
        await scheduleFollowup(result.contactId, "D0");
      }
      // Schedule next follow-up on RESPONDEU (outcome not negative)
      if (result.lane === "RESPONDEU" && result.contactId) {
        await scheduleFollowup(result.contactId, "D2");
      }
      // Stop follow-ups on SEM_INTERESSE
      if (result.lane === "SEM_INTERESSE" && result.contactId) {
        // No follow-up scheduled - outcome stops cadence
      }
    },
    onError: (err: any, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["batch-items", todayBatch?.id], context.previous);
      }
      toast.error(err.message || "Erro ao mover card");
    },
  });

  const copyMessage = (contact: any) => {
    const msg = `Olá! Vi sua empresa em ${contact.city_name} e trabalho com linhas que podem agregar ao mix da sua loja. Se quiser, posso te enviar uma apresentação rápida pelo WhatsApp.`;
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada!");
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Lote do Dia</h1>

      {!todayBatch && (
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-48">
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger><SelectValue placeholder="Selecione a cidade" /></SelectTrigger>
                  <SelectContent>{cities?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={() => generateBatchMutation.mutate()} disabled={!selectedCity || generateBatchMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />Gerar Lote do Dia
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {todayBatch && (
        <p className="text-sm text-muted-foreground">
          Lote de {todayBatch.city_name} — {batchItems?.length ?? 0} contatos
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {LANES.map(lane => {
          const items = batchItems?.filter(i => i.lane === lane.key) ?? [];
          return (
            <div key={lane.key} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${lane.color}`} />
                <span className="text-sm font-semibold">{lane.label}</span>
                <Badge variant="secondary" className="text-xs">{items.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {items.map(item => {
                  const contact = item.contacts as any;
                  if (!contact) return null;
                  return (
                    <Card key={item.id} className="shadow-sm text-sm">
                      <CardContent className="p-3 space-y-2">
                        <p className="font-medium truncate">{contact.company_name}</p>
                        <p className="text-xs text-muted-foreground">{contact.city_name} · {contact.category}</p>
                        {contact.phone_raw && <p className="text-xs">{contact.phone_raw}</p>}
                        <div className="flex gap-1 flex-wrap">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyMessage(contact)}>
                            <Copy className="h-3 w-3 mr-1" />Copiar D0
                          </Button>
                          {contact.whatsapp_link && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                              <a href={contact.whatsapp_link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />WhatsApp
                              </a>
                            </Button>
                          )}
                          {lane.key === "A_CONTATAR" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateLaneMutation.mutate({ itemId: item.id, lane: "CONTATADO", contactId: contact.id, currentLane: lane.key })}>
                              <CheckCircle className="h-3 w-3 mr-1" />Contatado
                            </Button>
                          )}
                        </div>
                        {lane.key === "CONTATADO" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => updateLaneMutation.mutate({ itemId: item.id, lane: "RESPONDEU", contactId: contact.id, currentLane: lane.key })}>Respondeu</Button>
                            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => updateLaneMutation.mutate({ itemId: item.id, lane: "SEM_INTERESSE", contactId: contact.id, currentLane: lane.key })}>Sem interesse</Button>
                          </div>
                        )}
                        {lane.key === "RESPONDEU" && (
                          <Button size="sm" variant="outline" className="h-6 text-xs w-full" onClick={() => updateLaneMutation.mutate({ itemId: item.id, lane: "QUALIFICADO", contactId: contact.id, currentLane: lane.key })}>Qualificar</Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
