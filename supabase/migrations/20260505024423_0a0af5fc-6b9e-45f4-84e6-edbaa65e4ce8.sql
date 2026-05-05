-- Subscriptions table
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  paddle_subscription_id text not null unique,
  paddle_customer_id text not null,
  product_id text not null,
  price_id text not null,
  tier text,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_subscriptions_paddle_id on public.subscriptions(paddle_subscription_id);

alter table public.subscriptions enable row level security;
create policy "Users view own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);
create policy "Service role manages subscriptions" on public.subscriptions
  for all using (auth.role() = 'service_role');

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Report unlocks (one-time purchases)
create table public.report_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  paddle_transaction_id text not null unique,
  paddle_customer_id text,
  candidate_id text,
  amount_cents integer,
  currency text default 'usd',
  environment text not null default 'sandbox',
  created_at timestamptz default now()
);
create index idx_report_unlocks_user on public.report_unlocks(user_id);
alter table public.report_unlocks enable row level security;
create policy "Users view own unlocks" on public.report_unlocks
  for select using (auth.uid() = user_id);
create policy "Service role manages unlocks" on public.report_unlocks
  for all using (auth.role() = 'service_role');

-- Active subscription helper
create or replace function public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
      and environment = check_env
      and (
        (status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()))
        or (status = 'canceled' and current_period_end > now())
      )
  );
$$;

-- Current tier helper
create or replace function public.current_subscription_tier(
  user_uuid uuid,
  check_env text default 'live'
)
returns text language sql stable security definer set search_path = public as $$
  select tier from public.subscriptions
  where user_id = user_uuid
    and environment = check_env
    and (
      (status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now())
    )
  order by case tier when 'enterprise' then 2 when 'pro' then 1 else 0 end desc,
           created_at desc
  limit 1;
$$;

-- Sync premium role from subscription state
create or replace function public.sync_premium_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare _uid uuid;
begin
  _uid := coalesce(new.user_id, old.user_id);
  if public.has_active_subscription(_uid, coalesce(new.environment, old.environment, 'live')) then
    insert into public.user_roles (user_id, role)
    values (_uid, 'premium')
    on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles
    where user_id = _uid
      and role = 'premium'
      and not exists (
        select 1 from public.subscriptions s
        where s.user_id = _uid
          and (
            (s.status in ('active','trialing','past_due') and (s.current_period_end is null or s.current_period_end > now()))
            or (s.status = 'canceled' and s.current_period_end > now())
          )
      );
  end if;
  return new;
end;
$$;

create trigger trg_subscriptions_sync_role
after insert or update or delete on public.subscriptions
for each row execute function public.sync_premium_role();