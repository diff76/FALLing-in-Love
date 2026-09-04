# FALLing in Love — Phase 0A/0B 점검 및 아키텍처 평가

작성일: 2026-09-03 · 행사일: 2026-10-11 (D-38)

## 1. 점검 결과 (WHAT I FOUND)

### 작업 폴더
- `Event Web Building_Claude_Fable_51/`: 코드 없음. `Assets/`에 캠퍼스 현장 사진 22장(`캠퍼스 맵_Assets`와 동일본). git 저장소 아님.

### 기존 스캐폴드 `../falling-in-love-platform/` (이전 Codex 세션 산출물)
- npm workspaces 모노레포. Next 16.3.4 / React 19.2 / TS 5.9. `apps/web`(3000), `apps/ops`(3001), `packages/config|domain|supabase`.
- `npm run test`(3건) 통과, `npm run typecheck` 통과. git 이력 없음.
- Public: 히어로 + 초대문 + 7장면 세로 스크롤(IntersectionObserver, 현장 사진 정지 이미지) + 곡 카드 + 시간표 + `/apply`(비활성 폼) + `/pass/[id]`(자리표시) + `/one-more-song`(자리표시).
- Ops: `/login`(비활성), `/scan` `/desk` `/display` `/admin` 정적 골격. 인증·보호 없음. 문서에 "보안을 가장하지 않기 위해 비활성"이라고 명시.
- `packages/supabase`: SSR 클라이언트 유틸만 존재. 스키마·마이그레이션·RLS 없음.
- `docs/`: ARCHITECTURE, DATA_MODEL(제안), PUBLIC_EXPERIENCE(캠퍼스 공간 관계 고정 규칙 포함), OPS_FLOW, ROADMAP.
- 미디어: `public/campus/*.jpg` 현장 사진, `public/clay/campus-overview-v3.png`(세피아 톤 클레이 디오라마 캠퍼스 전경, 실제 배치 반영, 품질 양호), `og-v5.png`.

### 프로토타입 `../matinee-integrated.html` (1,098줄)
- 6개 화면(신청·Pass·스태프 스캔·데스크·디스플레이·관리자)이 단일 인메모리 `DB`를 공유. 시드 데이터 46팀.
- 유일한 쓰기 경로 `confirmCheckIn(team, count, gives)`: 도착 플래그·도착 인원·스테이션·시각·물품 지급 기록, 재고 차감, 환영 큐 push.
- 이미 체크인된 팀 재스캔 시 "안내 전용" 화면(재집계 없음, 환영 화면 재노출 없음) → 멱등성 개념.
- 상수: 교구 16개(11~35교구, 장애인부, 교육부), 셔틀 6편(10:40~12:30), 스테이션 3곳(창동 THE GATE·주차장 THE LANDING·채플 웰컴센터), 연령대 4단계, 비품 4종.
- 티켓 번호 `261011-<교구>-<일련>`, 좌석 `채플 A/B/C블록 n–m`(블록 랜덤·번호 순차).
- 신청 모드 2종: 초청자 등록(동반 최대 4명, 각 성함·관계·연령대·선호곡·식이) / 게스트 자가 등록(초대자 성함·교구).
- 동의: 필수(성함·연락처 수집), 선택(사진·플레이리스트·소식 수신).
- 프로토타입 전용 요소: 가짜 QR(해시 기반 패턴), 클릭식 가짜 스캐너, 시뮬레이션 버튼(5분 흐르기, 셔틀 도착), 데모 문구.
- 시간 표기가 "오후 1시–4시"로, 기획 v3의 12:00–16:00과 다름.

### `../Scroll-World PRJ/` (2026-09-02 scroll-world 스킬 실행 결과)
- 구조: 9섹션 `overture → gate → track → landing → ascent → acti → actii → garden → onemoresong`. 아키텍처 A(연속 전진 테이크). 아트 디렉션은 "painterly photographic"(클레이 아님).
- 진행 상태: 스틸 10장 완료, 레그 6/9 렌더(720p previz, `seedance_2_0_mini`), `actii`에서 NSFW 필터로 중단. `assets/vid/` 비어 있음 → `index.html`은 현재 동작하지 않음.
- 품질 문제: `work/last_ascent.png`가 실제 한신 채플(흰 콘크리트 매스 + 청록 유리)이 아닌 가상의 A-프레임 첨탑 예배당으로 표류. 종료 프레임 제약이 없는 A 체인의 구조적 한계.
- `../웹사이트_제작_프롬프트.md`(v3)는 이 PRJ의 브리프. PRELUDE/ACT I/THE TUNING/ACT II/FINALE 구조, "그 곡, 사실은" 카드 모티프, 빛 축(색온도) 개념, "게스트 신청곡 접수 삭제" 결정이 담겨 있음. 마스터 프롬프트의 7장면 구조와 다름.

