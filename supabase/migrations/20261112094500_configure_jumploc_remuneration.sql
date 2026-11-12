-- JumpLoc: 2% HT of the face value of each activated deposit with a matched securing fee.
-- Account linked to the "resa-jumploc" partner by its synchronized user record.
-- This rule calculates the amount due; it does not create a payout.
insert into public.kpi_partner_remuneration_rules (
  actor_key, actor_label, account_id, mechanism, enabled, eligibility,
  tiers, notes, calculation_mode, rate_bps, effective_from, effective_to
)
values (
  'resa-jumploc',
  'JumpLoc',
  'cmst1oiq00019pg01m6set83z',
  '2,00 % du montant de chaque caution activée',
  true,
  '{"successful_statuses":["active","close","captured","capture_issue"],"requires_activation":true,"requires_securing_fee":true,"period_basis":"securing_fee_paid_at"}'::jsonb,
  '[]'::jsonb,
  'Redevance HT calculée sur le montant de chaque caution activée avec frais encaissés, y compris après clôture ou capture. Versements à rapprocher séparément.',
  'activated_volume_rate',
  200,
  null,
  null
)
on conflict (actor_key) do update set
  actor_label = excluded.actor_label,
  account_id = excluded.account_id,
  mechanism = excluded.mechanism,
  enabled = excluded.enabled,
  eligibility = excluded.eligibility,
  tiers = excluded.tiers,
  notes = excluded.notes,
  calculation_mode = excluded.calculation_mode,
  rate_bps = excluded.rate_bps,
  effective_from = excluded.effective_from,
  effective_to = excluded.effective_to,
  updated_at = now();
