# Team Readiness Discord Bot

Discord 채널 안에서 프로젝트 목표와 Task를 등록하고, **팀이 직접 선택한 메시지**를 근거로 역할 배정안을 만든 뒤 진행 상태와 산출물을 확인하여 제출 ZIP까지 만드는 봇입니다.

AI가 사람을 평가하거나 최종 결정을 내리는 제품이 아닙니다. AI는 근거가 있는 배정안을 제안하고, 담당자 변경과 최종 확정은 팀이 직접 합니다.

## A/B/C/D가 하나로 연결되는 방식

| 영역 | 이 Discord 버전에서 하는 일 |
| --- | --- |
| A · 통합/PM | Discord 설정, 채널별 프로젝트, Goal·멤버·Task, 로컬 저장소를 하나의 실행 흐름으로 연결합니다. |
| B · Discord Data/Files | 사용자가 고른 메시지만 근거로 보존하고, 업로드 파일의 버전·크기·SHA-256 checksum을 기록해 `manifest.json`과 ZIP으로 묶습니다. |
| C · AI/Rules | 선택된 근거와 사용자가 직접 고정한 담당자를 바탕으로 역할을 제안하고, 존재하지 않는 멤버·Task·근거를 결과에서 차단합니다. 진행률은 AI의 인상이 아니라 완료조건과 파일 증거로 계산합니다. |
| D · Discord UI/QA | 슬래시 명령, 메시지 우클릭 메뉴, 배정 확정/재배정 버튼, 상태 카드, 제출 ZIP 다운로드를 제공합니다. |

대표 흐름은 다음과 같습니다.

1. 프로젝트 Goal, 마감, 완료조건을 등록합니다.
2. 팀원과 Task를 등록합니다.
3. 역할 배정에 필요한 Discord 메시지만 골라 `근거로 추가`합니다.
4. `/assign`으로 배정안을 만들고 팀이 확인한 뒤 `배정 확정`을 누릅니다.
5. `/task update`와 `/artifact upload`로 상태와 산출물을 갱신합니다.
6. `/status`로 완료조건 기반 진행률을 확인합니다.
7. `/package`로 전체 산출물, `manifest.json`, checksum이 담긴 제출 ZIP을 만듭니다.

## 꼭 지키는 원칙

- 개인 기여도 비교, 순위, 점수표를 만들지 않습니다.
- 메시지 수, 말투, 답장 속도, 온라인 체류시간, 키 입력을 역량이나 진행률에 사용하지 않습니다.
- 성격, 감정, 사적 관계를 추론하지 않습니다.
- 개인 메시지(DM)와 봇 메시지는 근거로 수집하지 않습니다.
- 서버의 모든 대화를 자동 감시하지 않습니다. 기본 설정에서는 사용자가 직접 고른 메시지만 저장합니다.
- 모든 배정과 진행 판단에는 Discord 메시지, 사용자 입력 또는 파일 같은 출처가 있어야 합니다.
- 근거가 부족하면 담당자를 지어내지 않고 `확인 필요`로 남깁니다.
- AI 결과는 제안입니다. 팀이 수정·거부·재배정·확정할 수 있습니다.
- 인사평가, 성적, 보상, 징계 같은 자동 결정에 사용하지 않습니다.

선택한 메시지의 내용, 작성자 이름/ID, 서버·채널·메시지 ID, 시각과 첨부파일 정보가 로컬 프로젝트 데이터에 저장될 수 있습니다. 파일을 등록하면 파일 원본도 로컬에 저장됩니다. 팀원의 동의를 받고 필요한 범위만 선택해 주세요. `AI_MODE=live`에서는 배정에 필요한 선택 근거와 프로젝트 정보가 OpenAI API로 전송될 수 있습니다.

## 준비물

- Node.js `24.17.0` 이상
- 봇을 설치할 수 있는 테스트용 Discord 서버
- Discord Developer Portal에서 만든 앱의 다음 값
  - Bot Token
  - Application ID
  - Guild ID(서버 ID)
