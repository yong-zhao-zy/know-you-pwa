-- Enable Supabase Realtime events for chat messages and AI interpretation updates.
-- Run this once in Supabase SQL Editor.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ai_interpretations'
  ) then
    alter publication supabase_realtime add table public.ai_interpretations;
  end if;
end $$;

alter table public.messages replica identity full;
alter table public.ai_interpretations replica identity full;
