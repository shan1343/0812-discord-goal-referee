# Discord Goal Referee 개발 계획

## 목표

대표 fixture를 `seed → assign → human confirm → progress/files → dashboard`로 통과시키는
하나의 닫힌 데모 경로를 만든다. Discord 실연동과 AI 호출이 실패해도 같은 fixture로
데모가 계속되어야 한다.

## 범위

포함: 허용 채널, 역할 제안, 근거 추적, 사람 확인, 체크포인트 기반 진행률,
파일 버전/누락 표시, 반응형 웹 대시보드.

제외: 카카오톡, Slack, DM 수집, 음성 전사, 개인 성향/기여도 점수화,
사람 승인 없는 재배정·삭제·완료 확정.

## 구현 순서와 중간 개입

1. A(개발자): API, 대시보드, 데이터 계약과 보안 기본값을 구현한다.
2. B(Fixture): `fixtures/conversations`의 예시를 실제 팀 대화처럼 확장하고 파일 manifest를 검수한다.
3. C(Eval/Security): `eval/goldset.json`을 기준으로 오답을 재현해 Issue를 만들고 보안 체크리스트를 판정한다.
4. D(User/Demo): 대시보드를 처음 보는 사용자 3명에게 배정 이유 찾기, 재배정, 최신 파일 찾기를 수행하게 한다.
5. A: Issue를 수정하고 테스트를 재실행한다. C가 fail→fix→retest를 닫고 D가 데모 동선을 확정한다.

## Done State

- `/api/demo/seed`, `/api/assign`, `/api/confirm`, `/api/progress/{id}`, `/api/files/{id}`가 작동한다.
- 배정 카드에 owner, reason, evidence, confidence, blocker, alternative가 표시된다.
- 근거가 없으면 owner는 null이고 상태는 needs_input이다.
- 필수 파일 또는 사람 승인이 없으면 100%가 되지 않는다.
- `/api/health`는 서비스 상태만 반환하며 token/key 값을 반환하지 않는다.
- 자동 테스트, secret 검사, localhost smoke test가 통과한다.

## Release gates

1. 계획과 데이터 계약 동결
2. 대표 경로 자동 테스트 PASS
3. 5개 fixture와 goldset PASS
4. 보안·사람 확인 시나리오 PASS
5. localhost와 배포 URL smoke PASS
6. `v0.1.0` release tag와 증거 링크 정리
