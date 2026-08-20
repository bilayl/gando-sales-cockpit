alter table public.deal_room_events
  add column if not exists visitor_first_name text,
  add column if not exists visitor_last_name text;

alter table public.deal_room_comments
  add column if not exists author_first_name text,
  add column if not exists author_last_name text;
