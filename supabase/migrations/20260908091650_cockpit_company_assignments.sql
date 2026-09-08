create table if not exists public.cockpit_company_assignments (
  company_id uuid primary key references public.companies(id) on delete cascade,
  assignee_cockpit_email text not null,
  assigned_by_email text,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cockpit_company_assignments_assignee_idx
  on public.cockpit_company_assignments (lower(assignee_cockpit_email), assigned_at desc);

alter table public.cockpit_company_assignments enable row level security;
revoke all on table public.cockpit_company_assignments from anon, authenticated;
grant select, insert, update, delete on table public.cockpit_company_assignments to service_role;

comment on table public.cockpit_company_assignments is
  'Cockpit-native commercial ownership. Independent from HubSpot owners.';