- 선택 사항: `AI_MODE=live`에 사용할 OpenAI API key

버전을 확인합니다.

```powershell
node --version
npm --version
```

## 1. Discord 앱과 봇 만들기

1. [Discord Developer Portal](https://discord.com/developers/applications)을 열고 `New Application`을 누릅니다.
2. 앱 이름을 입력하고 생성합니다.
3. 왼쪽 `General Information`에서 `Application ID`를 복사합니다.
4. 왼쪽 `Bot`으로 이동합니다. `Reset Token`을 눌러 Bot Token을 발급하고 안전한 곳에 잠시 보관합니다.

Bot Token은 비밀번호와 같습니다. **이 채팅, Discord 메시지, GitHub Issue, 코드 파일에 붙여 넣지 마세요.** 아래에서 만드는 로컬 `.env` 파일에만 넣습니다. 토큰은 다시 표시되지 않을 수 있으며, 노출되었다면 Developer Portal의 `Bot` 페이지에서 즉시 `Reset Token`으로 교체해야 합니다.

### 서버 설치 범위와 최소 권한

Developer Portal의 `Installation`에서 서버 설치(`Guild Install`)를 설정합니다.

- Scopes
  - `applications.commands`
  - `bot`
- Bot Permissions
  - `View Channels`
  - `Send Messages`
  - `Embed Links`
  - `Attach Files`
  - `Send Messages in Threads`

`Administrator`는 선택하지 마세요. 이 봇에는 필요하지 않습니다.

`Installation`의 Install Link를 복사해 브라우저에서 열고 테스트 서버에 앱을 추가합니다. Discord 화면이 조금 다르면 `OAuth2` → `URL Generator`에서 같은 scopes와 permissions를 선택해 초대 링크를 만들 수 있습니다.

### Guild ID(서버 ID) 얻기

1. Discord 데스크톱 앱의 `사용자 설정` → `고급`에서 `개발자 모드`를 켭니다.
2. 왼쪽 서버 아이콘을 우클릭합니다.
3. `서버 ID 복사`를 누릅니다.

이 값이 `DISCORD_GUILD_ID`입니다. 앱의 `General Information`에 표시되는 값은 `DISCORD_APPLICATION_ID`입니다. 두 값을 바꾸어 넣지 마세요.

## 2. 로컬 환경 설정

PowerShell에서 이 폴더로 이동합니다.

```powershell
cd C:\Users\LG\Desktop\openai\team-readiness\discord-bot
npm install
Copy-Item .env.example .env
notepad .env
```

처음에는 다음처럼 설정하는 것이 가장 간단합니다.

```dotenv
DISCORD_TOKEN=Developer Portal에서 복사한 Bot Token
DISCORD_APPLICATION_ID=General Information의 Application ID
DISCORD_GUILD_ID=테스트 서버의 Guild ID
DISCORD_COMMAND_SCOPE=guild
DISCORD_ENABLE_MESSAGE_CONTENT=false

AI_MODE=mock
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra

DATABASE_PATH=./data/projects.json
ARTIFACT_DIR=./data/artifacts
MAX_PACKAGE_BYTES=20971520
TIME_ZONE=Asia/Seoul
```

값 주위에 따옴표를 붙일 필요는 없습니다. `.env`는 `.gitignore`로 제외되어 있지만, 직접 강제 추가하거나 내용을 복사해 커밋하지 마세요.

### `AI_MODE=mock`과 `AI_MODE=live`

- `AI_MODE=mock`: OpenAI API key 없이 로컬 규칙으로 실행합니다. 설치 확인, 테스트, 데모에 권장합니다.
- `AI_MODE=live`: OpenAI Responses API를 이용해 선택 메시지에서 배정 근거 후보를 구조화합니다. `.env`의 `OPENAI_API_KEY`가 필요합니다.

live 모드 설정 예시는 다음과 같습니다.

```dotenv
AI_MODE=live
OPENAI_API_KEY=발급받은_키
OPENAI_MODEL=gpt-5.6-terra
```

live 모드에서 API 요청이 실패하면 결과를 몰래 mock으로 바꾸지 않고 오류를 표시합니다. 네트워크와 key, model 이름을 확인하거나 사용자가 명시적으로 `AI_MODE=mock`으로 되돌려 주세요.

## 3. 명령 등록과 봇 실행

Discord 명령은 봇 실행 전에 한 번 등록해야 합니다.

```powershell
npm run register
npm start
```

`7개 명령을 guild 범위에 등록했습니다.`가 표시되고, `Discord bot ready:`가 이어서 보이면 준비가 끝난 것입니다. `.env` 또는 명령 정의를 바꾸었으면 `npm run register`를 다시 실행합니다.

개발 중 자동 재시작이 필요하면 다음을 사용할 수 있습니다.

```powershell
npm run dev
```

처음에는 `DISCORD_COMMAND_SCOPE=guild`를 권장합니다. 테스트 서버에 명령이 빠르게 반영됩니다. 여러 서버에 배포할 때만 `global`로 바꾸고 `npm run register`를 다시 실행하세요.

## 4. Discord에서 사용하는 순서

한 Discord 채널이 한 프로젝트입니다. 프로젝트를 만든 채널에서 아래 명령을 계속 사용하세요.

변경 작업은 프로젝트 생성자, 등록된 팀원 또는 `Manage Server` 권한이 있는 관리자만 할 수 있습니다. 팀원 목록 변경과 프로젝트 삭제는 생성자 또는 관리자만 가능합니다.

### 4-1. 프로젝트 생성

```text
/project create name:팀 데모 goal:발표 가능한 Discord 봇 완성 deadline:2026-08-15 18:00+09:00 done:테스트 통과; 발표 자료와 제출 ZIP 완성
```

필수 입력은 `name`, `goal`, `deadline`, `done`입니다.

### 4-2. 팀원 추가

```text
/project members action:멤버 추가 member:@팀원
```

팀원마다 반복합니다. `action:목록 보기`로 현재 등록 수를 확인하고, `action:멤버 제외`로 뺄 수 있습니다. 봇 계정은 팀원으로 등록하지 않습니다.

### 4-3. Task 추가

```text
/task add text:Discord 명령 화면 구현 skills:JavaScript,Discord effort:2 deadline:2026-08-15 15:00+09:00 required_files:demo.zip done_conditions:명령 등록; 테스트 통과
```

선행 Task가 있으면 `dependencies:T-01`처럼 입력합니다. Task ID는 등록 순서대로 `T-01`, `T-02` 형태로 생성됩니다. 여러 값은 쉼표로 구분합니다.
`done_conditions`는 세미콜론으로 나눈 완료조건이며 진행률의 체크포인트가 됩니다. 생략하면 사용자 완료 확인 조건 하나가 만들어집니다.

### 4-4. 필요한 메시지만 근거로 추가

역량, 맡겠다는 약속, 일정, 선호, 제약처럼 배정에 필요한 메시지를 찾습니다.

- 데스크톱: 메시지 우클릭 → `앱` 또는 `Apps` → `근거로 추가`
- 모바일: 메시지 길게 누르기 → `Apps` → `근거로 추가`

같은 메시지를 두 번 선택해도 한 번만 저장됩니다. DM, 봇 메시지, 내용이 없는 메시지는 수집하지 않습니다.

기본값 `DISCORD_ENABLE_MESSAGE_CONTENT=false`를 유지해도 이 우클릭 메뉴는 동작합니다. 메시지 우클릭 명령으로 사용자가 특정한 대상 메시지만 Discord interaction으로 받기 때문에, 서버 메시지 전체를 읽는 privileged `MESSAGE_CONTENT` intent가 필요하지 않습니다. 다만 아래의 실시간 GPT 채팅 기능은 이 intent가 필요합니다.

## 실시간 Discord 채팅 → GPT 확인

이 기능은 사용자가 켠 **한 채널**에서만 새 메시지를 GPT에 전송합니다. 답변에는 `1/3 메시지 수신 → 2/3 API 전송 → 3/3 응답 수신` 단계와 모델·응답 ID·토큰 수·처리 시간이 표시됩니다.

1. `.env`를 설정합니다. API 키와 Bot Token은 절대 채팅에 붙여 넣지 않습니다.

```dotenv
DISCORD_ENABLE_MESSAGE_CONTENT=true
AI_MODE=live
OPENAI_API_KEY=새로_발급한_API_키
OPENAI_MODEL=gpt-5.6-terra
```

2. Discord Developer Portal → Application → `Bot` → **Privileged Gateway Intents**에서 **Message Content Intent**를 켭니다. 봇 권한에는 `Read Message History`도 추가합니다.

3. 봇을 재시작하고 명령을 다시 등록합니다.

```powershell
npm run register
npm start
```

4. 프로젝트 채널에서 생성자 또는 서버 관리자가 응답 방식을 켭니다.

```text
/chat setup mode:봇 멘션에만 응답 history_limit:8
/chat setup mode:지정 접두사에만 응답 prefix:!gpt history_limit:8
/chat setup mode:모든 채팅에 응답 history_limit:8
```

처음에는 `봇 멘션에만 응답`을 권장합니다. 이후 `@봇이름 오늘 할 일을 요약해줘` 또는 `!gpt 오늘 할 일을 요약해줘`처럼 보내면, 현재 문장과 최근 설정 개수의 채팅을 GPT에 전송합니다.

5. 실제 연결은 아래 명령으로 확인합니다.

```text
/chat test prompt:연결 테스트입니다. 받은 문장을 한 줄로 확인해줘.
/chat status
```

`/chat test`는 실행한 사람에게만 보이며 GPT에 보낸 최근 채팅 미리보기, GPT 출력, 모델, 응답 ID, 처리 시간을 보여줍니다. 응답 ID가 표시되면 Discord 수신 → OpenAI API 전송 → 응답 수신이 모두 성공한 것입니다. 중지는 `/chat off`입니다.

실시간 모드에서는 새 채팅 본문과 설정한 최근 문맥이 OpenAI API로 전송될 수 있습니다. 요청에는 `store:false`를 사용하고 봇·DM·웹훅·빈 메시지는 전송하지 않습니다. 참여자에게 알린 뒤 필요한 채널에서만 켜세요.

### 4-5. 역할 배정 제안과 확정

```text
/assign
```

결과 카드에서 담당자, 이유, 근거 확실성, 막힘과 확인 질문을 검토합니다.

- `배정 확정`: 현재 revision의 배정안을 팀 결정으로 확정합니다.
- `조건 반영 후 재배정`: 변경된 Task와 제약을 반영해 다시 제안합니다.
- `상태 보기`: 현재 준비 상태로 이동합니다.

담당자를 팀이 직접 정하거나 상태·막힘·다음 행동을 바꾸려면 다음처럼 사용합니다.

```text
/task update task:T-01 owner:@팀원 state:진행 중 blocker:디자인 승인 대기 next_action:승인 후 버튼 연결
```

사용자가 지정한 `owner`는 AI 제안보다 우선하는 고정 담당자로 취급됩니다. 조건을 바꾼 뒤 `/assign`을 다시 실행할 수도 있습니다.

### 4-6. 산출물 등록

```text
/artifact upload task:T-01 file:demo.zip version:v1 required:true
```

파일은 로컬 `data/artifacts` 아래에 저장되고 크기와 SHA-256 checksum이 기록됩니다. Task 생성 때 `required_files`를 입력했다면 실제 업로드 파일 이름을 같게 맞추는 것이 좋습니다.

### 4-7. 진행 상태 확인

```text
/status
```

진행률은 메시지 수가 아니라 Task 체크포인트와 등록 파일을 기준으로 계산합니다. 필수 파일이나 확인 근거가 없으면 사용자가 `완료`라고 입력했더라도 자동으로 100%가 되지 않을 수 있습니다.

### 4-8. 제출 패키지 만들기

```text
/package
```

현재 버전은 프로젝트에 등록된 **전체 산출물**을 ZIP으로 묶고, `manifest.json`도 함께 Discord에 보냅니다. manifest에는 프로젝트 정보와 파일명, 버전, 크기, checksum, 출처가 기록됩니다.

안전 여유를 두기 위해 기본 패키지 상한은 20 MiB(`20971520` bytes)입니다. ZIP이 이를 넘으면 생성이 중단됩니다. Discord 자체 업로드 한도는 서버/계정 설정에 따라 다를 수 있으므로 `MAX_PACKAGE_BYTES`를 무작정 높이지 말고, 처음부터 필요한 산출물만 작은 크기로 등록하세요.

### 4-9. 프로젝트 삭제

```text
/project delete confirm:true
```

이 명령은 해당 채널의 프로젝트 데이터와 저장된 산출물 폴더를 삭제합니다. 되돌리기 기능이 없으므로 필요한 ZIP을 먼저 내려받으세요.

## 5. 인터넷 연결 없이 데모와 테스트하기

Discord token이나 OpenAI API key 없이 전체 데이터 흐름을 확인하려면 다음을 실행합니다.

```powershell
npm run demo
```

자동 테스트는 다음과 같습니다.

```powershell
npm test
```

테스트와 데모를 한 번에 확인하려면 다음을 실행합니다.

```powershell
npm run check
```

## 저장 위치와 데이터 삭제

- 프로젝트 JSON: `./data/projects.json`
- 업로드 산출물과 생성 ZIP: `./data/artifacts`
- 오프라인 데모 출력: `./demo-output`

이 경로는 `.env`에서 바꿀 수 있습니다. 실제 팀 데이터가 포함될 수 있으므로 클라우드 동기화나 공개 저장소 안에 두지 말고, 접근 권한과 보존 기간을 정하세요. Discord의 원본 메시지를 삭제해도 이미 선택하여 저장한 로컬 근거가 자동으로 삭제되지는 않습니다. 이 봇의 `/project delete confirm:true`도 함께 실행해야 합니다.

## 문제 해결

### `Missing configuration: ...`

오류에 표시된 `.env` 값을 채웁니다. guild 범위에서는 `DISCORD_TOKEN`, `DISCORD_APPLICATION_ID`, `DISCORD_GUILD_ID`가 모두 필요합니다. live 모드에서는 `OPENAI_API_KEY`도 필요합니다.

### Discord에 `/project` 같은 명령이 보이지 않음

1. `DISCORD_APPLICATION_ID`와 `DISCORD_GUILD_ID`가 바뀌지 않았는지 확인합니다.
2. 봇이 같은 서버에 설치되어 있는지 확인합니다.
3. `npm run register`를 다시 실행합니다.
4. Discord 클라이언트를 새로고침합니다.
5. 서버 설정 → 연동(Integrations)에서 앱 명령이 해당 채널/역할에 허용되었는지 확인합니다.

### 봇은 온라인인데 응답하지 않음

- `npm start` 창이 계속 실행 중인지 확인합니다.
- 해당 채널에서 `View Channels`, `Send Messages`, `Embed Links`, `Attach Files`가 허용되어 있는지 확인합니다.
- 스레드라면 `Send Messages in Threads`도 확인합니다.
- 관리자 권한을 추가하는 대신 부족한 최소 권한만 고칩니다.

### `근거로 추가`가 보이지 않거나 실패함

- 먼저 같은 채널에서 `/project create`를 실행합니다.
- `npm run register`를 다시 실행합니다.
- DM이나 봇 메시지가 아닌 서버의 일반 사용자 메시지를 선택합니다.
- 같은 메시지라면 `이미 추가된 근거입니다.`가 정상입니다.
- `DISCORD_ENABLE_MESSAGE_CONTENT`는 이 우클릭 근거 수집에는 필요하지 않습니다. 실시간 GPT 채팅을 쓸 때에만 필요합니다.

### `Invalid Token`, `401` 또는 로그인 실패

Bot Token 앞뒤 공백을 제거하고, 사용자 token이 아니라 Developer Portal `Bot` 페이지의 token인지 확인합니다. 노출되었거나 확실하지 않으면 `Reset Token`으로 새로 발급한 뒤 `.env`만 갱신합니다.

### live AI 배정이 실패함

`OPENAI_API_KEY`, `OPENAI_MODEL`, 결제/사용 한도, 네트워크를 확인합니다. API 없이 기능 흐름만 확인하려면 `.env`를 `AI_MODE=mock`으로 바꾸고 봇을 다시 시작합니다.

### 완료인데 진행률이 100%가 아님

Task의 필수 파일, 완료조건, 승인 근거가 모두 충족되었는지 확인합니다. `required_files`에 등록한 이름과 실제 업로드 파일 이름이 다른지도 확인하세요. 메시지량이나 단순 완료 문장만으로 진행률을 올리지는 않습니다.

### ZIP이 20 MiB를 넘음

현재 버전에는 등록한 산출물 한 개만 삭제하는 Discord 명령이 없습니다. 중요한 파일을 먼저 백업한 뒤 프로젝트를 다시 만들거나, 개발자가 로컬 데이터를 안전하게 정리한 후 더 작은 파일만 등록해야 합니다. `MAX_PACKAGE_BYTES`를 높여도 Discord 업로드 한도를 넘으면 전송되지 않습니다.

## 배포 전 보안 체크

- [ ] `.env`, Discord Bot Token, OpenAI API key가 Git에 포함되지 않았습니다.
- [ ] 토큰이나 key를 채팅, 화면 캡처, 문서, Issue에 붙여 넣지 않았습니다.
- [ ] 이전 작업 중 노출된 OpenAI API key는 [OpenAI API Keys](https://platform.openai.com/api-keys)에서 폐기하고 새 key를 발급했습니다.
- [ ] 노출 가능성이 있는 Discord Bot Token도 Developer Portal에서 재발급했습니다.
- [ ] Discord 봇에 `Administrator` 권한이 없습니다.
- [ ] 필요한 채널에만 최소 권한을 부여했습니다.
- [ ] 실제 팀 데이터로 시작하기 전에 테스트 서버에서 mock 모드로 검증했습니다.
- [ ] 선택 메시지와 파일을 처리한다는 사실을 팀원에게 알리고 동의를 받았습니다.
- [ ] 로컬 `data` 폴더의 접근 권한, 백업, 보존 기간, 삭제 절차를 정했습니다.
- [ ] `/project delete` 전에 필요한 제출 ZIP을 별도 보관했습니다.
- [ ] 배포 서버에서는 프로세스 관리자와 비밀 저장소를 사용하고 `.env`를 공개 폴더에 두지 않았습니다.

## 공식 참고 자료

- [Discord: 첫 앱 만들기](https://docs.discord.com/developers/quick-start/getting-started)
- [Discord: OAuth2와 권한](https://docs.discord.com/developers/platform/oauth2-and-permissions)
- [Discord: 서버 ID 찾기](https://support.discord.com/hc/ko/articles/206346498-%EC%82%AC%EC%9A%A9%EC%9E%90-%EC%84%9C%EB%B2%84-%EB%A9%94%EC%8B%9C%EC%A7%80-ID%EB%8A%94-%EC%96%B4%EB%94%94%EC%84%9C-%ED%99%95%EC%9D%B8%ED%95%98%EB%82%98%EC%9A%94)
