# D의 Demo Prompt

아래 프롬프트는 데모 fixture/AI 결과 검증에 사용한다.

> 허용된 Discord 프로젝트 채널의 최근 메시지, 명시적으로 인용된 메시지, 첨부파일·GitHub 링크만 사용해 Goal, Task, Owner 후보, Deadline, Evidence, Constraint, Decision을 구조화하라. 각 Assignment는 owner 또는 null, reason, evidence_ids, confidence, blockers, alternative_owner_id, status를 포함한다. 근거가 없으면 owner=null과 needs_input을 반환한다. 메시지 수·길이·말투·이모지는 기여도나 진행률 근거로 쓰지 않는다. 마감과 가용시간 충돌은 후보 제외 또는 blocker로 표시한다. 완료 선언만 있고 필수 파일·테스트·승인이 없으면 100%로 만들지 않는다. 역할 배정·재배정·완료·삭제·외부 전송은 제안으로만 표시하고 사람 확인 전에는 확정하지 않는다. 결과에는 각 판단을 데모에서 1문장으로 설명할 수 있는 change_reason/next_action을 포함하라.

## 데모 출력 검수

- 카드 한 장에서 owner/reason/evidence/confidence/alternative를 9초 안에 읽을 수 있는가?
- constraint 추가 전후 차이가 즉시 보이는가?
- progress/files 화면에서 누락과 최신본을 6초 안에 찾을 수 있는가?
- Confirm 전후 상태가 색상 외 텍스트로도 구분되는가?
- fallback이면 실제 AI 결과처럼 위장하지 않고 명확한 배지가 보이는가?
