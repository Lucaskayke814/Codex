create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null check (amount >= 0),
  category text not null check (length(trim(category)) > 0),
  expense_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_email on public.profiles (email);
create index if not exists idx_expenses_user_id on public.expenses (user_id);
create index if not exists idx_expenses_created_at on public.expenses (created_at desc);
create index if not exists idx_expenses_expense_date on public.expenses (expense_date desc);

alter table public.profiles enable row level security;
alter table public.expenses enable row level security;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace trigger set_expenses_updated_at
before update on public.expenses
for each row
execute function public.set_updated_at();

drop policy if exists "users can manage own profile" on public.profiles;
drop policy if exists "users can view own profile" on public.profiles;
drop policy if exists "users can update own profile" on public.profiles;
drop policy if exists "users can insert own profile" on public.profiles;
drop policy if exists "users can delete own profile" on public.profiles;
drop policy if exists "users can read own expenses" on public.expenses;
drop policy if exists "users can insert own expenses" on public.expenses;
drop policy if exists "users can update own expenses" on public.expenses;
drop policy if exists "users can delete own expenses" on public.expenses;

create policy "users can manage own profile"
on public.profiles
for all
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "users can read own expenses"
on public.expenses
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert own expenses"
on public.expenses
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update own expenses"
on public.expenses
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete own expenses"
on public.expenses
for delete
to authenticated
using (auth.uid() = user_id);
