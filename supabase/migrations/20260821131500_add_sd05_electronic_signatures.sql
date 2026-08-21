create table if not exists public.sd_contract_signature_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.deal_rooms(id) on delete cascade,
  document_id uuid not null references public.sd_documents(id) on delete cascade,
  signer_name text not null,
  signer_email text not null,
  signer_role text,
  signer_organization text,
  token_hash text not null unique,
  contract_reference text,
  contract_version text,
  contract_snapshot jsonb not null,
  contract_hash text not null,
  signed_payload_hash text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'viewed', 'signed', 'expired', 'revoked', 'failed')),
  consent_text text not null,
  signature_name text,
  signature_ip text,
  signature_user_agent text,
  smtp_provider_message_id text,
  smtp_request_id text,
  expires_at timestamptz,
  sent_at timestamptz,
  first_viewed_at timestamptz,
  signed_at timestamptz,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sd_contract_signature_events (
  id uuid primary key default gen_random_uuid(),
  signature_request_id uuid not null references public.sd_contract_signature_requests(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'email_sent', 'email_failed', 'viewed', 'signed', 'revoked', 'expired')),
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists sd_contract_signature_requests_document_idx
  on public.sd_contract_signature_requests (document_id, created_at desc);
create index if not exists sd_contract_signature_requests_room_idx
  on public.sd_contract_signature_requests (room_id, created_at desc);
create index if not exists sd_contract_signature_requests_status_idx
  on public.sd_contract_signature_requests (status, expires_at);
create index if not exists sd_contract_signature_events_request_idx
  on public.sd_contract_signature_events (signature_request_id, occurred_at);

create unique index if not exists sd_contract_signature_one_signed_snapshot_idx
  on public.sd_contract_signature_requests (document_id, lower(signer_email), contract_hash)
  where status = 'signed';

drop trigger if exists set_sd_contract_signature_requests_updated_at on public.sd_contract_signature_requests;
create trigger set_sd_contract_signature_requests_updated_at
before update on public.sd_contract_signature_requests
for each row execute function public.set_sd_updated_at();

alter table public.sd_contract_signature_requests enable row level security;
alter table public.sd_contract_signature_events enable row level security;

revoke all on table public.sd_contract_signature_requests from anon, authenticated;
revoke all on table public.sd_contract_signature_events from anon, authenticated;
grant all on table public.sd_contract_signature_requests to service_role;
grant all on table public.sd_contract_signature_events to service_role;
