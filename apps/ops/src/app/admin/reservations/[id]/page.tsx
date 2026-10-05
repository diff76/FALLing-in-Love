import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { loadReservationForEdit } from "../actions";
import { AdminReservationEditor } from "./editor";

export const dynamic = "force-dynamic";

/** Admin: change one sign-up (all the fields of the web form). Reached from 수정 in the admin list. */
export default async function EditReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("admin");
  const { id } = await params;
  const data = await loadReservationForEdit(id).catch(() => null);
  if (!data) notFound();
  return (
    <OpsShell eyebrow={`Admin · ${data.code}`} title={`${data.applicantName} 님 신청 수정`} roles={session.roles} email={session.email} light>
      <p className="tiny"><Link href="/admin">← 관리자 대시보드로</Link></p>
      <AdminReservationEditor initial={data} />
    </OpsShell>
  );
}
