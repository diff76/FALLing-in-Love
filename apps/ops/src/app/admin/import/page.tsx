import { requireRole } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { ImportConsole } from "./import-console";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const session = await requireRole("admin");
  return (
    <OpsShell eyebrow="Admin · Desktop" title="엑셀 일괄 등록" roles={session.roles} email={session.email} wide>
      <p className="note">웹 신청이 어려운 분들의 수기 신청서를 엑셀 양식에 옮겨 한 번에 등록합니다. 성함·연락처가 같은 사람은 자동으로 중복 처리됩니다.</p>
      <ImportConsole />
    </OpsShell>
  );
}
