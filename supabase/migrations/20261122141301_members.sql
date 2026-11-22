-- Members of a property: people the owner shares one property with through a
-- personal link, like a Canva or Excel share link. No account, no password:
-- the token in the link is the key, so it is long, random and can be rotated
-- or cut at any time.
--
-- What a member may see or change is enforced here, by the functions below,
-- which are the only door for a link holder: anon has no table access.
--   pages: 'income'   income (bookings)
--          'expenses' expenses (never private ones)
--          'invoices' invoices
--          'report'   result, charts and yearly report (needs the figures)
--          'cash'     contributions, payouts and cash on hand
--   can_edit: may add, change and delete income and expenses, and file invoices.
-- Never returned: other properties, private expenses, recurring templates,
-- notes and deposit of the property, published statements, other members.
-- On a managed property, the owner's management commission is never returned.

create table public.members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid not null,
  name text not null check (length(name) between 1 and 80),
  email text not null default '' check (length(email) <= 200),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  can_edit boolean not null default false,
  pages text[] not null default '{income,expenses,invoices,report}'
    check (pages <@ array['income', 'expenses', 'invoices', 'report', 'cash']),
  monthly_report boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (property_id, owner_id) references public.properties (id, owner_id) on delete cascade
);

alter table public.members enable row level security;
create policy "own rows" on public.members for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
-- The token and the visit date are set by the database, never by the app.
grant select, delete on public.members to authenticated;
grant insert (id, property_id, name, email, can_edit, pages, monthly_report) on public.members to authenticated;
grant update (name, email, can_edit, pages, monthly_report) on public.members to authenticated;

-- A new link for a member: the old one stops working at once.
create function public.rotate_member_token(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_token text;
begin
  update public.members
     set token = encode(extensions.gen_random_bytes(24), 'hex')
   where id = p_id and owner_id = (select auth.uid())
  returning token into v_token;
  if v_token is null then raise exception 'not found'; end if;
  return v_token;
end $$;

revoke all on function public.rotate_member_token(uuid) from public, anon;
grant execute on function public.rotate_member_token(uuid) to authenticated;

-- The member behind a link, or nothing.
create function public.member_by_token(p_token text)
returns public.members
language sql
stable
security definer
set search_path = ''
as $$
  select m.* from public.members m
  where p_token is not null and length(p_token) >= 40 and m.token = p_token;
$$;

revoke all on function public.member_by_token(text) from public, anon, authenticated;

-- Everything a link holder may read, in one call.
create function public.member_load(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.members;
  p public.properties;
  v_owner text;
  v_managed boolean;
  v_figures boolean;
begin
  m := public.member_by_token(p_token);
  if m.id is null then return null; end if;
  select * into p from public.properties where id = m.property_id and owner_id = m.owner_id;
  select name into v_owner from public.profiles where id = m.owner_id;
  v_managed := p.kind = 'managed';
  v_figures := 'report' = any (m.pages) or 'cash' = any (m.pages);
  update public.members set last_seen_at = now() where id = m.id;

  return jsonb_build_object(
    'member', jsonb_build_object('id', m.id, 'name', m.name, 'can_edit', m.can_edit, 'pages', to_jsonb(m.pages)),
    'owner_name', coalesce(nullif(v_owner, ''), ''),
    'currency', coalesce((select currency from public.profiles where id = m.owner_id), 'XOF'),
    'fx', coalesce((select fx from public.profiles where id = m.owner_id), '{}'::jsonb),
    'property', jsonb_build_object('id', p.id, 'name', p.name, 'location', p.location, 'kind', p.kind,
      'color', p.color, 'revenue_basis', p.revenue_basis, 'payout_party_id', p.payout_party_id,
      'deposit', 0, 'notes', '', 'archived', false, 'created_at', p.created_at),
    -- The owner's own party is shown under the owner's name, never as "me".
    'parties', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'property_id', x.property_id,
        'name', case when x.is_me and coalesce(v_owner, '') <> '' then v_owner else x.name end, 'is_me', false))
      from public.parties x where x.property_id = p.id and x.owner_id = m.owner_id), '[]'::jsonb),
    'rules', case when v_figures then coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'property_id', r.property_id,
        'effective_from', r.effective_from, 'commission_rate', case when v_managed then 0 else r.commission_rate end,
        'shares', r.shares) order by r.effective_from)
      from public.rules r where r.property_id = p.id and r.owner_id = m.owner_id), '[]'::jsonb) else '[]'::jsonb end,
    'bookings', case when 'income' = any (m.pages) or v_figures then coalesce((select jsonb_agg(
        (to_jsonb(b) - 'owner_id') || jsonb_build_object('commission_rate', case when v_managed then null else b.commission_rate end))
      from public.bookings b where b.property_id = p.id and b.owner_id = m.owner_id), '[]'::jsonb) else '[]'::jsonb end,
    'expenses', case when 'expenses' = any (m.pages) or v_figures then coalesce((select jsonb_agg(to_jsonb(x) - 'owner_id')
      from public.expenses x where x.property_id = p.id and x.owner_id = m.owner_id and x.scope <> 'private'), '[]'::jsonb) else '[]'::jsonb end,
    'transfers', case when 'cash' = any (m.pages) then coalesce((select jsonb_agg(to_jsonb(t) - 'owner_id')
      from public.transfers t where t.property_id = p.id and t.owner_id = m.owner_id), '[]'::jsonb) else '[]'::jsonb end,
    'docs', case when 'invoices' = any (m.pages) then coalesce((select jsonb_agg(to_jsonb(d) - 'owner_id' - 'path')
      from public.docs d where d.property_id = p.id and d.owner_id = m.owner_id
        and (d.expense_id is null or exists (select 1 from public.expenses e where e.id = d.expense_id and e.scope <> 'private'))), '[]'::jsonb) else '[]'::jsonb end
  );
