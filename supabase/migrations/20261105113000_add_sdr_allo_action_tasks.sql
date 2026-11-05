-- Track SDR-confirmed follow-up tasks derived from Allo without duplicating them.
create table if not exists public.sdr_allo_action_tasks (
  id uuid primary key default gen_random_uuid(),
  call_id text not null check (call_id ~ '^cll[-_][A-Za-z0-9_-]{3,120}$'),
  action_fingerprint text not null check (length(action_fingerprint) = 64),
  owner_email text not null,
  state text not null default 'pending' check (state in ('pending','created')),
  hubspot_task_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (call_id, action_fingerprint, owner_email)
);
create index if not exists sdr_allo_action_tasks_owner_idx on public.sdr_allo_action_tasks (owner_email, created_at desc);
alter table public.sdr_allo_action_tasks enable row level security;
revoke all on public.sdr_allo_action_tasks from anon, authenticated;
grant select, insert, update, delete on public.sdr_allo_action_tasks to service_role;
