# Vercel 배포 (FALLing in Love)

한 저장소에 두 앱이 있으므로 Vercel 프로젝트를 **두 개** 만듭니다.

| 프로젝트 | Root Directory | 용도 | 접근 |
|---|---|---|---|
| `fal-ling-in-love-web` → https://fall-ing-in-love-web.vercel.app | `apps/web` | 공개 사이트 · 참여 신청 · Matinée Pass | 누구나 |
| `fal-ling-in-love-ops` → https://fall-ing-in-love-ops.vercel.app | `apps/ops` | 스캔·체크인 · 데스크 · 디스플레이 · 주차 · 관리자 | 스태프 로그인 |

배포 완료 2026-09-24. `NEXT_PUBLIC_SITE_URL` = `https://fall-ing-in-love-web.vercel.app` (Pass QR 링크 확인됨).

GitHub `diff76/FALLing-in-Love`의 `main` 브랜치에 푸시할 때마다 두 프로젝트가 자동으로 다시 배포됩니다.

## 1. 프로젝트 만들기 (두 번 반복)

1. https://vercel.com/new → **Import Git Repository** → `diff76/FALLing-in-Love` 선택 (처음이면 GitHub 연결 승인).
2. **Root Directory** → `Edit` → `apps/web` (두 번째 프로젝트는 `apps/ops`).
3. Framework Preset은 자동으로 **Next.js** 로 잡힙니다. Build/Install 명령은 그대로 둡니다
   (npm이 저장소 루트의 workspace를 인식해 설치하고, `@fil/*` 패키지는 `transpilePackages`로 함께 빌드됩니다.
   `typescript`와 `@types/*`는 각 앱의 devDependencies에 직접 선언되어 있어야 합니다 — 루트에만 있으면 Vercel 빌드가 "TypeScript package not installed"로 실패합니다).
4. **Environment Variables** 에 아래 값을 넣습니다 (로컬 `apps/*/.env.local`과 같은 값).

### web 프로젝트

| 이름 | 값 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable(anon) 키 |
| `SUPABASE_SECRET_KEY` | Supabase secret(service role) 키 — 서버 전용 |
| `NEXT_PUBLIC_SITE_URL` | 이 프로젝트의 최종 주소, 예 `https://falling-in-love-web.vercel.app` (QR에 들어가는 Pass 링크의 기준이므로 반드시 실제 주소) |

### ops 프로젝트

| 이름 | 값 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 위와 동일 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 위와 동일 |
| `SUPABASE_SECRET_KEY` | web과 동일 (Type: Secret) — 관리자 탭의 **계정 관리**(계정 생성·권한·비밀번호·삭제)에 필요. 없으면 그 화면만 안내 문구를 보여준다 |

5. **Deploy**. 첫 배포는 미디어(약 250MB, 1,500여 파일) 업로드 때문에 5~8분 걸릴 수 있습니다.

## 2. 배포 후 확인

- web: `/` 영상 체인(데스크톱·폰), `/apply` 신청 → Pass 발급, Pass의 QR 링크가 `NEXT_PUBLIC_SITE_URL`로 시작하는지.
- ops: `/login` → 스캔·체크인에서 성함 조회, 카메라 QR(https라 폰 카메라 바로 동작), 주차, 디스플레이 `LIVE` 표시.
- `NEXT_PUBLIC_SITE_URL`을 나중에 바꾸면 web 프로젝트를 **Redeploy** 해야 반영됩니다(빌드 시 고정).

## 3. 도메인 — eventgo.kr (2026-09-27)

`eventgo.kr`은 후이즈(whois.co.kr) 네임서버(ns1~4.whoisdomain.kr)를 쓰고, 루트와 `www`는 다른 서버(118.67.131.217)를 가리키므로 건드리지 않는다. 서브도메인만 Vercel로 보낸다.

