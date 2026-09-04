import { signIn } from "./actions";

// Never prerender: the session decides what this route does.
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string; error?: string; next?: string; denied?: string }> }) {
  const sp = await searchParams;
  const unconfigured = sp.reason === "unconfigured";
  return (
    <main className="loginPage">
      <section className="loginHero">
        <p>2026 · 온출전</p>
        <h1><b>FALL</b>ing <em>in</em> Love</h1>
        <span>OPERATIONS</span>
      </section>
      <form className="loginForm" action={signIn}>
        <h2>운영진 로그인</h2>
        <p>스태프 · 데스크 · 관리자 전용 입구입니다.</p>
        <input type="hidden" name="next" value={sp.next ?? "/"} />
        <label>이메일<input name="email" type="email" autoComplete="email" required disabled={unconfigured} /></label>
        <label>비밀번호<input name="password" type="password" autoComplete="current-password" required disabled={unconfigured} /></label>
        <button type="submit" disabled={unconfigured}>로그인</button>
        {unconfigured && <small className="warn">Supabase 환경 변수가 설정되지 않아 로그인할 수 없습니다. `.env.local`을 확인하세요.</small>}
        {sp.error && <small className="warn">이메일 또는 비밀번호가 맞지 않습니다.</small>}
        {sp.denied && <small className="warn">이 화면에 필요한 권한({sp.denied})이 계정에 없습니다. 관리자에게 요청하세요.</small>}
        <small>권한은 계정별로 관리자가 부여합니다. URL을 안다고 해서 열리지 않습니다.</small>
      </form>
    </main>
  );
}
