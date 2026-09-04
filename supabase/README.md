# Supabase

1. Install the CLI (`brew install supabase/tap/supabase`) and link the project: `supabase link --project-ref <ref>`.
2. Apply the schema: `supabase db push` (or paste `migrations/0001_init.sql` into the SQL editor).
3. Seed: run `seed.sql` (provisional shuttle times and districts).
4. Create staff accounts in Auth (Auto Confirm), then run `setup-roles.sql` (privilege fix + profiles + roles by e-mail). Edit the e-mail list in section 3 for your team.
5. Copy the project URL, publishable key and secret key into `.env.local` for both apps.

Data retention: personal data (names, phones, notes) is deleted within 30 days after 2026-10-11.
