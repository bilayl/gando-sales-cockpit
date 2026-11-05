-- Look up the same synchronized contacts used by the Cockpit directory.
-- Invoker rights: the function never bypasses RLS. Only the backend's service
-- role can execute it; not exposed to anonymous or public API clients.
create or replace function public.lookup_cockpit_contacts_by_phone_suffix(p_suffix text)
returns table (
  hubspot_id text,
  first_name text,
  last_name text,
  email text,
  phone text,
  mobilephone text,
  company text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.hubspot_id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.raw_data #>> '{properties,mobilephone}' as mobilephone,
    c.raw_data #>> '{properties,company}' as company
  from public.contacts c
  where p_suffix ~ '^[0-9]{9}$'
    and c.hubspot_id ~ '^[0-9]+$'
    and (
      right(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'), 9) = p_suffix
      or right(regexp_replace(coalesce(c.raw_data #>> '{properties,phone}', ''), '[^0-9]', '', 'g'), 9) = p_suffix
      or right(regexp_replace(coalesce(c.raw_data #>> '{properties,mobilephone}', ''), '[^0-9]', '', 'g'), 9) = p_suffix
    )
  order by c.updated_at desc nulls last
  limit 51;
$$;
revoke all on function public.lookup_cockpit_contacts_by_phone_suffix(text) from public, anon, authenticated;
grant execute on function public.lookup_cockpit_contacts_by_phone_suffix(text) to service_role;
