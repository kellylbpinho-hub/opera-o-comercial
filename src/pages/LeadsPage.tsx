import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import ContactForm, { type ContactFormData } from "@/components/contacts/ContactForm";
import DupeModal, { type DupeCandidate } from "@/components/contacts/DupeModal";
import ContactCard from "@/components/contacts/ContactCard";
import { formatTag } from "@/lib/whatsapp-messages";

const PAGE_SIZE = 50;

export default function LeadsPage() {
  const { industryId, industryKey } = useIndustry();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("maps");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<any | null>(null);
  const [dupes, setDupes] = useState<DupeCandidate[]>([]);
  const [showDupeModal, setShowDupeModal] = useState(false);
  const [pendingForm, setPendingForm] = useState<ContactFormData | null>(null);

  const category = tab === "maps" ? "NOVO_MAPS" : "NOVO_MANUAL";
  const source = tab === "maps" ? "MAPS" : "MANUAL";

  const { data: cities } = useQuery({
    queryKey: ["cities-for-leads", industryKey],
    queryFn: async () => {
      let q = supabase.from("cities").select("*").eq("is_active", true).order("name");
      if (industryKey === "KAPAZI") q = q.eq("is_kapazi_allowed", true);
      const { data } = await q;
      return data ?? [];
    },
  });

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

  const doInsert = async (form: ContactFormData, force = false, justification = "") => {
    if (!industryId) throw new Error("Selecione uma marca primeiro.");
    const city = cities?.find(c => c.id === form.city_id);
    if (!city) throw new Error("Selecione uma cidade.");

    const { data: tResult } = await supabase.functions.invoke("territory-guard", {
      body: { industry_key: industryKey, city_name: city.name, uf: "PA" },
    });
    if (tResult && !tResult.allowed) throw new Error(tResult.reason);

    if (!force) {
      const { data: dResult } = await supabase.functions.invoke("dedupe-contact", {
        body: { company_name: form.company_name, phone: form.phone_raw, city_name: city.name, uf: "PA" },
      });
      if (dResult?.has_duplicates) {
        setDupes(dResult.duplicates);
        setPendingForm(form);
        setShowDupeModal(true);
        return "DUPE_FOUND";
      }
    }

    const phoneNorm = form.phone_raw.replace(/\D/g, "");
    const { error } = await supabase.from("contacts").insert({
      industry_id: industryId, category, company_name: form.company_name,
      company_name_normalized: form.company_name.toLowerCase().trim(),
      contact_name: form.contact_name || null,
      phone_raw: form.phone_raw || null,
      phone_normalized: phoneNorm || null,
      whatsapp_link: phoneNorm ? `https://wa.me/55${phoneNorm}` : null,
      instagram: form.instagram || null, address: form.address || null,
      city_id: form.city_id, city_name: city.name, uf: "PA",
      niche: form.niche || null, source,
      notes: force ? `[Forçado] ${justification}\n${form.notes || ""}` : (form.notes || null),
      owner_user_id: user?.id,
      industry_tags: form.industry_tags ?? [],
    });
    if (error) throw error;
    return "OK";
  };

  const createMutation = useMutation({
    mutationFn: (form: ContactFormData) => doInsert(form),
    onSuccess: (result) => {
      if (result === "DUPE_FOUND") return;
      toast.success("Lead criado!");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const forceCreateMutation = useMutation({
    mutationFn: (j: string) => {
      if (!pendingForm) throw new Error("Formulário não encontrado.");
      return doInsert(pendingForm, true, j);
    },
    onSuccess: () => {
      toast.success("Lead criado (forçado)!");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setShowDupeModal(false);
      setDialogOpen(false);
      setPendingForm(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (form: ContactFormData) => {
      if (!editing) throw new Error("Nada para editar.");
      const phoneNorm = form.phone_raw.replace(/\D/g, "");
      const city = cities?.find(c => c.id === form.city_id);
      const { error } = await supabase.from("contacts").update({
        company_name: form.company_name,
        company_name_normalized: form.company_name.toLowerCase().trim(),
        contact_name: form.contact_name || null,
        phone_raw: form.phone_raw || null,
        phone_normalized: phoneNorm || null,
        whatsapp_link: phoneNorm ? `https://wa.me/55${phoneNorm}` : null,
        instagram: form.instagram || null,
        address: form.address || null,
        city_id: form.city_id || editing.city_id,
        city_name: city?.name ?? editing.city_name,
        niche: form.niche || null,
        notes: form.notes || null,
        industry_tags: form.industry_tags ?? [],
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead atualizado!");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setEditing(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const editingInitial: Partial<ContactFormData> | undefined = editing ? {
    company_name: editing.company_name ?? "",
    contact_name: editing.contact_name ?? "",
    phone_raw: editing.phone_raw ?? "",
    instagram: editing.instagram ?? "",
    address: editing.address ?? "",
    city_id: editing.city_id ?? "",
    niche: editing.niche ?? "",
    notes: editing.notes ?? "",
    industry_tags: editing.industry_tags ?? [],
  } : undefined;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Novos leads</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Lead</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo Lead ({tab === "maps" ? "Maps" : "Manual"})</DialogTitle></DialogHeader>
            <ContactForm
              cities={cities ?? []}
              isPending={createMutation.isPending}
              onSubmit={(form) => createMutation.mutate(form)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <DupeModal
        open={showDupeModal}
        onOpenChange={setShowDupeModal}
        dupes={dupes}
        onForceCreate={(j) => forceCreateMutation.mutate(j)}
        isPending={forceCreateMutation.isPending}
      />

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar lead</DialogTitle></DialogHeader>
          {editing && (
            <ContactForm
              cities={cities ?? []}
              isPending={updateMutation.isPending}
              initialData={editingInitial}
              submitLabel="Salvar alterações"
              onSubmit={(form) => updateMutation.mutate(form)}
            />
          )}
        </DialogContent>
      </Dialog>

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

      {/* Mobile: cards */}
      <div className="block md:hidden space-y-2">
        {leads.map(l => (
          <ContactCard
            key={l.id}
            contact={l}
            categoryLabel={tab === "maps" ? "Maps" : "Manual"}
            onEdit={() => setEditing(l)}
          />
        ))}
        {leads.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg bg-card">
            Nenhum lead encontrado.
          </div>
        )}
      </div>

      {/* Desktop: tabela (intacta) */}
      <div className="hidden md:block rounded-lg border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="hidden md:table-cell">Cidade</TableHead>
              <TableHead className="hidden md:table-cell">Nicho</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col gap-1">
                    <span>{l.company_name}</span>
                    {Array.isArray(l.industry_tags) && l.industry_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {l.industry_tags.slice(0, 3).map((t: string) => (
                          <Badge key={t} variant="secondary" className="text-[10px] py-0 px-1.5">{formatTag(t)}</Badge>
                        ))}
                        {l.industry_tags.length > 3 && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">+{l.industry_tags.length - 3}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{l.phone_raw || "—"}</TableCell>
                <TableCell className="hidden md:table-cell">{l.city_name || "—"}</TableCell>
                <TableCell className="hidden md:table-cell">{l.niche || "—"}</TableCell>
                <TableCell>{l.status}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(l)} title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {leads.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lead encontrado.</TableCell></TableRow>
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
      {/* Mobile FAB */}
      <button
        onClick={() => setDialogOpen(true)}
        className="md:hidden fixed bottom-24 right-4 z-50 flex flex-col items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-all"
        aria-label="Novo lead"
      >
        <Plus className="h-6 w-6" />
        <span className="text-[10px] font-medium">Novo</span>
      </button>
    </div>
  );
}
