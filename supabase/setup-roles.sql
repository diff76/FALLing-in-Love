-- FALLing in Love — run ONCE in the Supabase SQL Editor after apply-all.sql.
-- 1) privilege fix (0002)  2) profile rows for accounts created before the schema  3) staff roles

-- ---------- 1) privileges ----------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
revoke execute on function public.create_reservation(jsonb, text) from authenticated;
revoke execute on function public.lookup_pass(text) from authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- ---------- 2) profiles for every existing auth user ----------
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- ---------- 3) roles (by e-mail, so no UUID copying) ----------
-- admin@ykch.kr  → admin + staff + desk (can open every screen)
-- diff76@naver.com → admin + staff + desk (owner account)
-- desk@ykch.kr   → desk   (welcome desk, display)
-- staff@ykch.kr  → staff  (scan / check-in)
insert into public.staff_roles (profile_id, role)
select u.id, r.role::public.staff_role
from auth.users u
join (values
  ('admin@ykch.kr', 'admin'), ('admin@ykch.kr', 'staff'), ('admin@ykch.kr', 'desk'),
  ('diff76@naver.com', 'admin'), ('diff76@naver.com', 'staff'), ('diff76@naver.com', 'desk'),
  ('desk@ykch.kr', 'desk'),
  ('staff@ykch.kr', 'staff')
) as r(email, role) on r.email = u.email
on conflict do nothing;

-- check
select u.email, array_agg(s.role order by s.role) as roles
from public.staff_roles s join auth.users u on u.id = s.profile_id
group by u.email order by u.email;
