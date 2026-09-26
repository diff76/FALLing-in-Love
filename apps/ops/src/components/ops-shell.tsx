import Link from "next/link";
import type { StaffRole } from "@fil/domain";
import { signOut } from "@/app/login/actions";
import { OpsNav } from "./ops-nav";
import { Leaves } from "./leaves";

const nav: { href: string; label: string; roles: StaffRole[] }[] = [
  { href: "/scan", label: "스캔·체크인", roles: ["staff", "admin"] },
  { href: "/desk", label: "웰컴 데스크", roles: ["desk", "admin"] },
  { href: "/display", label: "웰컴 디스플레이", roles: ["desk", "admin"] },
  { href: "/parking", label: "주차 관리", roles: ["staff", "desk", "admin"] },
  { href: "/admin", label: "관리자", roles: ["admin"] },
  { href: "/admin/import", label: "엑셀 일괄 등록", roles: ["admin"] },
  { href: "/admin/accounts", label: "계정 관리", roles: ["admin"] },
];

export function OpsShell({ title, eyebrow, roles, email, wide, light, children }: { title: string; eyebrow: string; roles: StaffRole[]; email: string | null; wide?: boolean; light?: boolean; children: React.ReactNode }) {
  const items = nav.filter((n) => n.roles.some((r) => roles.includes(r)));
  return (
    <main className={`opsShell ${wide ? "wide" : ""} ${light ? "light" : ""}`}>
      <Leaves />
      <aside>
        {/* The lockup is the "home" button: / sends each role to its first screen after login. */}
        <strong className="lockup"><Link href="/" aria-label="처음 화면으로"><span className="fall">FALL</span>ing <em>in</em> Love</Link></strong>
        <span>OPERATIONS · 2026</span>
        <OpsNav items={items.map(({ href, label }) => ({ href, label }))} />
        <div className="who"><small>{email ?? ""}</small><small>{roles.join(" · ")}</small></div>
        <form action={signOut} className="logoutForm"><button className="logout" type="submit">로그아웃</button></form>
      </aside>
      <section className="opsMain">
        <header><div><p>{eyebrow}</p><h1>{title}</h1></div></header>
        {children}
        <footer className="opsFoot"><form action={signOut}><button className="logout" type="submit">로그아웃</button></form></footer>
      </section>
    </main>
  );
}
