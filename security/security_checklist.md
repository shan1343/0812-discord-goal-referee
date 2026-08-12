# Security checklist and human-confirmation copy

## 적용 기준

- 제품: Discord Goal Referee v3
- 담당: C — Security Red Team
- 기준선: `main@5938b3206cb8ee3fa32cb0fe91c38c34ed60a178`
- 상태 원칙: 증거 없는 항목은 PASS가 아니다.

Discord 공식 문서 기준으로 bot token은 비밀번호처럼 취급하고 필요한 권한만 요청한다. `MESSAGE_CONTENT`는 privileged intent이며, 전체 채널 수집이 필요하지 않은 MVP에서는 slash command, mention, message context command를 우선한다.

- Gateway / privileged intents: <https://docs.discord.com/developers/events/gateway>
- Application commands and channel permissions: <https://docs.discord.com/developers/interactions/application-commands>
- OAuth2 and least-privilege permissions: <https://docs.discord.com/developers/platform/oauth2-and-permissions>

## 현재 판정

| ID | 통과 조건 | 현재 상태 | 필요한 증거 |
| --- | --- | --- | --- |
| SEC-GIT-01 | `.env`가 Git에서 제외됨 | PASS | `git check-ignore -v -- .env` → `.gitignore:151` |
| SEC-GIT-02 | `.env.*` 제외, `!.env.example`만 허용 | FAIL | `FAIL-001`; A 수정 commit과 동일 명령 재시험 |
| SEC-GIT-03 | 실제 값 없는 `.env.example` 존재 | FAIL | `FAIL-002`; key 이름만 검토 |
| SEC-GIT-04 | 런타임 DB·첨부·로그·ZIP·캐시 경로가 Git에서 제외됨 | BLOCKED | A가 저장 경로를 동결한 뒤 `git check-ignore` |
| SEC-SECRET-01 | 작업 트리·전체 이력의 실제 token/key 후보 0건 | PASS 기준선 | 값 비노출 scan 파일명 목록 0건 |
| SEC-SECRET-02 | health, Discord UI, 웹 UI, 오류, stdout/stderr, 저장 로그에 sentinel 0건 | BLOCKED | A 실행물과 fake sentinel |
| SEC-ALLOW-01 | allowlist 밖 채널 이벤트 저장 0건, AI 호출 0회 | BLOCKED | fake store/model call count |
| SEC-ALLOW-02 | DM·다른 guild·허용되지 않은 thread 거부 | BLOCKED | interaction test 결과 |
| SEC-SIG-01 | interaction 서명·timestamp 검증이 allowlist·storage·AI보다 먼저 실행 | BLOCKED | missing/invalid/stale request 결과와 call count |
| SEC-REPLAY-01 | 같은 interaction의 replay가 중복 side effect를 만들지 않음 | BLOCKED | 동일 payload 2회 결과와 idempotency 기록 |
| SEC-PERM-01 | Administrator 없이 최소 bot 권한만 요청 | BLOCKED | Developer Portal/설치 설정 캡처 |
| SEC-CONSENT-01 | 테스트 서버·명시적 동의 멤버·허용 채널 범위 표시 | BLOCKED | `/setup` 또는 관리자 설정 화면 |
| SEC-RETENTION-01 | 기본 보존은 demo 세션 종료까지이며 기간을 설정 가능 | BLOCKED | 설정값, 만료 전후 storage 결과 |
| SEC-FORGET-01 | 삭제 범위 미리보기와 관리자 확인 후 원문·프로젝트 삭제 | BLOCKED | `HITL-DELETE-01` 로그 |
| SEC-ATTACH-01 | 개인정보 가능 첨부는 확인 전 다운로드·AI 전송하지 않음 | BLOCKED | fake downloader/model call count |
| SEC-FALLBACK-01 | AI 실패 시 명시된 deterministic demo fallback | BLOCKED | timeout/401/429/5xx/빈 응답/schema 불일치/존재하지 않는 ID 결과 |
| SEC-AUDIT-01 | 위험 행동에 actor, time, scope, before/after, reason, confirmation ID 기록 | BLOCKED | redacted audit record |

