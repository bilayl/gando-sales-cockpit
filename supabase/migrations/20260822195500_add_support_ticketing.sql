create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('SUP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  type text not null check (type in ('support','commercial')),
  status text not null default 'open' check (status in ('open','waiting_customer','resolved')),
  source text not null default 'manual' check (source in ('manual','web','email','api')),
  first_name text,
  last_name text,
  email text,
  phone text,
  company_name text,
  company_domain text,
  subject text not null,
  message_preview text,
  hubspot_company_id text,
  hubspot_contact_id text,
  dispatch_status text not null default 'not_applicable' check (dispatch_status in ('not_applicable','pending','synced','failed')),
  dispatch_error text,
  acknowledged_at timestamptz,
  last_reply_at timestamptz,
  created_by_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound','system')),
  channel text not null default 'email' check (channel in ('email','web','api','internal')),
  sender_name text,
  sender_email text,
  body text not null,
  external_id text,
  created_by_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_type_status_created_idx on public.support_tickets(type, status, created_at desc);
create index if not exists support_tickets_email_idx on public.support_tickets(lower(email));
create index if not exists support_ticket_messages_ticket_created_idx on public.support_ticket_messages(ticket_id, created_at asc);
create unique index if not exists support_ticket_messages_external_id_key on public.support_ticket_messages(external_id) where external_id is not null;

create or replace function public.touch_support_ticket_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_tickets_touch_updated_at on public.support_tickets;
create trigger support_tickets_touch_updated_at
before update on public.support_tickets
for each row execute function public.touch_support_ticket_updated_at();

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

revoke all on public.support_tickets from anon, authenticated;
revoke all on public.support_ticket_messages from anon, authenticated;
grant select, insert, update, delete on public.support_tickets to service_role;
grant select, insert, update, delete on public.support_ticket_messages to service_role;
