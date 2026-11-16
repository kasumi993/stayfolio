-- Stayfolio — row-level security, functions and storage policies.

-- ---------------------------------------------------------------------------
-- Row-level security: a user sees and changes only their own rows.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['properties', 'parties', 'rules', 'bookings', 'recurring',
                           'expenses', 'transfers', 'docs', 'shares', 'ai_usage']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Table privileges: signed-in users only. Visitors (anon) get nothing.
grant select, insert, update, delete on
  public.profiles, public.properties, public.parties, public.rules, public.bookings,
  public.recurring, public.expenses, public.transfers, public.docs, public.shares
  to authenticated;
grant select on public.ai_usage to authenticated;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- The single door for owners and partners: returns the published snapshot for
-- a valid, non-revoked token and nothing else. Runs with definer rights
-- because the caller is not signed in and has no access to any table.
create function public.get_shared_statement(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('title', s.title, 'created_at', s.created_at, 'statement', s.payload)
  from public.shares s
  where s.token = p_token and length(p_token) >= 32 and not s.revoked;
$$;

grant execute on function public.get_shared_statement(text) to anon, authenticated;

-- Counts one AI call for today and returns the new total. Called by the `ai`
-- edge function on behalf of the signed-in user.
create function public.bump_ai_usage()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_calls int;
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  insert into public.ai_usage (owner_id, day, calls)
  values ((select auth.uid()), current_date, 1)
  on conflict (owner_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls into v_calls;
  return v_calls;
end $$;

grant execute on function public.bump_ai_usage() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: one private bucket, one folder per user.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy "own files: read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files: add" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files: change" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files: remove" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
