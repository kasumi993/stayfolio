-- Keep only the privileges the app needs. TRUNCATE in particular ignores
-- row-level security, so no client role may hold it.
revoke truncate, references, trigger on all tables in schema public from authenticated, anon;
revoke insert, update, delete on public.ai_usage from authenticated, anon;

-- New tables must not become readable by default.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;

-- Deletes the signed-in user and, by cascade, every row they own.
-- (App Store rule: accounts created in the app must be deletable in the app.)
-- Stored files are removed by the app through the Storage API beforehand.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = (select auth.uid());
end $$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
