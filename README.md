# Discord Goal Referee

Discord 프로젝트 채널의 약속, 일정, 파일, GitHub 링크를 행동 증거로 구조화해
역할을 제안하고 진행률을 보여주는 해커톤 MVP입니다. 웹 대시보드와 실제 Discord
슬래시 명령 봇을 함께 제공합니다.

핵심 원칙은 세 가지입니다.

- AI의 배정은 제안이며 사람이 확인해야 확정됩니다.
- 메시지 수가 아니라 체크포인트, 파일, 테스트, 승인으로 진행률을 계산합니다.
- 허용된 Discord 채널의 데이터만 처리하고 비밀값은 응답이나 로그에 노출하지 않습니다.

## Quick start

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

브라우저에서 `http://localhost:8000`을 열고 **데모 데이터 넣기**부터 실행합니다.
API 문서는 `http://localhost:8000/docs`에서 볼 수 있습니다.

## Discord 진행률 봇

`/progress` 명령은 실행한 채널의 최근 100개 메시지를 OpenAI API로 분석해 Discord Embed로
전체 진행률, 완료/진행 중 항목, 다음 행동, 위험 요소와 개인별 진행률을 표시합니다.
카드의 **새로고침**은 최신 메시지를 다시 분석하고, **개인별 상세**는 호출자에게만 보이는
상세 진행 정보를 표시합니다.

루트 `.env`에 아래 값을 설정한 뒤 실행하세요.

```bash
OPENAI_API_KEY=sk-proj-...
DISCORD_BOT_TOKEN=...
DISCORD_APPLICATION_ID=...
DISCORD_GUILD_ID=... # 개발용 서버일 때만 권장
```

```bash
npm install --prefix discord-progress-bot
npm run register:bot
npm run start:bot
```

Discord Developer Portal에서는 **Message Content Intent**를 켜고 봇에
**View Channels**, **Read Message History**, **Send Messages**, **Embed Links** 권한을 부여해야 합니다.
분석 요청은 `store: false`로 전송되며, 자세한 판단·보안 원칙과 대화 파일 검증 방법은
[discord-progress-bot/README.md](discord-progress-bot/README.md)를 참고하세요.

배포용 인터랙티브 웹사이트는 Next 기반이며 다음 명령으로 실행합니다.

```bash
pnpm install
pnpm dev:web
```

## Test

```bash
pytest -q
npm run test:bot
```

상세 개발 순서와 팀원이 개입하는 지점은 [README_PLAN.md](README_PLAN.md)를 참고하세요.

## Deployed website

https://discord-goal-referee-0812.sanghyun1343590633.chatgpt.site

현재 배포본은 fixture 기반 웹 데모입니다. Discord API/Bot 연동은 별도 담당자가 연결합니다.
