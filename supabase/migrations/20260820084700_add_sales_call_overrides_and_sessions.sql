create table if not exists public.call_recommendation_overrides (
  contact_id uuid primary key references public.contacts(id) on delete cascade,
  decision text not null check (decision in ('SNOOZED','EXCLUDED')),
  snoozed_until timestamptz,
  reason text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint call_recommendation_override_snooze_date check (
    decision <> 'SNOOZED' or snoozed_until is not null
  )
);

create index if not exists call_recommendation_overrides_decision_idx
  on public.call_recommendation_overrides(decision, snoozed_until);

create table if not exists public.sales_call_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_hubspot_id text,
  target_count integer not null default 80 check (target_count between 1 and 500),
  status text not null default 'OPEN' check (status in ('OPEN','COMPLETED','CANCELLED')),
  created_by text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists sales_call_sessions_owner_status_idx
  on public.sales_call_sessions(owner_hubspot_id, status, created_at desc);

create table if not exists public.sales_call_session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sales_call_sessions(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  position integer not null,
  status text not null default 'QUEUED' check (status in ('QUEUED','CALLED','SKIPPED','REMOVED')),
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, contact_id)
);

create index if not exists sales_call_session_items_queue_idx
  on public.sales_call_session_items(session_id, status, position);

create or replace function public.apply_call_recommendation_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  override_row public.call_recommendation_overrides%rowtype;
begin
  select * into override_row
  from public.call_recommendation_overrides
  where contact_id = new.contact_id;

  if not found then
    return new;
  end if;

  if override_row.decision = 'EXCLUDED' then
    new.score := 0;
    new.bucket := 'EXCLUDED';
    new.priority_label := 'Exclu · décision Sales';
    new.reason := concat_ws(' · ', 'Décision manuelle du responsable Sales', nullif(override_row.reason, ''));
    new.recommended_action := 'Ne pas appeler';
    return new;
  end if;

  if override_row.decision = 'SNOOZED' and override_row.snoozed_until > now() then
    new.score := 0;
    new.bucket := 'SNOOZED';
    new.priority_label := 'À rappeler plus tard';
    new.reason := concat_ws(
      ' · ',
      'Décision manuelle du responsable Sales',
      nullif(override_row.reason, ''),
      'Rappel prévu le ' || to_char(override_row.snoozed_until at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI')
    );
    new.recommended_action := 'Attendre la date de relance';
    new.next_follow_up_at := override_row.snoozed_until;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists call_recommendation_override_before_write on public.call_recommendations;
create trigger call_recommendation_override_before_write
before insert or update on public.call_recommendations
for each row execute function public.apply_call_recommendation_override();
