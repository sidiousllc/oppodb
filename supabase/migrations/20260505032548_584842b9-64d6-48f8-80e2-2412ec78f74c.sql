
-- Entitlement helper: true if admin/moderator OR has an active subscription
-- (live by default) with tier in ('pro','enterprise','api'). Honors
-- current_period_end so expiration is enforced immediately, even without
-- a webhook event.
create or replace function public.has_api_entitlement(
  user_uuid uuid,
  check_env text default 'live'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.user_roles
      where user_id = user_uuid and role in ('admin','moderator')
    )
    or exists (
      select 1 from public.subscriptions
      where user_id = user_uuid
        and environment = check_env
        and tier in ('pro','enterprise','api')
        and (
          (status in ('active','trialing','past_due')
            and (current_period_end is null or current_period_end > now()))
          or (status = 'canceled' and current_period_end > now())
        )
    );
$$;

grant execute on function public.has_api_entitlement(uuid, text) to anon, authenticated, service_role;

-- Tighten api_keys INSERT: must own the row AND be entitled.
drop policy if exists "Users can create own api_keys" on public.api_keys;
create policy "Entitled users can create own api_keys"
  on public.api_keys
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.has_api_entitlement(auth.uid(), 'live')
  );