## Discord 최소 권한

기본 요청 권한은 아래로 제한한다. 기능이 필요하지 않으면 더 제거한다.

- View Channels
- Read Message History
- Send Messages
- Embed Links
- Attach Files
- Send Messages in Threads — thread 지원 시에만

`Administrator`, 멤버 관리, 메시지 전체 관리, 서버 관리 권한은 요청하지 않는다. 명령은 Discord의 application-command channel/role permission으로 허용 프로젝트 채널에 제한하고, 서버측 allowlist를 별도로 검증한다. UI 제한만으로 보안 경계를 만들지 않는다.

## 비밀정보 처리

- `DISCORD_BOT_TOKEN`, `OPENAI_API_KEY`, `DATABASE_URL`은 서버 환경에서만 읽는다.
- health는 설정 여부와 연결 상태만 반환하며 값·접두사·길이를 반환하지 않는다.
- 오류는 사용자용 코드와 안전한 문장만 반환한다. raw exception, request body, `.env`, 절대경로를 복사하지 않는다.
- 로그는 authorization header, interaction token, webhook URL, query secret을 저장 전에 제거한다.
- 브라우저 번들, source map, HTML, Discord embed에 secret을 넣지 않는다.
- 테스트에는 실제 token 형식과 구별되는 sentinel을 쓰고 보고서에는 sentinel 값 대신 탐지 건수만 기록한다.

### 안전한 정적 검사

아래 검사는 일치값이 아니라 파일명만 출력한다.

```powershell
git check-ignore -v -- .env .env.local
git ls-files -- .env .env.local
powershell -NoProfile -ExecutionPolicy Bypass -File qa/secret_scan.ps1
```

스크립트는 `--no-ignore`로 공개 표면을 검사하고, 의도적인 로컬 비밀 저장소인 `.env*`는 내용 대신 ignore 여부만 검사한다. `.env.example`은 실제 값이 없어야 하므로 공개 표면 검사 대상이다.

일치 파일이 있으면 내용을 채팅이나 Issue에 붙이지 말고 C와 A가 로컬에서 확인한다.

## Human-in-the-loop 공통 통제

모든 위험 행동은 `요청 → 요청자 권한 확인 → 허용된 범위의 영향 미리보기 → 명시적 확인 → 실행 직전 권한·revision 재검증 → 실행 → 감사 기록` 순서다. 권한 확인 전 미리보기에는 민감한 원문·파일명·수신자 정보를 노출하지 않는다.

- 확인 ID는 짧게 만료되고 한 번만 사용할 수 있어야 한다.
- 확인 ID는 actor, action, project/scope, destination, 대상 revision에 묶는다.
- 다른 사용자, 다른 프로젝트, stale revision, 재사용된 확인 ID는 거부한다.
- 취소·시간 초과 시 데이터와 기존 상태를 바꾸지 않는다.
- 버튼 문구는 “확인”만 쓰지 않고 실제 행동을 명시한다.
- Discord interaction의 요청자와 확인자를 기록한다. 삭제는 관리자만 가능하다.
- 외부 전송 adapter는 확인 전 호출 횟수가 0이어야 한다.

## 위험 행동 확인 문구

### 1. 역할 배정 확정

```text
배정안을 확정할까요?
대상: {project_name} / {task_count}개 Task
변경: 제안 상태의 담당자를 팀의 확정 배정으로 기록합니다.
근거가 부족한 Task: {needs_input_count}개
확정 후에도 재배정은 별도 확인이 필요합니다.

[배정 확정] [취소]
```

`needs_input_count > 0`이면 `[배정 확정]`을 비활성화하고 부족한 Task를 먼저 보여준다.

### 2. 완료 100% 확정

```text
이 Task를 완료(100%)로 확정할까요?
Task: {task_title}
필수 체크포인트: {checkpoint_summary}
필수 파일·테스트·승인: {evidence_summary}
누락 항목: {missing_items_or_none}

[완료 확정] [검토로 유지]
```

