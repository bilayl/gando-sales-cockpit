alter table public.deal_rooms
  add column if not exists first_contact_at timestamptz,
  add column if not exists proposal_sent_at timestamptz,
  add column if not exists proposal_agreed_at timestamptz,
  add column if not exists contract_uploaded_at timestamptz,
  add column if not exists contract_signed_at timestamptz,
  add column if not exists contract_signed_by_email text;

update public.deal_rooms
set first_contact_at = coalesce(first_contact_at, created_at)
where first_contact_at is null;

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]::text[]
where id = 'sd-room-files';
