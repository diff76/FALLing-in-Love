import { redirect } from "next/navigation";
import type { StaffRole } from "@fil/domain";
import { supabaseServer } from "./supabase-server";

export type Session = { userId: string; email: string | null; roles: StaffRole[] };

export async function getSession(): Promise<Session | null> {
  const db = await supabaseServer();
  if (!db) return null;
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: roles } = await db.rpc("my_roles");
  return { userId: user.id, email: user.email ?? null, roles: (roles ?? []) as StaffRole[] };
}

/**
 * Page-level guard. The real authorization lives in Postgres (RLS + role checks inside
 * every RPC); this only decides which screen to render and where to send people.
 */
export async function requireRole(...allowed: StaffRole[]): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.roles.some((r) => allowed.includes(r))) redirect(`/login?denied=${allowed.join(",")}`);
  return session;
}
