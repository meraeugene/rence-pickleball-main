-- =====================================================================
-- Dink Lab / UNO RALLY - demo seed data
-- Run AFTER full-schema.sql, in the Supabase SQL Editor.
--
-- Adds realistic demo data dated around TODAY (Asia/Manila):
--   * 25 demo customers
--   * bookings on both courts from 60 days ago to 14 days ahead
--     (accepted, pending review, cancelled, rejected; BPI / GoTyme / onsite;
--      1-hour and 2-hour booking groups)
--   * ~40 one-off expenses over the last 3 months
--   * 3 monthly recurring expenses (rent, staff, internet) and their
--     generated monthly rows
--
-- Every seed row is tagged so remove-seed-data.sql can delete it without
-- touching real data:
--   bookings  : user_email like 'seed-%@example.test'
--   expenses  : created_by_email = 'seed@example.test'
--
-- Safe to run again: it first removes the previous seed data, then
-- re-creates it on fresh dates. Slots already taken by real bookings are
-- skipped. Runs as one transaction.
--
-- Seed bookings have no Supabase Auth owner (user_id is null), so they show
-- in the admin dashboard but not on any customer's "My bookings" page.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Clear previous seed data
-- ---------------------------------------------------------------------
delete from public.expenses where created_by_email = 'seed@example.test';
delete from public.recurring_expenses where created_by_email = 'seed@example.test';
delete from public.bookings where user_email like 'seed-%@example.test';

