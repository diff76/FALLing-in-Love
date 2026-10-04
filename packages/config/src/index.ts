/**
 * Event-wide constants. Anything the church may change before the day lives here
 * (or in the `event_config` table once Supabase is connected) — never scattered in UI.
 */
export const eventConfig = {
  edition: "2026 온출전",
  name: "FALLing in Love",
  subtitle: "An Autumn Garden Matinée",
  tagline: "An afternoon of music, garden and grace.",
  taglineKo: "알고 있다고 여겼던 사랑이, 생각보다 더 컸습니다...",
  host: "창동염광교회",
  date: "2026-10-11",
  dateLabel: "2026. 10. 11. 주일",
  opensAt: "12:00",
  closesAt: "16:00",
  /** 12-hour labels for guest-facing copy */
  opensAtLabel: "12:00",
  closesAtLabel: "4:00",
  venue: {
    name: "한신대학교 신학대학원 서울캠퍼스",
    short: "한신성전",
    address: "서울 강북구 인수봉로 159",
  },
  origin: { name: "창동성전", note: "1층 라운지에서 셔틀이 출발합니다" },
  /** The line on the Matinée Pass: when and where guests are expected (the main programme). */
  passMeet: { time: "오후 1:00", place: "한신 채플" },
  /** Confirmed running order (v3 brief). Listed in ONE place on the public site. */
  schedule: [
    { time: "10:00", title: "THE OPENING TRACK", note: "셔틀 운행 시작", place: "창동성전 → 한신" },
    { time: "10:30", title: "PRELUDE", note: "캠퍼스 투어(스탬프), 피크닉, 정원 얼리 오픈", place: "한신 전역" },
    { time: "12:45", title: "입장 안내 · 좌석 안내", note: "화장실 이용 권고 포함", place: "Chapel" },
    { time: "13:00", title: "ACT I — 특별예배", note: "40분", place: "Chapel" },
    { time: "13:42", title: "THE TUNING", note: "10분", place: "Chapel" },
    { time: "13:52", title: "ACT II — 실내악 챔버 콘서트", note: "48분", place: "Chapel" },
    { time: "14:40", title: "정원으로 이동", note: "10분", place: "→ Garden" },
    { time: "14:50", title: "GARDEN FINALE — 재즈 · 애프터눈 테이블", note: "60분", place: "Garden" },
    { time: "15:50", title: "클로징 메시지", place: "Garden" },
    { time: "16:00", title: "SEE YOU SOON", place: "Garden" },
  ],
  districts: [
    ["11", "11교구"], ["12", "12교구"], ["13", "13교구"], ["14", "14교구"], ["15", "15교구"],
    ["21", "21교구"], ["22", "22교구"], ["23", "23교구"], ["24", "24교구"], ["25", "25교구"],
    ["31", "31교구"], ["32", "32교구"], ["33", "33교구"], ["35", "35교구"],
    ["JB", "장애인부"], ["ED", "교육부"],
  ] as const,
  ageGroups: ["30대", "40대", "50대", "60대", "70대 이상"] as const,
  stations: [
    { code: "gate", name: "창동 THE GATE" },
    { code: "landing", name: "주차장 THE LANDING" },
    { code: "chapel", name: "채플 웰컴센터" },
  ] as const,
  /** Updated 2026-10-01: every 30 minutes from 10:00, last outbound 15:00; four return runs (25 seats each by default). */
  shuttle: {
    provisional: false,
    outbound: ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00"],
    return: ["16:15", "16:30", "16:45", "17:00"],
    /** pre-selected outbound run on the sign-up form */
    defaultOutbound: "10:00",
    /** seats per return bus (each run is one 25-seat bus); admins adjust per run in ops */
    returnSeats: 25,
    rideMinutes: 18,
  },
  /** Main event vs. worship-only attendance (people who only join one of the services). */
  attendance: [["main", "메인 행사 참여 (13:00–16:00 · 한신성전)"], ["worship", "1~3부 예배만 참석 (메인 행사 불참)"]] as const,
  worshipServices: [["1", "1부 예배"], ["2", "2부 예배"], ["3", "3부 예배"]] as const,
  worshipSites: [["changdong", "창동성전"], ["hanshin", "한신성전"]] as const,
  /** Districts / departments seated on the ground floor near the aisles (easy exit). */
  priorityDistricts: ["11", "21", "JB", "ED"] as const,
  /** Handed out at check-in (2026-10-02: the welcome-drink coupon was dropped; its DB row stays for past records, hidden here). */
  hospitalityItems: [
    { code: "pouch", name: "런치박스" },
    { code: "stamp", name: "THE TRAIL 스탬프 카드" },
  ] as const,
  /** host + up to 5 invited guests (raised from 4 on 2026-09-27) */
  maxPartySize: 6,
  /** Personal data is deleted within this many days after the event (documented policy). */
  dataRetentionDays: 30,
} as const;

export type DistrictCode = (typeof eventConfig.districts)[number][0];
export type AgeGroup = (typeof eventConfig.ageGroups)[number];
export type StationCode = (typeof eventConfig.stations)[number]["code"];

export function districtName(code: string | null | undefined): string {
  const hit = eventConfig.districts.find(([c]) => c === code);
  return hit ? hit[1] : "교구 확인 필요";
}
