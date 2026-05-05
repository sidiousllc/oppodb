import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyWebhook, EventName, type PaddleEnv } from '../_shared/paddle.ts';

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
  }
  return _supabase;
}

function tierFromPriceId(priceId: string | undefined): string | null {
  if (!priceId) return null;
  if (priceId.startsWith('enterprise_')) return 'enterprise';
  if (priceId.startsWith('pro_')) return 'pro';
  return null;
}

async function handleSubscriptionCreatedOrUpdated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData, scheduledChange } = data;
  const userId = customData?.userId;
  if (!userId) {
    console.error('No userId in customData for subscription', id);
    return;
  }
  const item = items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn('Skipping subscription: missing importMeta.externalId', { id });
    return;
  }
  await getSupabase().from('subscriptions').upsert({
    user_id: userId,
    paddle_subscription_id: id,
    paddle_customer_id: customerId,
    product_id: productId,
    price_id: priceId,
    tier: tierFromPriceId(priceId),
    status,
    current_period_start: currentBillingPeriod?.startsAt,
    current_period_end: currentBillingPeriod?.endsAt,
    cancel_at_period_end: scheduledChange?.action === 'cancel',
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'paddle_subscription_id' });
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await getSupabase().from('subscriptions')
    .update({
      status: 'canceled',
      current_period_end: data.currentBillingPeriod?.endsAt ?? data.canceledAt,
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', data.id)
    .eq('environment', env);
}

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const customData = data.customData;
  const userId = customData?.userId;
  if (!userId) return;
  const item = data.items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  // Only handle one-time report unlock here; subscriptions handled separately
  if (priceId !== 'report_unlock_one_time') return;
  await getSupabase().from('report_unlocks').upsert({
    user_id: userId,
    paddle_transaction_id: data.id,
    paddle_customer_id: data.customerId,
    candidate_id: customData?.candidateId ?? null,
    amount_cents: parseInt(data.details?.totals?.total ?? '0', 10),
    currency: data.currencyCode?.toLowerCase() ?? 'usd',
    environment: env,
  }, { onConflict: 'paddle_transaction_id' });
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  console.log('Paddle event:', event.eventType, 'env:', env);
  switch (event.eventType) {
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionUpdated:
      await handleSubscriptionCreatedOrUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data, env);
      break;
    default:
      console.log('Unhandled event:', event.eventType);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const url = new URL(req.url);
  const env = (url.searchParams.get('env') || 'sandbox') as PaddleEnv;
  try {
    await handleWebhook(req, env);
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response('Webhook error', { status: 400 });
  }
});
