import { NextResponse } from "next/server";
import { isAdminToken } from "@/lib/oms";

export const dynamic = "force-dynamic";

/** Is the signed-in session an ops admin? (decides whether the upload panel shows) */
export async function GET(request: Request) {
  return NextResponse.json({ admin: await isAdminToken(request.headers.get("authorization")) }, { headers: { "Cache-Control": "no-store" } });
}
