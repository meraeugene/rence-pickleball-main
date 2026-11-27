-- Announcements the admin uploads from /admin and the homepage shows.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to run more than once.
--
-- Access model: announcements are read and written only on the server through
-- the service-role client (admin actions check the admin allowlist first).
-- Row level security is on with no policies, so browser clients cannot read or
-- write this table directly.

begin;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  image_url text,
  image_public_id text,
  published boolean not null default true,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_title_check check (char_length(trim(title)) between 1 and 120),
  constraint announcements_body_check check (body is null or char_length(body) <= 1000)
);

create index if not exists announcements_published_created_idx
  on public.announcements (published, created_at desc);

create or replace function public.touch_announcement_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists announcements_touch_updated_at on public.announcements;
create trigger announcements_touch_updated_at
before update on public.announcements
for each row execute function public.touch_announcement_updated_at();

alter table public.announcements enable row level security;

commit;