end $$;

-- A party of the member's property, or null when the id points elsewhere.
create function public.member_party(m public.members, p_id text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select x.id from public.parties x
  where p_id is not null and p_id <> '' and x.id = p_id::uuid and x.property_id = m.property_id and x.owner_id = m.owner_id;
$$;

revoke all on function public.member_party(public.members, text) from public, anon, authenticated;

-- Adds or changes an income, an expense, or an invoice's details.
create function public.member_save(p_token text, p_table text, p_row jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.members;
  v_id uuid := coalesce(nullif(p_row ->> 'id', '')::uuid, gen_random_uuid());
  v_date date;
  v_month text;
  v_out jsonb;
  v_expense uuid;
begin
  m := public.member_by_token(p_token);
  if m.id is null or not m.can_edit then raise exception 'not allowed'; end if;

  if p_table = 'bookings' then
    if not ('income' = any (m.pages)) then raise exception 'not allowed'; end if;
    insert into public.bookings as b (id, owner_id, property_id, platform, guest, check_in, check_out, received_on,
                                      currency, amount, fx_rate, commission_rate, received_by, notes)
    values (v_id, m.owner_id, m.property_id, coalesce(p_row ->> 'platform', 'Direct'), coalesce(p_row ->> 'guest', ''),
            (p_row ->> 'check_in')::date, nullif(p_row ->> 'check_out', '')::date, nullif(p_row ->> 'received_on', '')::date,
            coalesce(p_row ->> 'currency', 'XOF'), (p_row ->> 'amount')::numeric, coalesce((p_row ->> 'fx_rate')::numeric, 1),
            null, public.member_party(m, p_row ->> 'received_by'), coalesce(p_row ->> 'notes', ''))
    on conflict (id) do update set
      platform = excluded.platform, guest = excluded.guest, check_in = excluded.check_in, check_out = excluded.check_out,
      received_on = excluded.received_on, currency = excluded.currency, amount = excluded.amount, fx_rate = excluded.fx_rate,
      received_by = excluded.received_by, notes = excluded.notes
      where b.owner_id = m.owner_id and b.property_id = m.property_id
    returning to_jsonb(b) - 'owner_id' into v_out;

  elsif p_table = 'expenses' then
    if not ('expenses' = any (m.pages)) then raise exception 'not allowed'; end if;
    v_date := (p_row ->> 'date')::date;
    v_month := to_char(v_date, 'YYYY-MM');
    insert into public.expenses as x (id, owner_id, property_id, date, month, category, vendor, description, currency,
                                      amount, fx_rate, scope, charged_to, paid_by, excluded)
    values (v_id, m.owner_id, m.property_id, v_date, v_month, coalesce(p_row ->> 'category', 'other'),
            coalesce(p_row ->> 'vendor', ''), coalesce(p_row ->> 'description', ''), coalesce(p_row ->> 'currency', 'XOF'),
            (p_row ->> 'amount')::numeric, coalesce((p_row ->> 'fx_rate')::numeric, 1),
            case when p_row ->> 'scope' = 'setup' then 'setup' else 'property' end,
            public.member_party(m, p_row ->> 'charged_to'), public.member_party(m, p_row ->> 'paid_by'),
            coalesce((p_row ->> 'excluded')::boolean, false))
    on conflict (id) do update set
      date = excluded.date,
      -- A generated monthly occurrence keeps its month.
      month = case when x.recurring_id is null then excluded.month else x.month end,
      category = excluded.category, vendor = excluded.vendor, description = excluded.description,
      currency = excluded.currency, amount = excluded.amount, fx_rate = excluded.fx_rate, scope = excluded.scope,
      charged_to = excluded.charged_to, paid_by = excluded.paid_by, excluded = excluded.excluded
      where x.owner_id = m.owner_id and x.property_id = m.property_id and x.scope <> 'private'
    returning to_jsonb(x) - 'owner_id' into v_out;

  elsif p_table = 'docs' then
    if not ('invoices' = any (m.pages)) then raise exception 'not allowed'; end if;
    v_expense := nullif(p_row ->> 'expense_id', '')::uuid;
    if v_expense is not null and not exists (select 1 from public.expenses e where e.id = v_expense
        and e.owner_id = m.owner_id and e.property_id = m.property_id and e.scope <> 'private') then
      raise exception 'not allowed';
    end if;
    update public.docs d set
      title = coalesce(p_row ->> 'title', ''), date = nullif(p_row ->> 'date', '')::date,
      amount = nullif(p_row ->> 'amount', '')::numeric, expense_id = v_expense
    where d.id = v_id and d.owner_id = m.owner_id and d.property_id = m.property_id
    returning to_jsonb(d) - 'owner_id' - 'path' into v_out;

  else
    raise exception 'not allowed';
  end if;

  if v_out is null then raise exception 'not allowed'; end if;
  return v_out;
end $$;

-- Deletes an income or an expense. Invoices are deleted by the owner only.
create function public.member_delete(p_token text, p_table text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare m public.members;
begin
  m := public.member_by_token(p_token);
  if m.id is null or not m.can_edit then raise exception 'not allowed'; end if;
  if p_table = 'bookings' and 'income' = any (m.pages) then
    delete from public.bookings where id = p_id and owner_id = m.owner_id and property_id = m.property_id;
  elsif p_table = 'expenses' and 'expenses' = any (m.pages) then
    update public.docs set expense_id = null
     where expense_id = p_id and owner_id = m.owner_id
       and exists (select 1 from public.expenses e where e.id = p_id and e.owner_id = m.owner_id
                   and e.property_id = m.property_id and e.scope <> 'private');
    delete from public.expenses where id = p_id and owner_id = m.owner_id and property_id = m.property_id and scope <> 'private';
  else
    raise exception 'not allowed';
  end if;
end $$;

revoke all on function public.member_load(text) from public;
revoke all on function public.member_save(text, text, jsonb) from public;
revoke all on function public.member_delete(text, text, uuid) from public;
grant execute on function public.member_load(text) to anon, authenticated;
grant execute on function public.member_save(text, text, jsonb) to anon, authenticated;
grant execute on function public.member_delete(text, text, uuid) to anon, authenticated;
