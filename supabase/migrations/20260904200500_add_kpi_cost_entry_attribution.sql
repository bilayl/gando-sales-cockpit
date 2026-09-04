alter table public.kpi_cost_entries
  add column if not exists source text,
  add column if not exists campaign text;

update public.kpi_cost_entries current
set
  source = legacy.source,
  campaign = legacy.campaign,
  notes = legacy.notes
from public.kpi_acquisition_cost_entries legacy
where current.family = 'acquisition'
  and current.source is null
  and current.campaign is null
  and current.year = legacy.year
  and current.month_number = legacy.month_number
  and current.category = legacy.category
  and current.label = legacy.label
  and current.amount = legacy.amount
  and current.created_at = legacy.created_at;

create index if not exists kpi_cost_entries_attribution_idx
  on public.kpi_cost_entries (family, source, campaign);
