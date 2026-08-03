# REAL LOCAL 배포 구조 정리 (2026-08-03)

VS Code → Orca 마이그레이션 이후, GitHub/Vercel 배포 구조를 점검하고 정리한 내용.
Claude Code(Orca)에서 커밋/푸시/배포 관련 작업 시 참고용.

---

## 1. GitHub — Push/Pull 기준

- **리포지토리**: `jspark054/real-local` (개인 계정 소유, public)
- **remote**: `origin` 하나만 존재, 다른 remote 없음 (2026-08-03 `git remote -v`로 확인 완료)
- 즉 로컬에서 `git push` / `git pull` 하면 **무조건 이 리포 하나로만** 감
- 조직(AI-BuilderSchool) 소속 여부는 git 동작에 영향 없음 — 리포 자체는 개인 소유

```
origin  https://github.com/jspark054/real-local.git (fetch/push)
```

## 2. Vercel — 배포 기준

### 현재 상태 (정리 완료)

| 계정 | 프로젝트명 | 연결 상태 | 배포 URL |
|---|---|---|---|
| 조직 (AI-BuilderSchool, Pro) | `real-local-jspark-five` | ✅ 연결 유지 (자동배포됨) | `real-local-jspark-five.vercel.app` |
| 개인 (jspark054, Hobby) | `real-local-jspark` | ❌ Git 연동 Disconnect 완료 (프로젝트는 남아있으나 배포 안 됨) | `real-local-jspark.vercel.app` |

### 발견했던 문제
- 개인 계정에도 동명 프로젝트가 존재해서, **하나의 GitHub push에 두 계정 모두 자동배포**가 걸리고 있었음
- 원인: 7/28 개인 계정에서 먼저 리포 Import → 7/30 조직 계정에서 같은 리포를 또 Import
- 개인 계정 프로젝트는 환경변수(Supabase, Google Maps API 등)가 전혀 없어 실제로는 작동 안 하는 "유령 배포"였음 → 안전하게 Disconnect 처리

### 배포 워크플로 (변경 없음)
```
로컬 서버 확인 (npx serve .)
  → git add / commit / push
  → 조직 계정(real-local-jspark-five)에서만 자동배포
```
`vercel --prod` 등 수동 배포 명령 사용 안 함.

---

## 3. 향후 관리 원칙

| 구분 | 원칙 |
|---|---|
| GitHub | 개인 계정(jspark054) 유지. 조직 쪽 확인 필요 시 리포 이전 대신 **Collaborator 초대**로 권한만 부여 |
| Vercel (현재, 코스 진행 중) | **조직 계정만** 사용 |
| Vercel (전환 시점) | 클라이언트 논의 후 실서비스화되면, 개인/사업자 계정으로 배포 이관 검토 (조직 계정은 코스 종료 후 접근 권한 소실 위험) |

---

## 4. 보류된 작업 (사용자 요청 시 진행)

- [ ] 개인 계정 leftover 프로젝트 `real-local-jspark` 삭제 (Vercel 개인 계정 → Project Settings → General → Delete Project)
- [ ] 조직 계정 배포 URL 변경: `real-local-jspark-five.vercel.app` → `real-local-five.vercel.app`
  - 방법: 조직 계정 → `real-local-jspark-five` 프로젝트 → Settings → Domains → 새 서브도메인 추가 → Primary로 설정
