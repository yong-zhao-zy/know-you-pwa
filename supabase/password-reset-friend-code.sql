-- Friend-code password reset flow.
-- Run this once in Supabase SQL Editor for existing projects.

create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  account_user uuid not null references public.profiles(id) on delete cascade,
  friend_user uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  status text not null default 'pending' check (status in ('pending', 'used', 'expired')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (account_user <> friend_user)
);

alter table public.password_reset_requests enable row level security;

drop policy if exists "password_reset_select_friend" on public.password_reset_requests;
create policy "password_reset_select_friend" on public.password_reset_requests
for select to authenticated using (auth.uid() = friend_user);
