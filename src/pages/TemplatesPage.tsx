import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const CATEGORIES = [
  { value: "NOVO_MAPS", label: "Novo (Maps)" },
  { value: "INATIVO", label: "Inativo" },
  { value: "ATIVO", label: "Ativo" },
];

const STAGES = [
  { value: "D0", label: "D0" },
  { value: "D2", label: "D2" },
  { value: "D5", label: "D5" },
  { value: "D7", label: "D7" },
  { value: "OBJECAO_JA_TENHO_FORNECEDOR", label: "Objeção: Já tenho fornecedor" },
];

export default function TemplatesPage() {
  const { industryId, modeId } = useIndustry();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ category: "", stage: "", template_text: "" });

  const { data: templates } = useQuery({
    queryKey: ["templates", industryId, modeId],
    queryFn: async () => {
      let q = supabase.from("templates").select("*").order("category").order("stage");
      if (industryId) q = q.eq("industry_id", industryId);
      if (modeId) q = q.eq("industry_mode_id", modeId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!industryId) throw new Error("Selecione um assistente.");
      const { error } = await supabase.from("templates").insert({
        industry_id: industryId,
        industry_mode_id: modeId || null,
        category: form.category,
        stage: form.stage,
        template_text: form.template_text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template criado!");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setDialogOpen(false);
      setForm({ category: "", stage: "", template_text: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Templates de Mensagem</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Template</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Template</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estágio</Label>
                <Select value={form.stage} onValueChange={v => setForm(f => ({ ...f, stage: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Texto do template</Label>
                <Textarea value={form.template_text} onChange={e => setForm(f => ({ ...f, template_text: e.target.value }))} rows={5} placeholder="Use {company_name}, {city_name}, {niche}..." />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead>Estágio</TableHead>
              <TableHead>Texto</TableHead>
              <TableHead>Ativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates?.map(t => (
              <TableRow key={t.id}>
                <TableCell>{t.category}</TableCell>
                <TableCell>{t.stage}</TableCell>
                <TableCell className="max-w-md truncate">{t.template_text}</TableCell>
                <TableCell>{t.is_active ? "✓" : "—"}</TableCell>
              </TableRow>
            ))}
            {(!templates || templates.length === 0) && (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum template encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
