-- member_load: the owner's party keeps is_me, so the shared figures (who
-- holds the cash, who received an income) add up the same as for the owner.
create or replace function public.member_load(p_token text)
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
    -- The owner's own party is shown under the owner's name. It keeps is_me:
    -- the calculations need to know whose cash it is; the app labels it with
    -- the name for a member, never "me".
    'parties', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'property_id', x.property_id,
        'name', case when x.is_me and coalesce(v_owner, '') <> '' then v_owner else x.name end, 'is_me', x.is_me))
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
