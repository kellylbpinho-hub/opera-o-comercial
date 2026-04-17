import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Search, MapPin, Download, Loader2, ExternalLink, Star, MessageCircle, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface PlaceResult {
  place_id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  lat?: number;
  lng?: number;
}

interface ImportResult {
  place_id: string;
  name: string;
  status: "imported" | "territory" | "duplicate" | "error";
  reason?: string;
}

type SearchMode = "city" | "radius";

function extractCity(address: string): string {
  const ufMatch = address.match(/,?\s*([^,\-]+?)\s*-\s*[A-Z]{2}\s*[,]/i);
  if (ufMatch) return ufMatch[1].trim();
  const parts = address.split(" - ");
  if (parts.length >= 2) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const stateMatch = parts[i].trim().match(/^[A-Z]{2}(\s|,|$)/);
      if (stateMatch && i > 0) {
        return parts[i - 1].split(",").pop()?.trim() || "";
      }
    }
    return parts[parts.length - 2].split(",").pop()?.trim() || "";
  }
  return "";
}

export default function SearchLeadsPage() {
  const { industryId, industryKey } = useIndustry();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<SearchMode>("city");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusKm, setRadiusKm] = useState("10");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [cityOverrides, setCityOverrides] = useState<Record<string, string>>({});
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importResults, setImportResults] = useState<ImportResult[]>([]);

  // Auto-extract cities when results change
  useEffect(() => {
    const overrides: Record<string, string> = {};
    for (const r of results) {
      if (!cityOverrides[r.place_id]) {
        overrides[r.place_id] = extractCity(r.address) || city;
      }
    }
    if (Object.keys(overrides).length > 0) {
      setCityOverrides(prev => ({ ...overrides, ...prev }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const searchMutation = useMutation({
    mutationFn: async (pageToken?: string) => {
      const body: any = { query };
      if (pageToken) body.page_token = pageToken;
      else if (mode === "city") body.city = city;
      else { body.lat = parseFloat(lat); body.lng = parseFloat(lng); body.radius_km = parseFloat(radiusKm); }

      const { data, error } = await supabase.functions.invoke("search-places", { body });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, pageToken) => {
      if (pageToken) {
        setResults(prev => [...prev, ...data.results]);
        // Auto-select newly loaded results too
        setSelected(prev => {
          const next = new Set(prev);
          data.results.forEach((r: PlaceResult) => next.add(r.place_id));
          return next;
        });
      } else {
        setResults(data.results);
        // Auto-select ALL results so user only needs to click "Import"
        setSelected(new Set(data.results.map((r: PlaceResult) => r.place_id)));
        setImportResults([]);
        setCityOverrides({});
      }
      setNextPageToken(data.next_page_token);
      toast.success(`${data.results.length} resultados encontrados — todos selecionados. Clique em "Importar" para salvar.`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!industryId) throw new Error("Selecione um assistente.");
      const toImport = results.filter(r => selected.has(r.place_id));
      if (toImport.length === 0) throw new Error("Selecione ao menos um lead.");

      const leads = toImport.map(p => ({
        place_id: p.place_id,
        name: p.name,
        phone: p.phone,
        website: p.website,
        address: p.address,
        city_name: cityOverrides[p.place_id] || extractCity(p.address) || city,
      }));

      const { data, error } = await supabase.functions.invoke("import-leads", {
        body: { industry_id: industryId, industry_key: industryKey, leads },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const { summary, results: importRes } = data;
      setImportResults(importRes);
      
      if (summary.imported > 0) {
        toast.success(`✓ ${summary.imported} importados${summary.territory > 0 ? `, ${summary.territory} fora do território` : ""}${summary.duplicates > 0 ? `, ${summary.duplicates} duplicados` : ""}`);
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        // Remove imported from results
        const importedIds = new Set(importRes.filter((r: ImportResult) => r.status === "imported").map((r: ImportResult) => r.place_id));
        setResults(prev => prev.filter(r => !importedIds.has(r.place_id)));
      } else {
        toast.error(`Nenhum lead importado. ${summary.territory} fora do território, ${summary.duplicates} duplicados, ${summary.errors} erros`);
      }
      setSelected(new Set());
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleSelect = (placeId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(placeId) ? next.delete(placeId) : next.add(placeId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map(r => r.place_id)));
  };

  const getResultStatus = (placeId: string): ImportResult | undefined => {
    return importResults.find(r => r.place_id === placeId);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Prospecção Google Maps</h1>

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-base">Buscar estabelecimentos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant={mode === "city" ? "default" : "outline"} size="sm" onClick={() => setMode("city")}>
              <MapPin className="h-4 w-4 mr-1" />Por cidade
            </Button>
            <Button variant={mode === "radius" ? "default" : "outline"} size="sm" onClick={() => setMode("radius")}>
              <Search className="h-4 w-4 mr-1" />Por raio
            </Button>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Nicho / tipo de negócio</label>
            <Input placeholder="Ex: padarias, restaurantes..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>

          {mode === "city" ? (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Cidade</label>
              <Input placeholder="Ex: Belém, Ananindeua..." value={city} onChange={e => setCity(e.target.value)} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Latitude</label>
                <Input placeholder="-1.4557" value={lat} onChange={e => setLat(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Longitude</label>
                <Input placeholder="-48.5024" value={lng} onChange={e => setLng(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Raio (km)</label>
                <Input type="number" value={radiusKm} onChange={e => setRadiusKm(e.target.value)} />
              </div>
            </div>
          )}

          <Button onClick={() => searchMutation.mutate(undefined)} disabled={searchMutation.isPending || !query}>
            {searchMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">{results.length} resultados</CardTitle>
              <div className="flex gap-2 flex-wrap">
                {nextPageToken && (
                  <Button variant="outline" size="sm" onClick={() => searchMutation.mutate(nextPageToken)} disabled={searchMutation.isPending}>
                    Carregar mais
                  </Button>
                )}
                <Button size="lg" onClick={() => importMutation.mutate()} disabled={importMutation.isPending || selected.size === 0} className="font-semibold">
                  {importMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Importar {selected.size > 0 ? `(${selected.size})` : ""} para Novos Leads
                </Button>
              </div>
            </div>
            {importMutation.isPending && (
              <div className="space-y-1">
                <Progress value={50} className="h-2" />
                <p className="text-xs text-muted-foreground">Validando território, deduplicando e inserindo...</p>
              </div>
            )}
            {!importMutation.isPending && importResults.length === 0 && (
              <div className="rounded-md bg-primary/10 border border-primary/20 p-3 text-sm">
                <p className="font-medium text-primary">📋 Como salvar estes leads:</p>
                <ol className="text-xs text-muted-foreground mt-1 ml-4 list-decimal space-y-0.5">
                  <li>Confirme/corrija a <strong>Cidade</strong> (deve estar no território)</li>
                  <li>Desmarque os que não quiser (todos já vêm selecionados)</li>
                  <li>Clique em <strong>"Importar para Novos Leads"</strong></li>
                </ol>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-x-auto max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={selected.size === results.length && results.length > 0} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">Telefone</TableHead>
                    <TableHead>Cidade (editável)</TableHead>
                    <TableHead className="hidden lg:table-cell">Endereço</TableHead>
                    <TableHead className="w-16">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map(r => {
                    const status = getResultStatus(r.place_id);
                    return (
                      <TableRow key={r.place_id} className={selected.has(r.place_id) ? "bg-accent/30" : ""}>
                        <TableCell>
                          <Checkbox checked={selected.has(r.place_id)} onCheckedChange={() => toggleSelect(r.place_id)} />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{r.name}</div>
                          {r.rating && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              {r.rating} ({r.user_ratings_total})
                            </span>
                          )}
                          {r.website && (
                            <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" />site
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.phone ? (
                            <div className="flex items-center gap-2">
                              <span>{r.phone}</span>
                              <a href={`https://wa.me/55${r.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-accent">
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-sm"
                            value={cityOverrides[r.place_id] ?? ""}
                            onChange={e => setCityOverrides(prev => ({ ...prev, [r.place_id]: e.target.value }))}
                            placeholder="Cidade"
                          />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[250px] truncate">{r.address}</TableCell>
                        <TableCell>
                          {status?.status === "imported" && (
                            <span title="Importado"><CheckCircle2 className="h-4 w-4 text-green-600" /></span>
                          )}
                          {status?.status === "territory" && (
                            <span title={status.reason}><XCircle className="h-4 w-4 text-destructive" /></span>
                          )}
                          {status?.status === "duplicate" && (
                            <span title={status.reason}><AlertCircle className="h-4 w-4 text-yellow-600" /></span>
                          )}
                          {status?.status === "error" && (
                            <span title={status.reason}><XCircle className="h-4 w-4 text-destructive" /></span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {importResults.length > 0 && (
              <div className="mt-3 space-y-1">
                {importResults.filter(r => r.status !== "imported").map(r => (
                  <div key={r.place_id} className="text-xs text-muted-foreground flex items-start gap-2">
                    {r.status === "duplicate" && <AlertCircle className="h-3 w-3 text-yellow-600 mt-0.5 shrink-0" />}
                    {r.status === "territory" && <XCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />}
                    {r.status === "error" && <XCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />}
                    <span><strong>{r.name}:</strong> {r.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
