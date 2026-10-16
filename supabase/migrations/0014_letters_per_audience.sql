-- 0014 (2026-10-16): one letter per audience.
--  Letters were 'one' (VIP · 인도자 · 미래셀) and 'two' (일반 성도); now each district pastor writes four:
--  'vip', 'leader', 'mirae', 'member'. What was written so far is kept: 'one' is copied to vip, leader and mirae,
--  'two' to member. Photos of a letter are files in the "oms" bucket under letters/<district>/<audience>/ (no table).
-- Run once in the SQL Editor.

alter table public.letters drop constraint if exists letters_kind_check;

insert into public.letters (district_code, kind, body, signer, updated_at, updated_via)
select l.district_code, k.kind, l.body, l.signer, l.updated_at, l.updated_via
from public.letters l cross join (values ('vip'), ('leader'), ('mirae')) as k(kind)
where l.kind = 'one'
on conflict (district_code, kind) do nothing;

insert into public.letters (district_code, kind, body, signer, updated_at, updated_via)
select district_code, 'member', body, signer, updated_at, updated_via from public.letters where kind = 'two'
on conflict (district_code, kind) do nothing;

delete from public.letters where kind in ('one', 'two');

alter table public.letters add constraint letters_kind_check check (kind in ('vip', 'leader', 'mirae', 'member'));

-- check: every row is one of the four audiences (expect no 'one' / 'two')
select district_code, kind, length(body) as chars from public.letters order by district_code, kind;
