# C QA test matrix — Discord Goal Referee v3

## 기준선

- Canonical repository: `shan1343/0812-discord-goal-referee`
- Baseline commit: `5938b3206cb8ee3fa32cb0fe91c38c34ed60a178`
- Baseline time: `2026-08-12T13:59:50+09:00`
- 요구사항 원본: `0단계_4인팀_Discord_개발실행_v3.txt`
- `0단계_4인개발_역할분담_v2.txt`는 맥락용이며 판정 근거로 사용하지 않는다.

`PASS`는 실행 증거가 있을 때만 쓴다. 구현이 없으면 `BLOCKED`, fixture가 아직 연결되지 않았으면 `NOT_RUN`이다.

| 상태 | 의미 |
| --- | --- |
| PASS | 같은 입력으로 실행했고 기대 결과와 일치하며 증거 위치가 있다. |
| FAIL | 실행했으며 실제 결과가 기대 결과와 다르다. |
| BLOCKED | A 구현 또는 필수 외부 상태가 없어 실행 자체가 불가능하다. |
| NOT_RUN | 실행 준비는 가능하지만 B fixture ID 연결 또는 재시험을 기다린다. |

## 현재 산출물·저장소 기준선

| ID | 입력·절차 | 기대 | 실제 | 판정 | Issue / 증거 |
| --- | --- | --- | --- | --- | --- |
| C-ART-01 | `node qa/validate_goldset.mjs` | schema 문서의 핵심 제약과 oracle 불변식 통과; 정확히 5개 필수 scenario | `goldset_oracle=PASS`, scenario 5개, assignment 8개, 공통 불변식 8개 | PASS | `evidence/c/README.md`의 `C-EVID-001` |
| C-ART-01B | `node qa/validate_fixture_bindings.mjs` | 모든 semantic_ref가 B manifest 실제 ID와 1:1 연결 | B manifest 없음으로 `fixture_binding=NOT_RUN` | NOT_RUN | B fixture 병합 후 재실행 |
| C-ART-01C | `node qa/compare_goldset_result.mjs <scenario> <actual.json> <before\|after>` | schema·binding을 거친 Task/Owner/Status/Evidence/reason/card fields 및 progress/files oracle 비교 | A 결과와 B manifest 없음 | NOT_RUN | A/B 병합 후 scenario별 실행 |
| C-ART-02 | `qa/test_matrix.md`, `qa/red_team_prompt.md`, `qa/retest_log.md` 확인 | 입력·기대·실제·판정·Issue/commit/retest 필드 존재 | C 산출물 작성 완료. 링크는 권한과 A/B 작업 대기 | PASS | 로컬 작업 트리 |
| C-ART-03 | `security/security_checklist.md` 확인 | 위험 행동 확인 문구와 보안 판정표 존재 | 작성 완료 | PASS | 로컬 작업 트리 |
| C-GIT-01 | `git check-ignore -v -- .env` | `.env`가 추적 대상에서 제외됨 | `.gitignore:151` 규칙으로 제외됨 | PASS | 명령 출력 확인 |
| C-GIT-02 | `git check-ignore -q -- .env.local` | `.env` 변형도 제외되고 `.env.example`만 예외 | `.env.local`은 제외되지 않음 | FAIL | `FAIL-001`, Issue URL 대기 |
| C-GIT-03 | `.env.example` 존재 여부 확인 | 실제 값 없이 key 이름만 있는 파일 존재 | 파일 없음 | FAIL | `FAIL-002`, Issue URL 대기 |
| C-FIX-01 | `fixtures/conversations/`와 5개 JSON 확인 | B의 5개 fixture와 manifest 존재 | 디렉터리와 파일 없음 | FAIL | `FAIL-003`, Issue URL 대기 |
| C-SECRET-01 | `powershell -NoProfile -ExecutionPolicy Bypass -File qa/secret_scan.ps1` | 공개 표면·Git 이력 후보 0개, unignored 로컬 env 0개 | 아래 최신 실행 결과 참조 | PASS | `security/security_checklist.md`의 안전 검사 절차 |

세 FAIL은 현재 기준선에서 실제로 재현됐지만, 아직 Issue·수정 commit·동일 입력 재시험이 없으므로 v3의 “실패→수정→재시험 3건”을 완료한 것으로 세지 않는다.

## Gold scenario 검사

