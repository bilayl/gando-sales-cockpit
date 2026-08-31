alter table public.kpi_value_funnel_monthly
  add column if not exists tooling_cost double precision,
  add column if not exists agency_cost double precision,
  add column if not exists creative_cost double precision,
  add column if not exists other_acquisition_cost double precision,
  add column if not exists median_closing_days double precision,
  add column if not exists oldest_open_deal_days double precision,
  add column if not exists open_deals_count integer;

alter table public.kpi_campaign_performance
  add column if not exists sales_cost double precision,
  add column if not exists tooling_cost double precision,
  add column if not exists agency_cost double precision,
  add column if not exists creative_cost double precision,
  add column if not exists other_cost double precision;
