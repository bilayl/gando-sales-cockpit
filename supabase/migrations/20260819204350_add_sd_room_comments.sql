create table if not exists public.deal_room_comments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.deal_rooms(id) on delete cascade,
  document_code text not null check (document_code in ('SD01', 'SD02', 'SD03', 'SD04', 'SD05')),
  section_key text,
  author_email text not null,
  body text not null check (char_length(body) between 3 and 4000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_email text
);

create index if not exists deal_room_comments_room_created_idx
  on public.deal_room_comments (room_id, created_at desc);

alter table public.deal_room_comments enable row level security;
revoke all on table public.deal_room_comments from anon, authenticated;
grant all on table public.deal_room_comments to service_role;
