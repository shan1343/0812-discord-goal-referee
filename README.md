# Discord Goal Referee

Discord 프로젝트 채널의 약속, 일정, 파일, GitHub 링크를 행동 증거로 구조화해
역할을 제안하고 진행률을 보여주는 해커톤 MVP입니다.

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

배포용 인터랙티브 웹사이트는 Next 기반이며 다음 명령으로 실행합니다.

```bash
pnpm install
pnpm dev:web
```

## Test

```bash
pytest -q
```

상세 개발 순서와 팀원이 개입하는 지점은 [README_PLAN.md](README_PLAN.md)를 참고하세요.

## Deployed website

https://discord-goal-referee-0812.sanghyun1343590633.chatgpt.site

현재 배포본은 fixture 기반 웹 데모입니다. Discord API/Bot 연동은 별도 담당자가 연결합니다.
