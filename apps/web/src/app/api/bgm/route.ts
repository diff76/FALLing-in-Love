import { NextResponse } from "next/server";
import { loadBgm } from "@fil/supabase";

export const dynamic = "force-dynamic";

/** Public: background-music settings and tracks (short CDN cache — admin changes show within ~30 s). */
export async function GET() {
  const { settings, tracks } = await loadBgm();
  return NextResponse.json(
    { settings, tracks: tracks.map(({ key, title, artist, url }) => ({ key, title, artist, url })) },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
  );
}
