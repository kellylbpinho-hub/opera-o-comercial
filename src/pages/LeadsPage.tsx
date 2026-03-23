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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

interface DupeCandidate {
  id: string;
  company_name: string;
  category: string;
  city_name: string;
  phone_raw?: string;
  confidence: number;
  match_type: string;
  suggested_action: string;
}

const PAGE_SIZE = 50;

function LeadForm({ source, category, onSuccess }: { source: "MAPS" | "MANUAL"; category: "NOVO_MAPS" | "NOVO_MANUAL"; onSuccess: () => void }) {
  const { industryId, industryKey } = useIndustry();
  const { user } = useAuth();
  const [dupes, setDupes] = useState<DupeCandidate[]>([]);
  const [showDupeModal, setShowDupeModal] = useState(false);
  const [justification, setJustification] = useState("");

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
    company_name: "", phone_raw: "", instagram: "", address: "", city_id: "", niche: "", notes: "",
  });

  const queryClient = useQueryClient();

  const doInsert = async (force = false) => {
    if (!industryId) throw new Error("Selecione um assistente primeiro.");
    const city = cities?.find(c => c.id === form.city_id);
    if (!city) throw new Error("Selecione uma cidade.");

    // Server-side territory validation
    const { data: tResult } = await supabase.functions.invoke("territory-guard", {
      body: { industry_key: industryKey, city_name: city.name, uf: "PA" },
    });
    if (tResult && !tResult.allowed) throw new Error(tResult.reason);

    // Server-side deduplication
    if (!force) {
      const { data: dResult } = await supabase.functions.invoke("dedupe-contact", {
        body: { company_name: form.company_name, phone: form.phone_raw, city_name: city.name, uf: "PA" },
      });
      if (dResult?.has_duplicates) {
        setDupes(dResult.duplicates);
        setShowDupeModal(true);
        return "DUPE_FOUND";
      }
    }

    const phoneNorm = form.phone_raw.replace(/\D/g, "");
    const compNorm = form.company_name.toLowerCase().trim();

    const { error } = await supabase.from("contacts").insert({
      industry_id: industryId, category, company_name: form.company_name,
      company_name_normalized: compNorm, phone_raw: form.phone_raw || null,
      phone_normalized: phoneNorm || null, whatsapp_link: phoneNorm ? `https://wa.me/55${phoneNorm}` : null,
      instagram: form.instagram || null, address: form.address || null,
      city_id: form.city_id, city_name: city.name, uf: "PA",
      niche: form.niche || null, source, notes: force ? `[Forçado] ${justification}\n${form.notes || ""}` : (form.notes || null),
      owner_user_id: user?.id,
    });
    if (error) throw error;
    return "OK";
  };

  const createMutation = useMutation({
    mutationFn: () => doInsert(false),
    onSuccess: (result) => {
      if (result === "DUPE_FOUND") return;
      toast.success("Lead criado!");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setForm({ company_name: "", phone_raw: "", instagram: "", address: "", city_id: "", niche: "", notes: "" });
      onSuccess();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const forceCreateMutation = useMutation({
    mutationFn: () => doInsert(true),
    onSuccess: () => {
      toast.success("Lead criado (forçado)!");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setForm({ company_name: "", phone_raw: "", instagram: "", address: "", city_id: "", niche: "", notes: "" });
      setShowDupeModal(false);
      setJustification("");
      onSuccess();
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <>
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

      {/* Duplicate modal */}
      <Dialog open={showDupeModal} onOpenChange={setShowDupeModal}>
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
            <Button variant="outline" className="flex-1" onClick={() => setShowDupeModal(false)}>Bloquear</Button>
            <Button variant="default" className="flex-1" disabled={!justification || forceCreateMutation.isPending} onClick={() => forceCreateMutation.mutate()}>
              Manter como novo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function LeadsPage() {
  const { industryId } = useIndustry();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("maps");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);

  const category = tab === "maps" ? "NOVO_MAPS" : "NOVO_MANUAL";

  const { data: leadsData } = useQuery({
    queryKey: ["leads", category, industryId, search, page],
    queryFn: async () => {
      let q = supabase.from("contacts").select("*", { count: "exact" })
        .eq("category", category as string)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (industryId) q = q.eq("industry_id", industryId);
      if (search) q = q.ilike("company_name", `%${search}%`);
      const { data, count } = await q;
      return { leads: data ?? [], total: count ?? 0 };
    },
  });

  const leads = leadsData?.leads ?? [];
  const totalPages = Math.ceil((leadsData?.total ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Leads Novos</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Lead</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo Lead ({tab === "maps" ? "Maps" : "Manual"})</DialogTitle></DialogHeader>
            <LeadForm source={tab === "maps" ? "MAPS" : "MANUAL"} category={category as "NOVO_MAPS" | "NOVO_MANUAL"} onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={v => { setTab(v); setPage(0); }}>
        <TabsList>
          <TabsTrigger value="maps">Maps</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
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
            {leads.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.company_name}</TableCell>
                <TableCell>{l.phone_raw || "—"}</TableCell>
                <TableCell>{l.city_name || "—"}</TableCell>
                <TableCell>{l.niche || "—"}</TableCell>
                <TableCell>{l.status}</TableCell>
              </TableRow>
            ))}
            {leads.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum lead encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{leadsData?.total} leads · Página {page + 1} de {totalPages}</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
