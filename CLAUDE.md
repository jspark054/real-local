# CLAUDE.md

이 파일은 Claude Code가 세션 시작 시 자동으로 참고하는 프로젝트 컨텍스트 문서입니다.
내용이 바뀌면 새 파일을 만들지 말고 이 파일을 직접 수정해서 최신 상태로 유지합니다.

---

## 프로젝트 개요

**REAL LOCAL** — 큐레이션 기반 로컬 장소 추천 지도 앱
- 스택: 순수 HTML/CSS/JS + Supabase(백엔드) + Google Maps JS API
- 로컬 폴더: `260726 REAL LOCAL/real-local`
- AI BuilderSchool 코스 과제로 시작, 현재 클라이언트 논의 진행 중인 실서비스 전환 프로젝트

---

## 배포 구조 (중요 — 반드시 이 규칙을 따를 것)

### GitHub — Push/Pull

- 리포: `jspark054/real-local` (개인 계정 소유, public)
- remote는 **`origin` 하나만 사용**. 다른 remote 추가하지 말 것
- 조직(AI-BuilderSchool) 소속 여부는 git 동작과 무관 — 리포 자체는 개인 소유

```
origin  https://github.com/jspark054/real-local.git (fetch/push)
```

### Vercel — 배포

- **배포 계정: AI-BuilderSchool 조직 계정만 사용**
- 프로젝트명: `real-local-jspark-five`
- 배포 URL: `real-local-jspark-five.vercel.app`

⚠️ **주의**: 2026-08-03 기준, 개인 계정(jspark054, Hobby)에도 동명 프로젝트 `real-local-jspark`가 같은 리포에 연결되어 있어 push할 때마다 이중 자동배포가 발생하던 문제를 발견하고 Git 연동을 해제했음. 프로젝트 자체는 아직 남아있으나(사용자 요청 시 삭제 예정) **재연결하거나 새로 만들지 말 것**.

### 작업 워크플로 (항상 이 순서로)

1. 로컬 서버로 먼저 확인: `npx serve .`
2. 확인 완료 후: `git add . && git commit -m "..." && git push`
3. push하면 조직 계정(`real-local-jspark-five`)에서 자동배포됨
4. ⚠️ `vercel --prod` 등 수동 배포 명령 사용 금지 — 항상 push 기반 자동배포만 사용

### 향후 계획 (참고)

- 코스 진행 중에는 조직 계정 배포 유지
- 클라이언트 논의 이후 실서비스 전환 시, 개인/사업자 Vercel 계정으로 배포 이관 검토 예정 (조직 계정은 코스 종료 후 접근 권한 소실 위험 있음)
- 배포 URL 변경 검토 중: `real-local-jspark-five.vercel.app` → `real-local-five.vercel.app` (Vercel Domains 탭에서 서브도메인 추가 방식으로 진행 예정, 아직 미실행)

---

## 현재 진행 상황

**완료**
- Supabase DB 연동 (맵 9개 / 장소 135개, 크리에이터 화면 테스트로 2개 증가) + RLS
- 이메일 + Google OAuth 로그인
- 저장/리뷰 기능 실DB 연동
- Google Maps JS API 실제 지도 표시
- 장소 상세 화면, 공유 링크(딥링크 포함)
- 카테고리 아이콘 자동분류, 반응형 그리드
- `fetch_spot_photos.js` 신규 작성 및 spots 135개 전체 실행 완료 (2026-08-03) — 성공 124 / 사진 없어 스킵 11 / 실패 0. `photo_fetch_progress.log`에 처리 이력 저장(재실행 시 이어서 처리 가능). 사진 저장 방식의 ToS 이슈는 아래 "⚠️ Google Places 사진 저장 방식" 참고

**보류**
- maps 테이블 cover_image_url(9개) — **보류 (홈화면 썸네일은 API 연동 범위 제외 결정, 2026-08-03)**. 스크립트는 `--target=maps`로 이미 지원하지만 실행하지 않기로 함. Google Places 사진 연동은 spots(장소별 썸네일 + 상세 팝업)만으로 범위 확정

