create or replace function public.get_openrouter_api_key()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'openrouter_api_key'
  limit 1;
$$;

revoke all on function public.get_openrouter_api_key() from public;
revoke all on function public.get_openrouter_api_key() from anon;
revoke all on function public.get_openrouter_api_key() from authenticated;
grant execute on function public.get_openrouter_api_key() to service_role;
