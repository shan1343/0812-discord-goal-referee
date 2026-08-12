# Test matrix

| ID | 입력 | 기대 결과 | 실제 | 판정 | Issue |
|---|---|---|---|---|---|
| T01 | happy path seed | 역할 후보와 근거 생성 | 역할 4건, 근거·confidence 표시 | PASS | automated test + browser E2E |
| T02 | missing evidence | owner=null, needs_input | owner=null, needs_input | PASS | `tests/test_api.py` |
| T03 | deadline conflict | blocker 표시 | blocked 35%, 14:00 수업 표시 | PASS | browser E2E |
| T04 | completion without file | 100% 금지 | 확인 후에도 review_pending 90% | PASS | `tests/test_api.py` |
| T05 | unauthorized project/channel | 403/404, 데이터 미노출 | 403/404 | PASS | `tests/test_api.py` |
| T06 | 재분석 | 확인된 배정 유지 | confirmed 유지 | PASS | `tests/test_api.py` |
| T07 | 새 제약 | proposed로 복귀 후 사람 재확인 | proposed + blocker | PASS | `tests/test_api.py` |
