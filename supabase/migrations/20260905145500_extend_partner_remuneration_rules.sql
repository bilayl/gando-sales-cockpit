alter table public.kpi_partner_remuneration_rules
  add column if not exists calculation_mode text not null default 'fixed_tier',
  add column if not exists rate_bps integer null,
  add column if not exists effective_from date null,
  add column if not exists effective_to date null;

update public.kpi_partner_remuneration_rules
set calculation_mode = 'fixed_tier'
where actor_key = 'rl';

-- LR Location mapping from the synchronized Gando production account.
update public.kpi_partner_remuneration_rules
set
  account_id = 'cmqbczedp003hqv01qp1spqpl',
  mechanism = '1,14 % du volume des cautions actives',
  calculation_mode = 'active_volume_rate',
  rate_bps = 114,
  enabled = true,
  effective_from = '2026-09-01',
  eligibility = jsonb_build_object(
    'statuses', jsonb_build_array('active'),
    'requires_securing_fee', true,
    'period_basis', 'securing_fee_paid_at'
  ),
  tiers = '[]'::jsonb,
  notes = 'Septembre 2026 : 1,14 % du volume des cautions actives. Les exemples 6,65 € sur 950 € et 10,50 € sur 1 500 € correspondent à 0,70 % et restent à clarifier.',
  updated_at = now()
where actor_key = 'lr';
