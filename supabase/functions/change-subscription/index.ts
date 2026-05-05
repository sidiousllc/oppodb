import { createClient } from 'npm:@supabase/supabase-js@2';
import { getPaddleClient, gatewayFetch, type PaddleEnv, corsHeaders } from '../_shared/paddle.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const body = await req.json();
    const { newPriceId, action, effectiveFrom } = body as {
      newPriceId?: string; action?: 'cancel'; effectiveFrom?: 'immediately' | 'next_billing_period';
    };

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: sub } = await admin.from('subscriptions')
      .select('paddle_subscription_id, environment')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (!sub) throw new Error('No active subscription');

    const env = sub.environment as PaddleEnv;
    const paddle = getPaddleClient(env);

    if (action === 'cancel') {
      await paddle.subscriptions.cancel(sub.paddle_subscription_id as string, {
        effectiveFrom: effectiveFrom === 'immediately' ? 'immediately' : 'next_billing_period',
      });
      return new Response(JSON.stringify({ ok: true, canceled: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!newPriceId) throw new Error('newPriceId required');
    // Resolve price external_id -> Paddle internal id
    const lookup = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(newPriceId)}`);
    const lookupData = await lookup.json();
    const paddlePriceId = lookupData.data?.[0]?.id;
    if (!paddlePriceId) throw new Error(`Price not found: ${newPriceId}`);

    const updated = await paddle.subscriptions.update(sub.paddle_subscription_id as string, {
      items: [{ priceId: paddlePriceId, quantity: 1 }],
      prorationBillingMode: 'prorated_immediately',
    });

    return new Response(JSON.stringify({ ok: true, subscriptionId: updated.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
