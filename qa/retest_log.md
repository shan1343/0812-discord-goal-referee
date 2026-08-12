# C fail → fix → retest log

현재는 canonical repo의 초기 기준선만 검사했다. 아래 세 건은 재현된 FAIL이지만 A/B 수정 commit, GitHub Issue, 동일 입력 재시험이 아직 없어 완료된 개선 사이클이 아니다.

## FAIL-001 — `.env` 변형 파일이 ignore되지 않음

- Requirement: token/API key는 서버 로컬 환경 파일에만 두고 Git에 포함하지 않는다.
- Tested ref: `5938b3206cb8ee3fa32cb0fe91c38c34ed60a178`
- Reproduction:
  1. 저장소 루트에서 `git check-ignore -q -- .env.local`을 실행한다.
  2. 종료 코드와 파일 추적 가능 여부를 확인한다.
- Expected: `.env.local`이 ignore되고 `.env.example`만 명시적으로 허용된다.
- Actual: `.env.local`이 ignore되지 않았다.
- Hypothesis: 현재 `.gitignore`는 Python 기본 템플릿의 정확한 `.env` 규칙만 포함한다.
- Issue URL: PENDING — 연결 계정에 이 저장소 Issue 쓰기 권한이 없음.
- Fix owner: A
- Fix commit: PENDING
- Same-input retest: PENDING
- Evidence: `qa/test_matrix.md`의 `C-GIT-02`

## FAIL-002 — `.env.example` 없음

- Requirement: v3 A 필수 작업은 실제 값이 없는 `.env.example` 제공이다.
- Tested ref: `5938b3206cb8ee3fa32cb0fe91c38c34ed60a178`
- Reproduction:
  1. 저장소 루트에서 `Test-Path -LiteralPath '.env.example'`을 실행한다.
- Expected: 필요한 key 이름과 안전한 기본값만 있는 파일이 존재한다.
- Actual: `False`.
- Hypothesis: 저장소가 초기 commit 상태이고 A 설정 작업이 아직 병합되지 않았다.
- Issue URL: PENDING — 연결 계정에 이 저장소 Issue 쓰기 권한이 없음.
- Fix owner: A
- Fix commit: PENDING
- Same-input retest: PENDING
- Evidence: `qa/test_matrix.md`의 `C-GIT-03`

## FAIL-003 — B의 5개 fixture 없음

- Requirement: C goldset은 B의 5개 fixture를 같은 ID로 검증해야 한다.
- Tested ref: `5938b3206cb8ee3fa32cb0fe91c38c34ed60a178`
- Reproduction:
  1. `fixtures/conversations/` 존재 여부를 확인한다.
  2. happy_path, missing_evidence, deadline_conflict, completion_without_file,
     version_conflict JSON과 manifest를 센다.
- Expected: 5개 JSON, manifest, 실제 ID binding이 존재한다.
- Actual: 해당 디렉터리와 fixture가 없다.
- Hypothesis: B 산출물이 아직 메인 저장소에 병합되지 않았다.
- Issue URL: PENDING — B handoff 또는 저장소 Issue 필요.
- Fix owner: B, integration owner A
- Fix commit: PENDING
- Same-input retest: PENDING
- Evidence: `qa/test_matrix.md`의 `C-FIX-01`

## 완료 조건

각 항목은 다음이 모두 채워져야 개선 사이클 1건으로 센다.

1. 공개 가능한 Issue URL
2. 원인을 수정한 commit SHA/URL
3. 최초와 정확히 같은 입력·절차
4. before/after 결과
5. PASS 스크린샷 또는 로그 위치
6. C 실행자와 교차 검토자

최소 3개 항목이 위 조건을 충족해야 v3의 반복 개선 합격 증거가 된다.