### scroll-world 스킬 (v0.8.0, 설치됨)
- 파이프라인: 스틸(`gpt_image_2`) → 카메라 클립(Seedance 2.0) → 인코딩 → `mountScrollWorld(container, config)` 바닐라 JS 엔진(448줄, 자체 DOM/CSS 주입, blob 시킹, 심 크로스페이드, reduced-motion, 모바일 하드닝).
- 아키텍처 B(다이브 + 연결 클립, `--end-image` 사용) = "Fly through the world" = 마스터 프롬프트의 World Flythrough. 스킬 자체가 디오라마/미니어처에는 B를 권장.
- 비용 구조: N스틸 + (2N−1)영상, 모바일 9:16 체인 추가 시 영상 ×2. 이전 관측치: Standard 영상 40–55크레딧, 스틸 ≈15.
- 환경: `higgsfield` CLI 로그인됨(ultra 플랜, 2,890크레딧). `monid`·`codex`·`supabase` CLI 없음. `ffmpeg` 있음.

## 2. 추천 아키텍처

- 기존 `falling-in-love-platform` 모노레포를 **계속 사용**(새로 시작하지 않음). 마스터 프롬프트 구조와 일치하고 빌드·테스트가 통과함. 단, git 저장소로 전환하고 이 세션의 작업 폴더로 이동 또는 연결 필요(Decision Gate 1).
- 구조 유지: `apps/web`(Public), `apps/ops`(Operations), `packages/config|domain|supabase`. 추가 예정: `packages/domain`에 예약·패스·체크인 서비스 경계, `supabase/migrations`, `packages/ui`는 필요 시에만.
- 서버 레이어: 별도 백엔드 없음. Next.js Route Handler + Server Action + Supabase RPC. 특권 키는 서버 전용.
- 배포: Next.js `output: "standalone"` + Dockerfile을 두어 Vercel·Railway·Fly·Render 어디든 가능하게 유지.

## 3. 프로토타입에서 보존할 로직

1. 체크인 단일 쓰기 경로 → `perform_checkin` RPC(security definer) 하나로 고정.
2. 재스캔 멱등성: 활성 체크인이 있으면 "안내 전용" 응답(재집계·환영 재노출 없음).
3. 스캔과 수동 조회(성함 / 연락처 뒤 4자리)가 같은 확인 화면으로 수렴.
4. 확인 화면 구성: 신청 인원 대비 실제 도착 인원 스테퍼, 특이 플래그(식이·이동·주차·복귀 셔틀), 물품 지급 체크.
5. 물품 지급 ↔ 재고 차감 연동.
6. 데스크의 "다음 셔틀 편" 뷰: 탑승 예정 인원, 처음 오시는 분 수, 사전 준비 항목(이동 도움·주차·식이).
7. 환영 디스플레이 큐: 체크인 → 4~5초 노출 → 대기 화면 복귀. 성함 마스킹 추가.
8. 관리자 KPI: 신청 팀/인원, 체크인, 실참률, 연락 수신 동의 수, 교구별·셔틀별·스테이션별·연령대별 집계, 필터 명단.
9. 초청자 등록 / 게스트 자가 등록 이중 모드, 초대자 연결.
10. 티켓 번호 규칙(`YYMMDD-교구-일련`)은 사람이 읽는 참조번호로 유지, QR 토큰과 분리.

## 4. Supabase 전략

### 스키마 제안 (마이그레이션 전 승인 대상)
- `profiles`(auth.users 1:1) · `staff_roles`(profile_id, role: staff|desk|admin) — 역할은 테이블 기반, 필요 시 JWT custom claims 훅으로 승격.
- `reservations`: id, code(사람용 참조번호), kind(host|guest_self), applicant_name, phone, phone_last4(생성 컬럼), district_code, inviter_name, party_size, transport(shuttle|car|other), outbound_run_id, return_run_id, vehicle_plate, needs_mobility_support, mobility_note, dietary_note, privacy_consent, contact_consent, status, created_at.
- `reservation_members`: reservation_id, name, relation, age_group, dietary_note.
- `passes`: reservation_id(unique), token_hash, issued_at, revoked_at. QR에는 `https://<public>/p/<token>`만. 토큰 원문은 저장하지 않음.
- `shuttle_runs`: direction(outbound|return), departs_at, capacity, label.
- `seat_assignments`: reservation_id, block, seat_from, seat_to, assigned_at. `assignSeat(reservation)` 경계 뒤에 두고 알고리즘은 교체 가능.
- `stations` · `checkins`: reservation_id, station_id, staff_id, arrived_count, method(qr|manual), checked_in_at, voided_at. 활성 체크인 1건 제약(partial unique index).
- `hospitality_items` · `hospitality_distributions`(checkin_id, item_id, qty).
- `event_config`(key, value jsonb).
- 후속: `songs`, `playlist_items`, `photos`, `photo_moderation`.
- 특별 요구(식이·이동)는 별도 테이블 대신 예약 컬럼으로 흡수(과도한 정규화 회피).

