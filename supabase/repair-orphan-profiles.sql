-- Run in Supabase SQL Editor when login succeeds in Auth but the app cannot create/read profiles.
-- It removes profile rows whose auth.users record no longer exists.

delete from public.profiles p
where not exists (
  select 1
  from auth.users u
  where u.id = p.id
);

-- Optional targeted cleanup for one test email:
-- delete from public.profiles
-- where lower(email) = lower('your-test-email@example.com')
-- and not exists (
--   select 1
--   from auth.users u
--   where u.id = profiles.id
-- );
