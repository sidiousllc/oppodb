import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: stats, error } = await supabase
      .from('state_voter_stats')
      .select('*')
      .order('total_registered', { ascending: false });

    if (error) throw error;

    const totals = {
      totalRegistered: stats?.reduce((sum, s) => sum + (s.total_registered || 0), 0) || 0,
      totalEligible: stats?.reduce((sum, s) => sum + (s.total_eligible || 0), 0) || 0,
      avgRegistrationRate: stats?.reduce((sum, s) => sum + (s.registration_rate || 0), 0) / (stats?.length || 1) || 0,
      stateCount: stats?.length || 0,
    };

    return new Response(JSON.stringify({
      national: totals,
      states: stats,
      lastUpdated: stats?.[0]?.updated_at,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
