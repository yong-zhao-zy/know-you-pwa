-- Enable AI guide messages in the shared chat stream.
-- Run this once in Supabase SQL Editor for existing projects.

alter table public.messages
  alter column sender_id drop not null;

alter table public.messages
  add column if not exists sender_type text not null default 'user',
  add column if not exists message_kind text not null default 'normal';

alter table public.messages
  drop constraint if exists messages_sender_type_check,
  add constraint messages_sender_type_check
    check (sender_type in ('user', 'ai'));

alter table public.messages
  drop constraint if exists messages_message_kind_check,
  add constraint messages_message_kind_check
    check (
      message_kind in (
        'normal',
        'ai_opening_question',
        'ai_clarifying_question',
        'ai_pattern_observation',
        'ai_next_step'
      )
    );

alter table public.messages
  drop constraint if exists messages_sender_shape_check,
  add constraint messages_sender_shape_check
    check (
      (sender_type = 'user' and sender_id is not null)
      or (sender_type = 'ai' and sender_id is null)
    );

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender" on public.messages
for insert to authenticated with check (
  exists (
    select 1 from public.chat_rooms r
    where r.id = room_id and (r.user_a = auth.uid() or r.user_b = auth.uid())
  )
  and (
    (sender_type = 'user' and auth.uid() = sender_id)
    or (sender_type = 'ai' and sender_id is null)
  )
);
