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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
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

    // NationBuilder lookup
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
    } else {
      errors.push('NationBuilder: Not configured (NATIONBUILDER_SLUG and NATIONBUILDER_API_TOKEN required)');
    }

    // VAN / EveryAction lookup
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
    } else {
      errors.push('VAN: Not configured (VAN_API_KEY and VAN_APP_NAME required)');
    }

    return new Response(JSON.stringify({
      results,
      total: results.length,
      sources: {
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
    // People search endpoint
    const searchTerms = [first_name, last_name].filter(Boolean).join(' ');
    url = `${baseUrl}/people/search?access_token=${token}&name=${encodeURIComponent(searchTerms)}`;
    if (state) url += `&state=${encodeURIComponent(state)}`;
  } else if (search_type === 'address') {
    // Search by address fields
    const searchTerms = [first_name, last_name].filter(Boolean).join(' ');
    url = `${baseUrl}/people/search?access_token=${token}`;
    if (searchTerms) url += `&name=${encodeURIComponent(searchTerms)}`;
    if (city) url += `&city=${encodeURIComponent(city)}`;
    if (state) url += `&state=${encodeURIComponent(state)}`;
  } else if (search_type === 'district') {
    // Use tags/custom search for district
    url = `${baseUrl}/people/search?access_token=${token}`;
    if (state) url += `&state=${encodeURIComponent(state)}`;
  } else {
    return [];
  }

  url += '&limit=50';

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NationBuilder API ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const people = data.results || [];

  return people.map((p: any) => mapNBPerson(p));
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
  const { apiKey, appName, search_type, first_name, last_name, address, city, state, zip, district, district_type } = params;
  const baseUrl = 'https://api.securevan.com/v4';

  // VAN uses Basic auth: appName:apiKey
  const authToken = btoa(`${appName}:${apiKey}`);

  // Build match criteria
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
    // VAN find-or-create doesn't directly support district search,
    // use people endpoint with district filter
  }

  // VAN people/find endpoint
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

  // Fetch full person record
  const detailRes = await fetch(`${baseUrl}/people/${person.vanId}?$expand=phones,emails,addresses,districts`, {
    headers: {
      'Authorization': `Basic ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!detailRes.ok) {
    return [mapVANPerson(person)];
  }

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
