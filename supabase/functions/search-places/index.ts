const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Use Places API (New) - Text Search
    const textSearchUrl = "https://places.googleapis.com/v1/places:searchText";

    let textQuery = query;
    if (city) {
      textQuery = `${query} em ${city}, Pará, Brasil`;
    }

    const requestBody: any = {
      textQuery,
      languageCode: "pt-BR",
      maxResultCount: 20,
    };

    if (lat && lng && radius_km) {
      const radiusMeters = Math.min(radius_km * 1000, 50000);
      requestBody.locationBias = {
        circle: {
          center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
          radius: radiusMeters,
        },
      };
      requestBody.textQuery = query; // don't append city when using radius
    }

    if (page_token) {
      requestBody.pageToken = page_token;
    }

    const fieldMask = "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.location,places.businessStatus";

    const response = await fetch(textSearchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message || "Google API error", status: data.error.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = (data.places || []).map((place: any) => ({
      place_id: place.id,
      name: place.displayName?.text || "",
      address: place.formattedAddress || "",
      phone: place.nationalPhoneNumber || null,
      website: place.websiteUri || null,
      rating: place.rating || null,
      user_ratings_total: place.userRatingCount || null,
      lat: place.location?.latitude,
      lng: place.location?.longitude,
      business_status: place.businessStatus || null,
    }));

    return new Response(JSON.stringify({
      results,
      next_page_token: data.nextPageToken || null,
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
