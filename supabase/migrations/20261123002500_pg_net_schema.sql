-- pg_net was registered in the public schema (Supabase advisor 0014). Its
-- functions live in the `net` schema either way; the extension itself belongs
-- in `extensions`. pg_net cannot be moved, so it is recreated there.
drop extension if exists pg_net;
create extension pg_net with schema extensions;
