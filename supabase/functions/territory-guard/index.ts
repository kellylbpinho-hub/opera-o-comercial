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

    const { industry_key, city_name, uf } = await req.json();

    if (!industry_key || !city_name) {
      return new Response(JSON.stringify({ allowed: false, reason: "industry_key e city_name são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UF check
    if (uf && uf.toUpperCase() !== "PA") {
      return new Response(JSON.stringify({ allowed: false, reason: "Território restrito ao estado do Pará (PA)." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize city name: remove state suffix like "- PA", trim
    const cityNorm = city_name.replace(/\s*-\s*[A-Z]{2}\s*$/i, "").trim();

    // Find city
    const { data: cities } = await supabase
      .from("cities")
      .select("id, name, is_kapazi_allowed, is_active")
      .ilike("name", cityNorm)
      .limit(1);

    if (!cities || cities.length === 0) {
      return new Response(JSON.stringify({ allowed: false, reason: `Cidade "${city_name}" não encontrada no território.` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const city = cities[0];
    if (!city.is_active) {
      return new Response(JSON.stringify({ allowed: false, reason: `Cidade "${city.name}" está inativa.` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Kapazi territory check
    if (industry_key.toUpperCase() === "KAPAZI" && !city.is_kapazi_allowed) {
      return new Response(JSON.stringify({ allowed: false, reason: "Cidade fora do território do assistente Kapazi." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ allowed: true, city_id: city.id, city_name: city.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ allowed: false, reason: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
