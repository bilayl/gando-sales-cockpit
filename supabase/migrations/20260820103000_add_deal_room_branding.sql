alter table public.deal_rooms
  add column if not exists brand_banner_image_url text,
  add column if not exists brand_theme text not null default 'gando',
  add column if not exists brand_title text,
  add column if not exists brand_subtitle text;

alter table public.deal_rooms
  drop constraint if exists deal_rooms_brand_theme_check;

alter table public.deal_rooms
  add constraint deal_rooms_brand_theme_check
  check (brand_theme in ('gando', 'gradient', 'dark', 'light'));
