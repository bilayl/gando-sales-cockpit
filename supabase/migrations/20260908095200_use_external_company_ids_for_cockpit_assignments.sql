alter table public.cockpit_company_assignments
  drop constraint if exists cockpit_company_assignments_company_id_fkey;

alter table public.cockpit_company_assignments
  alter column company_id type text using company_id::text;

comment on column public.cockpit_company_assignments.company_id is
  'External CRM company identifier used by the Cockpit; not a HubSpot owner assignment.';
