alter table public.deal_rooms
  add column if not exists crm_link text,
  add column if not exists prospect_logo_url text;