### 접근 제어
- anon: 테이블 직접 접근 전면 차단. 예약 생성은 서버 Route Handler(zod 검증 → service key)로만. 패스 조회는 토큰 해시 대조 후 서버에서 최소 필드만 반환.
- staff: 체크인 RPC 실행 + 조회용 view(성함·인원·좌석·셔틀·플래그만).
- desk: 도착·셔틀·좌석·플래그·재고 view.
- admin: 예약·설정 CRUD.
- 통계는 개인 행을 노출하지 않는 view/RPC로 제공.
- Realtime: `checkins` INSERT만 구독(데스크·디스플레이·관리자). 나머지는 주기적 재조회.

### 인증
- Supabase Auth 이메일+비밀번호(운영진 소수). 관리자가 계정 초대. Ops 미들웨어는 세션 존재만 확인하고 실제 권한은 RLS가 결정.

## 5. Public / Ops 경계

- 두 Next 앱, 별도 도메인(예: `fallinginlove.kr` / `ops.fallinginlove.kr`). Public에서 Ops 링크 노출 금지(현재 준수).
- 공유 범위: `packages/config`(행사 상수), `packages/domain`(타입·서비스 경계·검증 스키마), `packages/supabase`(클라이언트·생성 타입).
- 데이터 흐름: Public 예약 → `reservations`/`passes`/`seat_assignments` → Ops 조회. Ops 체크인 → `checkins` → Realtime → Desk/Display/Admin.

## 6. scroll-world 평가

- 적합: 엔진이 프레임워크 중립이고 설정 기반이라 React 클라이언트 컴포넌트에서 `useEffect`로 마운트 가능. `scenes.ts`가 단일 소스가 되도록 어댑터 한 층만 추가.
- 경계 준수 가능: 엔진은 `/`의 시네마틱 구간만 담당. 예약·패스·Ops와 무관.
- 주의: 엔진이 자체 DOM·CSS·경로 레일을 주입하므로 기존 `sceneNav`와 중복 → 하나로 통합. 첫 화면은 스틸 포스터로 즉시 그려지고 영상은 지연 로드.
- 이전 실행(A 아키텍처)의 표류 문제는 B로 전환하면 완화됨: 각 장면 스틸을 개별 승인하고 다이브가 승인된 스틸에서 시작, 연결 클립은 실제 렌더 프레임을 양끝에 고정.
- 비용(N=7, Standard 1080p, Higgsfield 크레딧 기준): 스틸 7×15 ≈ 105, 영상 13×~50 ≈ 650, 재롤 15% → 데스크톱 약 870. 모바일 9:16 추가 시 약 1,620. 잔여 2,890으로 데스크톱+모바일 1회 완성 가능하나 재작업 여유는 작음. previz(`seedance_2_0_mini`, 약 ¼ 비용)로 전체 체인을 먼저 승인하는 방식을 권장.
- 대안: (a) 스틸 + 패럴랙스/크로스페이드(무비용·안정·임팩트 낮음), (b) 전 장면 영상 체인, (c) 하이브리드(핵심 3~4장면만 영상).

## 7. Clay Diorama 함의

- 클레이/미니어처는 하이앵글 다이브와 부감 이동(B)에 자연스럽고, 지상 1인칭 워크스루(A)와는 어긋남. 카메라 결정과 아트 디렉션이 서로를 지지함.
- 기준 이미지: `clay/campus-overview-v3.png`가 이미 캠퍼스 배치·레벨 차·인물 밀도 규칙을 충족. 모든 스틸의 `--image` 스타일 앵커로 사용 권장.
- `docs/PUBLIC_EXPERIENCE.md`의 공간 고정 규칙(채플 동쪽·본관·도서관·흙 운동장·숲 계단 위치, 제외 건물)을 스틸 프롬프트에 그대로 승계.
- 실내 장면(창동 라운지, 채플 내부)은 "지붕이 열리는 미니어처" 문법으로 처리. Seedance NSFW 오탐이 실내에서 잦으므로 "empty, architectural" 계열 문구와 재롤 예산 필요.
- 기존 Scroll-World PRJ의 painterly 스틸·레그는 클레이 방향과 양립 불가 → 폐기(이미 소모된 크레딧은 매몰).
- UI(폼·패스·Ops)는 클레이가 아니라 종이·잉크 타이포그래피 언어를 유지. 클레이는 영상 레이어에만.
- 미확정 항목: 톤(세피아 단색 vs 가을 풀컬러), 인물 디테일, 손맛 정도, 렌즈감(틸트시프트 강도), 카메라 고도, 전환 언어.

