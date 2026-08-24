alter table public.deal_rooms
  add column if not exists meeting_booking_url text;
