import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, MapPin, Download, Loader2, ExternalLink, Star, MessageCircle } from "lucide-react";

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
  is_open?: boolean | null;
}

type SearchMode = "city" | "radius";

export default function SearchLeadsPage() {
  const { industryId, industryKey } = useIndustry();
  const { user } = useAuth();
  const [mode, setMode] = useState<SearchMode>("city");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusKm, setRadiusKm] = useState("10");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const searchMutation = useMutation({
    mutationFn: async (pageToken?: string) => {
      const body: any = { query };
      if (pageToken) {
        body.page_token = pageToken;
      } else if (mode === "city") {
        body.city = city;
      } else {
        body.lat = parseFloat(lat);
        body.lng = parseFloat(lng);
        body.radius_km = parseFloat(radiusKm);
      }

      const { data, error } = await supabase.functions.invoke("search-places", { body });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, pageToken) => {
      if (pageToken) {
        setResults(prev => [...prev, ...data.results]);
      } else {
        setResults(data.results);
        setSelected(new Set());
      }
      setNextPageToken(data.next_page_token);
      toast.success(`${data.results.length} resultados encontrados`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!industryId) throw new Error("Selecione um assistente.");
      const toImport = results.filter(r => selected.has(r.place_id));
      if (toImport.length === 0) throw new Error("Selecione ao menos um lead.");

      let imported = 0;
      let errors = 0;

      for (const place of toImport) {
        // Territory check
        const cityFromAddr = extractCity(place.address);
        const { data: tResult } = await supabase.functions.invoke("territory-guard", {
          body: { industry_key: industryKey, city_name: cityFromAddr, uf: "PA" },
        });
        if (!tResult?.allowed) { errors++; continue; }

        // Dedupe check
        const { data: dResult } = await supabase.functions.invoke("dedupe-contact", {
          body: { company_name: place.name, phone: place.phone, city_name: cityFromAddr, uf: "PA" },
        });
        if (dResult?.has_duplicates) { errors++; continue; }

        const phoneNorm = (place.phone || "").replace(/\D/g, "");
        const { error } = await supabase.from("contacts").insert({
          industry_id: industryId,
          category: "NOVO_MAPS",
          company_name: place.name,
          company_name_normalized: place.name.toLowerCase().trim(),
          phone_raw: place.phone || null,
          phone_normalized: phoneNorm || null,
          whatsapp_link: phoneNorm ? `https://wa.me/55${phoneNorm}` : null,
          website: place.website || null,
          address: place.address || null,
          city_id: tResult.city_id,
          city_name: tResult.city_name,
          uf: "PA",
          source: "MAPS",
          owner_user_id: user?.id,
        });
        if (error) { errors++; } else { imported++; }
      }

      return { imported, errors };
    },
    onSuccess: (data) => {
      toast.success(`${data.imported} leads importados, ${data.errors} com erro/duplicidade.`);
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
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map(r => r.place_id)));
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Prospecção Google Maps</h1>

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-base">Buscar estabelecimentos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === "city" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("city")}
            >
              <MapPin className="h-4 w-4 mr-1" />Por cidade
            </Button>
            <Button
              variant={mode === "radius" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("radius")}
            >
              <Search className="h-4 w-4 mr-1" />Por raio
            </Button>
          </div>

          {/* Query input */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Nicho / tipo de negócio</label>
            <Input
              placeholder="Ex: padarias, restaurantes, oficinas mecânicas..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          {mode === "city" ? (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Cidade</label>
              <Input placeholder="Ex: Belém, Ananindeua, Castanhal..." value={city} onChange={e => setCity(e.target.value)} />
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

      {/* Results */}
      {results.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{results.length} resultados</CardTitle>
              <div className="flex gap-2">
                {nextPageToken && (
                  <Button variant="outline" size="sm" onClick={() => searchMutation.mutate(nextPageToken)} disabled={searchMutation.isPending}>
                    Carregar mais
                  </Button>
                )}
                <Button size="sm" onClick={() => importMutation.mutate()} disabled={importMutation.isPending || selected.size === 0}>
                  {importMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Importar {selected.size > 0 ? `(${selected.size})` : ""}
                </Button>
              </div>
            </div>
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
                    <TableHead className="hidden md:table-cell">Avaliação</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map(r => (
                    <TableRow key={r.place_id} className={selected.has(r.place_id) ? "bg-accent/30" : ""}>
                      <TableCell>
                        <Checkbox checked={selected.has(r.place_id)} onCheckedChange={() => toggleSelect(r.place_id)} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{r.name}</div>
                        {r.website && (
                          <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />site
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{r.phone || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {r.rating ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            {r.rating} <span className="text-muted-foreground">({r.user_ratings_total})</span>
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.address}</TableCell>
                      <TableCell>
                        {r.phone && (
                          <a
                            href={`https://wa.me/55${r.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir WhatsApp"
                            className="text-accent hover:text-accent/80"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function extractCity(address: string): string {
  // Tries to extract city from Google formatted address like "R. X, 123 - Bairro, Belém - PA, 66000-000"
  const parts = address.split(" - ");
  if (parts.length >= 2) {
    const cityPart = parts[parts.length - 2].trim();
    // Remove state suffix if present
    return cityPart.split(",")[0].trim();
  }
  return address.split(",").slice(-3, -2)[0]?.trim() || "";
}
