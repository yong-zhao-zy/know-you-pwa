-- Fix PostgREST/API table privileges for the existing Supabase project.
-- Run once in Supabase SQL Editor if the app shows:
-- "permission denied for table profiles"

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.friend_requests to authenticated;
grant select, insert on public.friendships to authenticated;
grant select, insert on public.chat_rooms to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update on public.ai_interpretations to authenticated;
grant select on public.password_reset_requests to authenticated;

grant all on public.profiles to service_role;
grant all on public.friend_requests to service_role;
grant all on public.friendships to service_role;
grant all on public.chat_rooms to service_role;
grant all on public.messages to service_role;
grant all on public.ai_interpretations to service_role;
grant all on public.password_reset_requests to service_role;
