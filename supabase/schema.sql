-- Know You production schema for Supabase Auth + PostgreSQL.
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nickname text not null,
  avatar_color text not null default '#E8E0F0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_user, to_user)
);

create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  room_key text not null unique,
  title text,
  created_at timestamptz not null default now(),
  check (user_a <> user_b)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_backgrounds (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null default '',
  emotion text not null default 'other',
  hope text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.ai_interpretations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.messages(id) on delete cascade,
  interpretation text not null,
  receiver_hint text not null,
  guess_options jsonb not null default '[]'::jsonb,
  confirmed boolean not null default false,
  understood boolean not null default false,
  expanded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nickname, avatar_color)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'nickname', split_part(coalesce(new.email, '新用户'), '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#E8E0F0')
  )
  on conflict (id) do update set
    email = excluded.email,
    nickname = excluded.nickname,
    avatar_color = excluded.avatar_color,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.accept_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    insert into public.friendships (user_id, friend_id)
    values (new.from_user, new.to_user), (new.to_user, new.from_user)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_friend_request_accepted on public.friend_requests;
create trigger on_friend_request_accepted
after update on public.friend_requests
for each row execute function public.accept_friend_request();

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_backgrounds enable row level security;
alter table public.messages enable row level security;
alter table public.ai_interpretations enable row level security;
alter table public.password_reset_requests enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
for select to authenticated using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "friend_requests_select_related" on public.friend_requests;
create policy "friend_requests_select_related" on public.friend_requests
for select to authenticated using (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists "friend_requests_insert_own" on public.friend_requests;
create policy "friend_requests_insert_own" on public.friend_requests
for insert to authenticated with check (auth.uid() = from_user and from_user <> to_user);

drop policy if exists "friend_requests_update_recipient" on public.friend_requests;
create policy "friend_requests_update_recipient" on public.friend_requests
for update to authenticated using (auth.uid() = to_user) with check (auth.uid() = to_user);

drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own" on public.friendships
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "rooms_select_participants" on public.chat_rooms;
create policy "rooms_select_participants" on public.chat_rooms
for select to authenticated using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "rooms_insert_participant" on public.chat_rooms;
create policy "rooms_insert_participant" on public.chat_rooms
for insert to authenticated with check (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "rooms_update_participants" on public.chat_rooms;
create policy "rooms_update_participants" on public.chat_rooms
for update to authenticated using (auth.uid() = user_a or auth.uid() = user_b)
with check (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "backgrounds_select_participants" on public.chat_backgrounds;
create policy "backgrounds_select_participants" on public.chat_backgrounds
for select to authenticated using (
  exists (
    select 1 from public.chat_rooms r
    where r.id = room_id and (r.user_a = auth.uid() or r.user_b = auth.uid())
  )
);

drop policy if exists "backgrounds_upsert_own" on public.chat_backgrounds;
create policy "backgrounds_upsert_own" on public.chat_backgrounds
for insert to authenticated with check (
  auth.uid() = user_id and exists (
    select 1 from public.chat_rooms r
    where r.id = room_id and (r.user_a = auth.uid() or r.user_b = auth.uid())
  )
);

drop policy if exists "backgrounds_update_own" on public.chat_backgrounds;
create policy "backgrounds_update_own" on public.chat_backgrounds
for update to authenticated using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (
    select 1 from public.chat_rooms r
    where r.id = room_id and (r.user_a = auth.uid() or r.user_b = auth.uid())
  )
);

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants" on public.messages
for select to authenticated using (
  exists (
    select 1 from public.chat_rooms r
    where r.id = room_id and (r.user_a = auth.uid() or r.user_b = auth.uid())
  )
);

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender" on public.messages
for insert to authenticated with check (
  auth.uid() = sender_id and exists (
    select 1 from public.chat_rooms r
    where r.id = room_id and (r.user_a = auth.uid() or r.user_b = auth.uid())
  )
);

drop policy if exists "interpretations_select_participants" on public.ai_interpretations;
create policy "interpretations_select_participants" on public.ai_interpretations
for select to authenticated using (
  exists (
    select 1 from public.messages m
    join public.chat_rooms r on r.id = m.room_id
    where m.id = message_id and (r.user_a = auth.uid() or r.user_b = auth.uid())
  )
);

drop policy if exists "interpretations_insert_participants" on public.ai_interpretations;
create policy "interpretations_insert_participants" on public.ai_interpretations
for insert to authenticated with check (
  exists (
    select 1 from public.messages m
    join public.chat_rooms r on r.id = m.room_id
    where m.id = message_id and (r.user_a = auth.uid() or r.user_b = auth.uid())
  )
);

drop policy if exists "interpretations_update_participants" on public.ai_interpretations;
create policy "interpretations_update_participants" on public.ai_interpretations
for update to authenticated using (
  exists (
    select 1 from public.messages m
    join public.chat_rooms r on r.id = m.room_id
    where m.id = message_id and (r.user_a = auth.uid() or r.user_b = auth.uid())
  )
);

drop policy if exists "password_reset_select_friend" on public.password_reset_requests;
create policy "password_reset_select_friend" on public.password_reset_requests
for select to authenticated using (auth.uid() = friend_user);

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.friend_requests to authenticated;
grant select, insert on public.friendships to authenticated;
grant select, insert, update on public.chat_rooms to authenticated;
grant select, insert, update on public.chat_backgrounds to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update on public.ai_interpretations to authenticated;
grant select on public.password_reset_requests to authenticated;
grant all on public.profiles to service_role;
grant all on public.friend_requests to service_role;
grant all on public.friendships to service_role;
grant all on public.chat_rooms to service_role;
grant all on public.chat_backgrounds to service_role;
grant all on public.messages to service_role;
grant all on public.ai_interpretations to service_role;
grant all on public.password_reset_requests to service_role;
