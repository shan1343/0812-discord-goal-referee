# D → A/C/B 우선순위 전달

최초 작성: 2026-08-12 13:51 KST
원격 저장소 재확인: 2026-08-12 KST

## P0 — 지금 해결하지 않으면 D 검증 불가

1. 현재 UI가 `Kakao Goal Referee`, 카카오 TXT, 카카오 공유를 사용한다. v3의 “카카오 전부 제거, Discord 전환”과 충돌한다.
2. 메인 저장소 `origin/main`에는 초기 `README.md`와 `.gitignore`만 있다. Discord Bot, `/seed_demo`, `/assign`, `/reassign`, `/progress`, `/files`, allowlist, `/api/health` 구현을 확인할 수 없다.
3. HTTPS 배포 URL과 Codex Sites 사용 증거가 없다.

요청: A는 Discord v3 테스트 가능 빌드/URL, 테스트 계정 접근 방법, 대표 fixture 이름을 D에 전달한다. 전달 전에는 사용자 테스트와 최종 촬영을 시작하지 않는다.

## P1 — 합격 증거 차단

1. repo URL과 초기 commit은 확인했지만 GitHub Plugin 실제 조회/변경 증거와 Issue URL은 없다.
2. C의 goldset/security/fail→fix→retest 링크가 없다.
3. B의 fixture 5개와 Discord seed 화면/메시지 링크가 없다.
4. human confirm 전후 상태, deadline conflict, version conflict를 촬영할 안정된 데이터가 없다.

## D가 전달받아야 하는 최소 패키지

- A: 테스트 URL, 배포 URL, health URL, GitHub repo/Issue, Sites/Plugin 캡처
- B: fixture manifest, 5개 scenario 경로, seed 명령과 기대 화면
- C: 최종 pass/fail 표, 미해결 이슈, secret scan, human confirmation 결과
- 전원: 발표자 이름/파트, 고유 artifact URL, 승인 기록

## 전달 후 D 실행 순서

1. P1 사용자 테스트 → 치명 문제 즉시 A Issue
2. A 수정 확인 후 P2/P3 테스트 → 결과 집계
3. 45초 hero demo 촬영
4. 5분 발표 3회 리허설 및 시간 기록
5. pass matrix에 실제 링크 연결하고 최종 판정
