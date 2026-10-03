import { redirect as go } from "next/navigation";
import { getSession } from "@/lib/auth";

// Never prerender: the session decides what this route does.
export const dynamic = "force-dynamic";

export default async function OpsHome({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const session = await getSession();
  if (!session) go("/login");
  const { k } = await searchParams;
  const redirect = (path: string): never => go(k ? `${path}?k=${encodeURIComponent(k)}` : path);   // keep an access-link key (home-screen icons)
  // First screen after sign-in (and after an access link, and the lockup "home" button):
  // the highest role wins — admin → 관리자, staff → 스캔·체크인, desk → 웰컴 데스크, parking → 주차 관리.
  if (session.roles.includes("admin")) redirect("/admin");
  if (session.roles.includes("staff")) redirect("/scan");
  if (session.roles.includes("desk")) redirect("/desk");
  if (session.roles.includes("parking")) redirect("/parking");
  go("/login?denied=staff");
}
