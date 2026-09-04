import { z } from "zod";
import { eventConfig } from "@fil/config";

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}
export function phoneLast4(raw: string): string {
  return normalizePhone(raw).slice(-4);
}
export function formatPhone(raw: string): string {
  const d = normalizePhone(raw);
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw.trim();
}

const name = z.string().trim().min(1, "성함을 적어주세요").max(40);
const phone = z
  .string()
  .trim()
  .transform(normalizePhone)
  .refine((d) => d.length === 10 || d.length === 11, "연락처를 확인해 주세요");
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || undefined);

export const reservationMemberSchema = z.object({
  name,
  relation: optionalText(30),
  ageGroup: z.enum(eventConfig.ageGroups).optional().or(z.literal("")).transform((v) => v || undefined),
  dietaryNote: optionalText(120),
});

export const reservationInputSchema = z
  .object({
    kind: z.enum(["host", "guest_self"]),
    applicantName: name,
    phone,
    districtCode: optionalText(4),
    inviterName: optionalText(40),
    ageGroup: z.enum(eventConfig.ageGroups).optional().or(z.literal("")).transform((v) => v || undefined),
    members: z.array(reservationMemberSchema).max(eventConfig.maxPartySize - 1).default([]),
    transport: z.enum(["shuttle", "car", "other"]),
    outboundRun: optionalText(5),
    returnRun: optionalText(5),
    vehiclePlate: optionalText(12),
    mobilitySupport: z.boolean().default(false),
    mobilityNote: optionalText(160),
    dietaryNote: optionalText(160),
    privacyConsent: z.literal(true, { error: "필수 항목에 동의가 필요합니다" }),
    contactConsent: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "host" && !v.districtCode) {
      ctx.addIssue({ code: "custom", path: ["districtCode"], message: "교구 또는 부서를 선택해 주세요" });
    }
    if (v.kind === "guest_self" && !v.inviterName) {
      ctx.addIssue({ code: "custom", path: ["inviterName"], message: "초대해주신 분의 성함을 적어주세요" });
    }
    if (v.transport === "shuttle" && !v.outboundRun) {
      ctx.addIssue({ code: "custom", path: ["outboundRun"], message: "탑승하실 셔틀 편을 골라주세요" });
    }
  });

export type ReservationInput = z.infer<typeof reservationInputSchema>;
export type ReservationMemberInput = z.infer<typeof reservationMemberSchema>;

export function partySize(input: Pick<ReservationInput, "members">): number {
  return 1 + input.members.length;
}

/** Human-readable reference: YYMMDD-<district>-<seq3>. Not a secret; the pass token is. */
export function makeReservationCode(eventDate: string, districtCode: string | undefined, seq: number): string {
  const ymd = eventDate.replace(/-/g, "").slice(2);
  return `${ymd}-${districtCode ?? "00"}-${String(seq).padStart(3, "0")}`;
}
