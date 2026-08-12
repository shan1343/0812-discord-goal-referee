# C evidence index

이 폴더는 C의 정답셋·테스트·보안 증거 위치만 기록한다. 실제 token/key, 개인 Discord 메시지, 개인 ID, 원문 첨부파일은 저장하지 않는다.

## 현재 기준선

- Repository: `shan1343/0812-discord-goal-referee`
- Commit: `5938b3206cb8ee3fa32cb0fe91c38c34ed60a178`
- Tested at: `2026-08-12T14:26+09:00`
- Runtime: 아직 없음
- B fixture binding: 아직 없음

## 로컬 검증 증거

### C-EVID-001 — goldset 구조

- 입력: `eval/goldset.json`
- 절차: PowerShell `ConvertFrom-Json`, scenario 이름/개수/고유 ID 검사
- 결과: PASS
- 관측값: `goldset_oracle=PASS`, scenario 5개, 고유 ID 5개, assignment oracle 8개, 모든 scenario의 Task/Owner/Status/Evidence oracle 존재, 공통 불변식 8개
- 시나리오: happy_path, missing_evidence, deadline_conflict, completion_without_file, version_conflict

### C-EVID-002 — 비밀정보 기준선

- 입력: 공개·커밋 가능 작업 트리 표면과 전체 Git 이력; 로컬 `.env*`는 별도 ignore 여부만 검사
- 절차: OpenAI/Discord token, Discord webhook, credential이 포함된 DATABASE_URL 고신뢰 패턴을 일치값이 아닌 파일명만 출력하도록 `--no-ignore` 검사하되 로컬 비밀 저장소 `.env*`와 의존성 폴더는 제외
- 결과: PASS
- 관측값: 공개 표면 후보 파일 0개, Git 이력 후보 파일 0개, unignored 로컬 env 파일 0개, `secret_scan=PASS`

### C-EVID-003 — 환경 파일 ignore

- `.env`: PASS — `.gitignore:151`에서 제외
- `.env.local`: FAIL — 제외 규칙 없음 (`FAIL-001`)
- `.env.example`: FAIL — 파일 없음 (`FAIL-002`)

### C-EVID-004 — fixture 준비

- `fixtures/conversations/`: FAIL — 디렉터리 없음
- 필요한 5개 fixture: 0/5
- 연결 기록: `FAIL-003`

### C-EVID-005 — GitHub 기준선 조회

- GitHub 연동으로 `shan1343/0812-discord-goal-referee` 메타데이터와 root, Issue 목록을 조회했다.
- 관측값: default branch `main`, root tracked file 2개, Issue 0개, 연결 계정 권한은 read-only.
- 이 기록은 C의 기준선 확인 증거이며, A가 repo/Issue 상태를 실제 갱신해야 하는 v3 Plugin Gate를 대신하지 않는다.

## 후속 증거 이름 규칙

```text
C_<test-id>_<before|after>_<YYYYMMDD-HHMM>.<png|txt|json>
```

스크린샷은 token, 개인 ID, 실제 메시지를 가린 뒤 저장한다. D의 최종 `evidence/pass_matrix.md`는 이 인덱스의 PASS 증거만 링크하고, BLOCKED/NOT_RUN을 PASS로 바꾸지 않는다.