**다음 작업**
- 크리에이터 화면 (맵/장소 작성 폼)

**별도 이슈**
- ~~Google Cloud 결제 계정이 자동 위험 감지로 즉시 종료되는 문제~~ → **해결됨 (2026-08-03)**: 결제 계정 재연결 완료. Places API (New) `photos` 필드가 billing 연결 전에는 에러 없이 항상 빈 값으로 오다가, 연결 후 정상 응답되는 것을 실제 spot(Ramura, Sentiment Café)과 검증용 랜드마크(에펠탑)로 확인함. 단, billing 연동 반영에 약간의 전파 지연이 있었음 — 배치 실행 전 sanity-check 호출 한 번 권장

---

## Google API 키 구조

- **`GOOGLE_MAPS_API_KEY`** (`.env` / `index.html:443`) — 프론트엔드 Google Maps JS API용 키. **HTTP 리퍼러 제한**이 걸려있어(배포 도메인 기준) 서버 사이드(Node 스크립트 등)에서 그대로 쓰면 `403 API_KEY_HTTP_REFERRER_BLOCKED`. 서버에서 굳이 쓰려면 요청마다 `Referer` 헤더를 배포 도메인으로 수동 지정해야 우회 가능하지만, 이는 임시방편일 뿐 정식 구조는 아님
- **`GOOGLE_PLACES_SERVER_KEY`** — **발급 완료 (2026-08-03)**. 배치 사진 스크립트 등 서버 전용 키, `.env`에 등록됨. 리퍼러 제한 없는(또는 IP 제한) 키이므로 `fetch_spot_photos.js` 등 서버 스크립트는 이 키를 쓸 것 — `GOOGLE_MAPS_API_KEY`(리퍼러 제한)를 서버 스크립트에 쓰지 말 것
- Legacy Places API(`maps.googleapis.com/maps/api/place/...`)는 리퍼러 제한이 걸린 키로는 원천적으로 사용 불가("API keys with referer restrictions cannot be used with this API" — Google이 명시적으로 거부). 사진 배치 스크립트는 **Places API (New)** (`places.googleapis.com/v1/places:searchText` 등)로 작성할 것
- Places API (New)의 `photos[].name`은 `photo_reference` 문자열이 아니라 `places/{placeId}/photos/{photoId}` 형태의 리소스 경로. 실제 이미지를 받으려면 이 `name`으로 Photo media 엔드포인트(`GET .../v1/{name}/media?...`)를 한 번 더 호출해야 함
- 사진마다 `authorAttributions`(촬영자 정보)가 함께 오는데, Google 정책상 사용 시 저작자 표시가 필요할 수 있으니 배치 스크립트에서 같이 저장해둘 것

---

## ⚠️ Google Places 사진 저장 방식 — ToS 검토 필요 (2026-08-03)
- 현재 방식: Places API (New)에서 받은 photoUri를 spots.image_url에 영구 저장
- 문제: photoUri는 "short-lived"(비공식, 정확한 만료 기간 미공개), photos[].name도 만료됨 (Google 공식 문서 확인)
- Google Maps Platform ToS 3.2.3(b) 조항상 원칙적으로 캐싱 금지, 예외 허용 조건도 "연속 30일 미만 저장" 등 제약 있음
- 현재는 연습/과제 프로젝트 단계라 이 방식 그대로 진행하기로 결정
- 프로덕션(실제 클라이언트 서비스) 전환 시 반드시 재검토

---

## 참고 문서

- `PRD_REAL_LOCAL_v1.4.md` — 제품 요구사항 정의서
- `기획서_로컬리얼.md` — 기획 문서
- `Wireframe_UserFlow_REAL_LOCAL.html` — 와이어프레임 / 유저플로우

---

## 작업 시 유의사항

- 커밋 메시지는 실제 변경 내용과 일치하게 작성 (예: 문서만 바뀌면 `docs:`, 기능 추가면 `feat:`)
- 코드 작업 전, 요구사항이 애매하면 먼저 미니 스펙(무엇을/왜/어떻게)을 간단히 정리하고 시작할 것 — 구현 후 재작업 사이클을 줄이기 위함
