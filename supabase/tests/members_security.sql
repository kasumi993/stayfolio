-- Security checks for member links. Run against a project with the SQL editor
-- (or the MCP execute_sql tool): it creates two throwaway users, runs every
-- check as `anon` (a link holder), prints one row per check, then deletes
-- everything it created. Every `ok` must be true.
create temp table if not exists t_results (n int, test text, ok boolean, detail text);
grant all on t_results to anon, authenticated;
truncate t_results;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  pa uuid := gen_random_uuid(); pb uuid := gen_random_uuid();
  me uuid := gen_random_uuid(); partner uuid := gen_random_uuid(); pbme uuid := gen_random_uuid();
  xpriv uuid := gen_random_uuid(); xprop uuid := gen_random_uuid(); xother uuid := gen_random_uuid();
  tv text; te text; r jsonb; ok boolean; mid uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-a-' || a || '@example.invalid', '', now(), now(), '{}', '{}'),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-b-' || b || '@example.invalid', '', now(), now(), '{}', '{}');
  insert into public.profiles (id, name) values (a, 'Owner test');
  insert into public.properties (id, owner_id, name, kind, notes, deposit) values (pa, a, 'Appart A', 'partnership', 'secret note', 900000), (pb, b, 'Appart B', 'owned', '', 0);
  insert into public.parties (id, owner_id, property_id, name, is_me) values (me, a, pa, 'Moi', true), (partner, a, pa, 'Associée', false), (pbme, b, pb, 'Moi', true);
  insert into public.rules (owner_id, property_id, effective_from, commission_rate, shares) values (a, pa, '2026-01', 0, jsonb_build_array(jsonb_build_object('party_id', me, 'revenue', 0.6, 'expense', 0.6)));
  insert into public.bookings (owner_id, property_id, check_in, amount) values (a, pa, '2026-11-02', 100000);
  insert into public.expenses (id, owner_id, property_id, date, month, amount, scope) values
    (xpriv, a, pa, '2026-11-03', '2026-11', 5000, 'private'), (xprop, a, pa, '2026-11-04', '2026-11', 20000, 'property'), (xother, b, pb, '2026-11-04', '2026-11', 7000, 'property');
  insert into public.members (owner_id, property_id, name, can_edit, pages) values (a, pa, 'Viewer', false, '{income}') returning token into tv;
  insert into public.members (owner_id, property_id, name, can_edit, pages) values (a, pa, 'Editor', true, '{expenses,invoices}') returning token into te;
  insert into public.members (owner_id, property_id, name, email, monthly_report) values (a, pa, 'Mailer', 'mailer@example.invalid', true) returning id into mid;

  set local role anon;
  r := public.member_load(tv);
  insert into t_results values (1, 'viewer sees income', jsonb_array_length(r->'bookings') = 1, null);
  insert into t_results values (2, 'viewer sees no expenses', jsonb_array_length(r->'expenses') = 0, null);
  insert into t_results values (3, 'no notes, no deposit, owner shown by name', (r->'property'->>'notes') = '' and (r->'property'->>'deposit')::int = 0 and (r->'parties') @> jsonb_build_array(jsonb_build_object('name', 'Owner test', 'is_me', true)), r->>'parties');
  insert into t_results values (4, 'viewer gets no rules', jsonb_array_length(r->'rules') = 0, null);
  begin perform public.member_save(tv, 'bookings', jsonb_build_object('check_in', '2026-11-05', 'amount', 1)); ok := false;
  exception when others then ok := true; end;
  insert into t_results values (5, 'viewer cannot write', ok, null);
  r := public.member_load(te);
  insert into t_results values (6, 'editor never sees private expense', not (r->'expenses' @> jsonb_build_array(jsonb_build_object('id', xpriv))) and jsonb_array_length(r->'expenses') = 1, null);
  r := public.member_save(te, 'expenses', jsonb_build_object('date', '2026-11-06', 'amount', 3000, 'scope', 'private', 'paid_by', partner));
  insert into t_results values (7, 'editor cannot create a private expense', r->>'scope' = 'property' and r->>'paid_by' = partner::text, r::text);
  begin perform public.member_save(te, 'expenses', jsonb_build_object('id', xpriv, 'date', '2026-11-03', 'amount', 1)); ok := false;
  exception when others then ok := true; end;
  insert into t_results values (8, 'editor cannot change a private expense', ok, null);
  begin perform public.member_save(te, 'expenses', jsonb_build_object('id', xother, 'date', '2026-11-03', 'amount', 1)); ok := false;
  exception when others then ok := true; end;
  insert into t_results values (9, 'editor cannot touch another owner''s expense', ok, null);
  begin perform public.member_save(te, 'bookings', jsonb_build_object('check_in', '2026-11-05', 'amount', 1)); ok := false;
  exception when others then ok := true; end;
  insert into t_results values (10, 'editor without income page cannot add income', ok, null);
  r := public.member_save(te, 'expenses', jsonb_build_object('date', '2026-11-07', 'amount', 1000, 'paid_by', pbme));
  insert into t_results values (11, 'foreign party ids are dropped', r->>'paid_by' is null, null);
  perform public.member_delete(te, 'expenses', xpriv);
  insert into t_results values (13, 'unknown or short token gives nothing', public.member_load('abc') is null and public.member_load(repeat('0', 48)) is null, null);
  begin perform * from public.members; ok := false; exception when others then ok := true; end;
  insert into t_results values (14, 'anon cannot read the members table', ok, null);
  begin perform * from public.expenses; ok := false; exception when others then ok := true; end;
  insert into t_results values (15, 'anon cannot read expenses directly', ok, null);
  begin perform public.rotate_member_token(gen_random_uuid()); ok := false; exception when others then ok := true; end;
  insert into t_results values (16, 'anon cannot rotate a link', ok, null);
  begin perform * from public.report_requests; ok := false; exception when others then ok := true; end;
  insert into t_results values (19, 'anon cannot read recap requests', ok, null);
  begin perform public.request_monthly_reports(); ok := false; exception when others then ok := true; end;
  insert into t_results values (20, 'anon cannot trigger the recaps', ok, null);
  begin perform public.send_member_report(mid); ok := false; exception when others then ok := true; end;
  insert into t_results values (21, 'anon cannot ask for a recap', ok, null);
  -- Signed in as owner B: owner A's member stays out of reach.
  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.send_member_report(mid); ok := false; exception when others then ok := true; end;
  insert into t_results values (22, 'another owner cannot send my member a recap', ok, null);
  begin perform * from public.report_requests; ok := false; exception when others then ok := true; end;
  insert into t_results values (23, 'signed-in users cannot read recap requests', ok, null);
  begin perform public.request_monthly_reports(mid, true); ok := false; exception when others then ok := true; end;
  insert into t_results values (24, 'signed-in users cannot trigger recaps directly', ok, null);
  reset role;
  insert into t_results values (25, 'no recap request was written', not exists (select 1 from public.report_requests where member_id = mid), null);
  insert into t_results values (12, 'delete of a private expense does nothing', (select amount from public.expenses where id = xpriv) = 5000, null);
  insert into t_results values (17, 'expense of owner B untouched', (select amount from public.expenses where id = xother) = 7000, null);
  delete from auth.users where id in (a, b);
  insert into t_results values (18, 'cleanup cascades', not exists (select 1 from public.members where owner_id in (a, b)) and not exists (select 1 from public.properties where id in (pa, pb)), null);
end $$;
select n, test, ok from t_results order by n;
