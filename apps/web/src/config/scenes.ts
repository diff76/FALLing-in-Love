import type { CinematicScene, SceneId } from "@fil/domain";
import manifest from "./media-manifest.json";

type Manifest = {
  clips: Partial<Record<SceneId, string>>;
  clipsMobile: Partial<Record<SceneId, string>>;
  connectors: (string | null)[];
  connectorsMobile: (string | null)[];
};
const media = manifest as Manifest;

/**
 * The seven approved scenes. Copy here is working copy (not final). Posters are
 * temporary spatial plates from the campus photographs; final clay renders replace
 * them by file name without touching this list.
 */
const base: Omit<CinematicScene, "media">[] & { id: SceneId }[] = [
  {
    id: "opening-track", label: "Opening", eyebrow: "01 · The Opening Track",
    title: "Every Journey Needs A First Note.",
    body: "창동성전 1층 라운지에서 셔틀이 떠납니다. 당신의 가을 오후는 도착하기 전에 이미 시작됩니다.",
    accent: "#C9932F", camera: "travel", scroll: 1.4, linger: 0.3,
  },
  {
    id: "landing", label: "Landing", eyebrow: "02 · The Landing", title: "You’re Here.",
    body: "정문을 지나면 흙 운동장과 웰컴 스팟이 먼저 맞이합니다. 셔틀과 자차가 한곳에 닿는 오늘의 첫 정착지입니다.",
    accent: "#6C8A50", camera: "dive", scroll: 1.3,
  },
  {
    id: "ascent", label: "Ascent", eyebrow: "03 · The Ascent",
    title: "Somewhere Above, The Music Has Already Begun.",
    body: "소나무 사이의 짧은 침목 계단. 시야가 잠시 좁아지고, 계단 끝에서 채플의 청록빛 유리가 먼저 보입니다.",
    accent: "#C9932F", camera: "approach", scroll: 1.1,
  },
  {
    id: "garden", label: "Garden", eyebrow: "04 · The Garden", title: "Stay Awhile.",
    body: "흰 열주 사이의 수공간 옆에 테이블이 놓입니다. 커피와 핑거푸드를 앞에 두고, 초청한 분과 나누는 대화가 소란스럽지 않게 이어집니다.",
    tags: ["Coffee", "Jazz", "Conversation"],
    accent: "#BE5637", camera: "discover", scroll: 1.8, linger: 0.45,
  },
  {
    id: "trail", label: "Interlude", eyebrow: "05 · The Trail", title: "Take The Long Way.",
    body: "잔디 광장의 판석 길을 따라 본관과 도서관 사이를 걷습니다. 무대가 아닌 곳에서도 오늘의 이야기가 이어집니다.",
    accent: "#6C8A50", camera: "pause", scroll: 1.2, linger: 0.35,
  },
  {
    id: "chamber", label: "Concert", eyebrow: "06 · Chamber Concert", title: "You May Know This Melody.",
    body: "십자가가 새겨진 크림색 타워를 지나 채플 안으로. 익숙한 선율 뒤에 숨어 있던 이야기가 열립니다.",
    accent: "#3E5540", camera: "dive", scroll: 1.7, linger: 0.5,
  },
  {
    id: "finale", label: "Finale", eyebrow: "07 · Finale", title: "FALLing in Love",
    body: "분수대 곁에서 재즈 트리오가 마지막 곡을 시작합니다. 카메라는 천천히 물러나 채플과 본관, 잔디와 수공간을 한 화면에 담고, 오늘 다녀온 자리들이 하나의 정원이었음을 보여줍니다.",
    accent: "#BE5637", camera: "pull-out", scroll: 1.8, linger: 0.4,
  },
];

const posters: Record<SceneId, { poster: string; posterMobile?: string; posterAlt: string }> = {
  "opening-track": { poster: "/media/scenes/opening-track.webp", posterAlt: "창동성전 라운지에서 출발하는 셔틀을 예고하는 따뜻한 오후 빛 (임시 플레이트)" },
  landing: { poster: "/media/scenes/landing.webp", posterAlt: "한신대 서울캠퍼스 흙 운동장과 보도블록 웰컴 스팟 예정지" },
  ascent: { poster: "/media/scenes/ascent.webp", posterMobile: "/media/scenes/ascent-m.webp", posterAlt: "소나무 사이로 채플 유리가 보이는 짧은 침목 계단" },
  garden: { poster: "/media/scenes/garden.webp", posterAlt: "본관 앞 수공간 테라스 (대화와 커피의 자리)" },
  trail: { poster: "/media/scenes/trail.webp", posterAlt: "본관 앞 잔디 광장과 공중 브리지 동" },
  chamber: { poster: "/media/scenes/chamber.webp", posterAlt: "십자가 절개 타워와 청록 유리 계단실이 있는 채플 정면" },
  finale: { poster: "/media/scenes/finale.webp", posterAlt: "본관 앞 수공간 테라스 — 재즈 버스킹이 열리는 자리 (다른 앵글)" },
};

export const scenes: readonly CinematicScene[] = base.map((s) => ({
  ...s,
  media: {
    ...posters[s.id],
    clip: media.clips[s.id] ?? null,
    clipMobile: media.clipsMobile[s.id] ?? null,
  },
}));

export const connectors = media.connectors;
export const connectorsMobile = media.connectorsMobile;
export const sceneIds = scenes.map((s) => s.id);
