import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileText, AlertTriangle, CheckCircle, Loader2, ShieldAlert, XCircle, Sparkles } from "lucide-react";

interface ParsedRow {
  company_name: string;
  contact_name?: string;
  phone_raw?: string;
  instagram?: string;
  address?: string;
  city_name?: string;
  niche?: string;
  category?: string;
  // Pré-análise
  is_duplicate?: boolean;
  duplicate_of?: string;
  include?: boolean; // se true, importa mesmo sendo duplicata
  error?: string;
}

const VALID_CATEGORIES = ["ATIVO", "INATIVO", "NOVO_MAPS", "NOVO_MANUAL"];

export default function ImportsPage() {
  const { industryId, industryKey } = useIndustry();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [imported, setImported] = useState(false);
  const [errors, setErrors] = useState<ParsedRow[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [showOnlyDupes, setShowOnlyDupes] = useState(false);
  const [report, setReport] = useState<{ newOk: number; dupeOk: number; dupeIgnored: number; errorsCount: number; total: number } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast.error("Arquivo vazio ou sem dados."); return; }

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const parsed: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim());
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] || ""; });

      const cat = (row.category || row.categoria || "NOVO_MAPS").toUpperCase();
      parsed.push({
        company_name: row.company_name || row.empresa || "",
        contact_name: row.contact_name || row.contato || "",
        phone_raw: row.phone_raw || row.telefone || "",
        instagram: row.instagram || "",
        address: row.address || row.endereco || "",
        city_name: row.city_name || row.cidade || "",
        niche: row.niche || row.nicho || "",
        category: VALID_CATEGORIES.includes(cat) ? cat : "NOVO_MAPS",
        include: true,
      });
    }

    setRows(parsed);
    setImported(false);
    setErrors([]);
    setReport(null);
    setShowOnlyDupes(false);

    // Pré-checar duplicatas
    if (industryId) {
      setAnalyzing(true);
      try {
        const phones = parsed.map(r => (r.phone_raw || "").replace(/\D/g, "")).filter(p => p.length >= 8);
        const names = parsed.map(r => r.company_name.toLowerCase().trim()).filter(Boolean);

        const { data: existing } = await supabase
          .from("contacts")
          .select("id, company_name, company_name_normalized, city_name, phone_normalized")
          .eq("industry_id", industryId)
          .is("deleted_at", null)
          .or(
            [
              phones.length > 0 ? `phone_normalized.in.(${phones.join(",")})` : null,
              names.length > 0 ? `company_name_normalized.in.(${names.map(n => `"${n.replace(/"/g, "")}"`).join(",")})` : null,
            ].filter(Boolean).join(",")
          );

        const phoneMap = new Map<string, string>();
        const nameMap = new Map<string, string>();
        for (const c of existing ?? []) {
          if (c.phone_normalized) phoneMap.set(c.phone_normalized, c.company_name);
          const nameKey = `${(c.company_name_normalized || c.company_name || "").toLowerCase().trim()}|${(c.city_name || "").toLowerCase().trim()}`;
          nameMap.set(nameKey, c.company_name);
        }

        const enriched = parsed.map(r => {
          const phoneNorm = (r.phone_raw || "").replace(/\D/g, "");
          const nameKey = `${r.company_name.toLowerCase().trim()}|${(r.city_name || "").toLowerCase().trim()}`;
          let dupOf: string | undefined;
          if (phoneNorm.length >= 8 && phoneMap.has(phoneNorm)) dupOf = phoneMap.get(phoneNorm);
          else if (nameMap.has(nameKey)) dupOf = nameMap.get(nameKey);
          return { ...r, is_duplicate: !!dupOf, duplicate_of: dupOf, include: !dupOf };
        });
        setRows(enriched);
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const toggleInclude = (idx: number) => {
    setRows(rs => rs.map((r, i) => i === idx ? { ...r, include: !r.include } : r));
  };

  /** Marca/desmarca em lote apenas as linhas duplicadas. */
  const setAllDuplicates = (include: boolean) => {
    setRows(rs => rs.map(r => r.is_duplicate ? { ...r, include } : r));
  };

  /** Marca/desmarca todas as linhas (duplicatas + novas). */
  const setAll = (include: boolean) => {
    setRows(rs => rs.map(r => ({ ...r, include })));
  };

  const dupCount = rows.filter(r => r.is_duplicate).length;
  const dupIncludedCount = rows.filter(r => r.is_duplicate && r.include).length;
  const toImportCount = rows.filter(r => r.include).length;

  /** Linhas exibidas após aplicar o filtro "só duplicatas". */
  const visibleRows = showOnlyDupes ? rows.filter(r => r.is_duplicate) : rows;

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!industryId) throw new Error("Selecione uma marca primeiro.");

      const errs: ParsedRow[] = [];
      const valid: any[] = [];
      let dupeOk = 0;
      let newOk = 0;
      const dupeIgnored = rows.filter(r => r.is_duplicate && !r.include).length;

      for (const row of rows) {
        if (!row.include) continue;
        if (!row.company_name) { errs.push({ ...row, error: "Empresa obrigatória" }); continue; }

        const { data: tResult } = await supabase.functions.invoke("territory-guard", {
          body: { industry_key: industryKey, city_name: row.city_name || "", uf: "PA" },
        });
        if (!tResult?.allowed) {
          errs.push({ ...row, error: tResult?.reason || "Cidade não permitida" });
          continue;
        }

        const phoneNorm = (row.phone_raw || "").replace(/\D/g, "");
        const cat = row.category || "NOVO_MAPS";
        valid.push({
          industry_id: industryId,
          category: cat,
          company_name: row.company_name,
          company_name_normalized: row.company_name.toLowerCase().trim(),
          contact_name: row.contact_name || null,
          phone_raw: row.phone_raw || null,
          phone_normalized: phoneNorm || null,
          whatsapp_link: phoneNorm ? `https://wa.me/55${phoneNorm}` : null,
          instagram: row.instagram || null,
          address: row.address || null,
          city_id: tResult.city_id,
          city_name: tResult.city_name,
          uf: "PA",
          niche: row.niche || null,
          source: cat === "ATIVO" ? "BASE_ATIVOS" : cat === "INATIVO" ? "BASE_INATIVOS" : "MAPS",
          owner_user_id: user?.id,
          notes: row.is_duplicate ? "[Importado mesmo sendo duplicata]" : null,
        });
        if (row.is_duplicate) dupeOk++;
        else newOk++;
      }

      if (valid.length > 0) {
        const { error } = await supabase.from("contacts").insert(valid);
        if (error) throw error;
      }

      setErrors(errs);
      return {
        newOk,
        dupeOk,
        dupeIgnored,
        errorsCount: errs.length,
        total: rows.length,
      };
    },
    onSuccess: (data) => {
      toast.success(`${data.newOk + data.dupeOk} contatos importados`);
      setImported(true);
      setReport(data);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Importar contatos</h1>

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-base">Upload CSV</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Colunas aceitas: <code>empresa, contato, telefone, instagram, endereco, cidade, nicho, categoria</code>
          </p>
          <p className="text-xs text-muted-foreground">
            A coluna <strong>categoria</strong> aceita: <code>ATIVO</code>, <code>INATIVO</code>, <code>NOVO_MAPS</code>, <code>NOVO_MANUAL</code>.
            Não confunda com a marca (Kapazi, Forte Plástico, Imprimax) — a marca vem do seletor de Marca no topo.
          </p>
          <Label
            htmlFor="csv-file-input"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer select-none w-full sm:w-auto"
          >
            <Upload className="h-4 w-4" />
            Selecionar arquivo
          </Label>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              handleFile(e);
              // permite re-selecionar o mesmo arquivo em seguida
              e.target.value = "";
            }}
            className="sr-only"
          />
        </CardContent>
      </Card>

      {analyzing && (
        <Card className="shadow-sm">
          <CardContent className="pt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando duplicatas com sua carteira...
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && !imported && !analyzing && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-sm text-muted-foreground">{rows.length} linhas</span>
              {dupCount > 0 && (
                <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="h-3 w-3 mr-1" />
                  {dupCount} já na carteira
                </Badge>
              )}
              <Badge variant="secondary">{toImportCount} a importar</Badge>
            </div>
            <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending || toImportCount === 0}>
              <FileText className="h-4 w-4 mr-2" />
              {importMutation.isPending ? "Importando..." : `Importar ${toImportCount}`}
            </Button>
          </div>

          {dupCount > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Linhas duplicadas estão desmarcadas por padrão. Use os botões abaixo para decidir em lote o que fazer com as <strong>{dupCount}</strong> duplicatas detectadas
                {dupIncludedCount > 0 && <> ({dupIncludedCount} marcadas para importar)</>}.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setAllDuplicates(true)}>
                  Importar todas as duplicatas
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAllDuplicates(false)}>
                  Ignorar todas as duplicatas
                </Button>
                <span className="mx-1 h-6 w-px bg-border self-center" />
                <Button size="sm" variant="ghost" onClick={() => setAll(true)}>
                  Selecionar todas
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAll(false)}>
                  Desmarcar todas
                </Button>
              </div>
            </div>
          )}

          {dupCount > 0 && (
            <div className="flex items-center gap-2 px-1">
              <Switch
                id="only-dupes"
                checked={showOnlyDupes}
                onCheckedChange={setShowOnlyDupes}
              />
              <Label htmlFor="only-dupes" className="text-sm cursor-pointer">
                Mostrar apenas duplicatas
              </Label>
              <span className="text-xs text-muted-foreground ml-auto">
                Exibindo {visibleRows.length} de {rows.length}
              </span>
            </div>
          )}

          <div className="rounded-lg border bg-card shadow-sm overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Importar</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="hidden sm:table-cell">Cidade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.slice(0, 200).map((r) => {
                  const realIdx = rows.indexOf(r);
                  return (
                    <TableRow key={realIdx} className={r.is_duplicate ? "bg-amber-500/5" : ""}>
                      <TableCell>
                        <Checkbox checked={!!r.include} onCheckedChange={() => toggleInclude(realIdx)} />
                      </TableCell>
                      <TableCell className="font-medium">{r.company_name}</TableCell>
                      <TableCell>{r.phone_raw || "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">{r.city_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{r.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.is_duplicate ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 text-xs">
                            ⚠️ Já na carteira
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Novo</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {visibleRows.length > 200 && (
              <p className="text-xs text-muted-foreground p-2 text-center">Mostrando 200 de {visibleRows.length} linhas. Todas serão processadas.</p>
            )}
            {visibleRows.length === 0 && (
              <p className="text-sm text-muted-foreground p-6 text-center">Nenhuma linha para exibir com o filtro atual.</p>
            )}
          </div>
        </>
      )}

      {imported && report && (
        <Card className="shadow-sm border-accent/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              Resumo da importação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md border p-3 bg-card">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5 text-accent" />
                  Novos importados
                </div>
                <p className="text-2xl font-bold mt-1">{report.newOk}</p>
              </div>
              <div className="rounded-md border border-amber-500/30 p-3 bg-amber-500/5">
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Duplicatas importadas
                </div>
                <p className="text-2xl font-bold mt-1">{report.dupeOk}</p>
              </div>
              <div className="rounded-md border p-3 bg-muted/30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5" />
                  Duplicatas ignoradas
                </div>
                <p className="text-2xl font-bold mt-1">{report.dupeIgnored}</p>
              </div>
              <div className="rounded-md border p-3 bg-card">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  Total processado
                </div>
                <p className="text-2xl font-bold mt-1">{report.total}</p>
              </div>
            </div>
            {report.errorsCount > 0 && (
              <p className="text-xs text-destructive mt-3 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {report.errorsCount} linha(s) com erro — veja detalhes abaixo.
              </p>
            )}
          </CardContent>
        </Card>
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
