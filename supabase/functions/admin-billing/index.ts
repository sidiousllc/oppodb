import { createClient } from 'npm:@supabase/supabase-js@2';
import { getPaddleClient, gatewayFetch, type PaddleEnv, corsHeaders } from '../_shared/paddle.ts';

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) throw new Error('Admin role required');
  return { actor: user };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { actor } = await requireAdmin(req);
    const { action, user_id, subscription_id, transaction_id, amount, reason, environment } = await req.json();
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    if (action === 'list_user_billing') {
      if (!user_id) throw new Error('user_id required');
      const { data: subs } = await admin.from('subscriptions')
        .select('*').eq('user_id', user_id).order('created_at', { ascending: false });
      const { data: unlocks } = await admin.from('report_unlocks')
        .select('*').eq('user_id', user_id).order('created_at', { ascending: false }).limit(50);
      return json({ subscriptions: subs || [], report_unlocks: unlocks || [] });
    }

    if (action === 'list_transactions') {
      if (!user_id) throw new Error('user_id required');
      const { data: subs } = await admin.from('subscriptions')
        .select('paddle_customer_id, environment').eq('user_id', user_id).limit(20);
      const customers = new Map<string, PaddleEnv>();
      for (const s of subs || []) {
        if (s.paddle_customer_id) customers.set(s.paddle_customer_id as string, s.environment as PaddleEnv);
      }
      const all: any[] = [];
      for (const [cid, env] of customers) {
        const r = await gatewayFetch(env, `/transactions?customer_id=${cid}&per_page=50&order_by=created_at[DESC]`);
        const j = await r.json();
        if (Array.isArray(j.data)) all.push(...j.data.map((t: any) => ({ ...t, _env: env })));
      }
      return json({ transactions: all });
    }

    if (action === 'cancel_subscription') {
      if (!subscription_id) throw new Error('subscription_id required');
      const { data: sub } = await admin.from('subscriptions')
        .select('environment, paddle_subscription_id, user_id')
        .eq('id', subscription_id).maybeSingle();
      if (!sub) throw new Error('Subscription not found');
      const paddle = getPaddleClient(sub.environment as PaddleEnv);
      const effective = (reason === 'immediately' ? 'immediately' : 'next_billing_period') as 'immediately' | 'next_billing_period';
      await paddle.subscriptions.cancel(sub.paddle_subscription_id as string, { effectiveFrom: effective });
      await admin.from('admin_billing_actions').insert({
        actor_id: actor.id, target_user_id: sub.user_id, action: `cancel_${effective}`,
        subscription_id, metadata: { paddle_subscription_id: sub.paddle_subscription_id },
      });
      return json({ ok: true });
    }

    if (action === 'refund_transaction') {
      if (!transaction_id) throw new Error('transaction_id required');
      const env = (environment || 'live') as PaddleEnv;
      const txnResp = await gatewayFetch(env, `/transactions/${transaction_id}`);
      const txnJson = await txnResp.json();
      if (!txnJson.data) throw new Error('Transaction not found');
      const items = (txnJson.data.details?.line_items || []).map((li: any) => ({
        item_id: li.id, type: 'full',
      }));
      const body = {
        action: 'refund', transaction_id,
        reason: reason || 'requested_by_customer', items,
      };
      const r = await gatewayFetch(env, '/adjustments', { method: 'POST', body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.detail || 'Refund failed');
      await admin.from('admin_billing_actions').insert({
        actor_id: actor.id, target_user_id: user_id || null,
        action: 'refund', metadata: { transaction_id, environment: env, amount },
      });
      return json({ ok: true, adjustment: j.data });
    }

    if (action === 'grant_premium') {
      if (!user_id) throw new Error('user_id required');
      await admin.from('user_roles').upsert({ user_id, role: 'premium' }, { onConflict: 'user_id,role' });
      await admin.from('admin_billing_actions').insert({
        actor_id: actor.id, target_user_id: user_id, action: 'grant_premium', metadata: { reason },
      });
      return json({ ok: true });
    }

    if (action === 'revoke_premium') {
      if (!user_id) throw new Error('user_id required');
      await admin.from('user_roles').delete().eq('user_id', user_id).eq('role', 'premium');
      await admin.from('admin_billing_actions').insert({
        actor_id: actor.id, target_user_id: user_id, action: 'revoke_premium', metadata: { reason },
      });
      return json({ ok: true });
    }

    if (action === 'list_recent_actions') {
      const { data } = await admin.from('admin_billing_actions')
        .select('*').order('created_at', { ascending: false }).limit(100);
      return json({ actions: data || [] });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
