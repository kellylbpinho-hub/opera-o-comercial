import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import IndustryTagsSelector from "@/components/contacts/IndustryTagsSelector";

export interface ContactFormData {
  company_name: string;
  contact_name: string;
  phone_raw: string;
  instagram: string;
  address: string;
  city_id: string;
  niche: string;
  notes: string;
  industry_tags: string[];
}

const EMPTY_FORM: ContactFormData = {
  company_name: "", contact_name: "", phone_raw: "", instagram: "", address: "", city_id: "", niche: "", notes: "",
  industry_tags: [],
};

interface ContactFormProps {
  cities: Array<{ id: string; name: string }>;
  isPending: boolean;
  onSubmit: (form: ContactFormData) => void;
}

export default function ContactForm({ cities, isPending, onSubmit }: ContactFormProps) {
  const [form, setForm] = useState<ContactFormData>(EMPTY_FORM);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <div><Label>Empresa *</Label><Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} required /></div>
      <div><Label>Contato</Label><Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
      <div><Label>Telefone</Label><Input value={form.phone_raw} onChange={e => setForm(f => ({ ...f, phone_raw: e.target.value }))} /></div>
      <div><Label>Instagram</Label><Input value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} /></div>
      <div>
        <Label>Cidade *</Label>
        <Select value={form.city_id} onValueChange={v => setForm(f => ({ ...f, city_id: v }))}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Endereço</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
      <div><Label>Nicho principal</Label><Input value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))} placeholder="Ex: Padaria, Arquiteto, Academia..." /></div>

      <IndustryTagsSelector
        value={form.industry_tags}
        onChange={(tags) => setForm(f => ({ ...f, industry_tags: tags }))}
      />

      <div><Label>Observação</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
      <Button type="submit" className="w-full" disabled={isPending}>Salvar</Button>
    </form>
  );
}

export { EMPTY_FORM };
