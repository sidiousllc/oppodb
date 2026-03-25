import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatePortal {
  state: string;
  portalName: string;
  lookupUrl: string;
  hasVoterStatus: boolean;
  hasDistrictLookup: boolean;
  notes: string;
}

const STATE_PORTALS: StatePortal[] = [
  { state: "AL", portalName: "Alabama VOTELINK", lookupUrl: "https://votelink.alabama.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "AK", portalName: "Alaska myVote", lookupUrl: "https://myvoterinformation.alaska.gov/", hasVoterStatus: true, hasDistrictLookup: false, notes: "" },
  { state: "AZ", portalName: "Arizona Voter Dashboard", lookupUrl: "https://my.arizona.vote/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "AR", portalName: "Arkansas VOTERS", lookupUrl: "https://www.voterview.ar.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "CA", portalName: "California Voter Status", lookupUrl: "https://voterstatus.sos.ca.gov/", hasVoterStatus: true, hasDistrictLookup: false, notes: "" },
  { state: "CO", portalName: "Colorado Go Vote", lookupUrl: "https://www.govotecolorado.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "CT", portalName: "Connecticut Voter Lookup", lookupUrl: "https://portal.ct.gov/SOTS/Look-Look-Up/Branch-Lookup", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "DE", portalName: "Delaware iVote", lookupUrl: "https://ivote.delaware.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "DC", portalName: "DC Board of Elections", lookupUrl: "https://app.car.dc.gov/myvote/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "FL", portalName: "Florida Voter Check", lookupUrl: "https://registertovoteflorida.gov/home", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "GA", portalName: "Georgia MVP", lookupUrl: "https://www.mvp.sos.ga.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "HI", portalName: "Hawaii Office of Elections", lookupUrl: "https://elections.hawaii.gov/", hasVoterStatus: true, hasDistrictLookup: false, notes: "" },
  { state: "ID", portalName: "Idaho Voter Portal", lookupUrl: "https://vote.idaho.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "IL", portalName: "Illinois State Board of Elections", lookupUrl: "https://www.elections.il.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "IN", portalName: "Indiana Voter Portal", lookupUrl: "https://www.in.gov/sos/elections/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "IA", portalName: "Iowa Voter Lookup", lookupUrl: "https://sos.iowa.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "KS", portalName: "Kansas Voter Lookup", lookupUrl: "https://sos.ks.gov/elections/elections.html", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "KY", portalName: "Kentucky State Board of Elections", lookupUrl: "https://elect.ky.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "LA", portalName: "Louisiana Voter Portal", lookupUrl: "https://voterportal.sos.la.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "ME", portalName: "Maine Bureau of Corporations", lookupUrl: "https://www.maine.gov/sos/cec/elec/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "MD", portalName: "Maryland State Board of Elections", lookupUrl: "https://voterservices.elections.maryland.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "MA", portalName: "Massachusetts Secretary of State", lookupUrl: "https://www.sec.state.ma.us/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "MI", portalName: "Michigan Voter Information", lookupUrl: "https://mvic.sos.state.mi.us/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "MN", portalName: "Minnesota Voter Lookup", lookupUrl: "https://mnvotes.sos.state.mn.us/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "MS", portalName: "Mississippi Secretary of State", lookupUrl: "https://www.sos.ms.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "MO", portalName: "Missouri Secretary of State", lookupUrl: "https://sos.mo.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "MT", portalName: "Montana Secretary of State", lookupUrl: "https://sosmt.gov/elections/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "NE", portalName: "Nebraska Secretary of State", lookupUrl: "https://sos.nebraska.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "NV", portalName: "Nevada Secretary of State", lookupUrl: "https://www.nvsos.gov/vosearch/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "NH", portalName: "New Hampshire Voter Lookup", lookupUrl: "https://app.sos.nh.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "NJ", portalName: "New Jersey Division of Elections", lookupUrl: "https://voter.nj.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "NM", portalName: "New Mexico Secretary of State", lookupUrl: "https://www.sos.nm.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "NY", portalName: "New York State Board of Elections", lookupUrl: "https://www.elections.ny.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "NC", portalName: "North Carolina Voter Search", lookupUrl: "https://vt.ncsbe.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "ND", portalName: "North Dakota Voter Lookup", lookupUrl: "https://vip.sos.nd.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "No party registration" },
  { state: "OH", portalName: "Ohio Voter Lookup", lookupUrl: "https://voterlookup.ohiosos.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "OK", portalName: "Oklahoma Elections", lookupUrl: "https://www.oscn.net/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "OR", portalName: "Oregon Secretary of State", lookupUrl: "https://sos.oregon.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "PA", portalName: "Pennsylvania Voter Services", lookupUrl: "https://www.pavoterservices.pa.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "RI", portalName: "Rhode Island Voter Lookup", lookupUrl: "https://vote.sos.ri.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "SC", portalName: "South Carolina VR Update", lookupUrl: "https://www.scvotes.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "SD", portalName: "South Dakota Secretary of State", lookupUrl: "https://sos.sd.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "TN", portalName: "Tennessee Voter Lookup", lookupUrl: "https://ovr.govote.tn.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "TX", portalName: "Texas Voter Lookup", lookupUrl: "https://teamhive.texas.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "UT", portalName: "Utah Voter Lookup", lookupUrl: "https://vote.utah.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "VT", portalName: "Vermont Secretary of State", lookupUrl: "https://www.sec.state.vt.us/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "VA", portalName: "Virginia Department of Elections", lookupUrl: "https://www.elections.virginia.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "WA", portalName: "Washington Voter Lookup", lookupUrl: "https://voter.votewa.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "WV", portalName: "West Virginia Secretary of State", lookupUrl: "https://www.wvsos.com/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "WI", portalName: "Wisconsin MyVote", lookupUrl: "https://myvote.wi.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
  { state: "WY", portalName: "Wyoming Secretary of State", lookupUrl: "https://sos.wyo.gov/", hasVoterStatus: true, hasDistrictLookup: true, notes: "" },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const state = url.searchParams.get('state')?.toUpperCase();

  if (state) {
    const portal = STATE_PORTALS.find(p => p.state === state);
    if (!portal) {
      return new Response(JSON.stringify({ error: 'State not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(portal), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    portals: STATE_PORTALS,
    count: STATE_PORTALS.length,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