| ID | 입력 | 기대 | 실제 | 판정 | Issue URL |
| --- | --- | --- | --- | --- | --- |
| C-GOLD-01 | `happy_path` seed → assign → confirm | 네 Task가 직접 근거로 proposed, 사람 확인 뒤 confirmed; unassigned 없음 | B fixture와 A 실행 경로 없음 | BLOCKED | 대기 |
| C-GOLD-02 | `missing_evidence` seed → assign | 무근거 Task는 `owner=null`, `needs_input`, 질문 반환 | B fixture와 A 실행 경로 없음 | BLOCKED | 대기 |
| C-GOLD-03 | `deadline_conflict` seed → assign/reassign | 충돌 후보 제외, `deadline_availability_conflict` blocker 표시 | B fixture와 A 실행 경로 없음 | BLOCKED | 대기 |
| C-GOLD-04 | `completion_without_file` seed → progress | 완료 선언이 있어도 `review_pending`, 80~99%, 누락 파일과 next action 표시 | B fixture와 A 실행 경로 없음 | BLOCKED | 대기 |
| C-GOLD-05 | `version_conflict` seed → files/progress | checksum이 맞는 v1을 최신 유효본으로 표시하고 이름만으로 final 확정 금지 | B fixture와 A 실행 경로 없음 | BLOCKED | 대기 |

## 필수 기능 불변식

| ID | 입력·공격 | 기대 | 실제 | 판정 | Issue URL |
| --- | --- | --- | --- | --- | --- |
| C-ASGN-01 | Task와 무관한 “내가 다 할게”만 반복 | owner를 만들지 않고 `needs_input` | A 구현 없음 | BLOCKED | 대기 |
| C-ASGN-02 | 사람이 고정 owner를 정한 뒤 같은 입력으로 3회 assign | 세 번 모두 같은 owner; AI가 변경하지 않음 | A 구현 없음 | BLOCKED | 대기 |
| C-ASGN-03 | 14시 마감과 후보의 불가시간을 함께 입력 | 후보 제외 또는 blocker; 조용히 배정 금지 | A 구현 없음 | BLOCKED | 대기 |
| C-ASGN-04 | 한 사람에게 여러 Task가 몰리는 입력 | warning과 근거 기반 대안; 근거 없는 대안 생성 금지 | A 구현 없음 | BLOCKED | 대기 |
| C-PROG-01 | 동일 체크포인트에 무관한 메시지를 1개/100개 추가 | Task·Goal percent가 동일 | A 구현 없음 | BLOCKED | 대기 |
| C-PROG-02 | 완료 선언만 있고 파일·테스트·승인 없음 | 100% 및 done 금지 | A 구현 없음 | BLOCKED | 대기 |
| C-PROG-03 | 완료조건 또는 체크포인트 자체가 없음 | `unknown`, `percent=null`, 질문 반환 | A 구현 없음 | BLOCKED | 대기 |
| C-FILE-01 | 같은 Task에 파일 두 버전과 checksum 충돌 | 모든 버전·checksum·검증 상태 표시, 유효 최신본 설명 | A 구현 없음 | BLOCKED | 대기 |

## 채널·보안·Human-in-the-loop

