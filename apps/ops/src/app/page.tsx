import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Never prerender: the session decides what this route does.
export const dynamic = "force-dynamic";

export default async function OpsHome() {
  const session = await getSession();
  if (!session) redirect("/login");
  // First screen after sign-in (and after an access link, and the lockup "home" button):
  // the highest role wins — admin → 관리자, staff → 스캔·체크인, desk → 웰컴 데스크, parking → 주차 관리.
  if (session.roles.includes("admin")) redirect("/admin");
  if (session.roles.includes("staff")) redirect("/scan");
  if (session.roles.includes("desk")) redirect("/desk");
  if (session.roles.includes("parking")) redirect("/parking");
  redirect("/login?denied=staff");
}
