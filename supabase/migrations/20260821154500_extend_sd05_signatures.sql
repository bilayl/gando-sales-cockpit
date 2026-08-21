alter table public.sd_contract_signature_requests
  add column if not exists signature_mode text,
  add column if not exists signature_data text,
  add column if not exists signature_data_hash text,
  add column if not exists initials jsonb not null default '{}'::jsonb,
  add column if not exists document_page_count integer,
  add column if not exists initials_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sd_contract_signature_requests_signature_mode_check'
      and conrelid = 'public.sd_contract_signature_requests'::regclass
  ) then
    alter table public.sd_contract_signature_requests
      add constraint sd_contract_signature_requests_signature_mode_check
      check (signature_mode is null or signature_mode in ('typed', 'drawn'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sd_contract_signature_requests_page_count_check'
      and conrelid = 'public.sd_contract_signature_requests'::regclass
  ) then
    alter table public.sd_contract_signature_requests
      add constraint sd_contract_signature_requests_page_count_check
      check (document_page_count is null or document_page_count between 1 and 200);
  end if;
end $$;

alter table public.sd_contract_signature_events
  drop constraint if exists sd_contract_signature_events_event_type_check;

alter table public.sd_contract_signature_events
  add constraint sd_contract_signature_events_event_type_check
  check (event_type in ('created', 'email_sent', 'email_failed', 'viewed', 'initialed', 'signed', 'revoked', 'expired'));
