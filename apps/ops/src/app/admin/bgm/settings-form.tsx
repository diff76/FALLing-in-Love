"use client";

import { useState } from "react";
import type { BgmSettings } from "@fil/supabase";
import { saveBgmSettings } from "../oms/actions";

/** Admin: how the site plays its background music. Saved to event_config; the site picks it up within ~30 s. */
export function BgmSettingsForm({ initial, trackCount }: { initial: BgmSettings; trackCount: number }) {
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await saveBgmSettings(s);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "저장했습니다. 웹사이트에는 30초 안에 반영됩니다." } : { ok: false, text: r.error });
  };
  return (
    <section className="box bgmSettings">
      <h2>재생 설정 <small>{s.enabled && trackCount ? "웹사이트에서 재생 중" : !trackCount ? "곡을 올리면 재생됩니다" : "꺼짐"}</small></h2>
      <p className="sub">웹사이트 왼쪽 아래에 작은 배경음악 버튼이 나옵니다. 방문자가 언제든 끄고 켤 수 있고, 끈 사람에게는 다음 방문에도 꺼진 채로 유지됩니다. 플레이어가 있는 One More Song 페이지에서는 자동으로 멈춥니다.</p>
      <label className="bgmRow"><input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} /><span><b>배경음악 사용</b><small>끄면 웹사이트에서 버튼과 음악이 모두 사라집니다.</small></span></label>
      <label className="bgmRow"><input type="checkbox" checked={s.autostart} onChange={(e) => setS({ ...s, autostart: e.target.checked })} /><span><b>자동 재생</b><small>켜 두면 들어오자마자 재생을 먼저 시도합니다. 다만 대부분의 브라우저(아이폰 사파리, 크롬, 삼성 인터넷)는 방문자가 화면을 한 번 누르기 전에는 소리를 막기 때문에, 그런 경우에는 처음 누르는 순간 음악이 시작됩니다. 끄면 방문자가 버튼을 눌러야 시작됩니다.</small></span></label>
      <label className="bgmRow"><input type="checkbox" checked={s.shuffle} onChange={(e) => setS({ ...s, shuffle: e.target.checked })} /><span><b>무작위 순서</b><small>끄면 아래 목록 순서대로 재생합니다. 마지막 곡 뒤에는 처음으로 돌아갑니다.</small></span></label>
      <label className="bgmVol"><b>처음 볼륨</b>
        <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => setS({ ...s, volume: Number(e.target.value) })} />
        <span className="mono">{Math.round(s.volume * 100)}%</span>
        <small>처음 들어온 방문자의 볼륨입니다. 방문자가 조절하면 그 기기에서는 그 값이 유지됩니다. 낮게(30~40%) 두시길 권합니다.</small>
      </label>
      <div className="resActions"><button className="btn gold small" type="button" disabled={busy || !dirty} onClick={save}>{busy ? "저장 중…" : "설정 저장"}</button></div>
      {msg && <p className={`tiny ${msg.ok ? "" : "warn"}`} role="status">{msg.text}</p>}
    </section>
  );
}
