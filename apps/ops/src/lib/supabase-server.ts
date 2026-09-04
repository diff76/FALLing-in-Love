import { cookies } from "next/headers";
import { createServerSupabaseClient, isSupabaseConfigured, type Db } from "@fil/supabase";

/** Server-side Supabase client bound to the request cookies (Next 16: cookies() is async). */
export async function supabaseServer(): Promise<Db | null> {
  if (!isSupabaseConfigured()) return null;
  const store = await cookies();
  return createServerSupabaseClient({
    getAll: () => store.getAll(),
    setAll: (list) => {
      try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only in RSC */ }
    },
  });
}
