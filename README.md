# Discord Goal Referee

Discord 프로젝트 대화에서 목표, 역할, 일정, 파일과 제약을 근거가 연결된 실행 계획으로 변환하고 웹에서 공유하는 서비스입니다. 메시지 수로 사람을 평가하지 않으며 AI 배정은 항상 제안 상태로 남겨 사람이 확인합니다.

## 구성

- `app/`: FastAPI 프로젝트 API와 역할 분석
- `pages/`, `styles/`: Next.js 웹 대시보드
- `discord-progress-bot/`: 현재 main의 진행률·역할 제안 봇
- `discord-bot/`: 프로젝트·작업·증거·파일·Goal Referee 통합 봇
- `fixtures/`, `eval/`, `qa/`, `tests/`: 고정 시나리오와 QA·보안 검증

## API 실행

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

API 문서는 `http://localhost:8000/docs`에서 확인합니다.

## 웹 실행

```powershell
pnpm install
pnpm dev:web
```

## Discord 봇 실행

루트 `.env`에 Discord와 OpenAI 설정을 입력하고 Discord Developer Portal에서 Message Content Intent를 활성화합니다.

```powershell
npm install --prefix discord-bot
npm --prefix discord-bot run register
npm --prefix discord-bot start
```

## 검증

```powershell
pytest -q
npm --prefix discord-bot test
npm --prefix discord-progress-bot test
pnpm build
```

Discord 입력 계약은 [docs/DISCORD_INPUT.md](docs/DISCORD_INPUT.md)를 참고하세요.

## 배포 사이트

https://discord-goal-referee-0812.sanghyun1343590633.chatgpt.site

최종 목표는 Discord 분석 결과를 저장 API로 전달하고 이 사이트가 같은 결과를 조회하도록 구성하는 것입니다.
