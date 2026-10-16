import { requireRole } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { isSupabaseAdminConfigured } from "@fil/supabase";
import { loadLetterOverview, WEB_ORIGIN } from "./data";
import { LettersConsole } from "./letters-console";

export const dynamic = "force-dynamic";

/** Admin: the thank-you letters — which district has written, the pastors' writing links, the letter links and the sending list. */
export default async function LettersPage() {
  const session = await requireRole("admin");
  const data = isSupabaseAdminConfigured() ? await loadLetterOverview().catch(() => null) : null;
  return (
    <OpsShell eyebrow="Admin · Thank-you letters" title="감사 편지" roles={session.roles} email={session.email} wide light>
      {!data ? (
        <section className="box"><h2>불러오지 못했습니다</h2><p className="tiny">서버 전용 키(<code>SUPABASE_SECRET_KEY</code>)와 신청 데이터를 확인해 주세요.</p></section>
      ) : (
        <>
          {data.tablesMissing && <section className="box"><p className="stationNote">감사 편지 저장소가 아직 없습니다. Supabase SQL Editor에서 <b>0013 SQL</b>을 실행하면 아래 기능이 켜집니다.</p></section>}
          <section className="box">
            <h2>보내는 순서</h2>
            <ol className="ltSteps">
              <li><b>작성 링크 보내기</b> — 교구마다 “작성 링크 만들기”로 링크를 만들어 교구장 목사님께 보냅니다. 목사님은 로그인 없이 자기 교구 편지 두 편(① VIP · 인도자 · 미래셀, ② 일반 성도)만 쓸 수 있습니다.</li>
              <li><b>글 확인</b> — 아래 표에서 ①·②가 “작성됨”이 되었는지 보고, 대상별 링크로 받는 분 화면을 열어 봅니다. 필요하면 “직접 쓰기”로 고칩니다.</li>
              <li><b>발송</b> — <a className="miniBtn" href="/admin/letters/export" download>발송용 엑셀 받기</a> 를 눌러 이름 · 전화번호 · 받을 링크 · 문자 문구가 담긴 파일을 받고, 교회 문자 발송 서비스로 보냅니다. 함께 오신 VIP(연락처 없음)는 인도자 편지의 “함께 오신 분께 편지 보내기”로 전달됩니다.</li>
            </ol>
            {data.noDistrict > 0 && <p className="tiny warn">교구/부서가 없는 신청 {data.noDistrict}건은 받을 편지가 정해지지 않아 발송용 엑셀에 링크가 비어 있습니다. 관리자 명단에서 교구를 채워 주세요.</p>}
          </section>
          <LettersConsole districts={data.districts} webOrigin={WEB_ORIGIN} />
        </>
      )}
    </OpsShell>
  );
}
