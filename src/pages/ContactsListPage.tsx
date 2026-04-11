import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, ChevronLeft, ChevronRight, Users } from "lucide-react";
import ContactForm, { type ContactFormData } from "@/components/contacts/ContactForm";
import ContactsTable from "@/components/contacts/ContactsTable";
import DupeModal, { type DupeCandidate } from "@/components/contacts/DupeModal";

interface ContactsListPageProps {
  category: "ATIVO" | "INATIVO";
  title: string;
  source: "BASE_ATIVOS" | "BASE_INATIVOS";
}

const PAGE_SIZE = 50;

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

  const { data: cities } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data } = await supabase.from("cities").select("*").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: contactsData, isLoading } = useQuery({
    queryKey: ["contacts", category, industryId, search, page],
    queryFn: async () => {
      let q = supabase.from("contacts").select("*", { count: "exact" })
        .eq("category", category)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (industryId) q = q.eq("industry_id", industryId);
      if (search) q = q.ilike("company_name", `%${search}%`);
      const { data, count } = await q;
      return { contacts: data ?? [], total: count ?? 0 };
    },
  });

  const contacts = contactsData?.contacts ?? [];
  const totalPages = Math.ceil((contactsData?.total ?? 0) / PAGE_SIZE);

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
        // If dedup fails, proceed (non-blocking)
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

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
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

      <DupeModal
        open={showDupeModal}
        onOpenChange={setShowDupeModal}
        dupes={dupes}
        onForceCreate={(j) => forceCreateMutation.mutate(j)}
        isPending={forceCreateMutation.isPending}
      />

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar empresa..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      </div>

      {!isLoading && contacts.length === 0 && !search && (
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

      {(contacts.length > 0 || search) && (
        <ContactsTable
          contacts={contacts}
          isLoading={isLoading}
          search={search}
          onDelete={(id) => softDeleteMutation.mutate(id)}
        />
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
    </div>
  );
}
