import test from "node:test";
import assert from "node:assert/strict";
import { rolesDashboardContent } from "../src/dashboard.js";
import { rolesSchema } from "../src/roles.js";

test("roles dashboard labels every assignment as a proposal with evidence", () => {
  const content = rolesDashboardContent({
    project_goal: "빈 강의실 MVP",
    scope: "검색만 제공",
    assignments: [{
      person: "수빈",
      suggested_role: "프론트엔드",
      tasks: ["검색 화면 구현"],
      deadline: "수요일 밤",
      reason: "React 경험",
      evidence_ids: ["17", "43"],
      status: "proposal"
    }],
    risks: ["최종 제출 담당 미정"]
  });
  assert.match(content.title, /역할 분담 제안/);
  assert.match(content.fields[1].value, /제안 상태/);
  assert.match(content.fields[1].value, /17, 43/);
});

test("roles schema only permits proposal status", () => {
  assert.deepEqual(rolesSchema.properties.assignments.items.properties.status.enum, ["proposal"]);
});