| 이름 | 앱 | 후이즈 DNS 레코드 |
|---|---|---|
| `falling.eventgo.kr` | web (`fal-ling-in-love-web`) | CNAME `falling` → `cname.vercel-dns.com` |
| `ops.eventgo.kr` | ops (`fal-ling-in-love-ops`) | CNAME `ops` → `cname.vercel-dns.com` |

연결 완료 2026-09-27 (YesNIC 네임서버 고급설정에서 CNAME 등록; 두 주소 모두 HTTPS 정상). Vercel의 "DNS Change Recommended"는 프로젝트별 CNAME(`…vercel-dns-017.com`)을 권하는 안내일 뿐 오류가 아니다; `cname.vercel-dns.com`도 계속 동작한다.

절차: (1) Vercel 프로젝트 → Domains → Add Existing 으로 이름 등록 → "Invalid Configuration"은 DNS가 아직 없다는 뜻. (2) 후이즈 도메인 관리 → DNS(호스트) 설정에 위 CNAME 추가 (CNAME을 못 쓰면 A `76.76.21.21`). (3) TTL 3600이라 최대 1시간 안에 "Valid Configuration"으로 바뀌고 인증서는 자동 발급. (4) web 프로젝트 `NEXT_PUBLIC_SITE_URL` = `https://falling.eventgo.kr` 로 바꾸고 Redeploy (Pass QR 링크 기준).

## 4. 이후 수정 흐름

코드 수정 → 커밋 → `git push origin main` → 1~2분 뒤 자동 반영. 문제가 있으면 Vercel → Deployments 에서 이전 배포를 **Promote to Production** 으로 즉시 되돌립니다.
DB 변경(마이그레이션)은 배포와 별개로 Supabase SQL Editor에서 실행합니다.

## 5. 배운 것 (2026-09-24 첫 배포)

- `typescript`/`@types/*`는 각 앱의 devDependencies에 있어야 한다(루트만으로는 실패).
- `output: "standalone"`은 Vercel에서 끈다(`process.env.VERCEL` 분기).
- **Redeploy**는 그 배포의 옛 커밋을 다시 빌드한다. 코드 수정 뒤에는 푸시로 생기는 새 배포를 기다릴 것. Redeploy는 환경 변수 반영용.
- 프로젝트 이름을 바꿔도 `*.vercel.app` 주소는 따라오지 않는다 → Settings → Domains 에서 추가.
- 환경 변수 Type: `NEXT_PUBLIC_*`는 Config, `SUPABASE_SECRET_KEY`만 Secret.
- 서버 함수 리전은 기본이 미국 동부(`iad1`)라 서울 사용자·서울 Supabase와 태평양을 왕복했다. `apps/*/vercel.json`의 `"regions": ["icn1"]`로 서울에 고정(응답 헤더 `x-vercel-id`가 `icn1::icn1::…`이면 적용된 것).

## 6. 참고

- `output: "standalone"` 설정은 Docker용이며 Vercel에서는 무시됩니다.
- 로컬 확인용 cloudflared 임시 터널과 `next start` 서버는 배포 뒤 필요 없습니다.
- 행사 뒤: Supabase secret 키 교체(대화에 노출된 적 있음), 30일 후 개인정보 삭제 작업.

## 7. 운영앱 계정 (2026-09-28)

- 로그인은 이메일이 아니라 짧은 아이디(`admin`, `staff`, `desk`, `diff76`)로 한다. 내부적으로 `<아이디>@ops.eventgo.kr`로 매핑되며 그 주소로 메일은 보내지 않는다 (`apps/ops/src/lib/login-id.ts`).
- 계정 생성·아이디/이름 변경·권한·비밀번호·삭제는 관리자 → **계정 관리**에서 한다.
- **바로 접속 링크**: 같은 화면에서 계정별로 `https://ops.eventgo.kr/go/<토큰>` 링크를 만들어 공유한다. 열면 그 계정으로 바로 로그인된다(토큰은 해시로만 저장, 만료·무효화 가능). 사용하려면 Supabase SQL Editor에서 `supabase/migrations/0005_access_links.sql`을 한 번 실행해야 한다.

