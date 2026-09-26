import { requireRole } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { isSupabaseAdminConfigured } from "@fil/supabase";
import { AccountsConsole } from "./accounts-console";
import { listAccounts } from "./actions";

export const dynamic = "force-dynamic";

/** Admin-only: staff accounts and their roles. Non-admins never see the tab (nav filter) and are redirected here. */
export default async function AccountsPage() {
  const session = await requireRole("admin");
  const configured = isSupabaseAdminConfigured();
  const accounts = configured ? await listAccounts().catch(() => null) : null;
  return (
    <OpsShell eyebrow="Admin · Accounts" title="계정 관리" roles={session.roles} email={session.email} light>
      {!configured ? (
        <section className="box">
          <h2>설정이 필요합니다</h2>
          <p className="tiny">계정을 만들고 지우려면 서버 전용 키가 필요합니다. Vercel의 <b>fal-ling-in-love-ops</b> 프로젝트 → Settings → Environment Variables 에 <code>SUPABASE_SECRET_KEY</code>(Type: Secret, 값은 web 프로젝트와 동일)를 추가하고 Redeploy 하세요.</p>
        </section>
      ) : (
        <AccountsConsole initial={accounts ?? []} selfId={session.userId} />
      )}
    </OpsShell>
  );
}
