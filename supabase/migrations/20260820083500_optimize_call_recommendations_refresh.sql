create index if not exists activities_contact_type_occurred_idx
  on public.activities (contact_id, activity_type, occurred_at desc)
  where contact_id is not null;

create index if not exists tasks_contact_due_idx
  on public.tasks (contact_id, due_at)
  where contact_id is not null and due_at is not null;

create or replace function public.refresh_call_recommendations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  -- Several stale page loads can otherwise start the same full rebuild concurrently.
  if not pg_try_advisory_xact_lock(hashtext('gando_refresh_call_recommendations')::bigint) then
    select count(*)::int into current_count from public.call_recommendations;
    return current_count;
  end if;

  with activity_rollup as (
    select
      a.contact_id,
      max(a.occurred_at) filter (where a.activity_type = 'call') as last_call_at,
      coalesce(
        bool_or(
          a.activity_type = 'meeting'
          and a.occurred_at > now()
          and lower(coalesce(a.outcome,'')) not in ('canceled','cancelled','annulé','annule')
        ),
        false
      ) as has_future_meeting
    from public.activities a
    where a.contact_id is not null
      and a.activity_type in ('call','meeting')
    group by a.contact_id
  ),
  task_rollup as (
    select
      t.contact_id,
      count(*) filter (
        where upper(coalesce(t.status,'')) not in ('COMPLETED','DONE')
          and t.due_at <= now()
      )::int as overdue_tasks
    from public.tasks t
    where t.contact_id is not null
      and t.due_at is not null
    group by t.contact_id
  ),
  contact_facts as (
    select
      c.id as contact_id,
      c.hubspot_id as hubspot_contact_id,
      c.owner_hubspot_id,
      nullif(btrim(coalesce(c.raw_data->'properties'->>'statut_de_lappel','')), '') as call_status,
      nullif(btrim(coalesce(c.raw_data->'properties'->>'statut_prospection','')), '') as prospecting_status,
      nullif(btrim(coalesce(c.raw_data->'properties'->>'resultat_prospection','')), '') as prospecting_result,
      case
        when coalesce(c.raw_data->'properties'->>'date_prochaine_relance','') ~ '^\d{4}-\d{2}-\d{2}'
          then (c.raw_data->'properties'->>'date_prochaine_relance')::timestamptz
        else null
      end as next_follow_up_at,
      case
        when coalesce(c.raw_data->'properties'->>'notes_last_contacted','') ~ '^\d{4}-\d{2}-\d{2}'
          then (c.raw_data->'properties'->>'notes_last_contacted')::timestamptz
        when coalesce(c.raw_data->'properties'->>'hs_last_sales_activity_timestamp','') ~ '^\d{4}-\d{2}-\d{2}'
          then (c.raw_data->'properties'->>'hs_last_sales_activity_timestamp')::timestamptz
        else null
      end as last_contacted_at,
      ar.last_call_at,
      coalesce(tr.overdue_tasks, 0) as overdue_tasks,
      coalesce(ar.has_future_meeting, false) as has_future_meeting,
      lower(translate(coalesce(c.raw_data->'properties'->>'statut_de_lappel',''), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy')) as call_status_norm,
      lower(translate(coalesce(c.raw_data->'properties'->>'statut_prospection',''), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy')) as prospecting_status_norm,
      lower(translate(coalesce(c.raw_data->'properties'->>'resultat_prospection',''), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy')) as prospecting_result_norm,
      c.phone
    from public.contacts c
    left join activity_rollup ar on ar.contact_id = c.id
    left join task_rollup tr on tr.contact_id = c.id
  ),
  scored as (
    select
      f.*,
      case
        when f.phone is null or btrim(f.phone) = '' then 'EXCLUDED'
        when f.prospecting_status_norm ~ '(perdu|non qualifie)'
          or f.call_status_norm ~ '(hors cible|pas interesse|numero invalide)'
          or f.prospecting_result_norm ~ '(perdu|hors cible|pas interesse)' then 'EXCLUDED'
        when f.has_future_meeting
          or f.prospecting_status_norm ~ '(rdv booke|rdv|opportunite)'
          or f.prospecting_result_norm ~ '(rdv obtenu|rdv|signe|gagne)' then 'OPPORTUNITY'
        when f.next_follow_up_at is not null and f.next_follow_up_at > now() then 'SNOOZED'
        else 'ACTIONABLE'
      end as bucket,
      least(100, greatest(0,
        45
        + case when f.next_follow_up_at is not null and f.next_follow_up_at <= now() then 35 else 0 end
        + case when f.call_status_norm ~ '(interesse|a rappeler|attente decision)' then 28 else 0 end
        + case when f.prospecting_status_norm ~ '(conversation|en prospection)' then 14 else 0 end
        + case when f.call_status_norm ~ '(occupe)' then 18 else 0 end
        + case when f.call_status_norm ~ '(^| )nrp($| )' then 12 else 0 end
        + least(f.overdue_tasks * 8, 20)
        + case when f.last_call_at is null and f.last_contacted_at is null then 8 else 0 end
        + case when coalesce(f.last_call_at, f.last_contacted_at) < now() - interval '7 days' then 8 else 0 end
        - case when coalesce(f.last_call_at, f.last_contacted_at) > now() - interval '24 hours'
            and not (f.next_follow_up_at is not null and f.next_follow_up_at <= now()) then 18 else 0 end
      ))::int as score
    from contact_facts f
  ),
  prepared as (
    select
      s.contact_id,
      s.hubspot_contact_id,
      case when s.bucket = 'ACTIONABLE' then s.score else 0 end as score,
      case
        when s.bucket = 'EXCLUDED' then 'Exclu'
        when s.bucket = 'OPPORTUNITY' then 'Opportunité'
        when s.bucket = 'SNOOZED' then 'À échéance'
        when s.score >= 90 then 'P1 · À appeler'
        when s.score >= 80 then 'P2 · Prioritaire'
        when s.score >= 65 then 'P3 · Recontact'
        when s.score >= 50 then 'P4 · À traiter'
        else 'P5 · À qualifier'
      end as priority_label,
      s.bucket,
      concat_ws(' · ',
        case when s.next_follow_up_at is not null and s.next_follow_up_at <= now() then 'Relance arrivée à échéance' end,
        case when s.call_status is not null then 'Dernier statut appel : ' || s.call_status end,
        case when s.prospecting_status is not null then 'Prospection : ' || s.prospecting_status end,
        case when s.prospecting_result is not null then 'Résultat : ' || s.prospecting_result end,
        case when s.overdue_tasks > 0 then s.overdue_tasks::text || ' tâche(s) HubSpot en retard' end,
        case when s.last_call_at is null and s.last_contacted_at is null then 'Aucun appel enregistré' end,
        case when s.bucket = 'OPPORTUNITY' then 'Rendez-vous ou opportunité déjà en cours' end,
        case when s.bucket = 'SNOOZED' then 'Relance planifiée dans le futur' end,
        case when s.bucket = 'EXCLUDED' then 'Contact retiré de la prospection active' end
      ) as reason,
      case
        when s.bucket = 'EXCLUDED' then 'Ne pas appeler'
        when s.bucket = 'OPPORTUNITY' then 'Préparer le rendez-vous / deal'
        when s.bucket = 'SNOOZED' then 'Attendre la date de relance'
        when s.next_follow_up_at is not null and s.next_follow_up_at <= now() then 'Rappeler maintenant'
        when s.call_status_norm ~ '(interesse)' then 'Relancer le contact chaud'
        when s.call_status_norm ~ '(a rappeler)' then 'Rappeler maintenant'
        when s.call_status_norm ~ '(occupe|nrp)' then 'Retenter l’appel'
        when s.prospecting_status_norm ~ 'conversation' then 'Faire avancer la conversation'
        when s.last_call_at is null and s.last_contacted_at is null then 'Effectuer le premier appel'
        else 'Appeler et qualifier'
      end as recommended_action,
      s.call_status,
      s.prospecting_status,
      s.prospecting_result,
      s.next_follow_up_at,
      s.last_contacted_at,
      s.last_call_at,
      s.overdue_tasks,
      s.has_future_meeting,
      now() as evaluated_at
    from scored s
  )
  insert into public.call_recommendations (
    contact_id, hubspot_contact_id, score, priority_label, bucket, reason, recommended_action,
    call_status, prospecting_status, prospecting_result, next_follow_up_at, last_contacted_at,
    last_call_at, overdue_tasks, has_future_meeting, evaluated_at
  )
  select
    contact_id, hubspot_contact_id, score, priority_label, bucket,
    case when reason = '' then 'Contact à qualifier selon les données disponibles' else reason end,
    recommended_action, call_status, prospecting_status, prospecting_result,
    next_follow_up_at, last_contacted_at, last_call_at, overdue_tasks, has_future_meeting, evaluated_at
  from prepared
  on conflict (contact_id) do update set
    hubspot_contact_id = excluded.hubspot_contact_id,
    score = excluded.score,
    priority_label = excluded.priority_label,
    bucket = excluded.bucket,
    reason = excluded.reason,
    recommended_action = excluded.recommended_action,
    call_status = excluded.call_status,
    prospecting_status = excluded.prospecting_status,
    prospecting_result = excluded.prospecting_result,
    next_follow_up_at = excluded.next_follow_up_at,
    last_contacted_at = excluded.last_contacted_at,
    last_call_at = excluded.last_call_at,
    overdue_tasks = excluded.overdue_tasks,
    has_future_meeting = excluded.has_future_meeting,
    evaluated_at = excluded.evaluated_at;

  delete from public.call_recommendations r
  where not exists (select 1 from public.contacts c where c.id = r.contact_id);

  select count(*)::int into current_count from public.call_recommendations;
  return current_count;
end;
$$;
