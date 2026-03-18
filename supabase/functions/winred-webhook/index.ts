import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-winred-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  // POST /winred-webhook — receive webhook from WinRed
  if (req.method === "POST" && (!path || path === "winred-webhook")) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      const payload = await req.json();
      console.log("WinRed webhook received:", JSON.stringify(payload).substring(0, 500));

      // WinRed sends donation events - normalize the fields
      // WinRed webhook payloads can vary; we handle common shapes
      const donations = Array.isArray(payload) ? payload : [payload];

      const rows = donations.map((d: any) => ({
        donor_first_name: d.first_name || d.donor_first_name || d.billing_first_name || null,
        donor_last_name: d.last_name || d.donor_last_name || d.billing_last_name || null,
        donor_email: d.email || d.donor_email || null,
        donor_phone: d.phone || d.donor_phone || null,
        donor_address: d.address || d.billing_address || d.street_address || null,
        donor_city: d.city || d.billing_city || null,
        donor_state: d.state || d.billing_state || null,
        donor_zip: d.zip || d.billing_zip || d.postal_code || null,
        donor_employer: d.employer || d.employer_name || null,
        donor_occupation: d.occupation || null,
        amount: parseFloat(d.amount || d.total || d.charge_amount || "0"),
        recurring: d.recurring === true || d.is_recurring === true || d.subscription === true,
        page_name: d.page_name || d.page_title || d.page?.name || null,
        page_slug: d.page_slug || d.page?.slug || null,
        candidate_name: d.candidate_name || d.candidate || d.beneficiary_name || null,
        committee_name: d.committee_name || d.committee || d.organization_name || null,
        transaction_id: d.transaction_id || d.id || d.charge_id || d.uuid || crypto.randomUUID(),
        transaction_date: d.created_at || d.transaction_date || d.date || new Date().toISOString(),
        refunded: d.refunded === true || d.status === "refunded",
        raw_data: d,
      }));

      const { error } = await supabase
        .from("winred_donations")
        .upsert(rows, { onConflict: "transaction_id" });

      if (error) {
        console.error("Insert error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, count: rows.length }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("Webhook error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // POST /winred-webhook/search — authenticated search of stored WinRed data
  if (req.method === "POST" && path === "search") {
    try {
      const authHeader = req.headers.get("Authorization");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader || "" } },
      });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      let query = supabase
        .from("winred_donations")
        .select("*")
        .order("transaction_date", { ascending: false })
        .limit(100);

      if (body.last_name) {
        query = query.ilike("donor_last_name", `%${body.last_name}%`);
      }
      if (body.first_name) {
        query = query.ilike("donor_first_name", `%${body.first_name}%`);
      }
      if (body.state) {
        query = query.eq("donor_state", body.state);
      }
      if (body.email) {
        query = query.ilike("donor_email", `%${body.email}%`);
      }
      if (body.candidate_name) {
        query = query.ilike("candidate_name", `%${body.candidate_name}%`);
      }
      if (body.min_amount) {
        query = query.gte("amount", body.min_amount);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      // Aggregate stats
      const totalAmount = (data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
      const uniqueDonors = new Set((data || []).map((r: any) => `${r.donor_first_name}|${r.donor_last_name}|${r.donor_email}`)).size;

      return new Response(JSON.stringify({
        results: data || [],
        stats: { total_amount: totalAmount, unique_donors: uniqueDonors, count: (data || []).length },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("Search error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
