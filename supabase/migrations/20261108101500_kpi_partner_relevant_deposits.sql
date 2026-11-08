-- The remuneration page must not fetch the first 1,000 deposits of the
-- Gando mirror: at present there are >50,000 and RL Location is truncated.
-- Read only the deposits belonging to configured partners plus Fleetee's
-- partner-originated deposits. The Fleetee marker may be on another deposit
-- belonging to the same account, so marker deposits are included too.
create or replace function public.kpi_partner_relevant_deposits()
returns table(source_id text, payload jsonb)
language sql
stable
security invoker
set search_path = ''
as $function$
  with configured_accounts as (
    select distinct account_id
    from public.kpi_partner_remuneration_rules
    where enabled = true
      and nullif(account_id, '') is not null
  ),
  fleetee_accounts as (
    select distinct d.payload ->> 'account_id' as account_id
    from public.gando_source_records d
    where d.source_table = 'deposits'
      and d.payload ->> 'return_url' ilike '%link.fleetee.io%'
      and nullif(d.payload ->> 'account_id', '') is not null
  )
  select d.source_id, d.payload
  from public.gando_source_records d
  where d.source_table = 'deposits'
    and (
      d.payload ->> 'account_id' in (select account_id from configured_accounts)
      or d.payload ->> 'return_url' ilike '%link.fleetee.io%'
      or (
        d.payload ->> 'account_id' in (select account_id from fleetee_accounts)
        and d.payload ->> 'created_via' = 'partner_api'
      )
    )
  order by d.source_id;
$function$;

revoke all on function public.kpi_partner_relevant_deposits() from public, anon, authenticated;
grant execute on function public.kpi_partner_relevant_deposits() to service_role;
