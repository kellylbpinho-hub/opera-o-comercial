import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, ChevronLeft, ChevronRight, Users, Download, Trash2, Filter, ExternalLink, Instagram, MessageCircle, Pencil } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ContactForm, { type ContactFormData } from "@/components/contacts/ContactForm";
import DupeModal, { type DupeCandidate } from "@/components/contacts/DupeModal";
import ContactCard from "@/components/contacts/ContactCard";
import { downloadCSV } from "@/lib/csv-export";
import { buildWhatsappLink, getWhatsappMessage, PROFILE_LABELS, getClientProfile, INDUSTRY_CATALOG, formatTag } from "@/lib/whatsapp-messages";

interface ContactsListPageProps {
  category: "ATIVO" | "INATIVO";
  title: string;
  source: "BASE_ATIVOS" | "BASE_INATIVOS";
}

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "NAO_CONTATADO", label: "Não Contatado" },
  { value: "CONTATADO", label: "Contatado" },
  { value: "RESPONDEU", label: "Respondeu" },
  { value: "QUALIFICADO", label: "Qualificado" },
  { value: "SEM_INTERESSE", label: "Sem Interesse" },
];

export default function ContactsListPage({ category, title, source }: ContactsListPageProps) {
  const { industryId, industryKey } = useIndustry();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [dupes, setDupes] = useState<DupeCandidate[]>([]);
  const [showDupeModal, setShowDupeModal] = useState(false);
  const [pendingForm, setPendingForm] = useState<ContactFormData | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterCity, setFilterCity] = useState("all");
  const [filterNiche, setFilterNiche] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);

  const { data: cities } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data } = await supabase.from("cities").select("*").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: contactsData, isLoading } = useQuery({
    queryKey: ["contacts", category, industryId, search, page, filterCity, filterNiche, filterStatus, filterTag],
    queryFn: async () => {
      let q = supabase.from("contacts").select("*", { count: "exact" })
        .eq("category", category)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (industryId) q = q.eq("industry_id", industryId);
      if (search) q = q.ilike("company_name", `%${search}%`);
      if (filterCity !== "all") q = q.eq("city_name", filterCity);
      if (filterNiche !== "all") q = q.eq("niche", filterNiche);
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      if (filterTag !== "all") q = q.contains("industry_tags", [filterTag]);
      const { data, count } = await q;
      return { contacts: data ?? [], total: count ?? 0 };
    },
  });

  // Get unique niches & cities for filters
  const { data: nicheOptions } = useQuery({
    queryKey: ["contact-niches", category, industryId],
    queryFn: async () => {
      let q = supabase.from("contacts").select("niche").eq("category", category).is("deleted_at", null).not("niche", "is", null);
      if (industryId) q = q.eq("industry_id", industryId);
      const { data } = await q;
      const niches = [...new Set((data ?? []).map(d => d.niche).filter(Boolean))] as string[];
      return niches.sort();
    },
  });

  const { data: cityOptions } = useQuery({
    queryKey: ["contact-cities", category, industryId],
    queryFn: async () => {
      let q = supabase.from("contacts").select("city_name").eq("category", category).is("deleted_at", null).not("city_name", "is", null);
      if (industryId) q = q.eq("industry_id", industryId);
      const { data } = await q;
      const cs = [...new Set((data ?? []).map(d => d.city_name).filter(Boolean))] as string[];
      return cs.sort();
    },
  });

  const contacts = contactsData?.contacts ?? [];
  const totalPages = Math.ceil((contactsData?.total ?? 0) / PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map(c => c.id)));
    }
  };

  const doInsert = async (form: ContactFormData, force = false, justification = "") => {
    if (!industryId) throw new Error("Selecione um assistente primeiro.");
    const city = cities?.find(c => c.id === form.city_id);
    if (!city) throw new Error("Selecione uma cidade.");

    try {
      const { data: tResult, error: tErr } = await supabase.functions.invoke("territory-guard", {
        body: { industry_key: industryKey, city_name: city.name, uf: "PA" },
      });
      if (tErr) throw new Error("Erro ao validar território. Tente novamente.");
      if (tResult && !tResult.allowed) throw new Error(tResult.reason);
    } catch (e: any) {
      if (e.message?.includes("território") || e.message?.includes("allowed")) throw e;
      throw new Error("Falha na validação de território. Verifique sua conexão.");
    }

    if (!force) {
      try {
        const { data: dResult, error: dErr } = await supabase.functions.invoke("dedupe-contact", {
          body: { company_name: form.company_name, phone: form.phone_raw, city_name: city.name, uf: "PA" },
        });
        if (!dErr && dResult?.has_duplicates) {
          setDupes(dResult.duplicates);
          setPendingForm(form);
          setShowDupeModal(true);
          return "DUPE_FOUND";
        }
      } catch {
        // non-blocking
      }
    }

    const phoneNorm = form.phone_raw.replace(/\D/g, "");
    const { error } = await supabase.from("contacts").insert({
      industry_id: industryId, category, company_name: form.company_name,
      company_name_normalized: form.company_name.toLowerCase().trim(),
      contact_name: form.contact_name || null, phone_raw: form.phone_raw || null,
      phone_normalized: phoneNorm || null, whatsapp_link: phoneNorm ? `https://wa.me/55${phoneNorm}` : null,
      instagram: form.instagram || null, address: form.address || null,
      city_id: form.city_id, city_name: city.name, uf: "PA", niche: form.niche || null,
      source, notes: force ? `[Forçado] ${justification}\n${form.notes || ""}` : (form.notes || null),
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
      toast.success("Contato criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const forceCreateMutation = useMutation({
    mutationFn: (justification: string) => {
      if (!pendingForm) throw new Error("Formulário não encontrado.");
      return doInsert(pendingForm, true, justification);
    },
    onSuccess: () => {
      toast.success("Contato criado (forçado)!");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setDialogOpen(false);
      setShowDupeModal(false);
      setPendingForm(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const softDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contato removido.");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const now = new Date().toISOString();
      for (const id of ids) {
        const { error } = await supabase.from("contacts").update({ deleted_at: now }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${selected.size} contatos removidos.`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
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
      toast.success("Contato atualizado!");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setEditing(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleExportCSV = () => {
    if (contacts.length === 0) { toast.error("Nenhum contato para exportar."); return; }
    const exportData = contacts.map(c => ({
      Empresa: c.company_name,
      Contato: c.contact_name || "",
      Telefone: c.phone_raw || "",
      Cidade: c.city_name || "",
      Nicho: c.niche || "",
      Status: c.status,
      Instagram: c.instagram || "",
      Endereço: c.address || "",
    }));
    downloadCSV(exportData, `${title.toLowerCase()}_${new Date().toISOString().split("T")[0]}`);
    toast.success("CSV exportado!");
  };

  const activeFilters = [filterCity, filterNiche, filterStatus, filterTag].filter(f => f !== "all").length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" />CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Novo {title}</DialogTitle></DialogHeader>
              <ContactForm
                cities={cities ?? []}
                isPending={createMutation.isPending}
                onSubmit={(form) => createMutation.mutate(form)}
              />
            </DialogContent>
          </Dialog>
        </div>
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
          <DialogHeader><DialogTitle>Editar contato</DialogTitle></DialogHeader>
          {editing && (
            <ContactForm
              cities={cities ?? []}
              isPending={updateMutation.isPending}
              submitLabel="Salvar alterações"
              initialData={{
                company_name: editing.company_name ?? "",
                contact_name: editing.contact_name ?? "",
                phone_raw: editing.phone_raw ?? "",
                instagram: editing.instagram ?? "",
                address: editing.address ?? "",
                city_id: editing.city_id ?? "",
                niche: editing.niche ?? "",
                notes: editing.notes ?? "",
                industry_tags: editing.industry_tags ?? [],
              }}
              onSubmit={(form) => updateMutation.mutate(form)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover contato?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `O contato "${deleting.company_name}" será removido.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleting) return;
                softDeleteMutation.mutate(deleting.id);
                setDeleting(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar empresa..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Button
          variant={activeFilters > 0 ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4 mr-1" />
          Filtros{activeFilters > 0 ? ` (${activeFilters})` : ""}
        </Button>
      </div>

      {showFilters && (
        <div className="flex gap-2 flex-wrap p-3 rounded-lg border bg-muted/30">
          <Select value={filterCity} onValueChange={v => { setFilterCity(v); setPage(0); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Cidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas cidades</SelectItem>
              {cityOptions?.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterNiche} onValueChange={v => { setFilterNiche(v); setPage(0); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Nicho" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos nichos</SelectItem>
              {nicheOptions?.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTag} onValueChange={v => { setFilterTag(v); setPage(0); }}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Indústria/Nicho" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas indústrias</SelectItem>
              {INDUSTRY_CATALOG.map(ind => (
                <div key={ind.brand}>
                  {ind.niches.map(n => {
                    const tag = `${ind.brand}:${n}`;
                    return <SelectItem key={tag} value={tag}>{ind.brandLabel} · {n}</SelectItem>;
                  })}
                </div>
              ))}
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterCity("all"); setFilterNiche("all"); setFilterStatus("all"); setFilterTag("all"); setPage(0); }}>
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-2 rounded-lg border bg-primary/5">
          <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />Remover selecionados
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover {selected.size} contatos?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação pode ser desfeita pelo administrador.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => bulkDeleteMutation.mutate([...selected])}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Cancelar</Button>
        </div>
      )}

      {!isLoading && contacts.length === 0 && !search && activeFilters === 0 && (
        <Card className="shadow-sm border-dashed">
          <CardContent className="pt-6 flex flex-col items-center gap-3 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhum {category === "ATIVO" ? "cliente ativo" : "cliente inativo"} cadastrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Clique em "Novo" para adicionar manualmente ou use a página de Importações para carregar um CSV.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {(contacts.length > 0 || search || activeFilters > 0) && (
        <>
          {/* Mobile: cards */}
          <div className="block md:hidden space-y-2">
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="shadow-sm"><CardContent className="p-3"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))}
            {!isLoading && contacts.map(c => (
              <ContactCard
                key={c.id}
                contact={c}
                categoryLabel={category}
                selected={selected.has(c.id)}
                onToggleSelect={() => toggleSelect(c.id)}
                onEdit={() => setEditing(c)}
                onRemove={() => setDeleting(c)}
              />
            ))}
            {!isLoading && contacts.length === 0 && (search || activeFilters > 0) && (
              <Card className="shadow-sm"><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum contato encontrado.</CardContent></Card>
            )}
          </div>

          {/* Desktop: tabela (intacta) */}
          <div className="hidden md:block rounded-lg border bg-card shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={contacts.length > 0 && selected.size === contacts.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="min-w-[140px]">Empresa</TableHead>
                  <TableHead className="hidden sm:table-cell">Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="hidden md:table-cell">Cidade</TableHead>
                  <TableHead className="hidden lg:table-cell">Nicho</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Links</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))}
                {!isLoading && contacts.map(c => (
                  <TableRow key={c.id} className={selected.has(c.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{c.company_name}</span>
                        {Array.isArray(c.industry_tags) && c.industry_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {c.industry_tags.slice(0, 3).map((t: string) => (
                              <Badge key={t} variant="secondary" className="text-[10px] py-0 px-1.5">{formatTag(t)}</Badge>
                            ))}
                            {c.industry_tags.length > 3 && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5">+{c.industry_tags.length - 3}</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{c.contact_name || "—"}</TableCell>
                    <TableCell>{c.phone_raw || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{c.city_name || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{c.niche || "—"}</TableCell>
                    <TableCell>{c.status}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex gap-1">
                        {(c.phone_normalized || c.phone_raw) && (
                          <a
                            href={buildWhatsappLink(c.phone_normalized || c.phone_raw, getWhatsappMessage(c)) || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`WhatsApp · ${PROFILE_LABELS[getClientProfile(c)]}`}
                            className="text-accent hover:text-accent/80"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        )}
                        {c.instagram && (
                          <a
                            href={c.instagram.startsWith("http") ? c.instagram : `https://instagram.com/${c.instagram.replace(/^@/, "")}`}
                            target="_blank" rel="noopener noreferrer" title="Instagram"
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Instagram className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(c)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover contato?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O contato "{c.company_name}" será removido.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => softDeleteMutation.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && contacts.length === 0 && (search || activeFilters > 0) && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum contato encontrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{contactsData?.total} contatos · Página {page + 1} de {totalPages}</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {/* Mobile FAB */}
      <button
        onClick={() => setDialogOpen(true)}
        className="md:hidden fixed bottom-24 right-4 z-50 flex flex-col items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-all"
        aria-label="Novo contato"
      >
        <Plus className="h-6 w-6" />
        <span className="text-[10px] font-medium">Novo</span>
      </button>
    </div>
  );
}