## 8. 리스크

1. 일정: D-38. 예약·패스·체크인이 행사 2주 전에는 실사용 가능해야 함. 시네마틱 제작이 이를 막으면 안 됨 → 병렬 트랙 필요.
2. 미디어 생성: 클립당 3~8분, B는 병렬 가능하나 재롤·NSFW 오탐·표류로 크레딧 초과 가능.
3. 모바일: 주 관람층 40~60대, 폰 접속 다수. 1080p 스크럽은 구형 폰에서 끊김 → 9:16 체인 또는 스틸 폴백 필수.
4. 개인정보: 연락처·식이·이동 정보 수집. 동의 문구, 보관 기간, 행사 후 삭제 정책 필요.
5. 결정 불일치: 행사 시간(13:00 vs 12:00), 신청곡 수집 여부(프로토타입 O / v3 브리프 X / 마스터 프롬프트 optional), 장면 구조(7 vs 9).
6. 셔틀 첫차·막차·복귀 운행 미확정 → 폼 선택지 확정 불가.
7. 도메인 미확보, 호스팅 미정.
8. Supabase CLI 미설치 → 마이그레이션 관리 전 설치 필요.

## 9. 가정

- 행사: 2026-10-11(주일) 12:00–16:00, 한신대 신학대학원 서울캠퍼스. 셔틀 창동성전 출발.
- 예약 규모 수백 팀 이하, 운영진 계정 30개 이하. 성능·확장은 문제 아님.
- Supabase 프로젝트는 유료로 이미 존재(영수증 확인). 자격 증명은 아직 미제공.
- UI 언어 한국어, 장면 제목 영어. 마스터 프롬프트 카피는 미확정.
- 미디어 생성은 Higgsfield 크레딧 사용(Monid 미설치).
- 신청곡은 수집하지 않음(v3 브리프 결정)으로 가정. 다르면 알려주세요.

## 10. 도구 변경 반영 (2026-09-03 정정)

실행 주체가 Codex에서 **Claude Fable 5.1 + scroll-world 스킬 + Higgsfield**로 바뀌었다. 영향은 다음과 같다.

- 기존 `falling-in-love-platform`은 Codex 산출물이므로 문서(ROADMAP "완료" 표기 등)를 그대로 믿지 않고 코드 기준으로 재감사한 뒤 인수한다. `AGENTS.md`/`CLAUDE.md`는 `next dev`가 생성한 것으로 무해.
- 스틸 생성 경로: scroll-world 스킬의 "Codex `image_gen`(구독 과금)" 옵션은 사용 불가(`codex` CLI 없음). 스틸은 Higgsfield `gpt_image_2`(크레딧)로 생성한다. 비용 추정(§6)은 이미 이 기준.
- 영상 체인 과금: `monid` 없음 → Higgsfield 크레딧이 유일한 과금 경로. 모델은 `seedance_2_0`(최종) / `seedance_2_0_mini`(previz).
- Higgsfield 접근 경로 2종: (1) `higgsfield` CLI — 스킬의 배치 스크립트·프레임 핸드오프·ffmpeg 추출이 이 경로를 전제하므로 체인 제작은 CLI로. (2) 이 세션에 연결된 Higgsfield MCP 도구(`generate_image`, `generate_video` 등) — 단발 스틸 탐색·비교에 사용.
- 스타일 앵커 재생성: `clay/campus-overview-v3.png`와 `og-v5.png`(1731×909)는 Codex 생성물로 추정된다. 스킬 문서상 Codex와 Higgsfield의 렌더 성격이 다르므로(Codex가 더 따뜻하고 밝음), 월드 전체를 한 소스로 맞추기 위해 같은 프롬프트·구도로 **Higgsfield에서 앵커 오버뷰를 1회 재생성**한 뒤 이를 모든 장면 스틸의 `--image` 참조로 쓴다. 기존 v3는 구도·배치 검증용으로 보존.
- 스킬 인터뷰(Step 1)는 마스터 프롬프트가 이미 답한 항목(주제, 장면, 팔레트, 카메라 의도, 아트 디렉션)을 재질문하지 않고, Decision Gate 항목만 확인한다.
- Higgsfield 생성은 클립당 3~8분이므로 Claude Code 세션에서 백그라운드 실행 + 폴링으로 돌리고, 레그마다 핸드오프 프레임을 육안 확인한다.
