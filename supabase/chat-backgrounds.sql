-- Persist each participant's pre-chat context and show it in the chat room.
-- Run once in Supabase SQL Editor for existing projects.

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

alter table public.chat_backgrounds enable row level security;

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

grant select, insert, update on public.chat_backgrounds to authenticated;
grant all on public.chat_backgrounds to service_role;
