# Security checklist

- [ ] `.env`와 실제 secret이 Git에서 추적되지 않는다.
- [ ] `/api/health`, 오류, 로그에 secret 값이 없다.
- [ ] Discord 수집은 `ALLOWED_CHANNEL_IDS`로 제한된다.
- [ ] 최소 권한과 MESSAGE_CONTENT intent 조건을 Discord 설정에서 확인했다.
- [ ] 배정·재배정·삭제·완료 확정은 사람 확인을 요구한다.
- [ ] 근거가 없는 담당자는 `owner=null`, `needs_input`으로 남는다.
- [ ] `/forget` 구현 전에는 원문 삭제 기능을 제공하지 않는다.
- [ ] 실제 개인정보가 없는 fixture만 사용한다.
