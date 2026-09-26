"use server";

import type { StaffRole } from "@fil/domain";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@fil/supabase";
import { getSession } from "@/lib/auth";

export type Account = { id: string; email: string; displayName: string; roles: StaffRole[]; createdAt: string; lastSignIn: string | null; self: boolean };
const ROLES: StaffRole[] = ["staff", "desk", "admin"];

/**
 * Account management runs with the service-role key (auth admin API + staff_roles writes),
 * so every action re-checks that the CALLER is an admin before touching anything.
 */
async function adminOnly() {
  const s = await getSession();
  if (!s || !s.roles.includes("admin")) throw new Error("관리자만 계정을 관리할 수 있습니다.");
  if (!isSupabaseAdminConfigured()) throw new Error("SUPABASE_SECRET_KEY가 설정되지 않아 계정 관리를 쓸 수 없습니다.");
  return { session: s, db: createAdminSupabaseClient() };
}
const cleanRoles = (roles: string[]): StaffRole[] => ROLES.filter((r) => roles.includes(r));

export async function accountsConfigured(): Promise<boolean> { return isSupabaseAdminConfigured(); }

export async function listAccounts(): Promise<Account[]> {
  const { session, db } = await adminOnly();
  const { data, error } = await db.auth.admin.listUsers({ perPage: 500 });
  if (error) throw new Error(error.message);
  const { data: roleRows } = await db.from("staff_roles").select("profile_id, role");
  const roles = new Map<string, StaffRole[]>();
  (roleRows ?? []).forEach((r) => roles.set(r.profile_id, [...(roles.get(r.profile_id) ?? []), r.role as StaffRole]));
  return data.users
    .map((u) => ({
      id: u.id, email: u.email ?? "", displayName: String(u.user_metadata?.display_name ?? ""),
      roles: cleanRoles(roles.get(u.id) ?? []), createdAt: u.created_at, lastSignIn: u.last_sign_in_at ?? null, self: u.id === session.userId,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function createAccount(input: { email: string; password: string; displayName: string; roles: string[] }): Promise<void> {
  const { db } = await adminOnly();
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("이메일 형식을 확인해 주세요.");
  if (input.password.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
  const roles = cleanRoles(input.roles);
  if (!roles.length) throw new Error("권한을 하나 이상 골라주세요.");
  const { data, error } = await db.auth.admin.createUser({ email, password: input.password, email_confirm: true, user_metadata: { display_name: input.displayName.trim() || email.split("@")[0] } });
  if (error || !data.user) throw new Error(error?.message ?? "계정을 만들지 못했습니다.");
  // The profiles row comes from the auth trigger; make sure it exists before roles reference it.
  await db.from("profiles").upsert({ id: data.user.id, display_name: input.displayName.trim() || null });
  const { error: rErr } = await db.from("staff_roles").insert(roles.map((role) => ({ profile_id: data.user!.id, role })));
  if (rErr) throw new Error(rErr.message);
}

export async function setRoles(userId: string, roles: string[]): Promise<void> {
  const { session, db } = await adminOnly();
  const next = cleanRoles(roles);
  if (userId === session.userId && !next.includes("admin")) throw new Error("자기 자신의 관리자 권한은 뺄 수 없습니다.");
  if (!next.length) throw new Error("권한을 하나 이상 남겨주세요. 계정을 없애려면 삭제를 쓰세요.");
  await db.from("profiles").upsert({ id: userId });
  const { error: dErr } = await db.from("staff_roles").delete().eq("profile_id", userId);
  if (dErr) throw new Error(dErr.message);
  const { error } = await db.from("staff_roles").insert(next.map((role) => ({ profile_id: userId, role })));
  if (error) throw new Error(error.message);
}

export async function resetPassword(userId: string, password: string): Promise<void> {
  const { db } = await adminOnly();
  if (password.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
  const { error } = await db.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);
}

export async function renameAccount(userId: string, displayName: string): Promise<void> {
  const { db } = await adminOnly();
  const name = displayName.trim();
  const { error } = await db.auth.admin.updateUserById(userId, { user_metadata: { display_name: name } });
  if (error) throw new Error(error.message);
  await db.from("profiles").upsert({ id: userId, display_name: name || null });
}

export async function deleteAccount(userId: string): Promise<void> {
  const { session, db } = await adminOnly();
  if (userId === session.userId) throw new Error("로그인 중인 자기 계정은 삭제할 수 없습니다.");
  const { error } = await db.auth.admin.deleteUser(userId);   // profiles/staff_roles cascade from auth.users
  if (error) throw new Error(error.message);
}
