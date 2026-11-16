-- Stayfolio — tighten privileges: visitors get nothing but the shared-statement door.
--
-- Account deletion is handled by the `delete-account` edge function (it uses the
-- admin API, which also lets it remove the user's stored files).

revoke all on all tables in schema public from anon, public;
revoke insert, update, delete on public.ai_usage from authenticated;
revoke all on function public.get_shared_statement(text) from public;
grant execute on function public.get_shared_statement(text) to anon, authenticated;
revoke all on function public.bump_ai_usage() from public, anon;
grant execute on function public.bump_ai_usage() to authenticated;
