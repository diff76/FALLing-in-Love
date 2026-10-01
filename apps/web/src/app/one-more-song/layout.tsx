import { OmsAudioProvider } from "@/components/oms-audio";
import { listOms } from "@/lib/oms";

export const dynamic = "force-dynamic";

/** The playlist's sound lives here, above both pages, so the music keeps going from the player into the photos. */
export default async function OmsLayout({ children }: { children: React.ReactNode }) {
  const { tracks } = await listOms();
  return <OmsAudioProvider tracks={tracks.map(({ key, title, artist, url }) => ({ key, title, artist, url }))}>{children}</OmsAudioProvider>;
}
