import { requireRole } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { ScanConsole } from "./scan-console";

// Never prerender: the session decides what this route does.
export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const session = await requireRole("staff", "admin");
  return (
    <OpsShell eyebrow="Staff · Smartphone" title="스캔 · 체크인" roles={session.roles} email={session.email}>
      <p className="note">이 화면만이 참석을 기록합니다. 다른 화면은 결과를 보여줄 뿐입니다.</p>
      <ScanConsole />
    </OpsShell>
  );
}
