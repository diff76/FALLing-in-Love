export function publicSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export function secretSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url, key } : null;
}

/** True when the public prototype can talk to a real project. Rendering never requires it. */
export function isSupabaseConfigured(): boolean {
  return publicSupabaseEnv() !== null;
}
export function isSupabaseAdminConfigured(): boolean {
  return secretSupabaseEnv() !== null;
}
