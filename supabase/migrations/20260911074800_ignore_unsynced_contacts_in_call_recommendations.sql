do $do$
declare
  function_oid oid;
  ddl text;
  needle text := E'    from scored s\n  )';
  replacement text := E'    from scored s\n    where s.hubspot_contact_id is not null\n      and btrim(s.hubspot_contact_id) <> ''''\n  )';
begin
  select p.oid
    into function_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'refresh_call_recommendations'
    and n.nspname = 'public'
  limit 1;

  if function_oid is null then
    raise exception 'refresh_call_recommendations function not found';
  end if;

  ddl := pg_get_functiondef(function_oid);
  if position(needle in ddl) = 0 then
    raise exception 'Expected refresh_call_recommendations body pattern not found';
  end if;

  ddl := replace(ddl, needle, replacement);
  execute ddl;
end
$do$;
