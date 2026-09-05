alter table public.kpi_economics_settings
  add column if not exists insurance_rate_bps integer not null default 114;

update public.kpi_economics_settings
set insurance_rate_bps = 114,
    insurance_cost_per_won_deposit_cents = null,
    updated_at = now()
where id = 'default';

update public.kpi_partner_remuneration_rules
set mechanism = '0,70 % du volume des cautions actives',
    calculation_mode = 'active_volume_rate',
    rate_bps = 70,
    effective_from = '2026-09-01',
    notes = 'À partir de septembre 2026 : 0,70 % du volume des cautions actives. Exemples : 6,65 € HT sur 950 € et 10,50 € HT sur 1 500 €.',
    updated_at = now()
where actor_key = 'lr';
