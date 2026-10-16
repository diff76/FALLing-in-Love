import { ImageResponse } from "next/og";

// The link preview in KakaoTalk / Messages: a sealed envelope on autumn paper (Latin text only, so no font file is needed).
export const alt = "A letter has arrived · FALLing in Love";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(120% 90% at 50% 25%, #FBF4E6 0%, #EFE3CC 75%)", fontFamily: "serif" }}>
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 8, color: "#3E5540", fontWeight: 700 }}>A LETTER HAS ARRIVED</div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 52, color: "#2E251C", fontWeight: 700 }}>
          <span style={{ color: "#BE5637" }}>FALL</span><span>ing&nbsp;</span><span style={{ color: "#BE5637", fontStyle: "italic", fontWeight: 400 }}>in</span><span>&nbsp;Love</span>
        </div>
        {/* envelope */}
        <div style={{ position: "relative", display: "flex", marginTop: 44, width: 520, height: 300, borderRadius: 10, background: "#EAD9B8", boxShadow: "0 30px 50px rgba(46,37,28,.25)" }}>
          {/* flap: a triangle drawn with borders */}
          <div style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, borderLeft: "260px solid transparent", borderRight: "260px solid transparent", borderTop: "190px solid #E2CDA6" }} />
          {/* stamp */}
          <div style={{ position: "absolute", right: 30, bottom: 34, width: 76, height: 92, display: "flex", alignItems: "center", justifyContent: "center", background: "#3E5540", border: "4px dashed #FCF8F0", color: "#FCF8F0", fontSize: 18, fontStyle: "italic", textAlign: "center" }}>Autumn</div>
          {/* postmark */}
          <div style={{ position: "absolute", left: 34, bottom: 40, width: 110, height: 110, borderRadius: 55, border: "3px solid #C9932F", display: "flex", alignItems: "center", justifyContent: "center", color: "#C9932F", fontSize: 18, letterSpacing: 2 }}>2026.10.11</div>
          {/* wax seal */}
          <div style={{ position: "absolute", left: 220, top: 150, width: 80, height: 80, borderRadius: 40, background: "#BE5637", display: "flex", alignItems: "center", justifyContent: "center", color: "#F6D9C8", fontSize: 40, fontStyle: "italic" }}>F</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
