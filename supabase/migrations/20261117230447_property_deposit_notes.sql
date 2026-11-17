-- A reminder of the security deposit (outside every calculation) and free notes.
alter table public.properties add column deposit numeric(14,2) not null default 0 check (deposit >= 0);
alter table public.properties add column notes text not null default '' check (length(notes) <= 4000);
