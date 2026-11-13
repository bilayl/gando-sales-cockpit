create table if not exists public.kpi_loueur_guarantee_receivables (
  capture_id text primary key,
  account_id text not null,
  amount_due_cents bigint not null default 0 check (amount_due_cents >= 0),
  amount_paid_cents bigint not null default 0 check (
    amount_paid_cents >= 0 and amount_paid_cents <= amount_due_cents
  ),
  note text null,
  updated_at timestamptz not null default now(),
  updated_by text null
);

create index if not exists kpi_loueur_guarantee_receivables_account_idx
  on public.kpi_loueur_guarantee_receivables (account_id);

-- Read/write through the Cockpit server with the service-role client only.
-- No browser access or RLS bypass for authenticated users.
alter table public.kpi_loueur_guarantee_receivables enable row level security;
revoke all on table public.kpi_loueur_guarantee_receivables from anon, authenticated;

comment on table public.kpi_loueur_guarantee_receivables is
  'Confirmed contractual amounts charged to rental partners for accepted guarantees. Activation alone never implies a receivable.';
