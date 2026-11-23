-- Monthly recap emails, sent by the `monthly-report` edge function through Brevo.
--
-- The function is public (no sign-in) but refuses to run without a fresh row
-- of report_requests, which only the database can write: the schedule below,
-- or an owner asking for a sample for one of her members. No secret travels.

create table public.report_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members (id) on delete cascade,
  month text check (month is null or month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  dry_run boolean not null default false,
  created_at timestamptz not null default now(),
  -- Set by the function when it runs the request: each row works once.
  consumed_at timestamptz
);
alter table public.report_requests enable row level security;
-- No policy on purpose: only the service role (the edge function) reads it.
revoke all on public.report_requests from anon, authenticated;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- Writes a request row and calls the function with its id.
create function public.request_monthly_reports(p_member uuid default null, p_dry_run boolean default false, p_month text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.report_requests (member_id, dry_run, month) values (p_member, p_dry_run, p_month) returning id into v_id;
  return net.http_post(
    url := 'https://qizxtnojgxhkqasavghb.supabase.co/functions/v1/monthly-report',
    body := jsonb_build_object('request', v_id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;
revoke all on function public.request_monthly_reports(uuid, boolean, text) from public, anon, authenticated;

-- An owner asks for a sample of last month's recap for one of her members,
-- right now. At most one per member every 5 minutes.
create function public.send_member_report(p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.members m where m.id = p_member and m.owner_id = (select auth.uid())
                 and m.email <> '') then
    raise exception 'not found';
  end if;
  if exists (select 1 from public.report_requests r where r.member_id = p_member and r.created_at > now() - interval '5 minutes') then
    raise exception 'too soon';
  end if;
  perform public.request_monthly_reports(p_member, false, null);
end $$;
revoke all on function public.send_member_report(uuid) from public, anon;
grant execute on function public.send_member_report(uuid) to authenticated;

-- The 1st of each month, 07:00 UTC (07:00 in Dakar, 08:00 in Paris).
select cron.schedule('stayfolio-monthly-report', '0 7 1 * *', $$select public.request_monthly_reports()$$);
