create table if not exists public.cockpit_users (
  email text primary key,
  password_hash text not null,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cockpit_users enable row level security;

revoke all on public.cockpit_users from anon, authenticated;
grant select, insert, update, delete on public.cockpit_users to service_role;

create or replace function public.verify_cockpit_user(p_email text, p_password text)
returns table(email text, display_name text)
language sql
security definer
set search_path = public, extensions
as $$
  select u.email, u.display_name
  from public.cockpit_users u
  where lower(u.email) = lower(trim(p_email))
    and u.active = true
    and extensions.crypt(p_password, u.password_hash) = u.password_hash
  limit 1;
$$;

revoke all on function public.verify_cockpit_user(text, text) from public, anon, authenticated;
grant execute on function public.verify_cockpit_user(text, text) to service_role;

comment on table public.cockpit_users is 'Internal Sales Cockpit users. Accounts are provisioned server-side; there is no public signup flow.';
