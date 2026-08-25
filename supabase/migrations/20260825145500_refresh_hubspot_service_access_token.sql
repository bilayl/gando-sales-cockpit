create or replace function public.get_server_secret(p_name text)
returns text
language plpgsql
security definer
set search_path to 'public', 'vault', 'auth'
as $function$
declare
  v_secret text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;

  -- HubSpot access tokens expire. Resolve this secret through the refresh-aware
  -- OAuth helper so password-authenticated Sales Cockpit users never depend on
  -- a stale access token stored in Vault.
  if p_name = 'hubspot_access_token' then
    return public.get_hubspot_access_token();
  end if;

  select decrypted_secret
    into v_secret
  from vault.decrypted_secrets
  where name = p_name
  order by created_at desc
  limit 1;

  return v_secret;
end;
$function$;
