import { signIn } from "./actions";
import { Leaves } from "@/components/leaves";

// Never prerender: the session decides what this route does.
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string; error?: string; next?: string; denied?: string; link?: string }> }) {
  const sp = await searchParams;
  const unconfigured = sp.reason === "unconfigured";
  return (
    <main className="loginPage">
      <Leaves />
      <section className="loginHero">
        {/* The block is exactly as wide as the lockup, so OPERATIONS right-aligns to the "e" of Love. */}
        <div className="heroBlock">
          <p>2026 · 온출전</p>
          <h1 className="lockup"><span className="fall hl">FALL</span>ing <em>in</em> Love</h1>
          <p className="tagline">An Autumn Garden Matinée</p>
          <span className="ops">OPERATIONS</span>
        </div>
      </section>
      <form className="loginForm" action={signIn}>
        <h2>운영진 로그인</h2>
        <p>스태프 · 데스크 · 관리자 전용 앱입니다.</p>
        <input type="hidden" name="next" value={sp.next ?? "/"} />
        <label>아이디<input name="login" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={unconfigured} /></label>
        <label>비밀번호<input name="password" type="password" autoComplete="current-password" required disabled={unconfigured} /></label>
        <button type="submit" disabled={unconfigured}>로그인</button>
        {unconfigured && <small className="warn">Supabase 환경 변수가 설정되지 않아 로그인할 수 없습니다. `.env.local`을 확인하세요.</small>}
        {sp.error && <small className="warn">아이디 또는 비밀번호가 맞지 않습니다.</small>}
        {sp.link === "invalid" && <small className="warn">바로 접속 링크가 만료되었거나 무효화되었습니다. 관리자에게 새 링크를 요청하세요.</small>}
        {sp.denied && <small className="warn">이 화면에 필요한 권한({sp.denied})이 계정에 없습니다. 관리자에게 요청하세요.</small>}
        <small>권한은 계정별로 관리자가 부여합니다.</small>
      </form>
    </main>
  );
}
