import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// States with publicly available voter registration data
interface StateVoterSource {
  state: string;
  stateFips: string;
  hasPublicData: boolean;
  dataUrl?: string;
  format?: string;
  refreshFrequency?: string;
}

const STATE_VOTER_SOURCES: StateVoterSource[] = [
  // States with comprehensive public voter data
  { state: "Florida", stateFips: "12", hasPublicData: true, dataUrl: "https://www.flvot.org/data/", format: "CSV", refreshFrequency: "monthly" },
  { state: "Colorado", stateFips: "08", hasPublicData: true, dataUrl: "https://www.elections.colorado.gov/data-and-administration/data", format: "CSV", refreshFrequency: "quarterly" },
  { state: "Washington", stateFips: "53", hasPublicData: true, dataUrl: "https://www.sos.wa.gov/elections/data-research.cfm", format: "CSV", refreshFrequency: "monthly" },
  { state: "Oregon", stateFips: "41", hasPublicData: true, dataUrl: "https://sos.oregon.gov/elections/pages/electionsdata.aspx", format: "CSV", refreshFrequency: "quarterly" },
  // States with partial/aggregate data
  { state: "Texas", stateFips: "48", hasPublicData: true, dataUrl: "https://www.sos.state.tx.us/elections/voter-info/payroll.shtml", format: "PDF/HTML", refreshFrequency: "annual" },
  { state: "Georgia", stateFips: "13", hasPublicData: true, dataUrl: "https://www.elections.ga.gov/", format: "PDF", refreshFrequency: "annual" },
  { state: "North Carolina", stateFips: "37", hasPublicData: true, dataUrl: "https://www.ncsbe.gov/results-data/voter-registration-data", format: "CSV", refreshFrequency: "monthly" },
  { state: "Virginia", stateFips: "51", hasPublicData: true, dataUrl: "https://www.elections.virginia.gov/citizen-portal/", format: "PDF", refreshFrequency: "quarterly" },
  // Most states don't have public individual-level data
];

// Fetch voter data from a state source
async function fetchStateVoterData(source: StateVoterSource): Promise<any[]> {
  if (!source.hasPublicData || !source.dataUrl) return [];
  
  // This would need custom implementation per state
  // For now, just mark the source as checked
  console.log(`Checking voter data source for ${source.state}: ${source.dataUrl}`);
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Update data sources table with known sources
    for (const source of STATE_VOTER_SOURCES) {
      const { error } = await supabase
        .from('voter_data_sources')
        .upsert({
          state: source.state,
          state_fips: source.stateFips,
          has_public_data: source.hasPublicData,
          data_url: source.dataUrl,
          data_format: source.format,
          refresh_frequency: source.refreshFrequency,
          status: 'catalogued',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'state' });
      
      if (error) console.error(`Error upserting source for ${source.state}:`, error);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Voter data sources catalog updated',
      sourcesCount: STATE_VOTER_SOURCES.length,
      statesWithData: STATE_VOTER_SOURCES.filter(s => s.hasPublicData).map(s => s.state),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Voter file sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
