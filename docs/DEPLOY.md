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

## 3. 도메인 (선택)

Vercel 프로젝트 → Settings → Domains 에서 교회 도메인을 붙일 수 있습니다. 붙인 뒤 `NEXT_PUBLIC_SITE_URL`도 그 도메인으로 바꾸고 web을 Redeploy 합니다.

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
