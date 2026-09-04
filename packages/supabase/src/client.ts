import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { publicSupabaseEnv, secretSupabaseEnv } from "./env";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };
export type CookieAdapter = {
  getAll(): { name: string; value: string }[];
  setAll(cookies: CookieToSet[]): void;
};

export type Db = SupabaseClient<Database>;

export function createBrowserSupabaseClient(): Db {
  const env = publicSupabaseEnv();
  if (!env) throw new Error("Supabase public environment variables are not configured.");
  return createBrowserClient<Database>(env.url, env.key);
}

export function createServerSupabaseClient(cookies: CookieAdapter): Db {
  const env = publicSupabaseEnv();
  if (!env) throw new Error("Supabase public environment variables are not configured.");
  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (list) => cookies.setAll(list as CookieToSet[]),
    },
  });
}

/**
 * Service-role client. Server only — never import from a client component.
 * Used for the public reservation write path and pass lookup, where the caller is anonymous
 * but the server has already validated the input.
 */
export function createAdminSupabaseClient(): Db {
  if (typeof window !== "undefined") throw new Error("Admin client must not be created in the browser.");
  const env = secretSupabaseEnv();
  if (!env) throw new Error("SUPABASE_SECRET_KEY is not configured.");
  return createClient<Database>(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
}
