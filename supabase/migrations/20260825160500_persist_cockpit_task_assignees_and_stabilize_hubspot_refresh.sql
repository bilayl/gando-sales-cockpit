alter table public.tasks
  add column if not exists assignee_cockpit_email text;

create index if not exists tasks_assignee_cockpit_email_idx
  on public.tasks (lower(assignee_cockpit_email))
  where assignee_cockpit_email is not null;

create or replace function public.get_hubspot_access_token()
returns text
language plpgsql
security definer
set search_path to 'public', 'vault', 'extensions'
as $function$
declare
  v_access_token text;
  v_refresh_token text;
  v_client_id text;
  v_client_secret text;
  v_expires_at_ms bigint;
  v_resp extensions.http_response;
  v_json jsonb;
  v_new_access text;
  v_new_refresh text;
  v_expires_in integer;
  v_next_expires bigint;
begin
  select max(decrypted_secret) filter (where name='hubspot_access_token'),
         max(decrypted_secret) filter (where name='hubspot_refresh_token'),
         max(decrypted_secret) filter (where name='hubspot_client_id'),
         max(decrypted_secret) filter (where name='hubspot_client_secret'),
         nullif(max(decrypted_secret) filter (where name='hubspot_access_expires_at_ms'),'')::bigint
  into v_access_token, v_refresh_token, v_client_id, v_client_secret, v_expires_at_ms
  from vault.decrypted_secrets
  where name in ('hubspot_access_token','hubspot_refresh_token','hubspot_client_id','hubspot_client_secret','hubspot_access_expires_at_ms');

  if coalesce(v_access_token,'') <> ''
     and coalesce(v_expires_at_ms,0) > (extract(epoch from clock_timestamp())*1000)::bigint + 300000 then
    return v_access_token;
  end if;

  perform pg_advisory_xact_lock(hashtext('gando_hubspot_oauth_refresh'));

  select max(decrypted_secret) filter (where name='hubspot_access_token'),
         max(decrypted_secret) filter (where name='hubspot_refresh_token'),
         max(decrypted_secret) filter (where name='hubspot_client_id'),
         max(decrypted_secret) filter (where name='hubspot_client_secret'),
         nullif(max(decrypted_secret) filter (where name='hubspot_access_expires_at_ms'),'')::bigint
  into v_access_token, v_refresh_token, v_client_id, v_client_secret, v_expires_at_ms
  from vault.decrypted_secrets
  where name in ('hubspot_access_token','hubspot_refresh_token','hubspot_client_id','hubspot_client_secret','hubspot_access_expires_at_ms');

  if coalesce(v_access_token,'') <> ''
     and coalesce(v_expires_at_ms,0) > (extract(epoch from clock_timestamp())*1000)::bigint + 300000 then
    return v_access_token;
  end if;

  if coalesce(v_refresh_token,'') = '' or coalesce(v_client_id,'') = '' or coalesce(v_client_secret,'') = '' then
    return null;
  end if;

  v_resp := extensions.http_post(
    'https://api.hubapi.com/oauth/2026-03/token',
    extensions.urlencode(jsonb_build_object(
      'grant_type','refresh_token',
      'refresh_token',v_refresh_token,
      'client_id',v_client_id,
      'client_secret',v_client_secret
    )),
    'application/x-www-form-urlencoded'
  );

  if v_resp.status < 200 or v_resp.status >= 300 then
    raise exception 'HubSpot OAuth refresh failed with HTTP %', v_resp.status;
  end if;

  v_json := v_resp.content::jsonb;
  v_new_access := nullif(v_json->>'access_token','');
  v_new_refresh := coalesce(nullif(v_json->>'refresh_token',''), v_refresh_token);
  v_expires_in := coalesce(nullif(v_json->>'expires_in','')::integer, 1800);

  if v_new_access is null then
    raise exception 'HubSpot OAuth refresh returned no access token';
  end if;

  v_next_expires := (extract(epoch from clock_timestamp())*1000)::bigint + (v_expires_in::bigint * 1000);
  perform public.sync_hubspot_automation_credentials(v_new_access, v_new_refresh, v_next_expires, v_client_id, v_client_secret);
  return v_new_access;
end;
$function$;
