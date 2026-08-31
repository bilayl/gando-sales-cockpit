alter table public.deal_rooms
  add column if not exists room_mode text not null default 'standard'
  check (room_mode in ('standard', 'enterprise'));

create index if not exists deal_rooms_room_mode_idx
  on public.deal_rooms (room_mode, updated_at desc);
