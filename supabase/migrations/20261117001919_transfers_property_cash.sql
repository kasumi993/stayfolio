-- Money can now move between a party and the property's own cash:
-- to_party null = a contribution put in, from_party null = profit paid out.
alter table public.transfers alter column from_party drop not null;
alter table public.transfers alter column to_party drop not null;
alter table public.transfers add constraint transfers_one_party_check check (from_party is not null or to_party is not null);
