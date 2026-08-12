import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const [, , scenarioName, actualPath, stage = "before"] = process.argv;
if (!scenarioName || !actualPath) {
  console.log("goldset_comparison=NOT_RUN");
  console.log("usage=node qa/compare_goldset_result.mjs <scenario> <actual.json> [before|after]");
  process.exit(0);
}
assert.ok(["before", "after"].includes(stage), "stage must be before or after");

const goldsetPath = new URL("../eval/goldset.json", import.meta.url);
const manifestPath = new URL("../fixtures/manifest.json", import.meta.url);
try {
  await access(manifestPath);
} catch {
  console.log("goldset_comparison=NOT_RUN");
  console.log("reason=fixtures/manifest.json is not available yet");
  process.exit(0);
}

const [goldset, manifest, actual] = await Promise.all([
  readFile(goldsetPath, "utf8").then(JSON.parse),
  readFile(manifestPath, "utf8").then(JSON.parse),
  readFile(actualPath, "utf8").then(JSON.parse),
]);
const oracle = goldset.scenarios.find(({ name }) => name === scenarioName);
assert.ok(oracle, `unknown scenario: ${scenarioName}`);
const manifestScenario = manifest.scenarios?.[scenarioName];
assert.ok(manifestScenario, `${scenarioName}: manifest entry is missing`);
const bindings = manifestScenario.semantic_bindings ?? {};

function idFor(ref) {
  assert.equal(typeof ref, "string", `cannot bind non-string ref: ${ref}`);
  const id = bindings[ref];
  assert.equal(typeof id, "string", `${scenarioName}: binding missing for ${ref}`);
  assert.ok(id.trim(), `${scenarioName}: ${ref} has an empty binding`);
  return id;
}

function hasOwn(record, key) {
  assert.ok(Object.hasOwn(record, key), `${scenarioName}: response field ${key} is missing`);
}

function sortedStrings(value, field) {
  assert.ok(Array.isArray(value), `${scenarioName}: ${field} must be an array`);
  assert.ok(value.every((item) => typeof item === "string"), `${scenarioName}: ${field} must contain strings`);
  return [...new Set(value)].sort();
}

function compareAssignments() {
  assert.ok(Array.isArray(actual.assignments), `${scenarioName}: assignments must be an array`);
  assert.equal(actual.assignments.length, oracle.expected.assignments.length,
    `${scenarioName}: assignment count mismatch`);

  for (const expected of oracle.expected.assignments) {
    const taskId = idFor(expected.task_ref);
    const received = actual.assignments.find(({ task_id }) => task_id === taskId);
    assert.ok(received, `${scenarioName}: assignment missing for ${expected.task_ref}`);
    for (const field of [
      "task_id",
      "owner_id",
      "reason",
      "evidence_ids",
      "confidence",
      "blockers",
      "alternative_owner_id",
      "status",
    ]) hasOwn(received, field);

    assert.equal(received.owner_id, expected.owner_ref == null ? null : idFor(expected.owner_ref));
    assert.equal(received.status,
      stage === "after" ? expected.status_after_confirmation : expected.status_before_confirmation);
    assert.equal(received.confidence, expected.confidence);
    assert.equal(typeof received.reason, "string");
    assert.ok(received.reason.trim(), `${scenarioName}: reason must not be blank`);

    const expectedEvidence = expected.evidence_refs.map(idFor).sort();
    assert.deepEqual(sortedStrings(received.evidence_ids, "evidence_ids"), expectedEvidence);
    for (const blocker of expected.blockers) {
      assert.ok(sortedStrings(received.blockers, "blockers").includes(blocker),
        `${scenarioName}: expected blocker ${blocker} is missing`);
    }
    assert.equal(received.alternative_owner_id,
      expected.alternative_owner_ref == null ? null : idFor(expected.alternative_owner_ref));
  }
}

function compareProgress() {
  if (!oracle.expected.task_progress) return;
  assert.ok(Array.isArray(actual.task_progress), `${scenarioName}: task_progress must be an array`);
  for (const expected of oracle.expected.task_progress) {
    const received = actual.task_progress.find(({ task_id }) => task_id === idFor(expected.task_ref));
    assert.ok(received, `${scenarioName}: task progress missing for ${expected.task_ref}`);
    for (const field of ["task_id", "state", "percent", "evidence_ids", "blocker", "next_action"]) {
      hasOwn(received, field);
    }
    assert.equal(received.state, expected.state);
    assert.ok(Number.isFinite(received.percent), `${scenarioName}: percent must be numeric`);
    assert.ok(received.percent >= expected.percent_range.min_inclusive
      && received.percent <= expected.percent_range.max_inclusive,
    `${scenarioName}: percent is outside the expected range`);
    assert.deepEqual(sortedStrings(received.evidence_ids, "progress evidence_ids"),
      expected.evidence_refs.map(idFor).sort());
    assert.equal(typeof received.blocker, "string");
    assert.ok(received.blocker.trim(), `${scenarioName}: blocker must be visible`);
    assert.equal(typeof received.next_action, "string");
    assert.ok(received.next_action.trim(), `${scenarioName}: next_action must be visible`);
    if (expected.missing_required_files) {
      assert.deepEqual(sortedStrings(received.missing_required_files, "missing_required_files"),
        [...expected.missing_required_files].sort());
    }
  }
}

function compareArtifacts() {
  if (!oracle.expected.artifacts) return;
  assert.ok(Array.isArray(actual.artifacts), `${scenarioName}: artifacts must be an array`);
  for (const expected of oracle.expected.artifacts) {
    const received = actual.artifacts.find(({ id }) => id === idFor(expected.artifact_ref));
    assert.ok(received, `${scenarioName}: artifact missing for ${expected.artifact_ref}`);
    assert.equal(received.file_name, expected.file_name);
    assert.equal(received.validation_status, expected.validation_status);
    assert.equal(received.is_latest_by_time, expected.is_latest_by_time);
    assert.equal(received.is_latest_valid, expected.is_latest_valid);
    assert.match(received.checksum, /^sha256:[0-9a-f]{64}$/);
  }
}

compareAssignments();
compareProgress();
compareArtifacts();

console.log("goldset_comparison=PASS");
console.log(`scenario=${scenarioName}`);
console.log(`stage=${stage}`);
console.log(`fixture_version=${manifest.fixture_version}`);