-- ---------------------------------------------------------------------
-- 2. Bookings
-- ---------------------------------------------------------------------
with
customers as (
  select
    n,
    (array[
      'Miguel Santos','Andrea Cruz','Paolo Reyes','Bea Garcia','Carlo Mendoza',
      'Isabel Ramos','Joshua Tan','Kristine Villanueva','Marco Aquino','Nicole Bautista',
      'Rafael Torres','Sofia Lim','Gabriel Navarro','Jasmine Dela Cruz','Luis Fernandez',
      'Patricia Gonzales','Enzo Castillo','Camille Rivera','Daniel Ong','Hannah Lopez',
      'Adrian Pascual','Trisha Morales','Kevin Sy','Alyssa Domingo','Ramon Salazar'
    ])[n] as full_name
  from generate_series(1, 25) as n
),
customer_rows as (
  select
    n,
    full_name,
    'seed-' || lower(replace(full_name, ' ', '.')) || '@example.test' as email,
    '+63917' || lpad((1200000 + n * 37)::text, 7, '0') as contact
  from customers
),
-- Candidate blocks per day and court: 2-hour blocks starting 8,10,...,22
-- and a 1-hour block at 24:00 (12 midnight to 1 AM).
blocks as (
  select
    d as day_offset,
    c.court_id,
    c.court_no,
    b.start_hour,
    case when b.start_hour = 24 then 1 else 2 end as block_len,
    abs(hashtext(d::text || '-' || c.court_no::text || '-' || b.start_hour::text)) % 100 as roll
  from generate_series(-60, 14) as d
  cross join (values
    ('00000000-0000-0000-0000-000000000001'::uuid, 1),
    ('00000000-0000-0000-0000-000000000002'::uuid, 2)
  ) as c(court_id, court_no)
  cross join (values (8),(10),(12),(14),(16),(18),(20),(22),(24)) as b(start_hour)
),
picked as (
  select
    *,
    -- evenings are busier than mornings
    case when start_hour >= 16 then 70 when start_hour >= 12 then 45 else 35 end as fill_pct
  from blocks
),
groups as (
  select
    gen_random_uuid() as group_id,
    p.day_offset,
    p.court_id,
    p.start_hour,
    -- some 2-hour blocks are booked as a single hour
    case when p.block_len = 2 and p.roll % 3 = 0 then 1 else p.block_len end as hours_booked,
    p.roll,
    ((p.roll * 7 + p.day_offset + 60) % 25) + 1 as customer_n,
    case
      when p.day_offset < 0 then
        case when p.roll % 10 < 8 then 'ACCEPTED'
             when p.roll % 10 = 8 then 'CANCELLED'
             else 'REJECTED' end
      else
        case when p.roll % 10 < 6 then 'ACCEPTED'
             when p.roll % 10 < 9 then 'PENDING_REVIEW'
             else 'CANCELLED' end
    end::public.booking_status as status,
    case p.roll % 3
      when 0 then 'BPI'
      when 1 then 'GOTYME'
      else 'ONSITE'
    end::public.payment_method as payment_method
  from picked p
  where p.roll < p.fill_pct
),
slots as (
  select
    g.*,
    g.start_hour + h as slot_hour,
    ((now() at time zone 'Asia/Manila')::date + g.day_offset) as slot_date
  from groups g
  cross join lateral generate_series(0, g.hours_booked - 1) as h
),
slot_rows as (
  select
    s.*,
    ((s.slot_date + make_interval(hours => s.slot_hour))::timestamp
      at time zone 'Asia/Manila') as start_at,
    ((s.slot_date + make_interval(hours => s.slot_hour + 1))::timestamp
      at time zone 'Asia/Manila') as end_at,
    case when s.slot_hour < 12 then 200 when s.slot_hour < 16 then 250 else 300 end as rate
  from slots s
),
free_slots as (
  -- skip any slot that would clash with a real active booking
  select sr.*
  from slot_rows sr
  where not exists (
    select 1
    from public.bookings existing
    where existing.court_id = sr.court_id
      and existing.status in ('PENDING_REVIEW', 'ACCEPTED')
      and existing.start_at < sr.end_at
      and existing.end_at > sr.start_at
  )
)
insert into public.bookings (
  booking_group_id, court_id, user_id, user_email, customer_name,
  customer_avatar_url, customer_contact, start_at, end_at, hourly_rate,
  total_amount, downpayment_amount, payment_method, payment_status,
  payment_reference, payment_proof_url, payment_proof_public_id, status,
  accepted_at, cancelled_at, reviewed_at, reviewed_by_email, review_reason,
  reminder_sent_at, created_at, updated_at
)
select
  f.group_id,
  f.court_id,
  null,
  cr.email,
  cr.full_name,
  'https://api.dicebear.com/9.x/initials/svg?seed=' || replace(cr.full_name, ' ', '%20'),
  cr.contact,
  f.start_at,
  f.end_at,
  f.rate,
  f.rate,
  case
    -- past accepted bookings: mostly settled in full
    when f.status = 'ACCEPTED' and f.day_offset < 0 and f.roll % 5 <> 0 then f.rate
    when f.payment_method = 'ONSITE' then 0
    else f.rate / 2
  end,
  f.payment_method,
  'UNVERIFIED', -- trigger recalculates this for ACCEPTED rows
  case when f.payment_method = 'ONSITE' then null
       else 'SEED-' || upper(substr(replace(f.group_id::text, '-', ''), 1, 10)) end,
  case when f.payment_method = 'ONSITE' then null
       else 'https://res.cloudinary.com/demo/image/upload/sample.jpg' end,
  case when f.payment_method = 'ONSITE' then null
       else 'seed/payment-proof-' || f.group_id::text end,
  f.status,
  case when f.status = 'ACCEPTED' then f.start_at - interval '2 days' end,
  case when f.status = 'CANCELLED' then f.start_at - interval '1 day' end,
  case when f.status <> 'PENDING_REVIEW' then f.start_at - interval '2 days' end,
  case when f.status <> 'PENDING_REVIEW' then 'unorally2026@gmail.com' end,
  case f.status
    when 'REJECTED' then 'Payment proof could not be verified.'
    when 'CANCELLED' then 'Customer requested cancellation.'
  end,
  case when f.status = 'ACCEPTED' and f.day_offset < 0 then f.start_at - interval '1 day' end,
  f.start_at - interval '3 days',
  f.start_at - interval '2 days'
from free_slots f
join customer_rows cr on cr.n = f.customer_n
order by f.start_at, f.court_id;

-- ---------------------------------------------------------------------
-- 3. One-off expenses (last 3 months)
-- ---------------------------------------------------------------------
insert into public.expenses (
  expense_date, category, description, amount, created_by_email, updated_by_email
)
select
  ((now() at time zone 'Asia/Manila')::date - e.days_ago),
  e.category,
  e.description,
  e.amount,
  'seed@example.test',
  'seed@example.test'
