create table if not exists public.kpi_monthly_metrics (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2020 and 2100),
  month_number integer not null check (month_number between 1 and 12),
  month_label text not null,
  revenue double precision,
  tdv double precision,
  deposits_activated integer,
  active_renters integer,
  new_users integer,
  registered_users integer,
  total_clients integer,
  cumulative_deposit_volume double precision,
  deposit_cashouts integer,
  cashout_amount double precision,
  advanced_guarantee_amount double precision,
  churned_renters integer,
  churn_rate double precision,
  growth_rate double precision,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month_number)
);

alter table public.kpi_monthly_metrics enable row level security;

insert into public.kpi_monthly_metrics (
  year, month_number, month_label, revenue, tdv, deposits_activated, active_renters,
  new_users, registered_users, total_clients, cumulative_deposit_volume,
  deposit_cashouts, cashout_amount, advanced_guarantee_amount, churned_renters, churn_rate, growth_rate
) values
  (2025,11,'Novembre',60.30,null,1,null,null,null,null,null,0,null,null,null,null,null),
  (2025,12,'Décembre',246.99,null,6,null,null,null,null,null,0,null,null,null,null,5),
  (2026,1,'Janvier',237.27,null,5,null,null,null,null,null,null,null,null,null,null,-0.1667),
  (2026,2,'Février',350.82,null,9,null,null,null,null,null,null,null,null,null,null,0.8),
  (2026,3,'Mars',230.00,null,8,null,null,null,null,null,null,null,null,null,null,-0.1111),
  (2026,4,'Avril',503.32,null,20,5,null,null,null,null,null,null,null,null,null,1.5),
  (2026,5,'Mai',708.98,31100,28,6,null,125,null,null,null,null,null,null,null,null,0.4),
  (2026,6,'Juin',1174.74,43900,45,12,23,148,286,143900,null,null,null,null,null,0.6071),
  (2026,7,'Juillet',1714.54,56610,59,15,18,166,289,200510,null,null,null,null,null,0.3111),
  (2026,8,'Août',null,null,null,null,null,null,null,null,null,null,null,null,null,null),
  (2026,9,'Septembre',null,null,null,null,null,null,null,null,null,null,null,null,null,null),
  (2026,10,'Octobre',null,null,null,null,null,null,null,null,null,null,null,null,null,null,null),
  (2026,11,'Novembre',null,null,null,null,null,null,null,null,null,null,null,null,null,null,null),
  (2026,12,'Décembre',null,null,null,null,null,null,null,null,null,null,null,null,null,null,null)
on conflict (year, month_number) do nothing;
