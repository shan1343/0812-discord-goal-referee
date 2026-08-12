# 5분 발표 Run of Show — D

목표 총시간: 4분 45초, 최대 5분. 전환 여유 15초를 남긴다.

| 구간 | 누적 | 담당 | 화면 | 핵심 멘트 |
|---|---:|---|---|---|
| 문제 | 00:00–00:30 | D | Discord 대화/파일이 흩어진 화면 | “4인 프로젝트 팀은 역할, 마감, 최신 파일을 매번 수동으로 정리합니다.” |
| 사용자 가치 | 00:30–01:00 | D | 역할 카드와 진행률 | “누가 많이 말했는지가 아니라 약속, 완료조건, 파일과 테스트 근거로 판단합니다.” |
| AI·Skill·Plugin | 01:00–01:45 | A/D | 구조화 결과, GitHub 작업 증거, HTTPS 사이트 | “AI는 후보와 이유를 만들고, GitHub Plugin은 실제 작업 흐름을 연결하며, Codex Sites는 심사용 HTTPS 결과물을 제공합니다.” |
| 작동 데모 | 01:45–03:45 | D 조작, A 보조 | Discord→역할 카드→reassign→progress/files→confirm→웹 | `demo/demo_script.txt` 흐름을 확장해 2분 내 수행한다. |
| 테스트·보안 | 03:45–04:30 | C/D | goldset, 사용자 결과, confirmation | “근거 없는 owner, 마감 충돌, 완료 선언만 있는 경우와 비밀정보·권한을 검증했습니다.” 실제 PASS 수치만 말한다. |
| 결과·확장 | 04:30–05:00 | D | 배포 URL, 한 문장 요약 | “AI는 제안하고 사람은 확정합니다. 다음 단계는 선택적 연동 확대입니다.” |

## 발표자 큐시트

- D 시작: 문제→사용자 가치→데모 맥락을 끊지 않고 연결한다.
- A: 기술 구조, GitHub Plugin 실제 사용, 배포/rollback을 45초 내 설명한다.
- B: fixture가 실제 개인정보 없는 대표 상황 5개임을 설명한다.
- C: 실패→수정→재시험과 human confirmation 결과를 실제 수치로 설명한다.
- D 종료: 사용자 3명 결과와 남은 한계를 과장 없이 말한다.

## 3회 리허설 기록

| 회차 | 날짜/시각 | 전체 시간 | 데모 시간 | 막힌 구간 | 수정 | 증거 링크 | 판정 |
|---|---|---:|---:|---|---|---|---|
| 1 | PENDING | NOT RUN | NOT RUN | PENDING | PENDING | PENDING | NOT VERIFIED |
| 2 | PENDING | NOT RUN | NOT RUN | PENDING | PENDING | PENDING | NOT VERIFIED |
| 3 | PENDING | NOT RUN | NOT RUN | PENDING | PENDING | PENDING | NOT VERIFIED |

## 리허설 합격 기준

- 세 회 모두 5분 이하이며 최종 회차는 4분 45초 이하 권장.
- seed→assign→reassign→progress/files→human confirm→HTTPS URL 장면을 빠뜨리지 않는다.
- 실패가 나면 백업 영상으로 전환하는 데 10초를 넘기지 않는다.
- 실제로 확보하지 않은 사용자 수치, 테스트 PASS, 배포 성공을 말하지 않는다.
