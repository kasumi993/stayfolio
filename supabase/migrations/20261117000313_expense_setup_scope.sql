-- A third kind of expense: what it cost to get a property ready, paid out of
-- what the partners put in. Kept out of the monthly result by the app.
alter table public.expenses drop constraint expenses_scope_check;
alter table public.expenses add constraint expenses_scope_check check (scope in ('property', 'private', 'setup'));
