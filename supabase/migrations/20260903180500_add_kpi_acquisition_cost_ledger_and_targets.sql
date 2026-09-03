create table if not exists public.kpi_acquisition_cost_entries (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2020 and 2100),
  month_number integer not null check (month_number between 1 and 12),
  incurred_on date,
  category text not null check (category in ('ads','sales','tooling','agency','creative','other')),
  label text not null,
  amount double precision not null check (amount >= 0),
  source text,
  campaign text,
  notes text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kpi_acquisition_cost_entries_month_idx
  on public.kpi_acquisition_cost_entries (year, month_number);

create index if not exists kpi_acquisition_cost_entries_campaign_idx
  on public.kpi_acquisition_cost_entries (year, month_number, source, campaign);

alter table public.kpi_acquisition_cost_entries enable row level security;

create table if not exists public.kpi_acquisition_monthly_targets (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2020 and 2100),
  month_number integer not null check (month_number between 1 and 12),
  target_leads integer check (target_leads >= 0),
  target_meetings integer check (target_meetings >= 0),
  target_clients integer check (target_clients >= 0),
  target_first_deposit_renters integer check (target_first_deposit_renters >= 0),
  target_signed_revenue double precision check (target_signed_revenue >= 0),
  target_cash_collected double precision check (target_cash_collected >= 0),
  max_total_cost double precision check (max_total_cost >= 0),
  max_cac double precision check (max_cac >= 0),
  min_cash_roi double precision,
  min_signed_roi double precision,
  notes text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month_number)
);

alter table public.kpi_acquisition_monthly_targets enable row level security;
