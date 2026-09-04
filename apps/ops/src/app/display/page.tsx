import { requireRole } from "@/lib/auth";
import { WelcomeDisplay } from "./welcome-display";

// Never prerender: the session decides what this route does.
export const dynamic = "force-dynamic";

export default async function DisplayPage() {
  await requireRole("desk", "admin");
  return <WelcomeDisplay />;
}
