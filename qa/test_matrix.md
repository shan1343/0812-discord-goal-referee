# C QA test matrix — Discord Goal Referee v3

## 기준과 상태 원칙

- Canonical repository: `shan1343/0812-discord-goal-referee`
- 최초 기준선: `5938b3206cb8ee3fa32cb0fe91c38c34ed60a178`
- 현재 통합 기준: `6975fca6abc56833ff2cb1175f06aeb0498cbec6` + 별도 표시한 A 미커밋 변경
- 요구사항: `0단계_4인팀_Discord_개발실행_v3.txt`; v2는 맥락용이다.
- `PASS`: 같은 입력의 실행 증거가 있다. `FAIL`: 실행 결과가 기대와 다르다.
- `BLOCKED`: A 구현/외부 설정이 없다. `NOT_RUN`: 실행 가능한 결과 JSON 또는 후속 A commit을 기다린다.
- 실행 시각: `2026-08-12T14:46:05+09:00`

## 산출물·fixture·기준선

| ID | 입력·절차 | 기대 | 실제 | 판정 | Issue / 증거 |
| --- | --- | --- | --- | --- | --- |
| C-ART-01 | `node qa/validate_goldset.mjs` | Draft 2020-12 제약, 5개 scenario, oracle 불변식 | schema/oracle PASS; scenario 5, assignment 8, 불변식 8, negative 5 | PASS | `C-EVID-001` |
| C-ART-01B | `node qa/validate_fixture_bindings.mjs` | B의 실제 경로·값·메시지 ID에 모든 semantic ref 연결 | PASS; collection 1.1, scenario 5, binding 28; 개별 버전 1.0/1.1 기록 | PASS | `C-EVID-002` |
| C-ART-01C | `node qa/compare_goldset_result.mjs <scenario> <actual.json> <before\|after>` | A의 5개 scenario 결과와 oracle 비교 | A API가 B fixture를 scenario별 실행/반환하지 않음 | BLOCKED | [Issue #1](https://github.com/shan1343/0812-discord-goal-referee/issues/1) |
| C-ART-02 | C QA/red-team/retest 문서 필드 확인 | 입력·기대·실제·판정·Issue·commit·retest 필드 | 문서와 재현 probe 작성 | PASS | 이 문서, `qa/red_team_prompt.md`, `qa/retest_log.md` |
| C-ART-03 | `security/security_checklist.md` 확인 | 7개 위험 행동 확인 문구와 출고 gate | 작성 완료 | PASS | `C-EVID-004` |
| C-GIT-01 | `git check-ignore -q -- .env .env.local` | 로컬 환경 파일 ignore | 둘 다 exit 0 | PASS | `333f1f8` |
| C-GIT-02 | `.env.example` 정적 검사 | key와 비밀 없는 기본값만 존재 | 존재; secret 후보 0 | PASS | `333f1f8`, `C-EVID-003` |
| C-FIX-01 | manifest와 `fixtures/conversations/*.json` | 5개 scenario, 20개 이상 메시지 | 5개, 23개 메시지, manifest 존재 | PASS | B commits through `66b09b8` |
| C-SECRET-STATIC | `qa/secret_scan.ps1` | 공개 표면/.env.example/이력 후보 0, unignored env 0 | `0/0/0/0`, `secret_scan=PASS` | PASS | `C-EVID-003` |
| A-REGRESSION | A test suite | 모든 기존 자동 테스트 통과 | `10 passed, 1 warning` | PASS | `C-EVID-005` |

## Gold scenario와 핵심 불변식

| ID | 입력·공격 | 기대 | 실제 | 판정 | Issue URL |
| --- | --- | --- | --- | --- | --- |
| C-GOLD-01 | `happy_path` seed → assign → confirm | 네 Task가 직접 message evidence로 proposed, 확인 후 confirmed | A의 demo seed는 B fixture를 읽지 않음 | BLOCKED | [#1](https://github.com/shan1343/0812-discord-goal-referee/issues/1) |
| C-GOLD-02 | `missing_evidence` | owner=null, needs_input, 질문 | B oracle은 bound; A의 scenario 실행 경로 없음 | BLOCKED | [#1](https://github.com/shan1343/0812-discord-goal-referee/issues/1) |
| C-GOLD-03 / C-ASGN-03 | `deadline_conflict` | 충돌 후보 owner 제외, blocker/질문 | `owner_is_null=false,status=proposed` | FAIL | [#7](https://github.com/shan1343/0812-discord-goal-referee/issues/7) |
| C-GOLD-04 / C-PROG-02 | 완료 선언, 빌드 파일·보안 결과·승인 없음 | review_pending 80~99, done/100 금지 | oracle bound; A의 B scenario 실행 경로 없음 | BLOCKED | [#1](https://github.com/shan1343/0812-discord-goal-referee/issues/1) |
| C-GOLD-05 / C-FILE-01 | v1 superseded + candidate-final pending_smoke_test, checksum 없음 | 최신 유효본 null, 사람 검증 질문 | oracle bound; A files API는 해당 fixture 미사용 | BLOCKED | [#1](https://github.com/shan1343/0812-discord-goal-referee/issues/1) |
| C-ASGN-01 | evidence 배열을 비운 뒤 confirm | 거부, 상태 무변경 | 최신 A 미커밋 변경에서 `EMPTY_EVIDENCE_REJECTED=PASS` | PASS* | [#4](https://github.com/shan1343/0812-discord-goal-referee/issues/4); fix commit 대기 |
| C-ASGN-02 | 사람 고정 owner/owner_id 설정 → 동일 입력 reanalysis | owner와 confirmed 상태 유지 | `LOCKED_OWNER_PRESERVED=FAIL actual=false` | FAIL | [#5](https://github.com/shan1343/0812-discord-goal-referee/issues/5) |
| C-PROG-01 | 무관 메시지 1개/100개 | 동일 진행률 | A의 fixture/message-count 평가 경로 없음 | BLOCKED | [#1](https://github.com/shan1343/0812-discord-goal-referee/issues/1) |
| C-PROG-03 | 완료조건 없음 | unknown, percent=null, 질문 | done-definition 모델/입력 없음 | BLOCKED | [#1](https://github.com/shan1343/0812-discord-goal-referee/issues/1) |

`PASS*`는 같은 입력 행동은 통과했으나 A의 영구 fix commit URL이 아직 없어 최종 반복 개선 합격 건수에는 포함하지 않는다.

## 채널·보안·Human-in-the-loop

| ID | 입력·공격 | 기대 | 실제 | 판정 | Issue URL |
| --- | --- | --- | --- | --- | --- |
| SEC-ALLOW-01 | 비허용 channel event | 저장/분석 0 | 기존 API test 통과 | PASS | `tests/test_api.py` |
| SEC-ALLOW-02 | DM·다른 guild·thread | 저장/분석 0 | 요청 모델에 guild/DM/thread 경계 없음 | FAIL | [#1](https://github.com/shan1343/0812-discord-goal-referee/issues/1) |
| SEC-SIG-01 | missing/invalid signature, stale timestamp | allowlist·저장 전 거부 | signature/timestamp 필드와 검증 없음 | FAIL | [#1](https://github.com/shan1343/0812-discord-goal-referee/issues/1) |
| SEC-REPLAY-01 | 같은 confirm 두 번 | 두 번째 거부, audit 1개 | `replay_rejected=false,audit_count=2` | FAIL | [#6](https://github.com/shan1343/0812-discord-goal-referee/issues/6) |
| SEC-SECRET-RUNTIME | fake Discord/OpenAI/DB sentinel로 health·오류·UI·로그 | 모든 표면 0건 | health unit test만 있음; 종합 sentinel 미실행 | BLOCKED | A 실행 설정 필요 |
| HITL-ASSIGN-01 | 배정 제안과 confirm 재전송 | 인증된 사람·1회용 확인 전 confirmed 금지 | actor를 body가 지정; replay 가능 | FAIL | [#6](https://github.com/shan1343/0812-discord-goal-referee/issues/6) |
| HITL-COMPLETE-01 | 완료 증거 충족 | 사람 승인 전 review_pending/99 이하 | completion confirmation endpoint 없음 | BLOCKED | A 구현 필요 |
| HITL-DELETE-01 | 삭제·stale/replay 확인 | 관리자 one-shot 확인 전 무변경 | `/api/forget` 없음 | BLOCKED | A 구현 필요 |
| HITL-SEND-01 | 외부 전송 | 확인 전 outbound 0 | 전송 endpoint 없음 | BLOCKED | A 구현 필요 |
| HITL-REASSIGN-01 | 기존 owner 변경 | 확인 전 기존 owner 유지 | `/api/reassign`이 blocker/status를 즉시 변경 | FAIL | [#5](https://github.com/shan1343/0812-discord-goal-referee/issues/5) |
| HITL-DEADLINE-01 | deadline 변경 | 확인 전 기존 값 유지 | deadline 변경 흐름 없음 | BLOCKED | A 구현 필요 |
| HITL-ATTACH-01 | 개인정보 가능 첨부 | 확인 전 download/AI 0 | metadata 수신만 있고 승인/분석 흐름 없음 | BLOCKED | A 구현 필요 |
| AI-FB-01..07 | timeout, 401, 429, 5xx, empty, schema 오류, 존재하지 않는 ID | 표시된 deterministic fallback; 확정값 보존 | AI adapter/오류 주입 경로 없음 | BLOCKED | A 구현 필요 |

## 최신 실행 출력

```text
goldset_schema=PASS
goldset_oracle=PASS
scenario_count=5
assignment_count=8
global_expectations=8
negative_schema_cases=5
fixture_binding=PASS
fixture_collection_version=1.1
binding_count=28
fixture_versions=happy_path:1.1,missing_evidence:1.1,deadline_conflict:1.0,completion_without_file:1.1,version_conflict:1.0
public_surface_secret_candidate_files=0
env_example_secret_candidate_files=0
history_secret_candidate_files=0
unignored_local_env_files=0
secret_scan=PASS
pytest: 10 passed, 1 warning
C_ASGN_01_EMPTY_EVIDENCE_REJECTED=PASS
C_ASGN_02_LOCKED_OWNER_PRESERVED=FAIL actual=false
C_ASGN_03_DEADLINE_CONFLICT_EXCLUDED=FAIL actual=owner_is_null=false,status=proposed
SEC_REPLAY_01_CONFIRMATION_ONE_SHOT=FAIL actual=replay_rejected=false,audit_count=2
runtime_red_team_failures=3
```

## 재실행 명령

```powershell
node qa/validate_goldset.mjs
node qa/validate_fixture_bindings.mjs
node qa/compare_goldset_result.mjs <scenario> <actual.json> <before|after>
python qa/runtime_red_team_probe.py
pytest -q
powershell -NoProfile -ExecutionPolicy Bypass -File qa/secret_scan.ps1
```
