# 제출 증거 캡처 체크리스트 — D

## 폴더 규칙

```text
evidence/
  demo/hero_demo_45s.mp4
  rehearsals/run_1.mp4, run_2.mp4, run_3.mp4
  screenshots/01_discord_goal.png ... 05_confirm_https.png
  user-tests/P1/, P2/, P3/
  links.md
  pass_matrix.md
```

## 캡처 전에 가릴 것

- Discord bot token, API key, `.env`, 개인 DM, 서버 초대 링크
- 실제 이름·전화번호·학교 ID·이메일·브라우저 프로필
- 허용되지 않은 채널 이름과 메시지

## 반드시 보이는 것

- Discord 테스트 서버와 allowlist 대상 `#project-room`
- `/seed_demo`, `/assign`, `/reassign`, `/progress`, `/files`, human confirm
- owner/reason/evidence/confidence/blocker/alternative
- 최신 파일, 누락 파일, checksum, review_pending
- GitHub Plugin의 실제 조회/변경 결과와 URL
- Codex Sites 실행 결과, HTTPS URL, 모바일 화면
- localhost와 배포 URL의 `/api/health` 또는 이에 준하는 상태 확인

## `evidence/links.md` 작성 형식

각 링크에 `무엇을 증명하는지`, `촬영/확인 시각`, `확인자`를 함께 쓴다. 로컬 파일 경로만으로 외부 심사 링크를 대체하지 않는다.
