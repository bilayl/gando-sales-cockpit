create table if not exists public.kpi_economics_settings (
  id text primary key default 'default',
  insurance_cost_per_won_deposit_cents integer null check (insurance_cost_per_won_deposit_cents is null or insurance_cost_per_won_deposit_cents >= 0),
  updated_at timestamptz not null default now(),
  updated_by text null
);

insert into public.kpi_economics_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.kpi_partner_remuneration_rules (
  actor_key text primary key,
  actor_label text not null,
  account_id text null,
  mechanism text not null,
  enabled boolean not null default false,
  eligibility jsonb not null default '{}'::jsonb,
  tiers jsonb not null default '[]'::jsonb,
  notes text null,
  updated_at timestamptz not null default now()
);

insert into public.kpi_partner_remuneration_rules (
  actor_key, actor_label, account_id, mechanism, enabled, eligibility, tiers, notes
) values
(
  'rl',
  'RL',
  'cmr6reei900atr3014j8fb6g8',
  'Cashback fixe par caution',
  true,
  '{"min_deposit_cents":100000,"max_deposit_cents":250000,"successful_statuses":["active","close","captured"],"requires_securing_fee":true}'::jsonb,
  '[{"min_cents":100000,"max_cents":149999,"reward_cents":560},{"min_cents":150000,"max_cents":250000,"reward_cents":833}]'::jsonb,
  'Caution activée, frais de sécurisation encaissés, sans annulation ni remboursement/rétrofacturation. Barème HT.'
),
('fleetee','Fleetee',null,'Cashback fixe par caution',false,'{}'::jsonb,'[]'::jsonb,'À configurer'),
('lr','LR',null,'Partage de % du securing_fee',false,'{}'::jsonb,'[]'::jsonb,'À configurer'),
('resa-jumploc','Resa jumploc',null,'Partage de % du securing_fee',false,'{}'::jsonb,'[]'::jsonb,'À configurer')
on conflict (actor_key) do update set
  actor_label = excluded.actor_label,
  account_id = excluded.account_id,
  mechanism = excluded.mechanism,
  enabled = excluded.enabled,
  eligibility = excluded.eligibility,
  tiers = excluded.tiers,
  notes = excluded.notes,
  updated_at = now();

alter table public.kpi_economics_settings enable row level security;
alter table public.kpi_partner_remuneration_rules enable row level security;
