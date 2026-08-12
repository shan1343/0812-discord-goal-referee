"""C-owned, non-mutating red-team probes for A's in-memory demo services.

Exit 0 means all security/assignment invariants pass. A failure prints only
boolean/count observations and never fixture content or secret values.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import confirm_assignment, propose_assignments, seed_demo  # noqa: E402
from app.store import DemoStore  # noqa: E402


def check(name: str, condition: bool, actual: str) -> None:
    if condition:
        print(f"{name}=PASS")
        return
    print(f"{name}=FAIL actual={actual}")
    failures.append(name)


failures: list[str] = []

# FAIL-RUNTIME-001: an owner is not itself evidence.
store = DemoStore()
seed_demo(store)
propose_assignments(store)
store.assignments["assignment-a"].evidence = []
evidence_rejected = False
try:
    confirm_assignment(store, "assignment-a", "probe-actor")
except ValueError:
    evidence_rejected = True
check("C_ASGN_01_EMPTY_EVIDENCE_REJECTED", evidence_rejected, str(evidence_rejected).lower())

# FAIL-RUNTIME-002: a human-confirmed owner is a lock, not another suggestion.
store = DemoStore()
seed_demo(store)
propose_assignments(store)
locked = store.assignments["assignment-a"]
locked.owner = "human-selected-owner"
locked.owner_id = "human-selected-owner-id"
locked.status = "confirmed"
propose_assignments(store)
owner_preserved = (
    store.assignments["assignment-a"].owner == "human-selected-owner"
    and store.assignments["assignment-a"].owner_id == "human-selected-owner-id"
    and store.assignments["assignment-a"].status == "confirmed"
)
check("C_ASGN_02_LOCKED_OWNER_PRESERVED", owner_preserved, str(owner_preserved).lower())

# FAIL-RUNTIME-003 / issue #7: a hard deadline conflict cannot be a normal owner proposal.
store = DemoStore()
seed_demo(store)
propose_assignments(store)
conflicted = store.assignments["assignment-c"]
deadline_candidate_excluded = conflicted.owner is None and conflicted.status == "needs_input"
check(
    "C_ASGN_03_DEADLINE_CONFLICT_EXCLUDED",
    deadline_candidate_excluded,
    f"owner_is_null={str(conflicted.owner is None).lower()},status={conflicted.status}",
)

# FAIL-RUNTIME-004 / issue #6: replay must not create a second side effect.
store = DemoStore()
seed_demo(store)
propose_assignments(store)
confirm_assignment(store, "assignment-a", "body-controlled-actor")
first_count = sum(item["action"] == "assignment_confirmed" for item in store.audit_log)
replay_rejected = False
try:
    confirm_assignment(store, "assignment-a", "body-controlled-actor")
except ValueError:
    replay_rejected = True
second_count = sum(item["action"] == "assignment_confirmed" for item in store.audit_log)
check(
    "SEC_REPLAY_01_CONFIRMATION_ONE_SHOT",
    replay_rejected and first_count == second_count == 1,
    f"replay_rejected={str(replay_rejected).lower()},audit_count={second_count}",
)

print(f"runtime_red_team_failures={len(failures)}")
raise SystemExit(1 if failures else 0)
