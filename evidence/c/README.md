# C evidence index

실제 token/key, 개인 Discord 원문·ID, 민감 첨부는 저장하지 않는다. 실행 결과는 값 대신 판정과 건수만 기록한다.

## C-EVID-001 — goldset schema/oracle

- Tested at: `2026-08-12T14:46:05+09:00`
- Input: `eval/goldset.json`, `eval/goldset.schema.json`
- Result: PASS
- Output: schema/oracle PASS, scenario 5, assignment 8, global invariant 8, negative schema case 5

## C-EVID-002 — B fixture binding

- Input: B manifest 1.1, conversation fixture 5개
- Procedure: `node qa/validate_fixture_bindings.mjs`
- Result: PASS
- Output: scenario 5, concrete binding 28
- Individual versions: happy 1.1, missing 1.1, deadline 1.0, completion 1.1, version 1.0
- Bound evidence IDs: `0900, 0902, 0903, 0904, 0905, 1100, 1101, 1200, 1201, 1202, 1300, 1301` 등 validator에 명시된 실제 pointer

## C-EVID-003 — secret와 환경 파일

- `.env`, `.env.local`: Git ignore PASS
- `.env.example`: 존재, secret candidate 0
- Public surface candidates: 0
- Git history candidates: 0
- Unignored local env files: 0
- Result: `secret_scan=PASS`

## C-EVID-004 — security/HITL 설계

- `security/security_checklist.md`에 allowlist, 최소 권한, 동의·보존·삭제, secret, signature/replay, fallback을 기록했다.
- 배정, 완료, 외부 전송, 삭제, owner 교체, 마감 변경, 개인정보 가능 첨부 분석의 확인 문구 7개를 제공한다.
- 이 문서 존재는 산출물 PASS이며, 구현되지 않은 runtime 항목을 PASS로 뜻하지 않는다.

## C-EVID-005 — A regression tests

- Command: Python 3.12 임시 의존성 환경에서 `pytest -q`
- Result: `10 passed, 1 warning in 1.47s`
- Warning: test client dependency deprecation; 테스트 실패는 아님

## C-EVID-006 — runtime Red Team

- Input: `qa/runtime_red_team_probe.py`
- Result: 1 behavioral PASS, 3 FAIL
- PASS: evidence 없는 confirm 거부 — Issue #4, A fix commit 대기
- FAIL: human-locked owner 미보존 — <https://github.com/shan1343/0812-discord-goal-referee/issues/5>
- FAIL: deadline 충돌 owner 유지 — <https://github.com/shan1343/0812-discord-goal-referee/issues/7>
- FAIL: confirm replay/audit 중복 — <https://github.com/shan1343/0812-discord-goal-referee/issues/6>
- Exact output: `qa/test_matrix.md` 최신 실행 출력 참조

## C-EVID-007 — GitHub 작업 흐름

- Branch: `agent/role-c-qa-security`
- Draft PR: <https://github.com/shan1343/0812-discord-goal-referee/pull/3>
- C가 GitHub 연동으로 Issue #4, #5, #6, #7을 생성하고 #4의 같은 입력 retest 상태를 갱신했다.
- Open runtime FAIL은 A가 수정 commit을 push한 뒤 C가 같은 probe로 재시험한다.

## 현재 C gate

- Goldset 5개 + B binding: PASS
- 정적 secret scan: PASS
- A regression suite: PASS
- Runtime security/assignment: FAIL
- 완결된 Issue → A commit → same-input retest: 0/3
- 따라서 Role C 최종 acceptance는 아직 **INCOMPLETE**이다.
