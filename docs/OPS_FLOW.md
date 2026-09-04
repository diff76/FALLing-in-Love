# Operations flow

- `/login` only public route. `proxy.ts` refreshes the session and redirects anonymous visitors; pages call `requireRole`; RPCs re-check roles in SQL.
- Staff (phone): pick station (remembered) → camera QR (`BarcodeDetector`, Chrome/Android; manual fallback elsewhere) or name/last-4 lookup → arrival count stepper, flags, hospitality checks → 체크인 확정 → `perform_checkin`.
- Re-scan of a checked-in party returns an "usher to seat" card: no second count, no second welcome.
- Desk (tablet): counts, shuttle expectations, recent arrivals, pending list; refreshes on `checkins` inserts.
- Display (lobby): idle programme; on insert shows masked name (김○○) + seat for ~4.6 s, then returns to idle.
- Admin (desktop): KPIs, per-district/run/station, full list. Editing, voids and inventory management are next.

Open: shuttle first/last runs, return runs, station devices, staff account list.
