# 중간보고 01 — 검증 가능한 웹 MVP

## 현재 상태

- 메인 저장소 `main`에 첫 개발 버전 반영
- FastAPI API와 반응형 웹 대시보드 실행 가능
- `seed → assign → confirm → progress/files` 브라우저 클릭 검증 완료
- 자동 테스트 7개 PASS, 브라우저 콘솔 오류 0건
- GitHub Plugin으로 저장소를 조회하고 Issue #1을 실제 생성
- Browser Skill로 데스크톱·모바일 레이아웃과 사용자 흐름 검증

## 현재 제품에서 확인 가능한 것

1. 데모 fixture를 넣으면 후보 파일과 checksum이 표시된다.
2. 역할 제안은 근거, confidence, blocker와 함께 표시된다.
3. 근거 없는 역할은 owner가 미정이며 확인 버튼이 나오지 않는다.
4. 사람이 확인한 역할만 confirmed가 된다.
5. 파일이 있어도 테스트·완료 승인이 없으면 90% review_pending에서 멈춘다.

## 지금 다른 팀원이 개입하는 방법

### B — Fixture

`fixtures/conversations/*.json`을 검토한다. 실제 개인정보는 넣지 말고 메시지 ID,
시각, 작성자, 첨부파일을 유지한다. 수정이 필요하면 Issue #1에 `B fixture feedback`으로
댓글을 남기고 변경할 시나리오와 기대 결과를 적는다.

### C — Eval/Security

`eval/goldset.json`, `qa/test_matrix.md`, `security/security_checklist.md`를 검토한다.
반례를 찾으면 Issue를 만들고 입력, 기대, 실제 결과를 붙인다. 배정 오류보다
근거 없는 확정, 비허용 채널 저장, secret 노출, 증거 없는 100%를 우선 공격한다.

### D — User/Demo

처음 보는 사용자에게 다음 세 작업만 안내 없이 시킨다.

1. 도윤이 선택된 근거 찾기
2. 역할 배정 확인하기
3. 최신 파일과 누락 상태 찾기

성공 여부와 막힌 문구를 Issue #1 댓글에 남긴다. 화면 디자인 취향보다 작업 성공 여부를 우선 기록한다.

## 다음 개발 Gate

- Sites용 웹 빌드 추가 및 HTTPS 배포
- Discord interaction 어댑터 추가
- fixture/goldset 자동 평가
- 실제 Discord 테스트 서버 smoke
