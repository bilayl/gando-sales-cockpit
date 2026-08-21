alter table public.cockpit_users
  add column if not exists role text;

update public.cockpit_users
set role = 'admin'
where role is null or role not in ('admin', 'member', 'commercial');

alter table public.cockpit_users
  alter column role set default 'member',
  alter column role set not null;

alter table public.cockpit_users
  drop constraint if exists cockpit_users_role_check;

alter table public.cockpit_users
  add constraint cockpit_users_role_check
  check (role in ('admin', 'member', 'commercial'));

drop function if exists public.verify_cockpit_user(text, text);

create function public.verify_cockpit_user(p_email text, p_password text)
returns table(email text, display_name text, role text)
language sql
security definer
set search_path = public, extensions
as $$
  select u.email, u.display_name, u.role
  from public.cockpit_users u
  where lower(u.email) = lower(trim(p_email))
    and u.active = true
    and extensions.crypt(p_password, u.password_hash) = u.password_hash
  limit 1;
$$;

revoke all on function public.verify_cockpit_user(text, text) from public, anon, authenticated;
grant execute on function public.verify_cockpit_user(text, text) to service_role;

create or replace function public.upsert_cockpit_team_member(
  p_email text,
  p_display_name text,
  p_role text,
  p_password text default null,
  p_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_role text := lower(trim(p_role));
  v_existing public.cockpit_users%rowtype;
  v_active_admins integer;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Adresse email invalide.';
  end if;

  if v_role not in ('admin', 'member', 'commercial') then
    raise exception 'Rôle invalide.';
  end if;

  select * into v_existing
  from public.cockpit_users
  where lower(email) = v_email
  limit 1;

  if found then
    if v_existing.role = 'admin' and v_existing.active = true
       and (v_role <> 'admin' or p_active = false) then
      select count(*) into v_active_admins
      from public.cockpit_users
      where role = 'admin' and active = true;

      if v_active_admins <= 1 then
        raise exception 'Au moins un administrateur actif doit rester dans l’équipe.';
      end if;
    end if;

    update public.cockpit_users
    set display_name = nullif(trim(p_display_name), ''),
        role = v_role,
        active = p_active,
        password_hash = case
          when nullif(p_password, '') is not null then extensions.crypt(p_password, extensions.gen_salt('bf'))
          else password_hash
        end,
        updated_at = now()
    where email = v_existing.email;
  else
    if nullif(p_password, '') is null then
      raise exception 'Un mot de passe temporaire est obligatoire pour un nouveau membre.';
    end if;

    insert into public.cockpit_users (email, password_hash, display_name, role, active)
    values (
      v_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      nullif(trim(p_display_name), ''),
      v_role,
      p_active
    );
  end if;
end;
$$;

revoke all on function public.upsert_cockpit_team_member(text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.upsert_cockpit_team_member(text, text, text, text, boolean) to service_role;

comment on column public.cockpit_users.role is 'Cockpit authorization role: admin, member, or commercial. Commercial users cannot access Deal Room.';
