import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function similarity(a: string, b: string): number {
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1.0;
  if (!al || !bl) return 0;

  // Simple bigram similarity
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.substring(i, i + 2));
    return set;
  };
  const aSet = bigrams(al);
  const bSet = bigrams(bl);
  let intersection = 0;
  for (const bg of aSet) if (bSet.has(bg)) intersection++;
  return (2 * intersection) / (aSet.size + bSet.size);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { company_name, phone, city_name, uf } = await req.json();
    const candidates: any[] = [];

    // 1. Exact phone match (highest confidence)
    if (phone) {
      const phoneNorm = phone.replace(/\D/g, "");
      if (phoneNorm) {
        const { data } = await supabase
          .from("contacts")
          .select("id, company_name, category, city_name, phone_raw, phone_normalized")
          .eq("phone_normalized", phoneNorm)
          .is("deleted_at", null)
          .limit(5);
        for (const row of data ?? []) {
          candidates.push({ ...row, confidence: 0.95, match_type: "phone_exact" });
        }
      }
    }

    // 2. Company name + city fuzzy match
    if (company_name && city_name) {
      const compNorm = company_name.toLowerCase().trim();
      const { data } = await supabase
        .from("contacts")
        .select("id, company_name, company_name_normalized, category, city_name, phone_raw")
        .eq("city_name", city_name)
        .is("deleted_at", null)
        .limit(100);

      for (const row of data ?? []) {
        if (candidates.some(c => c.id === row.id)) continue;
        const sim = similarity(compNorm, row.company_name_normalized || row.company_name);
        if (sim >= 0.6) {
          candidates.push({ ...row, confidence: Math.round(sim * 100) / 100, match_type: sim === 1 ? "name_exact" : "name_fuzzy" });
        }
      }
    }

    // Sort by confidence desc
    candidates.sort((a, b) => b.confidence - a.confidence);

    const suggestions = candidates.map(c => ({
      ...c,
      suggested_action: c.category === "INATIVO" ? "REATIVACAO" : c.confidence >= 0.9 ? "BLOQUEAR" : "REVISAR",
    }));

    return new Response(JSON.stringify({ duplicates: suggestions.slice(0, 10), has_duplicates: suggestions.length > 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, duplicates: [], has_duplicates: false }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
