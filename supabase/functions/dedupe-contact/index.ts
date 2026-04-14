import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { company_name, phone, city_name } = await req.json();
    const candidates: any[] = [];

    // 1. Exact phone match (only if phone is provided and non-empty)
    const phoneNorm = (phone || "").replace(/\D/g, "");
    if (phoneNorm.length >= 8) {
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

    // 2. Exact company name + city match (case-insensitive)
    if (company_name && city_name) {
      const compNorm = company_name.toLowerCase().trim();
      const cityNorm = city_name.toLowerCase().trim().replace(/\s*-\s*[a-z]{2}\s*$/i, "");

      const { data } = await supabase
        .from("contacts")
        .select("id, company_name, company_name_normalized, category, city_name, phone_raw")
        .is("deleted_at", null)
        .limit(200);

      for (const row of data ?? []) {
        if (candidates.some(c => c.id === row.id)) continue;
        const rowName = (row.company_name_normalized || row.company_name || "").toLowerCase().trim();
        const rowCity = (row.city_name || "").toLowerCase().trim();
        if (rowName === compNorm && rowCity === cityNorm) {
          candidates.push({ ...row, confidence: 1.0, match_type: "name_city_exact" });
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
