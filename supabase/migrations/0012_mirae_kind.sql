-- 0012 (2026-10-12): a third kind of sign-up — 미래셀.
--  The sign-up form now offers 제가 초대합니다 (host) · 초대를 받았습니다 (guest_self) · 미래셀입니다 (mirae).
--  A 미래셀 sign-up picks a district like a host but brings no companions; the ops dashboard counts it apart.
--  create_reservation / update_reservation cast the payload's kind to this enum, so they take the new value as is.
-- Run once in the SQL Editor. A new enum value cannot be read in the transaction that adds it, so run the check
-- below separately afterwards: select unnest(enum_range(null::public.reservation_kind)) as kind;  → host, guest_self, mirae

alter type public.reservation_kind add value if not exists 'mirae';
