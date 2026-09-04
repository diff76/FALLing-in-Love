-- 0002: explicit privileges. 0001 revoked EXECUTE from PUBLIC, which also stripped the
-- service_role and authenticated roles. Postgres privileges are the outer gate; RLS
-- (still enabled everywhere) decides which rows an authenticated user can see.
grant usage on schema public to anon, authenticated, service_role;

-- service_role (server-side secret key): full access, bypasses RLS by design
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- authenticated (ops staff): table access gated by the RLS policies in 0001
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- anon: nothing (the public site only talks to the server)
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

-- keep the two public write/lookup RPCs server-only
revoke execute on function public.create_reservation(jsonb, text) from authenticated;
revoke execute on function public.lookup_pass(text) from authenticated;

-- same rules for tables created later
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
