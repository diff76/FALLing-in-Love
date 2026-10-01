// Server only: uses the service-role key. Import it from route handlers and server components, never from "use client" files.
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@fil/supabase";

// The store layout and key helpers are shared with the ops app (its One More Song tab).
export { OMS_BUCKET, listOms, photoKey, trackKey, type OmsPhoto, type OmsTrack } from "@fil/supabase";

/** The caller is a signed-in ops admin (Bearer token from the browser session)? */
export async function isAdminToken(authHeader: string | null): Promise<boolean> {
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || !isSupabaseAdminConfigured()) return false;
  const db = createAdminSupabaseClient();
  const { data } = await db.auth.getUser(token);
  if (!data.user) return false;
  const { data: roles } = await db.from("staff_roles").select("role").eq("profile_id", data.user.id).eq("role", "admin");
  return !!roles?.length;
}
