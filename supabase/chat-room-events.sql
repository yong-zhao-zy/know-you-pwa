-- Enable event-style chat rooms.
-- Run this once in Supabase SQL Editor before using chat renaming.

alter table public.chat_rooms
  add column if not exists title text;

drop policy if exists "rooms_update_participants" on public.chat_rooms;
create policy "rooms_update_participants" on public.chat_rooms
  for update using (auth.uid() = user_a or auth.uid() = user_b)
  with check (auth.uid() = user_a or auth.uid() = user_b);

grant update on public.chat_rooms to authenticated;
