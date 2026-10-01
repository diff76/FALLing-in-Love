"use client";

import { useEffect, useState } from "react";

type Track = { title: string; artist: string };
/**
 * Track names next to THE ONE MORE SONG on the home page. Uploaded tracks once they exist
 * (from /api/oms); before that, the concert's teaser titles marked as "coming".
 */
export function OmsTracklist({ fallback }: { fallback: string[] }) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/oms").then((r) => r.json()).then((d) => { if (alive) setTracks(d.tracks ?? []); }).catch(() => alive && setTracks([]));
    return () => { alive = false; };
  }, []);
  const live = tracks && tracks.length > 0;
  const list = live ? tracks!.slice(0, 8) : fallback.map((title) => ({ title, artist: "" }));
  return (
    <ol className="omsTracklist" aria-label="트랙 목록">
      <li className="omsTracklistHead"><span>{live ? "Tracklist" : "Tracklist · 공개 예정"}</span></li>
      {list.map((t, i) => (
        <li key={`${i}-${t.title}`}><b>{String(i + 1).padStart(2, "0")}</b><span>{t.title}{t.artist ? <em> · {t.artist}</em> : null}</span></li>
      ))}
      {live && tracks!.length > 8 && <li className="more"><span>외 {tracks!.length - 8}곡</span></li>}
    </ol>
  );
}
