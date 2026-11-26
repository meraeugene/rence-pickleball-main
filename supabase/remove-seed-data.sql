-- =====================================================================
-- Dink Lab / UNO RALLY - remove demo seed data
-- Deletes ONLY the rows created by seed-data.sql. Real bookings, expenses,
-- courts, pricing, settings and admins are not touched.
-- Run in the Supabase SQL Editor. Runs as one transaction.
-- =====================================================================

begin;

-- Expenses first (generated recurring rows reference the templates).
delete from public.expenses
where created_by_email = 'seed@example.test';

delete from public.recurring_expenses
where created_by_email = 'seed@example.test';

delete from public.bookings
where user_email like 'seed-%@example.test';

commit;

-- Should all be 0.
select 'seed bookings left' as metric, count(*) as value
from public.bookings where user_email like 'seed-%@example.test'
union all
select 'seed expenses left', count(*) from public.expenses where created_by_email = 'seed@example.test'
union all
select 'seed recurring templates left', count(*) from public.recurring_expenses where created_by_email = 'seed@example.test';
