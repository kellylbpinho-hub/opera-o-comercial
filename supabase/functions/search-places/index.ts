import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlaceResult {
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  geometry?: { location: { lat: number; lng: number } };
  place_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Google Places API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, city, lat, lng, radius_km, page_token } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: "query é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let url: string;

    if (lat && lng && radius_km) {
      // Search by radius
      const radiusMeters = Math.min(radius_km * 1000, 50000);
      url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=${radiusMeters}&key=${apiKey}&language=pt-BR`;
    } else if (city) {
      // Search by city
      const searchQuery = `${query} em ${city}, Pará, Brasil`;
      url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}&language=pt-BR`;
    } else {
      return new Response(JSON.stringify({ error: "Informe city ou lat/lng/radius_km" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (page_token) {
      url = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${page_token}&key=${apiKey}&language=pt-BR`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return new Response(JSON.stringify({ error: `Google API error: ${data.status}`, error_message: data.error_message }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract relevant fields from results
    const results = (data.results || []).map((place: any) => ({
      place_id: place.place_id,
      name: place.name,
      address: place.formatted_address || "",
      lat: place.geometry?.location?.lat,
      lng: place.geometry?.location?.lng,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      types: place.types,
      business_status: place.business_status,
    }));

    // For each result, try to get phone number via Place Details (batch first 20)
    const detailedResults = await Promise.all(
      results.slice(0, 20).map(async (place: any) => {
        try {
          const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website,opening_hours&key=${apiKey}&language=pt-BR`;
          const detailRes = await fetch(detailUrl);
          const detailData = await detailRes.json();
          if (detailData.result) {
            return {
              ...place,
              phone: detailData.result.formatted_phone_number || null,
              website: detailData.result.website || null,
              is_open: detailData.result.opening_hours?.open_now ?? null,
            };
          }
        } catch {
          // ignore detail errors
        }
        return place;
      })
    );

    return new Response(JSON.stringify({
      results: detailedResults,
      next_page_token: data.next_page_token || null,
      total_found: results.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
