"use server";

import type { StaffRole } from "@fil/domain";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@fil/supabase";
import { getSession } from "@/lib/auth";
import { LOGIN_ID_RE, publicOrigin, toEmail, toLoginId } from "@/lib/login-id";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";

export type Account = { id: string; email: string; loginId: string; displayName: string; roles: StaffRole[]; createdAt: string; lastSignIn: string | null; self: boolean };
export type AccessLink = { id: string; profileId: string; label: string | null; createdAt: string; expiresAt: string; revokedAt: string | null; lastUsedAt: string | null; useCount: number };
const ROLES: StaffRole[] = ["staff", "desk", "admin", "parking"];

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
      id: u.id, email: u.email ?? "", loginId: toLoginId(u.email), displayName: String(u.user_metadata?.display_name ?? ""),
      roles: cleanRoles(roles.get(u.id) ?? []), createdAt: u.created_at, lastSignIn: u.last_sign_in_at ?? null, self: u.id === session.userId,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function createAccount(input: { loginId: string; password: string; displayName: string; roles: string[] }): Promise<void> {
  const { db } = await adminOnly();
  const id = input.loginId.trim().toLowerCase();
  if (!id.includes("@") && !LOGIN_ID_RE.test(id)) throw new Error("아이디는 영문·숫자·점·밑줄·하이픈 2~32자입니다.");
  const email = toEmail(id);
  if (input.password.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
  const roles = cleanRoles(input.roles);
  if (!roles.length) throw new Error("권한을 하나 이상 골라주세요.");
  const { data, error } = await db.auth.admin.createUser({ email, password: input.password, email_confirm: true, user_metadata: { display_name: input.displayName.trim() || id.split("@")[0] } });
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

export async function renameLoginId(userId: string, loginId: string): Promise<void> {
  const { db } = await adminOnly();
  const id = loginId.trim().toLowerCase();
  if (!id.includes("@") && !LOGIN_ID_RE.test(id)) throw new Error("아이디는 영문·숫자·점·밑줄·하이픈 2~32자입니다.");
  const { error } = await db.auth.admin.updateUserById(userId, { email: toEmail(id), email_confirm: true });
  if (error) throw new Error(error.message);
}

// ---------- one-tap access links (table access_links, migration 0005) ----------
const sha256 = (t: string) => createHash("sha256").update(t).digest("hex");

export async function listAccessLinks(): Promise<AccessLink[] | null> {
  const { db } = await adminOnly();
  const { data, error } = await db.from("access_links").select("id, profile_id, label, created_at, expires_at, revoked_at, last_used_at, use_count").order("created_at", { ascending: false });
  if (error) return null;   // table missing (migration 0005 not applied yet) → UI shows the setup note
  return (data ?? []).map((l) => ({ id: l.id, profileId: l.profile_id, label: l.label, createdAt: l.created_at, expiresAt: l.expires_at, revokedAt: l.revoked_at, lastUsedAt: l.last_used_at, useCount: l.use_count }));
}

/** Mints a link. The plain token is returned ONCE (only its hash is stored). */
export async function createAccessLink(userId: string, label: string, expiresAt: string): Promise<{ url: string }> {
  const { session, db } = await adminOnly();
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime()) || exp.getTime() < Date.now()) throw new Error("만료 시각이 올바르지 않습니다.");
  const token = randomBytes(32).toString("base64url");
  const { error } = await db.from("access_links").insert({ profile_id: userId, token_hash: sha256(token), label: label.trim() || null, created_by: session.userId, expires_at: exp.toISOString() });
  if (error) throw new Error(error.message.includes("access_links") ? "access_links 테이블이 없습니다. supabase/migrations/0005_access_links.sql 을 먼저 실행하세요." : error.message);
  const h = await headers();
  return { url: `${publicOrigin(h.get("x-forwarded-host") ?? h.get("host"))}/go/${token}` };
}

export async function revokeAccessLink(linkId: string): Promise<void> {
  const { db } = await adminOnly();
  const { error } = await db.from("access_links").update({ revoked_at: new Date().toISOString() }).eq("id", linkId);
  if (error) throw new Error(error.message);
}

export async function deleteAccessLink(linkId: string): Promise<void> {
  const { db } = await adminOnly();
  const { error } = await db.from("access_links").delete().eq("id", linkId);
  if (error) throw new Error(error.message);
}
