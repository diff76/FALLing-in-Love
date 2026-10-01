import { requireRole } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { isSupabaseAdminConfigured } from "@fil/supabase";
import { OmsConsole } from "./oms-console";
import { listTracks } from "./actions";

export const dynamic = "force-dynamic";

/** Admin-only: the tracks THE ONE MORE SONG player plays on the web site. Other roles never see the tab and are redirected here. */
export default async function OmsPage() {
  const session = await requireRole("admin");
  const configured = isSupabaseAdminConfigured();
  const tracks = configured ? await listTracks().catch(() => null) : null;
  return (
    <OpsShell eyebrow="Admin · One More Song" title="One More Song 곡 관리" roles={session.roles} email={session.email} light>
      {!configured ? (
        <section className="box">
          <h2>설정이 필요합니다</h2>
          <p className="tiny">곡을 올리려면 서버 전용 키가 필요합니다. Vercel의 ops 프로젝트 → Settings → Environment Variables 에 <code>SUPABASE_SECRET_KEY</code>(Type: Secret)를 추가하고 Redeploy 하세요.</p>
        </section>
      ) : (
        <OmsConsole initial={tracks ?? []} playerUrl="https://falling.eventgo.kr/one-more-song" loadError={tracks === null} />
      )}
    </OpsShell>
  );
}
