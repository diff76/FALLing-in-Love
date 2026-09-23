import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase-server";
import { OpsShell } from "@/components/ops-shell";
import type { ParkingBoard } from "@fil/supabase";
import { ParkingDesk } from "./parking-desk";

export const dynamic = "force-dynamic";

export default async function ParkingPage() {
  const session = await requireRole("staff", "desk", "admin");
  const db = await supabaseServer();
  const initial = db ? ((await db.rpc("parking_board")).data as ParkingBoard | null) : null;
  return (
    <OpsShell eyebrow="Parking · Phone or Tablet" title="주차 관리" roles={session.roles} email={session.email}>
      <ParkingDesk initial={initial} />
    </OpsShell>
  );
}
