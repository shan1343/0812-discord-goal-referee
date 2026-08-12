import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const goldsetPath = new URL("../eval/goldset.json", import.meta.url);
const schemaPath = new URL("../eval/goldset.schema.json", import.meta.url);

const [goldset, schema] = await Promise.all(
  [goldsetPath, schemaPath].map(async (url) => JSON.parse(await readFile(url, "utf8"))),
);

assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(goldset.schema_version, "1.0.0");
assert.equal(goldset.spec_version, "Discord Goal Referee v3");
assert.equal(goldset.maintainer_role, "C");
assert.ok(Number.isFinite(Date.parse(goldset.created_at)), "created_at must be an RFC 3339 datetime");
assert.ok(["draft_pending_fixture_binding", "bound"].includes(goldset.status));
assert.ok(goldset.binding_contract && typeof goldset.binding_contract === "object");
assert.ok(goldset.required_output_fields && typeof goldset.required_output_fields === "object");

const expectedScenarios = [
  "completion_without_file",
  "deadline_conflict",
  "happy_path",
  "missing_evidence",
  "version_conflict",
];
assert.deepEqual([...new Set(goldset.scenarios.map(({ name }) => name))].sort(), expectedScenarios);
assert.equal(new Set(goldset.scenarios.map(({ id }) => id)).size, 5);
assert.equal(new Set(goldset.global_expectations.map(({ id }) => id)).size, goldset.global_expectations.length);

for (const scenario of goldset.scenarios) {
  assert.equal(scenario.fixture_path, `fixtures/conversations/${scenario.name}.json`);
  for (const assignment of scenario.expected.assignments) {
    assert.equal(assignment.reason_required, true);
    assert.ok(Array.isArray(assignment.blockers), `${scenario.name}: blockers must be an array`);
    assert.ok(Object.hasOwn(assignment, "alternative_owner_ref"), `${scenario.name}: alternative owner field missing`);
    if (assignment.reason_must_reference_evidence_or_user_input) {
      assert.ok(assignment.evidence_refs.length > 0, `${scenario.name}: reason has no expected evidence`);
    }
    if (assignment.owner_ref == null) {
      assert.equal(assignment.status_before_confirmation, "needs_input");
      assert.equal(assignment.status_after_confirmation, "needs_input");
    }
  }
}

const completion = goldset.scenarios.find(({ name }) => name === "completion_without_file");
assert.deepEqual(completion.expected.task_progress[0].percent_range, {
  min_inclusive: 80,
  max_inclusive: 99,
});
assert.deepEqual(completion.expected.task_progress[0].missing_required_files, ["deliverable.zip"]);

const conflict = goldset.scenarios.find(({ name }) => name === "deadline_conflict");
assert.ok(conflict.expected.assignments[0].blockers.includes("deadline_availability_conflict"));

console.log("goldset_oracle=PASS");
console.log(`scenario_count=${goldset.scenarios.length}`);
console.log(`assignment_count=${goldset.scenarios.flatMap(({ expected }) => expected.assignments).length}`);
console.log(`global_expectations=${goldset.global_expectations.length}`);
