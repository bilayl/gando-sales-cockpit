create table if not exists public.kpi_value_funnel_monthly (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2020 and 2100),
  month_number integer not null check (month_number between 1 and 12),
  prospects_contacted integer,
  calls_made integer,
  meetings integer,
  renters_registered integer,
  renters_activated integer,
  first_deposit_renters integer,
  paid_spend double precision,
  sales_cost double precision,
  paid_leads integer,
  organic_leads integer,
  signed_revenue double precision,
  cash_collected double precision,
  mrr double precision,
  refunds double precision,
  net_margin double precision,
  avg_closing_days double precision,
  avg_deal_age_days double precision,
  deals_over_40_days integer,
  decisions_taken integer,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month_number)
);

alter table public.kpi_value_funnel_monthly enable row level security;

create table if not exists public.kpi_campaign_performance (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2020 and 2100),
  month_number integer not null check (month_number between 1 and 12),
  source text not null,
  campaign text not null,
  spend double precision,
  leads integer,
  meetings integer,
  clients integer,
  signed_revenue double precision,
  cash_collected double precision,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month_number, source, campaign)
);

alter table public.kpi_campaign_performance enable row level security;
