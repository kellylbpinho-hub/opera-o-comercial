import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchResult {
  id: string;
  company_name: string;
  city_name: string | null;
  category: string;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("contacts")
        .select("id, company_name, city_name, category")
        .is("deleted_at", null)
        .ilike("company_name", `%${query}%`)
        .limit(8);
      setResults(data ?? []);
      setOpen(true);
      setLoading(false);
    }, 300);
  }, [query]);

  const categoryRoute: Record<string, string> = {
    ATIVO: "/ativos",
    INATIVO: "/inativos",
    LEAD: "/leads",
  };

  const pick = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate(categoryRoute[r.category] || "/leads");
  };

  return (
    <div ref={ref} className="relative w-full max-w-xs">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Buscar contato..."
        className="pl-8 pr-8 h-9 text-sm"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {query && (
        <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      )}
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-popover border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => pick(r)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 flex justify-between items-center"
            >
              <span className="font-medium truncate">{r.company_name}</span>
              <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                {r.city_name || ""} · {r.category}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-popover border rounded-md shadow-lg z-50 p-3 text-sm text-muted-foreground text-center">
          Nenhum resultado encontrado
        </div>
      )}
    </div>
  );
}
