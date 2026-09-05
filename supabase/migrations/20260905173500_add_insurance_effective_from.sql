alter table public.kpi_economics_settings
  add column if not exists insurance_effective_from date not null default '2026-09-01';

update public.kpi_economics_settings
set insurance_rate_bps = 114,
    insurance_effective_from = '2026-09-01',
    updated_at = now()
where id = 'default';
