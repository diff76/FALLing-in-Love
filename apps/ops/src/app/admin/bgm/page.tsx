import { requireRole } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { BGM_DEFAULTS, isSupabaseAdminConfigured, loadBgm } from "@fil/supabase";
import { OmsConsole } from "../oms/oms-console";
import { BgmSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

/** Admin-only: the web site's background music — on/off, starting volume, autostart, order — and its tracks. */
export default async function BgmPage() {
  const session = await requireRole("admin");
  const configured = isSupabaseAdminConfigured();
  const bgm = configured ? await loadBgm().catch(() => null) : null;
  return (
    <OpsShell eyebrow="Admin · Background music" title="웹사이트 배경음악" roles={session.roles} email={session.email} light>
      {!configured ? (
        <section className="box"><h2>설정이 필요합니다</h2><p className="tiny">서버 전용 키(<code>SUPABASE_SECRET_KEY</code>)가 있어야 배경음악을 관리할 수 있습니다.</p></section>
      ) : (
        <div className="omsConsole">
          <BgmSettingsForm initial={bgm?.settings ?? BGM_DEFAULTS} trackCount={bgm?.tracks.length ?? 0} />
          <OmsConsole folder="bgm" initial={bgm?.tracks ?? []} playerUrl="https://falling.eventgo.kr/" loadError={bgm === null} />
        </div>
      )}
    </OpsShell>
  );
}
