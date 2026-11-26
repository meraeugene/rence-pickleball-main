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
