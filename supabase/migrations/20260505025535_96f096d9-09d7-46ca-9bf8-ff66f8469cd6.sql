create table if not exists public.admin_billing_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  target_user_id uuid,
  action text not null,
  subscription_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_billing_actions_target on public.admin_billing_actions(target_user_id, created_at desc);
create index if not exists idx_admin_billing_actions_actor on public.admin_billing_actions(actor_id, created_at desc);

alter table public.admin_billing_actions enable row level security;

create policy "Admins can view billing actions"
  on public.admin_billing_actions for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Service role can insert billing actions"
  on public.admin_billing_actions for insert
  with check (auth.role() = 'service_role');