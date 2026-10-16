import { ImageResponse } from "next/og";

// The link preview in KakaoTalk / Messages: a sealed envelope on autumn paper (Latin text only, so no font file is needed).
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
  <text x="110" y="236" text-anchor="middle" font-family="Georgia, serif" font-size="17" letter-spacing="1.5" fill="#C9932F">2026.10.11</text>
  <rect x="440" y="196" width="68" height="82" fill="#3E5540" stroke="#FCF8F0" stroke-width="3" stroke-dasharray="6 4" transform="rotate(4 474 237)"/>
  <text x="474" y="243" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="15" fill="#FCF8F0" transform="rotate(4 474 237)">Autumn</text>
  <circle cx="280" cy="205" r="38" fill="#BE5637"/>
  <circle cx="280" cy="205" r="31" fill="none" stroke="#D8714F" stroke-width="3"/>
  <text x="280" y="219" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="38" fill="#F6D9C8">F</text>
</svg>`;

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(120% 90% at 50% 25%, #FBF4E6 0%, #EFE3CC 75%)", fontFamily: "serif" }}>
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 8, color: "#3E5540", fontWeight: 700 }}>A LETTER HAS ARRIVED</div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 52, color: "#2E251C", fontWeight: 700 }}>
          <span style={{ color: "#BE5637" }}>FALL</span><span>ing&nbsp;</span><span style={{ color: "#BE5637", fontStyle: "italic", fontWeight: 400 }}>in</span><span>&nbsp;Love</span>
        </div>
        {/* envelope: drawn as SVG (a CSS border triangle does not render in the image renderer) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" width={560} height={330} style={{ marginTop: 40 }} src={`data:image/svg+xml;utf8,${encodeURIComponent(ENVELOPE)}`} />
      </div>
    ),
    { ...size },
  );
}
