-- UNO RALLY updates for 2026-11-25. Paste this whole file into the Supabase SQL editor and run it once.
-- Combines: migrations/20261125000000_add_expenses.sql, 20261125020000_add_recurring_expenses.sql, 20261125010000_restrict_admins.sql, 20261125030000_update_pricing_bands.sql
-- Safe to run more than once. Runs as one transaction: if any part fails, nothing is changed.

begin;

-- ===== 20261125000000_add_expenses.sql =====
-- Manual expense tracking for the admin Expenses & Profit dashboard.
-- Safe to run more than once.
--
-- Access model: expenses are read and written only by server actions through
-- the service-role client after an admin check. Row level security is enabled
-- with no policies, so anon and authenticated browser clients cannot read or
-- write this table directly.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category text not null,
  description text not null,
  amount numeric(12, 2) not null,
  created_by_email text,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_amount_check check (amount > 0),
  constraint expenses_description_check check (char_length(trim(description)) between 1 and 200),
  constraint expenses_category_check check (
    category in (
      'UTILITIES',
      'RENT',
      'STAFF',
      'EQUIPMENT',
      'MAINTENANCE',
      'SUPPLIES',
      'MARKETING',
      'OTHER'
    )
  )
);

create index if not exists expenses_date_idx on public.expenses (expense_date desc);

-- Dedicated trigger function so schema.sql resets (which drop
-- public.touch_updated_at without cascade) are not blocked by this table.
create or replace function public.touch_expense_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expenses_touch_updated_at on public.expenses;
create trigger expenses_touch_updated_at
before update on public.expenses
for each row execute function public.touch_expense_updated_at();

alter table public.expenses enable row level security;

-- ===== 20261125020000_add_recurring_expenses.sql =====
-- Recurring (monthly) expenses for the admin Expenses & Profit dashboard.
-- Requires 20261125000000_add_expenses.sql. Safe to run more than once.
--
-- A recurring expense is a template. public.generate_recurring_expenses()
-- turns each due month into a normal row in public.expenses. It runs every time
-- an admin opens the dashboard, so no cron job is needed. Each template
-- remembers the last month it generated, so deleting a generated expense does
-- not bring it back.

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text not null,
  amount numeric(12, 2) not null,
  day_of_month integer not null,
  start_month date not null,
  last_generated_month date,
  active boolean not null default true,
  created_by_email text,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_expenses_amount_check check (amount > 0),
  constraint recurring_expenses_description_check check (char_length(trim(description)) between 1 and 200),
  constraint recurring_expenses_day_check check (day_of_month between 1 and 31),
  constraint recurring_expenses_start_month_check check (start_month = date_trunc('month', start_month)::date),
  constraint recurring_expenses_category_check check (
    category in (
      'UTILITIES',
      'RENT',
      'STAFF',
      'EQUIPMENT',
      'MAINTENANCE',
      'SUPPLIES',
      'MARKETING',
      'OTHER'
    )
  )
);

drop trigger if exists recurring_expenses_touch_updated_at on public.recurring_expenses;
create trigger recurring_expenses_touch_updated_at
before update on public.recurring_expenses
for each row execute function public.touch_expense_updated_at();

alter table public.recurring_expenses enable row level security;

alter table public.expenses
  add column if not exists recurring_expense_id uuid
    references public.recurring_expenses(id) on delete set null,
  add column if not exists occurrence_month date;

create unique index if not exists expenses_recurring_occurrence_unique
on public.expenses (recurring_expense_id, occurrence_month)
where recurring_expense_id is not null;

create or replace function public.generate_recurring_expenses(p_today date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template record;
  v_month date;
  v_last_day integer;
  v_occurrence date;
  v_inserted integer := 0;
  v_rows integer;
begin
  for v_template in
    select *
    from public.recurring_expenses
    where active
    order by created_at
    for update
  loop
    v_month := coalesce(
      (v_template.last_generated_month + interval '1 month')::date,
      v_template.start_month
    );
    if v_month < v_template.start_month then
      v_month := v_template.start_month;
    end if;

    while v_month <= date_trunc('month', p_today)::date loop
      v_last_day := extract(day from (v_month + interval '1 month' - interval '1 day'))::integer;
      v_occurrence := v_month + (least(v_template.day_of_month, v_last_day) - 1);
      exit when v_occurrence > p_today;

      insert into public.expenses (
        expense_date,
        category,
        description,
        amount,
        created_by_email,
        updated_by_email,
        recurring_expense_id,
        occurrence_month
      )
      values (
        v_occurrence,
        v_template.category,
        v_template.description,
        v_template.amount,
        v_template.created_by_email,
        v_template.created_by_email,
        v_template.id,
        v_month
      )
      on conflict do nothing;

      get diagnostics v_rows = row_count;
      v_inserted := v_inserted + v_rows;

      update public.recurring_expenses
      set last_generated_month = v_month
      where id = v_template.id;

      v_month := (v_month + interval '1 month')::date;
    end loop;
  end loop;

  return v_inserted;
end;
$$;

revoke execute on function public.generate_recurring_expenses(date) from public;
revoke execute on function public.generate_recurring_expenses(date) from anon;
revoke execute on function public.generate_recurring_expenses(date) from authenticated;
grant execute on function public.generate_recurring_expenses(date) to service_role;

-- ===== 20261125010000_restrict_admins.sql =====
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

-- ===== 20261125030000_update_pricing_bands.sql =====
-- Rates: 8am-3pm PHP 300, 3pm-10pm PHP 350, 10pm-1am PHP 380.
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
