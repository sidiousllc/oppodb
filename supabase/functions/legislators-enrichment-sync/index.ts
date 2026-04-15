import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LEGISLATORS_URL = "https://unitedstates.github.io/congress-legislators/legislators-current.json";
const SOCIAL_MEDIA_URL = "https://unitedstates.github.io/congress-legislators/legislators-social-media.json";
const DISTRICT_OFFICES_URL = "https://unitedstates.github.io/congress-legislators/legislators-district-offices.json";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all three data sources in parallel
    const [legislatorsRes, socialRes, officesRes] = await Promise.all([
      fetch(LEGISLATORS_URL),
      fetch(SOCIAL_MEDIA_URL),
      fetch(DISTRICT_OFFICES_URL),
    ]);

    const legislators = await legislatorsRes.json();
    const socialMedia = await socialRes.json();
    const districtOffices = await officesRes.json();

    // Index social media and district offices by bioguide
    const socialByBioguide = new Map<string, any>();
    for (const s of socialMedia) {
      socialByBioguide.set(s.id.bioguide, s.social);
    }

    const officesByBioguide = new Map<string, any[]>();
    for (const o of districtOffices) {
      officesByBioguide.set(o.id.bioguide, o.offices || []);
    }

    let updated = 0;
    let errors: string[] = [];

    // Process in batches of 20
    const batchSize = 20;
    for (let i = 0; i < legislators.length; i += batchSize) {
      const batch = legislators.slice(i, i + batchSize);
      const updates = batch.map((leg: any) => {
        const bioguide = leg.id?.bioguide;
        if (!bioguide) return null;

        const currentTerm = leg.terms?.[leg.terms.length - 1];
        const social = socialByBioguide.get(bioguide) || {};
        const offices = officesByBioguide.get(bioguide) || [];

        return {
          bioguide_id: bioguide,
          social_media: {
            twitter: social.twitter || null,
            twitter_id: social.twitter_id || null,
            facebook: social.facebook || null,
            facebook_id: social.facebook_id || null,
            youtube: social.youtube || null,
            youtube_id: social.youtube_id || null,
            instagram: social.instagram || null,
            instagram_id: social.instagram_id || null,
          },
          district_offices: offices.map((o: any) => ({
            address: o.address || null,
            city: o.city || null,
            state: o.state || null,
            zip: o.zip || null,
            phone: o.phone || null,
            fax: o.fax || null,
            suite: o.suite || null,
            building: o.building || null,
            latitude: o.latitude || null,
            longitude: o.longitude || null,
          })),
          fec_ids: Array.isArray(leg.id?.fec) ? leg.id.fec : (leg.id?.fec ? [leg.id.fec] : []),
          opensecrets_id: leg.id?.opensecrets || null,
          votesmart_id: leg.id?.votesmart || null,
          wikipedia: leg.id?.wikipedia || null,
          ballotpedia: leg.id?.ballotpedia || null,
          contact_form: currentTerm?.contact_form || null,
          phone: currentTerm?.phone || null,
          office_address: currentTerm?.office || null,
        };
      }).filter(Boolean);

      for (const update of updates) {
        const { error } = await supabase
          .from("congress_members")
          .update({
            social_media: update.social_media,
            district_offices: update.district_offices,
            fec_ids: update.fec_ids,
            opensecrets_id: update.opensecrets_id,
            votesmart_id: update.votesmart_id,
            wikipedia: update.wikipedia,
            ballotpedia: update.ballotpedia,
            contact_form: update.contact_form,
            phone: update.phone,
            office_address: update.office_address,
          })
          .eq("bioguide_id", update.bioguide_id);

        if (error) {
          errors.push(`${update.bioguide_id}: ${error.message}`);
        } else {
          updated++;
        }
      }

      // Rate limit
      if (i + batchSize < legislators.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      updated,
      total: legislators.length,
      socialMediaCount: socialMedia.length,
      districtOfficesCount: districtOffices.length,
      errors: errors.slice(0, 10),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
