import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface VoterRecord {
  source: string;
  first_name: string;
  last_name: string;
  full_name: string;
  state: string;
  city: string;
  zip: string;
  address: string;
  county: string;
  party: string;
  registration_date: string;
  registration_status: string;
  voter_id: string;
  age: number | null;
  gender: string;
  race_ethnicity: string;
  phone: string;
  email: string;
  congressional_district: string;
  state_house_district: string;
  state_senate_district: string;
  vote_history: Array<{ election: string; voted: boolean; method?: string }>;
  tags: string[];
  raw: Record<string, unknown>;
  // FEC-specific fields
  employer?: string;
  occupation?: string;
  contributions?: Array<{ amount: number; date: string; committee: string }>;
  total_contributed?: number;
  // Civic API fields
  representatives?: Array<{ name: string; office: string; party: string; phones?: string[]; urls?: string[] }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { search_type, first_name, last_name, state, address, city, zip, district, district_type } = body;

    if (!search_type) {
      return new Response(JSON.stringify({ error: 'search_type is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: VoterRecord[] = [];
    const errors: string[] = [];

    // ===== FREE SOURCES =====

    // 1. FEC Individual Contributions (free, no key required - uses DEMO_KEY)
    try {
      const fecResults = await searchFEC({
        search_type, first_name, last_name, state, city, zip,
      });
      results.push(...fecResults);
    } catch (e) {
      errors.push(`FEC: ${e.message}`);
    }

    // 2. Google Civic Information API (free with key)
    const CIVIC_API_KEY = Deno.env.get('GOOGLE_CIVIC_API_KEY');
    if (CIVIC_API_KEY && search_type === 'address') {
      try {
        const civicResults = await searchCivicAPI({
          apiKey: CIVIC_API_KEY, address, city, state, zip,
        });
        results.push(...civicResults);
      } catch (e) {
        errors.push(`Google Civic: ${e.message}`);
      }
    }

    // 3. Open States API (free, for legislator data by district)
    const OPENSTATES_KEY = Deno.env.get('OPENSTATES_API_KEY');
    if (OPENSTATES_KEY && search_type === 'district' && state) {
      try {
        const osResults = await searchOpenStates({
          apiKey: OPENSTATES_KEY, state, district, district_type,
        });
        results.push(...osResults);
      } catch (e) {
        errors.push(`Open States: ${e.message}`);
      }
    }

    // ===== PREMIUM SOURCES (require credentials) =====

    // NationBuilder
    const NB_SLUG = Deno.env.get('NATIONBUILDER_SLUG');
    const NB_TOKEN = Deno.env.get('NATIONBUILDER_API_TOKEN');
    if (NB_SLUG && NB_TOKEN) {
      try {
        const nbResults = await searchNationBuilder({
          slug: NB_SLUG, token: NB_TOKEN,
          search_type, first_name, last_name, state, address, city, zip, district, district_type,
        });
        results.push(...nbResults);
      } catch (e) {
        errors.push(`NationBuilder: ${e.message}`);
      }
    }

    // VAN / EveryAction
    const VAN_API_KEY = Deno.env.get('VAN_API_KEY');
    const VAN_APP_NAME = Deno.env.get('VAN_APP_NAME');
    if (VAN_API_KEY && VAN_APP_NAME) {
      try {
        const vanResults = await searchVAN({
          apiKey: VAN_API_KEY, appName: VAN_APP_NAME,
          search_type, first_name, last_name, state, address, city, zip, district, district_type,
        });
        results.push(...vanResults);
      } catch (e) {
        errors.push(`VAN: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({
      results,
      total: results.length,
      sources: {
        fec: true, // always available
        google_civic: !!CIVIC_API_KEY,
        open_states: !!OPENSTATES_KEY,
        nationbuilder: !!(NB_SLUG && NB_TOKEN),
        van: !!(VAN_API_KEY && VAN_APP_NAME),
      },
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Voter lookup error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ========== FEC Individual Contributors (FREE) ==========
interface FECParams {
  search_type: string;
  first_name?: string; last_name?: string;
  state?: string; city?: string; zip?: string;
}

async function searchFEC(params: FECParams): Promise<VoterRecord[]> {
  const { search_type, first_name, last_name, state, city, zip } = params;
  if (search_type === 'district') return []; // FEC doesn't support district search directly

  const FEC_KEY = Deno.env.get('FEC_API_KEY') || 'DEMO_KEY';
  const baseUrl = 'https://api.open.fec.gov/v1';

  // Build search for individual contributions
  let url = `${baseUrl}/schedules/schedule_a/?api_key=${FEC_KEY}&sort=-contribution_receipt_date&per_page=20&is_individual=true`;

  if (last_name) {
    const nameQuery = first_name ? `${last_name}, ${first_name}` : last_name;
    url += `&contributor_name=${encodeURIComponent(nameQuery)}`;
  }
  if (state) url += `&contributor_state=${encodeURIComponent(state)}`;
  if (city) url += `&contributor_city=${encodeURIComponent(city)}`;
  if (zip) url += `&contributor_zip=${encodeURIComponent(zip)}`;

  // Also search by employer if address search with name
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FEC API ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const contributions = data.results || [];

  // Group contributions by unique person (name + state + zip)
  const personMap = new Map<string, { person: any; contributions: any[] }>();

  for (const c of contributions) {
    const key = `${(c.contributor_name || '').toLowerCase()}-${c.contributor_state}-${c.contributor_zip}`;
    if (!personMap.has(key)) {
      personMap.set(key, { person: c, contributions: [] });
    }
    personMap.get(key)!.contributions.push(c);
  }

  return Array.from(personMap.values()).map(({ person: c, contributions: contribs }) => {
    const nameParts = (c.contributor_name || '').split(', ');
    const cLastName = nameParts[0] || '';
    const cFirstName = nameParts[1] || '';
    const totalContributed = contribs.reduce((sum: number, cc: any) => sum + (cc.contribution_receipt_amount || 0), 0);

    return {
      source: 'FEC',
      first_name: cFirstName,
      last_name: cLastName,
      full_name: [cFirstName, cLastName].filter(Boolean).join(' ') || c.contributor_name || '',
      state: c.contributor_state || '',
      city: c.contributor_city || '',
      zip: c.contributor_zip || '',
      address: c.contributor_street_1 || '',
      county: '',
      party: inferPartyFromCommittee(c.committee?.party || '', c.committee?.name || ''),
      registration_date: '',
      registration_status: 'Donor',
      voter_id: '',
      age: null,
      gender: '',
      race_ethnicity: '',
      phone: '',
      email: '',
      congressional_district: '',
      state_house_district: '',
      state_senate_district: '',
      vote_history: [],
      tags: [c.contributor_occupation, c.contributor_employer].filter(Boolean),
      raw: c,
      employer: c.contributor_employer || '',
      occupation: c.contributor_occupation || '',
      contributions: contribs.map((cc: any) => ({
        amount: cc.contribution_receipt_amount || 0,
        date: cc.contribution_receipt_date || '',
        committee: cc.committee?.name || cc.committee_id || '',
      })),
      total_contributed: Math.round(totalContributed * 100) / 100,
    };
  });
}

function inferPartyFromCommittee(party: string, committeeName: string): string {
  if (party === 'DEM' || party === 'D') return 'DEM';
  if (party === 'REP' || party === 'R') return 'REP';
  const lower = committeeName.toLowerCase();
  if (lower.includes('democrat') || lower.includes('biden') || lower.includes('harris')) return 'DEM';
  if (lower.includes('republican') || lower.includes('trump')) return 'REP';
  return party || '';
}

// ========== Google Civic Information API (FREE with key) ==========
interface CivicParams {
  apiKey: string;
  address?: string; city?: string; state?: string; zip?: string;
}

async function searchCivicAPI(params: CivicParams): Promise<VoterRecord[]> {
  const { apiKey, address, city, state, zip } = params;
  const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');
  if (!fullAddress) return [];

  const url = `https://www.googleapis.com/civicinfo/v2/representatives?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Civic API ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const divisions = data.divisions || {};
  const offices = data.offices || [];
  const officials = data.officials || [];

  // Extract district info from divisions
  let congressionalDistrict = '';
  let stateHouseDistrict = '';
  let stateSenateDistrict = '';

  for (const divId of Object.keys(divisions)) {
    const cdMatch = divId.match(/cd:(\d+)/);
    if (cdMatch) congressionalDistrict = cdMatch[1];
    const slduMatch = divId.match(/sldu:(\d+)/);
    if (slduMatch) stateSenateDistrict = slduMatch[1];
    const sldlMatch = divId.match(/sldl:(\d+)/);
    if (sldlMatch) stateHouseDistrict = sldlMatch[1];
  }

  // Build representative records
  const reps: Array<{ name: string; office: string; party: string; phones?: string[]; urls?: string[] }> = [];
  for (const office of offices) {
    for (const idx of office.officialIndices || []) {
      const official = officials[idx];
      if (official) {
        reps.push({
          name: official.name,
          office: office.name,
          party: official.party || '',
          phones: official.phones,
          urls: official.urls,
        });
      }
    }
  }

  // Return a single result representing the address lookup
  const normalizedAddress = data.normalizedInput || {};
  return [{
    source: 'Google Civic',
    first_name: '',
    last_name: '',
    full_name: `Address Lookup: ${fullAddress}`,
    state: normalizedAddress.state || state || '',
    city: normalizedAddress.city || city || '',
    zip: normalizedAddress.zip || zip || '',
    address: normalizedAddress.line1 || address || '',
    county: '',
    party: '',
    registration_date: '',
    registration_status: 'Address Info',
    voter_id: '',
    age: null,
    gender: '',
    race_ethnicity: '',
    phone: '',
    email: '',
    congressional_district: congressionalDistrict,
    state_house_district: stateHouseDistrict,
    state_senate_district: stateSenateDistrict,
    vote_history: [],
    tags: ['Address Lookup', 'District Info'],
    raw: data,
    representatives: reps,
  }];
}

// ========== Open States API (FREE with key) ==========
interface OpenStatesParams {
  apiKey: string;
  state: string;
  district?: string;
  district_type?: string;
}

async function searchOpenStates(params: OpenStatesParams): Promise<VoterRecord[]> {
  const { apiKey, state, district, district_type } = params;

  const chamber = district_type === 'state_senate' ? 'upper' : 'lower';

  let url = `https://v3.openstates.org/people?jurisdiction=${state.toLowerCase()}&per_page=20&apikey=${apiKey}`;
  if (district) url += `&district=${encodeURIComponent(district)}`;
  if (district_type) {
    url += `&org_classification=${chamber}`;
  }

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Open States API ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const people = data.results || [];

  return people
    .map((p: any) => {
      const partyRaw = typeof p.party === 'string' ? p.party : (p.party || [])[0]?.name || '';
      const email = p.email || '';
      const nameParts = (p.name || '').split(' ');
      const districtLabel = p.current_role?.district || '';

      return {
        source: 'Open States',
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        full_name: p.name || '',
        state: state,
        city: '',
        zip: '',
        address: '',
        county: '',
        party: partyName.includes('Democrat') ? 'DEM' : partyName.includes('Republican') ? 'REP' : partyName,
        registration_date: '',
        registration_status: 'Legislator',
        voter_id: p.id || '',
        age: null,
        gender: '',
        race_ethnicity: '',
        phone: '',
        email: email,
        congressional_district: '',
        state_house_district: district_type === 'state_house' ? districtLabel : '',
        state_senate_district: district_type === 'state_senate' ? districtLabel : '',
        vote_history: [],
        tags: ['Legislator', chamber, districtLabel].filter(Boolean),
        raw: p,
      };
    })
    .filter(Boolean);
}

// ========== NationBuilder ==========
interface NBParams {
  slug: string; token: string; search_type: string;
  first_name?: string; last_name?: string; state?: string;
  address?: string; city?: string; zip?: string;
  district?: string; district_type?: string;
}

async function searchNationBuilder(params: NBParams): Promise<VoterRecord[]> {
  const { slug, token, search_type, first_name, last_name, state, city, zip } = params;
  const baseUrl = `https://${slug}.nationbuilder.com/api/v1`;

  let url = '';
  if (search_type === 'name') {
    const searchTerms = [first_name, last_name].filter(Boolean).join(' ');
    url = `${baseUrl}/people/search?access_token=${token}&name=${encodeURIComponent(searchTerms)}`;
    if (state) url += `&state=${encodeURIComponent(state)}`;
  } else if (search_type === 'address') {
    const searchTerms = [first_name, last_name].filter(Boolean).join(' ');
    url = `${baseUrl}/people/search?access_token=${token}`;
    if (searchTerms) url += `&name=${encodeURIComponent(searchTerms)}`;
    if (city) url += `&city=${encodeURIComponent(city)}`;
    if (state) url += `&state=${encodeURIComponent(state)}`;
  } else if (search_type === 'district') {
    url = `${baseUrl}/people/search?access_token=${token}`;
    if (state) url += `&state=${encodeURIComponent(state)}`;
  } else {
    return [];
  }

  url += '&limit=50';

  const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NationBuilder API ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  return (data.results || []).map((p: any) => mapNBPerson(p));
}

function mapNBPerson(p: any): VoterRecord {
  const addr = p.primary_address || {};
  return {
    source: 'NationBuilder',
    first_name: p.first_name || '',
    last_name: p.last_name || '',
    full_name: [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' '),
    state: addr.state || p.state_file_id?.slice(0, 2) || '',
    city: addr.city || '',
    zip: addr.zip || '',
    address: [addr.address1, addr.address2].filter(Boolean).join(', '),
    county: addr.county || '',
    party: p.party || p.registered_party || '',
    registration_date: p.registered_at || '',
    registration_status: p.is_voter === true ? 'Active' : p.is_voter === false ? 'Inactive' : 'Unknown',
    voter_id: p.state_file_id || p.id?.toString() || '',
    age: p.age || null,
    gender: p.sex || '',
    race_ethnicity: p.ethnicity || '',
    phone: p.phone || p.mobile || '',
    email: p.email || '',
    congressional_district: p.federal_district || '',
    state_house_district: p.state_lower_district || '',
    state_senate_district: p.state_upper_district || '',
    vote_history: [],
    tags: p.tags || [],
    raw: p,
  };
}

// ========== VAN / EveryAction ==========
interface VANParams {
  apiKey: string; appName: string; search_type: string;
  first_name?: string; last_name?: string; state?: string;
  address?: string; city?: string; zip?: string;
  district?: string; district_type?: string;
}

async function searchVAN(params: VANParams): Promise<VoterRecord[]> {
  const { apiKey, appName, search_type, first_name, last_name, address, city, state, zip } = params;
  const baseUrl = 'https://api.securevan.com/v4';
  const authToken = btoa(`${appName}:${apiKey}`);

  const body: any = {};
  if (search_type === 'name') {
    body.firstName = first_name || undefined;
    body.lastName = last_name || undefined;
    if (state) body.stateOrProvince = state;
  } else if (search_type === 'address') {
    body.firstName = first_name || undefined;
    body.lastName = last_name || undefined;
    if (address) body.streetAddress = address;
    if (city) body.city = city;
    if (state) body.stateOrProvince = state;
    if (zip) body.zipOrPostalCode = zip;
  } else if (search_type === 'district') {
    if (state) body.stateOrProvince = state;
  }

  const response = await fetch(`${baseUrl}/people/find`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VAN API ${response.status}: ${text.slice(0, 200)}`);
  }

  const person = await response.json();
  if (!person || !person.vanId) return [];

  const detailRes = await fetch(`${baseUrl}/people/${person.vanId}?$expand=phones,emails,addresses,districts`, {
    headers: {
      'Authorization': `Basic ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!detailRes.ok) return [mapVANPerson(person)];

  const detail = await detailRes.json();
  return [mapVANPerson(detail)];
}

function mapVANPerson(p: any): VoterRecord {
  const addr = (p.addresses || []).find((a: any) => a.isPreferred) || (p.addresses || [])[0] || {};
  const phone = (p.phones || []).find((ph: any) => ph.isPreferred) || (p.phones || [])[0] || {};
  const email = (p.emails || []).find((e: any) => e.isPreferred) || (p.emails || [])[0] || {};
  const districts = p.districts || [];

  const cd = districts.find((d: any) => d.districtFieldName === 'Congressional');
  const sh = districts.find((d: any) => d.districtFieldName === 'State House');
  const ss = districts.find((d: any) => d.districtFieldName === 'State Senate');

  return {
    source: 'VAN',
    first_name: p.firstName || '',
    last_name: p.lastName || '',
    full_name: [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' '),
    state: addr.stateOrProvince || '',
    city: addr.city || '',
    zip: addr.zipOrPostalCode || '',
    address: [addr.addressLine1, addr.addressLine2].filter(Boolean).join(', '),
    county: addr.county || '',
    party: p.party || '',
    registration_date: p.dateOfRegistration || '',
    registration_status: p.registrationStatus || 'Unknown',
    voter_id: p.vanId?.toString() || '',
    age: p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / 31557600000) : null,
    gender: p.sex || '',
    race_ethnicity: p.race || '',
    phone: phone.phoneNumber || '',
    email: email.email || '',
    congressional_district: cd?.districtValue || '',
    state_house_district: sh?.districtValue || '',
    state_senate_district: ss?.districtValue || '',
    vote_history: (p.electionRecords || []).map((e: any) => ({
      election: e.electionName || e.election?.name || '',
      voted: e.dateCounted != null || e.voted === true,
      method: e.ballotType || undefined,
    })),
    tags: (p.activistCodes || []).map((a: any) => a.name || a.activistCodeName).filter(Boolean),
    raw: p,
  };
}
