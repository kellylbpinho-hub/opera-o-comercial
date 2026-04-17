import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadInput {
  place_id: string;
  name: string;
  phone?: string;
  website?: string;
  address?: string;
  city_name: string; // pre-extracted/confirmed by client
}

interface ImportResult {
  place_id: string;
  name: string;
  status: "imported" | "territory" | "duplicate" | "error";
  reason?: string;
  duplicate_of?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate JWT and get user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { industry_id, industry_key, leads } = await req.json() as {
      industry_id: string;
      industry_key: string;
      leads: LeadInput[];
    };

    if (!industry_id || !leads || !Array.isArray(leads)) {
      return new Response(JSON.stringify({ error: "industry_id e leads são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-fetch all cities once
    const { data: allCities } = await supabase
      .from("cities")
      .select("id, name, is_active, is_kapazi_allowed")
      .eq("uf", "PA");

    const citiesMap = new Map<string, any>();
    for (const c of allCities ?? []) {
      citiesMap.set(c.name.toLowerCase().trim(), c);
    }

    // Pre-fetch existing contacts for dedupe (only for this industry)
    const { data: existingContacts } = await supabase
      .from("contacts")
      .select("id, company_name, company_name_normalized, city_name, phone_normalized")
      .eq("industry_id", industry_id)
      .is("deleted_at", null);

    const phoneIndex = new Map<string, any>();
    const nameCityIndex = new Map<string, any>();
    for (const c of existingContacts ?? []) {
      if (c.phone_normalized && c.phone_normalized.length >= 8) {
        phoneIndex.set(c.phone_normalized, c);
      }
      const nameNorm = (c.company_name_normalized || c.company_name || "").toLowerCase().trim();
      const cityNorm = (c.city_name || "").toLowerCase().trim();
      if (nameNorm && cityNorm) {
        nameCityIndex.set(`${nameNorm}|${cityNorm}`, c);
      }
    }

    const results: ImportResult[] = [];
    const toInsert: any[] = [];

    for (const lead of leads) {
      // 1. Territory check
      const cityNorm = (lead.city_name || "").replace(/\s*-\s*[A-Z]{2}\s*$/i, "").trim().toLowerCase();
      if (!cityNorm) {
        results.push({ place_id: lead.place_id, name: lead.name, status: "territory", reason: "Cidade não informada" });
        continue;
      }

      const city = citiesMap.get(cityNorm);
      if (!city) {
        results.push({ place_id: lead.place_id, name: lead.name, status: "territory", reason: `Cidade "${lead.city_name}" fora do território` });
        continue;
      }
      if (!city.is_active) {
        results.push({ place_id: lead.place_id, name: lead.name, status: "territory", reason: `Cidade "${city.name}" inativa` });
        continue;
      }
      if (industry_key?.toUpperCase() === "KAPAZI" && !city.is_kapazi_allowed) {
        results.push({ place_id: lead.place_id, name: lead.name, status: "territory", reason: `"${city.name}" fora do território Kapazi` });
        continue;
      }

      // 2. Dedupe check
      const phoneNorm = (lead.phone || "").replace(/\D/g, "");
      const nameNorm = lead.name.toLowerCase().trim();
      const cityNameNorm = city.name.toLowerCase().trim();

      let duplicate: any = null;
      if (phoneNorm.length >= 8 && phoneIndex.has(phoneNorm)) {
        duplicate = phoneIndex.get(phoneNorm);
      } else if (nameCityIndex.has(`${nameNorm}|${cityNameNorm}`)) {
        duplicate = nameCityIndex.get(`${nameNorm}|${cityNameNorm}`);
      }

      if (duplicate) {
        results.push({
          place_id: lead.place_id,
          name: lead.name,
          status: "duplicate",
          reason: `Já existe: "${duplicate.company_name}"`,
          duplicate_of: duplicate.id,
        });
        continue;
      }

      // 3. Stage for insert
      toInsert.push({
        industry_id,
        category: "NOVO_MAPS",
        company_name: lead.name,
        company_name_normalized: nameNorm,
        phone_raw: lead.phone || null,
        phone_normalized: phoneNorm || null,
        whatsapp_link: phoneNorm ? `https://wa.me/55${phoneNorm}` : null,
        website: lead.website || null,
        address: lead.address || null,
        city_id: city.id,
        city_name: city.name,
        uf: "PA",
        source: "MAPS",
        owner_user_id: userId,
        _place_id: lead.place_id,
        _name: lead.name,
      });

      // Add to indexes to prevent duplicates within the same batch
      if (phoneNorm.length >= 8) phoneIndex.set(phoneNorm, { id: "pending", company_name: lead.name });
      nameCityIndex.set(`${nameNorm}|${cityNameNorm}`, { id: "pending", company_name: lead.name });
    }

    // Bulk insert
    if (toInsert.length > 0) {
      const cleanInserts = toInsert.map(({ _place_id, _name, ...rest }) => rest);
      const { data: inserted, error: insertErr } = await supabase
        .from("contacts")
        .insert(cleanInserts)
        .select("id, company_name");

      if (insertErr) {
        // All failed
        for (const item of toInsert) {
          results.push({
            place_id: item._place_id,
            name: item._name,
            status: "error",
            reason: insertErr.message,
          });
        }
      } else {
        for (const item of toInsert) {
          results.push({
            place_id: item._place_id,
            name: item._name,
            status: "imported",
          });
        }
      }
    }

    const summary = {
      total: leads.length,
      imported: results.filter(r => r.status === "imported").length,
      territory: results.filter(r => r.status === "territory").length,
      duplicates: results.filter(r => r.status === "duplicate").length,
      errors: results.filter(r => r.status === "error").length,
    };

    return new Response(JSON.stringify({ summary, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("import-leads error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
