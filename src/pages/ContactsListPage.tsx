import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

interface ContactsListPageProps {
  category: "ATIVO" | "INATIVO";
  title: string;
  source: "BASE_ATIVOS" | "BASE_INATIVOS";
}

const PAGE_SIZE = 50;

export default function ContactsListPage({ category, title, source }: ContactsListPageProps) {
  const { industryId } = useIndustry();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);

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

  const [form, setForm] = useState({
    company_name: "", contact_name: "", phone_raw: "", instagram: "", address: "", city_id: "", niche: "", notes: "",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!industryId) throw new Error("Selecione um assistente primeiro.");
      const city = cities?.find(c => c.id === form.city_id);
      if (!city) throw new Error("Selecione uma cidade.");
      const phoneNorm = form.phone_raw.replace(/\D/g, "");
      const { error } = await supabase.from("contacts").insert({
        industry_id: industryId, category, company_name: form.company_name,
        company_name_normalized: form.company_name.toLowerCase().trim(),
        contact_name: form.contact_name || null, phone_raw: form.phone_raw || null,
        phone_normalized: phoneNorm || null, whatsapp_link: phoneNorm ? `https://wa.me/55${phoneNorm}` : null,
        instagram: form.instagram || null, address: form.address || null,
        city_id: form.city_id, city_name: city.name, uf: "PA", niche: form.niche || null,
        source, notes: form.notes || null, owner_user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contato criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setDialogOpen(false);
      setForm({ company_name: "", contact_name: "", phone_raw: "", instagram: "", address: "", city_id: "", niche: "", notes: "" });
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
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
              <div><Label>Empresa *</Label><Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} required /></div>
              <div><Label>Contato</Label><Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
              <div><Label>Telefone</Label><Input value={form.phone_raw} onChange={e => setForm(f => ({ ...f, phone_raw: e.target.value }))} /></div>
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
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar empresa..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Nicho</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
            {contacts.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.company_name}</TableCell>
                <TableCell>{c.contact_name || "—"}</TableCell>
                <TableCell>{c.phone_raw || "—"}</TableCell>
                <TableCell>{c.city_name || "—"}</TableCell>
                <TableCell>{c.niche || "—"}</TableCell>
                <TableCell>{c.status}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => softDeleteMutation.mutate(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && contacts.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum contato encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
