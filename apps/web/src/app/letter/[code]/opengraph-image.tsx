import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link preview in KakaoTalk / Messages: a sealed envelope on autumn paper, with the site lockup in the same fonts as
// the letter page (Syne for FALLing · Love, Fraunces italic for "in").
export const alt = "A letter has arrived · FALLing in Love";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ENVELOPE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 330">
  <defs><filter id="s" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#2E251C" flood-opacity=".22"/></filter></defs>
  <g filter="url(#s)"><rect x="20" y="10" width="520" height="300" rx="10" fill="#EAD9B8"/></g>
  <path d="M20 310 L280 150 L540 310" fill="none" stroke="#DCC69E" stroke-width="2"/>
  <path d="M20 10 L280 205 L540 10 Z" fill="#E2CDA6"/>
  <path d="M20 10 L280 205 L540 10" fill="none" stroke="#D3BC92" stroke-width="2"/>
  <circle cx="110" cy="230" r="52" fill="none" stroke="#C9932F" stroke-width="3"/>
  <rect x="440" y="196" width="68" height="82" fill="#3E5540" stroke="#FCF8F0" stroke-width="3" stroke-dasharray="6 4" transform="rotate(4 474 237)"/>
  <circle cx="280" cy="205" r="38" fill="#BE5637"/>
  <circle cx="280" cy="205" r="31" fill="none" stroke="#D8714F" stroke-width="3"/>
</svg>`;

/** The fonts ship with the site (apps/web/assets/og-fonts, SIL Open Font License): no network at render time. */
const font = (file: string) => readFile(join(process.cwd(), "assets/og-fonts", file));

export default async function Image() {
  const [syne800, syne600, frauncesItalic, frauncesRoman, label] = await Promise.all(
    ["Syne-ExtraBold.ttf", "Syne-SemiBold.ttf", "Fraunces-Italic.ttf", "Fraunces-Regular.ttf", "NotoSans-Bold.ttf"].map(font),
  );
  const fonts = [
    { name: "Syne", data: syne800, weight: 800 as const, style: "normal" as const },
    { name: "Syne", data: syne600, weight: 600 as const, style: "normal" as const },
    { name: "Fraunces", data: frauncesItalic, weight: 400 as const, style: "italic" as const },
    { name: "Fraunces", data: frauncesRoman, weight: 400 as const, style: "normal" as const },
    { name: "Label", data: label, weight: 700 as const, style: "normal" as const },
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(120% 90% at 50% 25%, #FBF4E6 0%, #EFE3CC 75%)", fontFamily: "serif" }}>
        <div style={{ display: "flex", fontFamily: "Label", fontSize: 24, letterSpacing: 7, color: "#3E5540", fontWeight: 700 }}>A LETTER HAS ARRIVED</div>
        {/* the letter page's lockup: FALL (Syne 800, persimmon) · ing (Syne 600) · in (Fraunces italic, persimmon) · Love (Syne 600) */}
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 14, fontFamily: "Syne", fontSize: 64, fontWeight: 600, letterSpacing: -2.6, color: "#2E251C" }}>
          <span style={{ color: "#BE5637", fontWeight: 800 }}>FALL</span>
          <span>ing</span>
          <span style={{ fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 400, letterSpacing: 0, color: "#BE5637", margin: "0 8px" }}>in</span>
          <span>Love</span>
        </div>
        {/* envelope: shapes as SVG (a CSS border triangle does not render here); its words laid over it in the loaded fonts */}
        <div style={{ position: "relative", display: "flex", width: 560, height: 330, marginTop: 40 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" width={560} height={330} src={`data:image/svg+xml;utf8,${encodeURIComponent(ENVELOPE)}`} />
          <div style={{ position: "absolute", left: 50, top: 218, width: 120, display: "flex", justifyContent: "center", fontFamily: "Fraunces", fontSize: 17, letterSpacing: 1.5, color: "#C9932F" }}>2026.10.11</div>
          <div style={{ position: "absolute", left: 440, top: 224, width: 68, display: "flex", justifyContent: "center", fontFamily: "Fraunces", fontStyle: "italic", fontSize: 15, color: "#FCF8F0", transform: "rotate(4deg)" }}>Autumn</div>
          <div style={{ position: "absolute", left: 250, top: 178, width: 60, height: 54, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces", fontStyle: "italic", fontSize: 38, color: "#F6D9C8" }}>F</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