from (values
  (2,  'UTILITIES',   'Electricity bill (Meralco)',          8450.00),
  (5,  'SUPPLIES',    'Pickleballs - 2 dozen',               2400.00),
  (8,  'MAINTENANCE', 'Court line repainting',               3500.00),
  (10, 'SUPPLIES',    'Drinking water refill',                450.00),
  (12, 'MARKETING',   'Facebook ads - weekend promo',        1500.00),
  (15, 'EQUIPMENT',   'Replacement net - Court 2',           4200.00),
  (18, 'SUPPLIES',    'Cleaning supplies',                    780.00),
  (21, 'OTHER',       'Tournament trophies',                 2600.00),
  (24, 'SUPPLIES',    'Drinking water refill',                450.00),
  (27, 'MAINTENANCE', 'Aircon cleaning',                     2200.00),
  (32, 'UTILITIES',   'Electricity bill (Meralco)',          9120.00),
  (34, 'EQUIPMENT',   'Rental paddles - 4 pcs',              6000.00),
  (37, 'SUPPLIES',    'Towels and first aid kit',            1150.00),
  (40, 'MARKETING',   'Printed flyers',                       900.00),
  (43, 'SUPPLIES',    'Drinking water refill',                450.00),
  (46, 'MAINTENANCE', 'Light bulb replacement',              1300.00),
  (49, 'OTHER',       'Business permit processing',          3000.00),
  (52, 'SUPPLIES',    'Pickleballs - 1 dozen',               1200.00),
  (55, 'MARKETING',   'Facebook ads - open play',            1200.00),
  (58, 'SUPPLIES',    'Cleaning supplies',                    650.00),
  (62, 'UTILITIES',   'Electricity bill (Meralco)',          8790.00),
  (65, 'SUPPLIES',    'Drinking water refill',                450.00),
  (68, 'MAINTENANCE', 'Court surface patching',              5400.00),
  (71, 'EQUIPMENT',   'Ball hopper',                         1800.00),
  (74, 'OTHER',       'Staff uniforms',                      2500.00),
  (77, 'SUPPLIES',    'Drinking water refill',                450.00),
  (80, 'MARKETING',   'Instagram ads',                       1000.00),
  (84, 'SUPPLIES',    'Cleaning supplies',                    720.00),
  (88, 'MAINTENANCE', 'Plumbing repair - comfort room',      1900.00)
) as e(days_ago, category, description, amount);

-- ---------------------------------------------------------------------
-- 4. Recurring monthly expenses (+ generate their monthly rows)
-- ---------------------------------------------------------------------
insert into public.recurring_expenses (
  category, description, amount, day_of_month, start_month, active,
  created_by_email, updated_by_email
)
values
  ('RENT',      'Venue rent',                45000.00, 1,
    (date_trunc('month', (now() at time zone 'Asia/Manila')::date) - interval '3 months')::date,
    true, 'seed@example.test', 'seed@example.test'),
  ('STAFF',     'Court staff salaries',      24000.00, 15,
    (date_trunc('month', (now() at time zone 'Asia/Manila')::date) - interval '3 months')::date,
    true, 'seed@example.test', 'seed@example.test'),
  ('UTILITIES', 'Internet (fiber plan)',      1899.00, 5,
    (date_trunc('month', (now() at time zone 'Asia/Manila')::date) - interval '3 months')::date,
    true, 'seed@example.test', 'seed@example.test');

select public.generate_recurring_expenses((now() at time zone 'Asia/Manila')::date);

commit;

-- ---------------------------------------------------------------------
-- Summary
-- ---------------------------------------------------------------------
select status::text as booking_status, count(*) as rows, sum(total_amount) as total_php
from public.bookings
where user_email like 'seed-%@example.test'
group by status
order by status;

select 'seed booking groups' as metric, count(distinct booking_group_id) as value
from public.bookings where user_email like 'seed-%@example.test'
union all
select 'seed expenses', count(*) from public.expenses where created_by_email = 'seed@example.test'
union all
select 'seed recurring templates', count(*) from public.recurring_expenses where created_by_email = 'seed@example.test';
