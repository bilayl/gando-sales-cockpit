create table if not exists public.setter_meeting_reviews (
  meeting_id text primary key,
  qualification_status text not null check (qualification_status in ('qualified','not_qualified','pending')),
  setter_owner_id text null,
  review_note text null,
  updated_by_email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists setter_meeting_reviews_status_idx on public.setter_meeting_reviews (qualification_status);

alter table public.setter_meeting_reviews enable row level security;

revoke all on table public.setter_meeting_reviews from anon, authenticated;
grant all on table public.setter_meeting_reviews to service_role;
