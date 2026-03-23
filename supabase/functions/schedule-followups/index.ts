import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CADENCE: Record<string, { nextStage: string; daysUntil: number }> = {
  D0: { nextStage: "D2", daysUntil: 2 },
  D2: { nextStage: "D5", daysUntil: 3 },
  D5: { nextStage: "D7", daysUntil: 2 },
};

const STOP_OUTCOMES = ["NAO_INTERESSA", "JA_TEM_FORNECEDOR"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { contact_id, user_id, stage, outcome } = await req.json();

    if (!contact_id || !user_id) {
      return new Response(JSON.stringify({ error: "contact_id e user_id são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If outcome stops follow-up, don't schedule
    if (outcome && STOP_OUTCOMES.includes(outcome)) {
      return new Response(JSON.stringify({ scheduled: false, reason: "Outcome encerra cadência" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentStage = stage || "D0";
    const next = CADENCE[currentStage];
    if (!next) {
      return new Response(JSON.stringify({ scheduled: false, reason: "Cadência finalizada (D7+)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if follow-up already exists for this stage
    const { data: existing } = await supabase
      .from("interactions")
      .select("id")
      .eq("contact_id", contact_id)
      .eq("stage", next.nextStage)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ scheduled: false, reason: "Follow-up já existe para " + next.nextStage }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + next.daysUntil);

    const { data: interaction, error } = await supabase.from("interactions").insert({
      contact_id,
      user_id,
      channel: "WHATSAPP",
      stage: next.nextStage,
      next_action_at: nextDate.toISOString(),
      next_action_type: "FOLLOWUP",
    }).select().single();

    if (error) throw error;

    return new Response(JSON.stringify({ scheduled: true, interaction_id: interaction.id, next_stage: next.nextStage, next_action_at: nextDate.toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
