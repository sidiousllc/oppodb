import { gatewayFetch, type PaddleEnv, corsHeaders } from '../_shared/paddle.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { priceId, environment } = await req.json();
    if (!priceId) throw new Error('priceId required');
    const env = (environment || 'sandbox') as PaddleEnv;
    const res = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(priceId)}`);
    const data = await res.json();
    if (!data.data?.length) throw new Error(`Price not found: ${priceId}`);
    return new Response(JSON.stringify({ paddleId: data.data[0].id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
