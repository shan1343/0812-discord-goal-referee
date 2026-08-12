# 필수 통과 조건 및 평가 증거 매트릭스 — D

판정 규칙: 실제 링크 또는 재현 가능한 저장소 증거가 없으면 `PASS`로 판정하지 않는다. 상태는 `PASS / FAIL / BLOCKED / NOT VERIFIED`만 사용한다.

## 현재 확인된 공통 증거

| 항목 | 상태 | 증거 | D 검증 메모 |
|---|---|---|---|
| 계획 commit | PASS | [333f1f8](https://github.com/shan1343/0812-discord-goal-referee/commit/333f1f8eebca2b89eba348551ff406d6ad87e55e) | README_PLAN과 구현 기준선 commit 확인 |
| GitHub Plugin 실제 작업 | PASS | [Issue #1](https://github.com/shan1343/0812-discord-goal-referee/issues/1) | 본문에 Plugin 실행 증거라고 명시됨 |
| 자동 테스트 | PASS | `pytest -q`: 7 passed, 2026-08-12 | 최신 main+D 병합 상태에서 D 재실행 |
| localhost smoke | NOT VERIFIED | main 증거표에 Browser smoke 기록 | 재현 로그·캡처 링크 필요 |
| 보안 검증 | NOT VERIFIED | `security/security_checklist.md` 존재 | 실제 pass 결과 필요 |
| 사용자 3명 검증 | NOT VERIFIED | `research/user_test_plan.md` | 실제 P1/P2/P3 세션 필요 |
| HTTPS 배포 | NOT VERIFIED | 없음 | Sites URL과 smoke 필요 |

## Gate 7개

| Gate | 통과 조건 | 필요한 증거 | 현재 증거 | 상태 | 소유자/다음 행동 |
|---|---|---|---|---|---|
| 1 Skill 실제 사용 | Codex Sites로 HTTPS 배포, 대표 입력 작동 | 실행 prompt, 결과 화면, URL, README | 없음 | NOT VERIFIED | A: Sites 배포 후 D에 URL/캡처 전달 |
| 2 Plugin 실제 사용 | GitHub Plugin으로 repo/Issue 조회·갱신 | 실행 화면/로그, repo·Issue URL, 변경 결과 | Issue #1과 실행 설명 확인 | PASS | A/D: 최종 발표 증거에 Issue URL 연결 |
| 3 충분한 계획 | 개발 전 README_PLAN과 팀 확인 | commit URL/시각, 승인 기록 | README_PLAN 및 commit 333f1f8 확인 | PASS | 전원: 최종 범위 변경 시 승인 기록 유지 |
| 4 전원 참여 | A/B/C/D 고유 산출물·2개 이상 참여 | artifact/Issue/결정/발표 링크 | A/B/C 구현과 D 문서 존재; 개인별 참여 링크 미완성 | NOT VERIFIED | 전원: 각 artifact·결정·발표 링크 제출 |
| 5 작동 Demo 15:30 | 핵심 end-to-end와 freeze/smoke | 영상, Discord 링크, smoke 기록 | localhost smoke 기록만 있고 영상·Discord 링크 없음 | NOT VERIFIED | A/B/C/D: 최신 빌드 smoke·촬영 |
| 6 안전과 보안 | secret scan, 최소권한, 동의/삭제/확인 | checklist, fail/pass 캡처, env 검사 | checklist와 `.env.example` 존재; 실행 결과 없음 | NOT VERIFIED | C/A: secret scan 및 위험 행동 검사 결과 전달 |
| 7 웹사이트 결과물 | HTTPS·모바일·대표 입력 안정 | URL, 모바일 캡처, smoke 결과 | 없음 | NOT VERIFIED | A: 배포 후 D 검증 |

## 평가 영역 7개

| 영역 | 목표 증거 | 현재 증거 | 상태 | D 확인 항목 |
|---|---|---|---|---|
| 문제 정의·사용자 가치 20 | 사용자 3명, 수정 시간, 근거 찾기 성공률 | `research/user_test_plan.md`; 실제 결과 없음 | NOT VERIFIED | 실제 3세션 후 수치 집계 |
| 작동 프로토타입 20 | 대표 입력 5개, Hero Demo, fallback, URL | fixture 5개와 localhost 구현 존재; 영상·배포 없음 | NOT VERIFIED | 영상과 URL smoke 연결 |
| AI Skill·Plugin 15 | AI 결과, Sites, GitHub Plugin 실제 사용 | GitHub Plugin Issue #1 확인; Sites 없음 | NOT VERIFIED | Sites 실행 증거 추가 |
| 계획·범위 15 | Discord 단일 채널, README, freeze | README_PLAN과 계획 commit 확인 | PASS | 최종 freeze 시각·승인 기록 추가 |
| 협업·참여 15 | 4명 고유 산출물·prompt/test/decision/presentation | A/B/C/D 산출물 경로 존재; 참여 링크 미완성 | NOT VERIFIED | 팀별 링크 수집 |
| 테스트·개선 10 | gold 5개, fail→fix→retest 3건 | fixture/goldset 존재; 3건 개선 링크 없음 | NOT VERIFIED | C의 Issue/commit/retest 확인 |
| 데모·커뮤니케이션 5 | 5분 이하, 3회 리허설 | run-of-show만 존재 | NOT VERIFIED | 실제 3회 시간·영상 기록 |

## D 최종 서명

- 최종 검토 시각: PENDING
- 미해결 P0/P1: PENDING
- 데모 URL: PENDING
- 백업 영상: PENDING
- D 판정: **NOT VERIFIED**
- D 확인자: PENDING