누락 항목이 하나라도 있으면 완료 확정은 실행하지 않고 `review_pending`을 유지한다.

### 3. 외부 채널·웹 전송

```text
프로젝트 정보를 외부로 전송할까요?
보내는 곳: {destination}
포함 내용: {summary_and_file_list}
개인정보 가능 항목: {sensitive_item_count}개
전송 후에는 수신처에서 회수할 수 없을 수 있습니다.

[이 대상에 전송] [취소]
```

대상과 파일 목록이 바뀌면 기존 확인은 무효다.

### 4. 원문·프로젝트 삭제

```text
선택한 데이터를 영구 삭제할까요?
범위: {scope}
원문 메시지: {message_count}개
첨부파일: {artifact_count}개
파생 데이터·checksum·분석 결과: {derived_data_summary}
이 작업은 되돌릴 수 없습니다.

삭제 범위를 다시 확인한 뒤 아래 버튼을 누르세요.
[영구 삭제] [취소]
```

관리자 권한을 서버에서 다시 검사하고, 삭제 결과에는 삭제/미발견/실패 건수를 구분한다.

### 5. 기존 owner 교체

```text
담당자를 변경할까요?
Task: {task_title}
기존 담당자: {old_owner}
새 담당자: {new_owner}
변경 사유와 근거: {reason_and_evidence}
확정 전까지 기존 담당자가 유지됩니다.

[담당자 변경 확정] [취소]
```

### 6. 마감 변경

```text
마감을 변경할까요?
Task: {task_title}
기존 마감: {old_deadline}
새 마감: {new_deadline}
영향받는 의존 Task: {dependent_tasks}
변경 사유: {reason}

[마감 변경 확정] [취소]
```

### 7. 개인정보 가능 첨부 분석

```text
이 첨부파일을 분석할까요?
파일: {file_name} / {size} / {content_type}
분석 범위: {analysis_scope}
전송 대상: {local_only_or_model_provider}
개인정보가 포함됐을 가능성이 있습니다. 필요한 파일인지 확인하세요.

[이 파일 분석] [취소]
```

확인 전에는 파일 본문을 다운로드·파싱·모델 전송하지 않는다. 허용 크기·형식·출처 검증은 확인 후에도 별도로 적용한다.

## AI/API 실패 fallback

다음 오류를 각각 독립적으로 주입한다.

- timeout / 연결 실패
- 인증 실패(401)
- rate limit(429)
- 서버 오류(5xx)
- 빈 응답
- JSON schema 불일치
- 존재하지 않는 Task/Member/Evidence ID

통과 조건:

1. 화면과 Discord에 `degraded` 또는 `demo fallback`임을 명시한다.
2. 같은 fixture는 같은 결과를 만든다.
3. 근거 없는 owner를 만들지 않는다.
4. 이전 confirmed 결과를 덮어쓰지 않는다.
5. secret, raw stack, 원문 전체를 오류에 포함하지 않는다.

## 유출 의심 대응

1. 해당 token/key 사용을 즉시 중단하고 공급자에서 폐기·재발급한다.
2. 노출 표면(로그, Discord 메시지, Issue, commit, 배포)을 식별하고 접근을 제한한다.
3. 로그와 배포 산출물에서 민감값을 제거한다.
4. Git 이력 수정이 필요하면 A가 팀과 영향 범위를 확인한 뒤 별도 절차로 수행한다.
5. 새 key는 로컬 비밀 저장소에만 넣고 재발 방지 검사를 통과시킨다.
6. incident 시간, 영향 범위, 폐기 시각, 재시험 결과를 값 없이 기록한다.

## 출고 판정

다음 중 하나라도 충족되지 않으면 Security Gate는 FAIL이다.

- allowlist 밖 저장·분석 0건
- 실제 secret 후보 0건 및 runtime sentinel 노출 0건
- 위험 행동 7종의 확인 전 side effect 0건
- AI 실패 7종의 fallback 성공
- 보존·삭제 테스트 성공
- 최소 권한과 동의 화면 증거
- FAIL 3건의 Issue → 수정 commit → 같은 입력 retest PASS
