create extension if not exists pgcrypto;

create table if not exists public.deal_rooms (
  id uuid primary key default gen_random_uuid(),
  hubspot_deal_id text not null unique,
  company_hubspot_id text,
  title text not null,
  company_name text not null,
  share_token text not null unique,
  access_mode text not null default 'email' check (access_mode in ('email', 'allowlist')),
  allowed_emails text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  current_stage text not null default 'SD01' check (current_stage in ('SD01', 'SD02', 'SD03', 'SD04', 'SD05')),
  created_by_email text,
  published_at timestamptz,
  last_shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sd_documents (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.deal_rooms(id) on delete cascade,
  code text not null check (code in ('SD01', 'SD02', 'SD03', 'SD04', 'SD05')),
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'validated')),
  content jsonb not null default '{}'::jsonb,
  published_content jsonb,
  source_mode text not null default 'manual' check (source_mode in ('manual', 'agent', 'mixed')),
  version integer not null default 1 check (version > 0),
  published_version integer,
  model_name text,
  prompt_version text,
  updated_by_email text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, code)
);

create table if not exists public.sd_source_conversations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.deal_rooms(id) on delete cascade,
  source_type text not null check (source_type in ('manual', 'onoff', 'hubspot')),
  external_id text,
  title text not null,
  transcript_text text not null,
  transcript_data jsonb,
  occurred_at timestamptz,
  created_by_email text,
  created_at timestamptz not null default now()
);

create unique index if not exists sd_source_conversations_external_unique
  on public.sd_source_conversations (room_id, source_type, external_id)
  where external_id is not null;

create table if not exists public.sd_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.sd_documents(id) on delete cascade,
  version integer not null check (version > 0),
  content jsonb not null,
  source_refs jsonb not null default '[]'::jsonb,
  model_name text,
  prompt_version text,
  created_by_email text,
  change_summary text,
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

create table if not exists public.deal_room_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.deal_rooms(id) on delete cascade,
  document_code text check (document_code is null or document_code in ('SD01', 'SD02', 'SD03', 'SD04', 'SD05')),
  visitor_email text not null,
  session_id text not null,
  event_type text not null check (event_type in ('room_opened', 'stage_viewed', 'section_viewed', 'heartbeat')),
  active_seconds integer not null default 0 check (active_seconds >= 0 and active_seconds <= 120),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sd_documents_room_id_idx on public.sd_documents (room_id);
create index if not exists sd_source_conversations_room_id_idx on public.sd_source_conversations (room_id);
create index if not exists sd_document_versions_document_id_idx on public.sd_document_versions (document_id, version desc);
create index if not exists deal_room_events_room_created_idx on public.deal_room_events (room_id, created_at desc);
create index if not exists deal_room_events_room_visitor_idx on public.deal_room_events (room_id, visitor_email);

create or replace function public.set_sd_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_deal_rooms_updated_at on public.deal_rooms;
create trigger set_deal_rooms_updated_at
before update on public.deal_rooms
for each row execute function public.set_sd_updated_at();

drop trigger if exists set_sd_documents_updated_at on public.sd_documents;
create trigger set_sd_documents_updated_at
before update on public.sd_documents
for each row execute function public.set_sd_updated_at();

alter table public.deal_rooms enable row level security;
alter table public.sd_documents enable row level security;
alter table public.sd_source_conversations enable row level security;
alter table public.sd_document_versions enable row level security;
alter table public.deal_room_events enable row level security;

revoke all on table public.deal_rooms from anon, authenticated;
revoke all on table public.sd_documents from anon, authenticated;
revoke all on table public.sd_source_conversations from anon, authenticated;
revoke all on table public.sd_document_versions from anon, authenticated;
revoke all on table public.deal_room_events from anon, authenticated;

grant all on table public.deal_rooms to service_role;
grant all on table public.sd_documents to service_role;
grant all on table public.sd_source_conversations to service_role;
grant all on table public.sd_document_versions to service_role;
grant all on table public.deal_room_events to service_role;

revoke all on function public.set_sd_updated_at() from public, anon, authenticated;
grant execute on function public.set_sd_updated_at() to service_role;
