create table if not exists public.kpi_acquisition_experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  source text,
  acquisition_cost double precision not null default 0 check (acquisition_cost >= 0),
  prospects_contacted integer check (prospects_contacted >= 0),
  conversations integer check (conversations >= 0),
  qualified_deals integer check (qualified_deals >= 0),
  meetings integer check (meetings >= 0),
  renters_registered integer check (renters_registered >= 0),
  first_deposit_renters integer check (first_deposit_renters >= 0),
  mau_30_renters integer check (mau_30_renters >= 0),
  margin_30d double precision check (margin_30d >= 0),
  notes text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kpi_acquisition_experiments_dates_check check (end_date >= start_date),
  constraint kpi_acquisition_experiments_mau_check check (
    mau_30_renters is null
    or first_deposit_renters is null
    or mau_30_renters <= first_deposit_renters
  )
);

create index if not exists kpi_acquisition_experiments_dates_idx
  on public.kpi_acquisition_experiments (start_date desc, end_date desc);

alter table public.kpi_acquisition_experiments enable row level security;

comment on table public.kpi_acquisition_experiments is
  'Acquisition cohorts used to measure CAC through first deposit activation and retained MAU at J+30.';

comment on column public.kpi_acquisition_experiments.qualified_deals is
  'Deals that passed Gando qualification; a raw lead or signup must not be counted as a qualified deal.';

comment on column public.kpi_acquisition_experiments.first_deposit_renters is
  'New renters in the cohort that activated their first deposit. This is the acquisition activation event.';

comment on column public.kpi_acquisition_experiments.mau_30_renters is
  'Renters from the same acquisition cohort still active at J+30. This denominator is used for CAC MAU J+30.';
