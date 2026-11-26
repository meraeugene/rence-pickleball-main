-- New hourly rates (effective 2026-11-25):
--   8:00 AM - 3:00 PM   PHP 300
--   3:00 PM - 10:00 PM  PHP 350
--   10:00 PM - 1:00 AM  PHP 380
-- Existing bookings keep the rate they were booked at.
-- Safe to run more than once.

begin;

update public.pricing_bands set active = false where active = true;

insert into public.pricing_bands (label, start_hour, end_hour, hourly_rate, sort_order, active)
values
  ('Day', 8, 15, 300, 10, true),
  ('Evening', 15, 22, 350, 20, true),
  ('Late Night', 22, 25, 380, 30, true);

-- Keep only one copy of the new bands if this file is run again.
delete from public.pricing_bands
where active = false
  and (label, start_hour, end_hour, hourly_rate) in (
    ('Day', 8, 15, 300),
    ('Evening', 15, 22, 350),
    ('Late Night', 22, 25, 380)
  );

update public.booking_settings set close_hour = 25 where id = true and close_hour < 25;

commit;
