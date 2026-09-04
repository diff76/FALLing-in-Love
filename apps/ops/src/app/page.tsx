import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Never prerender: the session decides what this route does.
export const dynamic = "force-dynamic";

export default async function OpsHome() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.roles.includes("admin")) redirect("/admin");
  if (session.roles.includes("desk")) redirect("/desk");
  redirect("/scan");
}
