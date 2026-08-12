# GoalReferee Discord Bot

Discord 대화를 OpenAI API로 근거 중심 분석해 예쁜 진행률 대시보드로 보여 주는 봇입니다.

![Dashboard layout](https://dummyimage.com/900x430/313338/ffffff&text=%F0%9F%9F%A2+%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8+%EC%A7%84%ED%96%89+%ED%98%84%ED%99%A9+%C2%B7+82%25)

`/progress`를 입력하면 다음을 한 번에 표시합니다.

- 전체 진행률과 상태, 완료/진행 중/다음 행동/위험 요소
- 팀원별 진행률, 현재 작업, 다음 행동
- **새로고침** 버튼으로 최근 100개 메시지를 다시 분석
- **개인별 상세** 버튼으로 나에게만 보이는 상세 카드

## 빠른 시작

```bash
cd discord-progress-bot
npm install
cd ..
copy .env.example .env
# 루트 .env에 OPENAI_API_KEY, DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID 입력
cd discord-progress-bot
npm run register
npm start
```

개발용 서버에서는 루트 `.env`에 `DISCORD_GUILD_ID`도 넣으세요. 명령어가 즉시 반영됩니다.

Discord Developer Portal에서 봇에 **View Channels**, **Read Message History**, **Send Messages**, **Embed Links** 권한을 주세요. 또한 **Privileged Gateway Intents → Message Content Intent**를 켜야 대화 본문을 분석할 수 있습니다. `/progress`는 실행된 채널의 최근 메시지 100개만 조회합니다.

## 첨부 대화로 API 확인

`.env` 설정 후 아래 명령으로 실제 OpenAI API 분석과 Discord 카드 미리보기를 JSON으로 확인합니다.

```bash
npm run analyze:file -- "/Users/donghwikim/과제/emptyroom_discord_conversation.json"
```

## 보안·판단 원칙

- `.env`는 Git에서 제외됩니다. 첨부된 키를 코드나 대화에 붙여넣지 마세요.
- OpenAI 요청에는 `store: false`를 사용합니다.
- 모델은 대화에서 직접 확인할 수 있는 보고만 근거로 삼고, 근거가 부족하면 `판단 보류`로 표시하도록 지시합니다.
- 제출 완료 보고 전에는 전체 100%를 표시하지 않도록 분석 규칙에 포함했습니다.

OpenAI의 [공식 Quickstart](https://developers.openai.com/api/docs/quickstart)를 따른 Responses API 호출입니다.
