-- Restrict database admin rights (public.is_admin()) to exactly two accounts.
-- Removes every other row from public.admins. Safe to run more than once.

delete from public.admins
where lower(email) not in (
  'andrewvillalon.dev@gmail.com',
  'unorally2026@gmail.com'
);

insert into public.admins (email)
values
  ('andrewvillalon.dev@gmail.com'),
  ('unorally2026@gmail.com')
on conflict (email) do nothing;
