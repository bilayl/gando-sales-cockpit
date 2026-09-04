create table if not exists public.kpi_cost_entries (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2020 and 2100),
  month_number integer not null check (month_number between 1 and 12),
  incurred_on date,
  family text not null check (family in ('acquisition', 'transaction', 'risk', 'partners', 'structure')),
  category text not null,
  label text not null,
  amount double precision not null default 0 check (amount >= 0),
  notes text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kpi_cost_entries_period_idx
  on public.kpi_cost_entries (year desc, month_number desc, family, incurred_on desc);

create table if not exists public.kpi_cost_monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2020 and 2100),
  month_number integer not null check (month_number between 1 and 12),
  family text not null check (family in ('acquisition', 'transaction', 'risk', 'partners', 'structure')),
  budget_amount double precision not null default 0 check (budget_amount >= 0),
  notes text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kpi_cost_monthly_budgets_unique unique (year, month_number, family)
);

create index if not exists kpi_cost_monthly_budgets_period_idx
  on public.kpi_cost_monthly_budgets (year desc, month_number desc, family);

alter table public.kpi_cost_entries enable row level security;
alter table public.kpi_cost_monthly_budgets enable row level security;

insert into public.kpi_cost_entries (
  year,
  month_number,
  incurred_on,
  family,
  category,
  label,
  amount,
  notes,
  updated_by,
  created_at,
  updated_at
)
select
  year,
  month_number,
  incurred_on,
  'acquisition',
  category,
  label,
  amount,
  concat_ws(' · ', nullif(source, ''), nullif(campaign, ''), nullif(notes, '')),
  updated_by,
  created_at,
  updated_at
from public.kpi_acquisition_cost_entries legacy
where not exists (
  select 1
  from public.kpi_cost_entries current
  where current.year = legacy.year
    and current.month_number = legacy.month_number
    and current.family = 'acquisition'
    and current.category = legacy.category
    and current.label = legacy.label
    and current.amount = legacy.amount
    and current.created_at = legacy.created_at
);

comment on table public.kpi_cost_entries is
  'General cost ledger for Gando KPI Cockpit. Every real expense is assigned to one operating family.';

comment on table public.kpi_cost_monthly_budgets is
  'Monthly budget by operating cost family used for budget vs actual and forecast control.';
