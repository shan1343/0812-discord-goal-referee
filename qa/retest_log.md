# C fail → fix → retest log

기준 입력은 `qa/runtime_red_team_probe.py`에 고정했다. A의 코드 변경은 C commit에 섞지 않으며, 같은 probe가 PASS이고 A fix commit URL이 연결된 경우에만 완료 cycle로 센다.

## FAIL-RUNTIME-001 — 직접 evidence가 비어도 배정 확정

- Test: `C_ASGN_01_EMPTY_EVIDENCE_REJECTED`
- Initial tested ref: `6975fca`와 당시 A 구현
- Reproduction: seed → propose → `assignment-a.evidence=[]` → confirm
- Expected: ValueError/409, 기존 상태 유지
- Before: owner만 있으면 confirmed 가능
- Cause hypothesis: confirm gate가 owner null만 검사
- Issue: <https://github.com/shan1343/0812-discord-goal-referee/issues/4>
- Fix owner: A
- Fix: 공유 워크트리의 A 변경이 `not assignment.evidence`를 검사하도록 수정
- Fix commit: **PENDING — A가 아직 이 변경을 commit/push하지 않음**
- Same-input retest at `2026-08-12T14:46:05+09:00`: `C_ASGN_01_EMPTY_EVIDENCE_REJECTED=PASS`
- Status: `PASS_BEHAVIOR / INCOMPLETE_EVIDENCE`

## FAIL-RUNTIME-002 — 사람이 고정한 owner를 재분석이 덮어씀

- Test: `C_ASGN_02_LOCKED_OWNER_PRESERVED`
- Tested ref: `6975fca` + 현재 A 미커밋 변경
- Reproduction: seed → propose → owner/owner_id를 human-selected로 변경하고 confirmed → 동일 입력 propose
- Expected: owner, owner_id, confirmed 상태가 그대로 유지
- Actual: `LOCKED_OWNER_PRESERVED=FAIL actual=false`
- Cause hypothesis: 이전 status/동일 owner만 비교하고 confirmed decision snapshot을 보존하지 않음
- Issue: <https://github.com/shan1343/0812-discord-goal-referee/issues/5>
- Fix owner: A
- Fix commit: PENDING
- Same-input retest: PENDING
- Status: `OPEN_FAIL`

## FAIL-RUNTIME-003 — deadline 충돌 후보가 정상 owner로 남음

- Test: `C_ASGN_03_DEADLINE_CONFLICT_EXCLUDED`
- Tested ref: `6975fca` + 현재 A 미커밋 변경
- Reproduction: demo의 14:00 class blocker가 있는 security assignment를 propose
- Expected: owner null/needs_input 또는 충돌 후보 제외 후 근거 있는 대안
- Actual: `owner_is_null=false,status=proposed`
- Cause hypothesis: owner 선택 전 deadline/availability/dependency 검증 없음
- Issue: <https://github.com/shan1343/0812-discord-goal-referee/issues/7>
- Fix owner: A
- Fix commit: PENDING
- Same-input retest: PENDING
- Status: `OPEN_FAIL`

## FAIL-RUNTIME-004 — confirm replay와 body-controlled actor

- Test: `SEC_REPLAY_01_CONFIRMATION_ONE_SHOT`
- Tested ref: `6975fca` + 현재 A 미커밋 변경
- Reproduction: 같은 assignment/actor로 confirm 두 번 호출
- Expected: 인증 컨텍스트의 actor, one-shot confirmation; audit 1개
- Actual: `replay_rejected=false,audit_count=2`
- Cause hypothesis: confirmation ID/expiry/revision/idempotency 및 서버 인증 actor 없음
- Issue: <https://github.com/shan1343/0812-discord-goal-referee/issues/6>
- Fix owner: A
- Fix commit: PENDING
- Same-input retest: PENDING
- Status: `OPEN_FAIL`

## 과거 기준선 회귀 기록 — 완료 cycle로 세지 않음

초기 `5938b32`에는 `.env.*` ignore, `.env.example`, 5개 fixture가 없었다. 이 세 항목은 모두 C 기준선 기록보다 먼저 생성된 A commit `333f1f8`에서 함께 수정되었다. 현재 동일 입력은 PASS지만 Issue → A fix → retest 순서가 아니므로 v3의 최소 3개 개선 cycle로 주장하지 않는다.

## 현재 합격 집계

- 영구 A fix commit과 Issue와 같은 입력 PASS가 모두 있는 cycle: **0/3**
- 행동 PASS지만 A fix commit 대기: **1건** (`FAIL-RUNTIME-001`)
- 재현된 open FAIL: **3건** (`002`, `003`, `004`)
- C가 완료하려면 A가 Issue #5, #6, #7을 수정·push한 뒤 같은 probe로 PASS를 받아야 한다.
