-- Manual, contact-level assignment only. Never claim companies during prospecting.
create table if not exists public.cockpit_contact_assignments (
  contact_id text primary key references public.contacts(hubspot_id) on delete cascade,
  assignee_cockpit_email text not null,
  assigned_by_email text,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cockpit_contact_assignments_email_not_blank check (length(btrim(assignee_cockpit_email)) > 3)
);
create index if not exists cockpit_contact_assignments_assignee_idx
  on public.cockpit_contact_assignments(assignee_cockpit_email);
alter table public.cockpit_contact_assignments enable row level security;
revoke all on public.cockpit_contact_assignments from public, anon, authenticated;
grant select, insert, update, delete on public.cockpit_contact_assignments to service_role;
