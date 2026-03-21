import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileText, AlertTriangle, CheckCircle } from "lucide-react";

interface ParsedRow {
  company_name: string;
  contact_name?: string;
  phone_raw?: string;
  instagram?: string;
  address?: string;
  city_name?: string;
  niche?: string;
  category?: string;
  error?: string;
}

export default function ImportsPage() {
  const { industryId, industryKey } = useIndustry();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [imported, setImported] = useState(false);
  const [errors, setErrors] = useState<ParsedRow[]>([]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { toast.error("Arquivo vazio ou sem dados."); return; }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const parsed: ParsedRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim());
        const row: any = {};
        headers.forEach((h, idx) => { row[h] = cols[idx] || ""; });

        parsed.push({
          company_name: row.company_name || row.empresa || "",
          contact_name: row.contact_name || row.contato || "",
          phone_raw: row.phone_raw || row.telefone || "",
          instagram: row.instagram || "",
          address: row.address || row.endereco || "",
          city_name: row.city_name || row.cidade || "",
          niche: row.niche || row.nicho || "",
          category: row.category || row.categoria || "NOVO_MAPS",
        });
      }

      setRows(parsed);
      setImported(false);
      setErrors([]);
    };
    reader.readAsText(file);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!industryId) throw new Error("Selecione um assistente.");

      const { data: allCities } = await supabase.from("cities").select("*");
      const cityMap = new Map((allCities ?? []).map(c => [c.name.toLowerCase(), c]));
      const errs: ParsedRow[] = [];
      const valid: any[] = [];

      for (const row of rows) {
        if (!row.company_name) { errs.push({ ...row, error: "Empresa obrigatória" }); continue; }
        const city = cityMap.get((row.city_name || "").toLowerCase());
        if (!city) { errs.push({ ...row, error: `Cidade "${row.city_name}" não encontrada` }); continue; }
        if (city.uf !== "PA") { errs.push({ ...row, error: "Fora do PA" }); continue; }
        if (industryKey === "KAPAZI" && !city.is_kapazi_allowed) { errs.push({ ...row, error: "Cidade fora do território Kapazi" }); continue; }

        const phoneNorm = (row.phone_raw || "").replace(/\D/g, "");
        valid.push({
          industry_id: industryId,
          category: row.category || "NOVO_MAPS",
          company_name: row.company_name,
          company_name_normalized: row.company_name.toLowerCase().trim(),
          contact_name: row.contact_name || null,
          phone_raw: row.phone_raw || null,
          phone_normalized: phoneNorm || null,
          whatsapp_link: phoneNorm ? `https://wa.me/55${phoneNorm}` : null,
          instagram: row.instagram || null,
          address: row.address || null,
          city_id: city.id,
          city_name: city.name,
          uf: "PA",
          niche: row.niche || null,
          source: row.category === "ATIVO" ? "BASE_ATIVOS" as const : row.category === "INATIVO" ? "BASE_INATIVOS" as const : "MAPS" as const,
          owner_user_id: user?.id,
        });
      }

      if (valid.length > 0) {
        const { error } = await supabase.from("contacts").insert(valid);
        if (error) throw error;
      }

      setErrors(errs);
      return { imported: valid.length, errors: errs.length };
    },
    onSuccess: (data) => {
      toast.success(`${data.imported} importados, ${data.errors} com erro.`);
      setImported(true);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Importações</h1>

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-base">Upload CSV</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Colunas: empresa, contato, telefone, instagram, endereco, cidade, nicho, categoria
          </p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />Selecionar arquivo
          </Button>
        </CardContent>
      </Card>

      {rows.length > 0 && !imported && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{rows.length} linhas encontradas</p>
            <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
              <FileText className="h-4 w-4 mr-2" />Importar
            </Button>
          </div>
          <div className="rounded-lg border bg-card shadow-sm overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Categoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 50).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.company_name}</TableCell>
                    <TableCell>{r.phone_raw}</TableCell>
                    <TableCell>{r.city_name}</TableCell>
                    <TableCell>{r.category}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {imported && errors.length > 0 && (
        <Card className="shadow-sm border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />Erros na importação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-x-auto max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.company_name}</TableCell>
                      <TableCell>{e.city_name}</TableCell>
                      <TableCell><Badge variant="destructive">{e.error}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {imported && errors.length === 0 && (
        <Card className="shadow-sm border-accent/30">
          <CardContent className="pt-6 flex items-center gap-2 text-accent">
            <CheckCircle className="h-5 w-5" />
            <span>Todas as linhas importadas com sucesso!</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
