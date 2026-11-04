-- Appels Aircall, accessibles uniquement depuis les routes serveur du Cockpit.
create table if not exists public.aircall_calls (
  call_id bigint primary key,
  direction text,
  external_number text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  status text,
  recording_url text,
  agent_id bigint,
  agent_email text,
  tags jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists aircall_calls_number_started_idx on public.aircall_calls (external_number, started_at desc);
create index if not exists aircall_calls_started_idx on public.aircall_calls (started_at desc);
alter table public.aircall_calls enable row level security;
revoke all on public.aircall_calls from anon, authenticated;
grant select, insert, update, delete on public.aircall_calls to service_role;
