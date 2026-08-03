# CHANGELOG

REAL LOCAL 프로젝트 작업 이력. 날짜별로 위에 새 항목을 추가합니다.
(구조/규칙 등 고정 정보는 `CLAUDE.md`에 남기고, 여기는 "언제 무엇을 했는지" 기록용)

---

## 2026-08-03

- VS Code → Orca(Claude Code) 마이그레이션 진행
- Vercel 이중배포 문제 발견 및 해결
  - 원인: 개인 계정(jspark054, Hobby)에 동명 프로젝트 `real-local-jspark`가 같은 GitHub 리포에 연결되어 있었음
  - 조치: 개인 계정 프로젝트 Git 연동 Disconnect (환경변수 없어 안전 확인 후 진행)
  - 결과: 이후 push는 조직 계정(`real-local-jspark-five`)에서만 자동배포됨
- 배포 구조 문서화 → `CLAUDE.md`로 정리
- 문서 파일 정리 및 커밋: `기획서_로컬리얼.md`, `Wireframe_UserFlow_REAL_LOCAL.html`, `.gitignore` 업데이트
- 보류 작업 확인:
  - 개인 계정 leftover 프로젝트(`real-local-jspark`) 삭제 — 추후 요청 시 진행
  - 배포 URL 변경 검토: `real-local-jspark-five.vercel.app` → `real-local-five.vercel.app`
- Google Places API (New) 서버 사이드 테스트: `GOOGLE_MAPS_API_KEY`가 리퍼러 제한 걸린 키임을 확인, Legacy Places API는 리퍼러 제한 키로 원천 사용 불가
- Google Cloud 결제 계정 재연결 → Places `photos` 필드 정상 응답 확인, 기존 "결제 계정 자동 종료" 이슈 해결
- 프로젝트 전체 API 키 하드코딩 위치 점검: service_role 키는 `.env`에만 있어 안전, `fetch_spot_photos.js`는 git 히스토리에 없어 신규 작성 필요로 정정

---

<!-- 다음 작업일 항목은 이 위에 추가 -->
