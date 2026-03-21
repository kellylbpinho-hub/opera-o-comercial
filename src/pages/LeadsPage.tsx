import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

function LeadForm({ source, category, onSuccess }: { source: "MAPS" | "MANUAL"; category: "NOVO_MAPS" | "NOVO_MANUAL"; onSuccess: () => void }) {
  const { industryId, industryKey } = useIndustry();
  const { user } = useAuth();

  const { data: cities } = useQuery({
    queryKey: ["cities-for-leads", industryKey],
    queryFn: async () => {
      let q = supabase.from("cities").select("*").eq("is_active", true).order("name");
      if (industryKey === "KAPAZI") q = q.eq("is_kapazi_allowed", true);
      const { data } = await q;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    company_name: "",
    phone_raw: "",
    instagram: "",
    address: "",
    city_id: "",
    niche: "",
    notes: "",
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!industryId) throw new Error("Selecione um assistente primeiro.");
      const city = cities?.find(c => c.id === form.city_id);
      if (!city) throw new Error("Selecione uma cidade.");

      // Territory validation
      if (industryKey === "KAPAZI" && !city.is_kapazi_allowed) {
        throw new Error("Cidade fora do território do assistente selecionado.");
      }

      // Check dedup
      const phoneNorm = form.phone_raw.replace(/\D/g, "");
      if (phoneNorm) {
        const { data: existing } = await supabase.from("contacts").select("id, company_name, category, city_name").eq("phone_normalized", phoneNorm).limit(1);
        if (existing && existing.length > 0) {
          const ex = existing[0];
          if (ex.category === "INATIVO") {
            throw new Error(`Este telefone pertence a um Inativo: "${ex.company_name}" (${ex.city_name}). Use Reativação.`);
          }
          throw new Error(`Possível duplicidade com "${ex.company_name}" (${ex.category}, ${ex.city_name}).`);
        }
      }

      // Check company name dedup
      const compNorm = form.company_name.toLowerCase().trim();
      const { data: nameMatch } = await supabase.from("contacts").select("id, company_name, category, city_name")
        .eq("company_name_normalized", compNorm).eq("city_name", city.name).limit(1);
      if (nameMatch && nameMatch.length > 0) {
        const ex = nameMatch[0];
        if (ex.category === "INATIVO") {
          throw new Error(`Empresa já existe como Inativo: "${ex.company_name}" (${ex.city_name}). Use Reativação.`);
        }
        throw new Error(`Possível duplicidade: "${ex.company_name}" (${ex.category}) em ${ex.city_name}.`);
      }

      const { error } = await supabase.from("contacts").insert({
        industry_id: industryId,
        category,
        company_name: form.company_name,
        company_name_normalized: compNorm,
        phone_raw: form.phone_raw || null,
        phone_normalized: phoneNorm || null,
        whatsapp_link: phoneNorm ? `https://wa.me/55${phoneNorm}` : null,
        instagram: form.instagram || null,
        address: form.address || null,
        city_id: form.city_id,
        city_name: city.name,
        uf: "PA",
        niche: form.niche || null,
        source,
        notes: form.notes || null,
        owner_user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead criado!");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setForm({ company_name: "", phone_raw: "", instagram: "", address: "", city_id: "", niche: "", notes: "" });
      onSuccess();
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
      <div><Label>Empresa *</Label><Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} required /></div>
      <div><Label>Telefone</Label><Input value={form.phone_raw} onChange={e => setForm(f => ({ ...f, phone_raw: e.target.value }))} placeholder="(91) 99999-9999" /></div>
      <div><Label>Instagram</Label><Input value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} /></div>
      <div>
        <Label>Cidade *</Label>
        <Select value={form.city_id} onValueChange={v => setForm(f => ({ ...f, city_id: v }))}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>{cities?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Endereço</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
      <div><Label>Nicho</Label><Input value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))} /></div>
      <div><Label>Observação</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending}>Salvar Lead</Button>
    </form>
  );
}

export default function LeadsPage() {
  const { industryId } = useIndustry();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("maps");
  const [dialogOpen, setDialogOpen] = useState(false);

  const category = tab === "maps" ? "NOVO_MAPS" : "NOVO_MANUAL";

  const { data: leads } = useQuery({
    queryKey: ["leads", category, industryId, search],
    queryFn: async () => {
      let q = supabase.from("contacts").select("*").eq("category", category as string).order("created_at", { ascending: false }).limit(100);
      if (industryId) q = q.eq("industry_id", industryId);
      if (search) q = q.ilike("company_name", `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Leads Novos</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Lead</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo Lead ({tab === "maps" ? "Maps" : "Manual"})</DialogTitle></DialogHeader>
            <LeadForm
              source={tab === "maps" ? "MAPS" : "MANUAL"}
              category={category as "NOVO_MAPS" | "NOVO_MANUAL"}
              onSuccess={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="maps">Maps</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Nicho</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads?.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.company_name}</TableCell>
                <TableCell>{l.phone_raw || "—"}</TableCell>
                <TableCell>{l.city_name || "—"}</TableCell>
                <TableCell>{l.niche || "—"}</TableCell>
                <TableCell>{l.status}</TableCell>
              </TableRow>
            ))}
            {(!leads || leads.length === 0) && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum lead encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