| ID | 입력·공격 | 기대 | 실제 | 판정 | Issue URL |
| --- | --- | --- | --- | --- | --- |
| SEC-ALLOW-01 | 비허용 채널에서 정상 형태 MESSAGE_CREATE/interaction 전송 | 저장 0건, AI 호출 0회, 일반 오류 또는 무시 | A 구현 없음 | BLOCKED | 대기 |
| SEC-ALLOW-02 | DM, 다른 guild, allowlist 밖 thread에서 호출 | 저장·분석 없음 | A 구현 없음 | BLOCKED | 대기 |
| SEC-SIG-01 | 누락·잘못된 Discord interaction 서명과 오래된 timestamp | allowlist·저장·AI 전에 거부; side effect 0건 | A 구현 없음 | BLOCKED | 대기 |
| SEC-REPLAY-01 | 같은 유효 서명 payload와 interaction ID를 재전송 | 최초 한 번만 처리하거나 replay 거부; 중복 저장·전송 0건 | A 구현 없음 | BLOCKED | 대기 |
| SEC-SECRET-01 | Discord/OpenAI/DB 가짜 sentinel로 health·오류·UI·로그 검사 | 모든 표면에서 sentinel 0건, raw stack 0건 | A 구현 없음 | BLOCKED | 대기 |
| HITL-ASSIGN-01 | AI 배정 결과만 생성 | 사람 클릭 전 `confirmed` 금지 | A 구현 없음 | BLOCKED | 대기 |
| HITL-COMPLETE-01 | 모든 자동 증거가 있는 상태 | 사람 승인 전 최대 `review_pending`/99% | A 구현 없음 | BLOCKED | 대기 |
| HITL-DELETE-01 | 삭제 요청, 잘못된 사용자, stale/replay 확인 | 관리자 최종 확인 전 무변경; 확인은 한 번만 유효 | A 구현 없음 | BLOCKED | 대기 |
| HITL-SEND-01 | 외부 채널/웹으로 파일·요약 전송 요청 | 확인 전 outbound 호출 0회; 확인 후 1회 | A 구현 없음 | BLOCKED | 대기 |
| HITL-REASSIGN-01 | 기존 owner 변경 요청 | 확인 전 기존 owner 유지; 사유와 before/after 기록 | A 구현 없음 | BLOCKED | 대기 |
| HITL-DEADLINE-01 | 마감 변경 요청 | 확인 전 기존 마감 유지; actor와 변경 사유 기록 | A 구현 없음 | BLOCKED | 대기 |
| HITL-ATTACH-01 | 개인정보 가능 첨부 업로드 | 확인 전 다운로드·분석·AI 전송 0회 | A 구현 없음 | BLOCKED | 대기 |
| AI-FB-01 | timeout 주입 | degraded/fallback 표시, deterministic demo 결과, owner 발명·비밀 노출 없음 | A 구현과 B fixture 없음 | BLOCKED | 대기 |
| AI-FB-02 | 401 주입 | AI-FB-01과 동일 | A 구현과 B fixture 없음 | BLOCKED | 대기 |
| AI-FB-03 | 429 주입 | AI-FB-01과 동일 | A 구현과 B fixture 없음 | BLOCKED | 대기 |
| AI-FB-04 | 5xx 주입 | AI-FB-01과 동일 | A 구현과 B fixture 없음 | BLOCKED | 대기 |
| AI-FB-05 | 빈 응답 주입 | AI-FB-01과 동일 | A 구현과 B fixture 없음 | BLOCKED | 대기 |
| AI-FB-06 | JSON schema 불일치 주입 | AI-FB-01과 동일 | A 구현과 B fixture 없음 | BLOCKED | 대기 |
| AI-FB-07 | 존재하지 않는 Task/Member/Evidence ID 주입 | validator가 거부하고 안전한 fallback; 이전 confirmed 결과 유지 | A 구현과 B fixture 없음 | BLOCKED | 대기 |

## 실행 증거 기록 형식

각 실행 후 아래 필드를 한 행 또는 `qa/retest_log.md`에 추가한다.

```text
test_id:
tested_ref:
fixture_version:
command_or_ui_path:
expected:
actual:
status: PASS | FAIL
issue_url:
fix_commit:
retest_same_input:
evidence_url_or_path:
tested_at:
tester:
reviewer:
```

## 최종 검증 명령

PowerShell에서 저장소 루트 기준으로 실행한다. 실제 secret 값은 출력하지 않는다.

```powershell
node qa/validate_goldset.mjs
node qa/validate_fixture_bindings.mjs
node qa/compare_goldset_result.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File qa/secret_scan.ps1
git check-ignore -v -- .env
git status --short --branch
```

이 명령의 실제 출력과 실행 시각을 최종 인계 전에 이 문서에 반영한다.

### 최신 로컬 실행

- 실행 시각: `2026-08-12T14:26+09:00`
- Tested ref: `5938b3206cb8ee3fa32cb0fe91c38c34ed60a178` + C 로컬 산출물
- `goldset_oracle=PASS`
- `scenario_count=5`
- `scenario_names=completion_without_file,deadline_conflict,happy_path,missing_evidence,version_conflict`
- `assignment_count=8`
- `global_expectations=8`
- `fixture_binding=NOT_RUN` — B manifest 없음
- `goldset_comparison=NOT_RUN` — A 결과와 B manifest 없음
- `public_surface_secret_candidate_files=0`
- `history_secret_candidate_files=0`
- `unignored_local_env_files=0`
- `secret_scan=PASS`
