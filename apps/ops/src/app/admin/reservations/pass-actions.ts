"use server";

import QRCode from "qrcode";
import { eventConfig } from "@fil/config";
import { generatePassToken, hashPassToken, passUrl } from "@fil/domain";
import { createAdminSupabaseClient, isSupabaseAdminConfigured, type PassLookup } from "@fil/supabase";
import { getSession } from "@/lib/auth";

/**
 * Admin: one sign-up's Matinée Pass links. Only the SHA-256 of a link is stored, so an existing link's
 * address can never be shown again — an admin sees what the Pass shows, which links are live, and can
 * make a new link (shown once, with the companions' invitation links), cut a link or bring one back.
 * One sign-up may hold several live links (migration 0011); every one opens the same Pass.
 */
const WEB_ORIGIN = "https://falling.eventgo.kr";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export type PassLink = { id: string; issuedAt: string; revokedAt: string | null };
export type PassInfo = { links: PassLink[]; view: PassLookup | null };
export type MintedPass = { url: string; qrSvg: string; message: string; invites: { name: string; url: string; message: string }[] };

async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() }; } catch (e) { return { ok: false, error: (e as Error).message }; }
}
async function adminDb() {
  const s = await getSession();
  if (!s?.roles.includes("admin")) throw new Error("관리자만 Pass를 관리할 수 있습니다.");
  if (!isSupabaseAdminConfigured()) throw new Error("SUPABASE_SECRET_KEY가 설정되지 않았습니다.");
  return createAdminSupabaseClient();
}

export async function loadPassInfo(reservationId: string): Promise<Result<PassInfo>> {
  return attempt(async () => {
    const db = await adminDb();
    const { data, error } = await db.from("passes").select("id, token_hash, issued_at, revoked_at").eq("reservation_id", reservationId).order("issued_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const live = rows.find((p) => !p.revoked_at);
    // the Pass exactly as its holder sees it (same lookup the web Pass page uses)
    const view = live ? ((await db.rpc("lookup_pass", { p_token_hash: live.token_hash })).data as PassLookup | null) : null;
    return { links: rows.map((p) => ({ id: p.id, issuedAt: p.issued_at, revokedAt: p.revoked_at })), view };
  });
}

/** A new link for this sign-up. With `revokeOthers` every earlier link (and the invitations built on it) stops opening. */
export async function issuePassLink(reservationId: string, revokeOthers: boolean): Promise<Result<MintedPass>> {
  return attempt(async () => {
    const db = await adminDb();
    const { data: r } = await db.from("reservations").select("id, applicant_name, status").eq("id", reservationId).maybeSingle();
    if (!r || r.status !== "active") throw new Error("유효한 신청이 아닙니다(취소되었을 수 있습니다).");
    const token = generatePassToken();
    const { data: row, error } = await db.from("passes").insert({ reservation_id: r.id, token_hash: await hashPassToken(token) } as never).select("id").single();
    if (error || !row) {
      if (error?.message.includes("passes_reservation_id_key")) throw new Error("DB 설정이 아직 없습니다 — Supabase SQL Editor에서 0011 SQL을 실행해 주세요.");
      throw new Error(error?.message ?? "링크를 만들지 못했습니다.");
    }
    if (revokeOthers) {
      const { error: e2 } = await db.from("passes").update({ revoked_at: new Date().toISOString() } as never).eq("reservation_id", r.id).is("revoked_at", null).neq("id", (row as { id: string }).id);
      if (e2) throw new Error(`새 링크는 만들었지만 기존 링크를 끊지 못했습니다: ${e2.message}`);
    }
    const url = passUrl(WEB_ORIGIN, token);
    const { data: members } = await db.from("reservation_members").select("position, name").eq("reservation_id", r.id).order("position");
    const when = `${eventConfig.dateLabel} ${eventConfig.passMeet.time} ${eventConfig.passMeet.place}`;
    return {
      url,
      qrSvg: await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#2E251C", light: "#FFFFFF" } }),
      message: `${r.applicant_name} 님, FALLing in Love의 Matinée Pass 링크입니다. ${when} — 당일 이 화면의 QR을 보여 주세요.\n${url}`,
      invites: (members ?? []).filter((m) => m.name?.trim()).map((m) => ({
        name: m.name,
        url: `${url}?g=${m.position}`,
        message: `${m.name} 님, ${when}에서 열리는 가을 정원 마티네 'FALLing in Love'에 초대합니다. 아래 링크가 ${m.name} 님의 입장권(Matinée Pass)입니다. — ${r.applicant_name} 드림\n${url}?g=${m.position}`,
      })),
    };
  });
}

/** Cut one link (lost or leaked), or bring a cut link back. */
export async function setPassLinkRevoked(passId: string, revoked: boolean): Promise<Result<void>> {
  return attempt(async () => {
    const db = await adminDb();
    const { error } = await db.from("passes").update({ revoked_at: revoked ? new Date().toISOString() : null } as never).eq("id", passId);
    if (error) throw new Error(error.message);
  });
}
