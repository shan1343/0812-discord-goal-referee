import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const goldsetPath = new URL("../eval/goldset.json", import.meta.url);
const manifestPath = new URL("../fixtures/manifest.json", import.meta.url);

try {
  await access(manifestPath);
} catch {
  console.log("fixture_binding=NOT_RUN");
  console.log("reason=fixtures/manifest.json is not available yet");
  process.exit(0);
}

const [goldset, manifest] = await Promise.all(
  [goldsetPath, manifestPath].map(async (url) => JSON.parse(await readFile(url, "utf8"))),
);

assert.equal(typeof manifest.fixture_version, "string");
assert.ok(manifest.fixture_version.trim(), "fixture_version is required");
assert.ok(manifest.scenarios && typeof manifest.scenarios === "object", "manifest.scenarios is required");

const semanticPattern = /^(goal|task|member|message|attachment|link|checkpoint|test|approval):[a-z0-9_:-]+$/;

function collectSemanticRefs(value, refs = new Set()) {
  if (typeof value === "string") {
    if (semanticPattern.test(value)) refs.add(value);
    return refs;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSemanticRefs(item, refs);
    return refs;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectSemanticRefs(item, refs);
  }
  return refs;
}

for (const scenario of goldset.scenarios) {
  const entry = manifest.scenarios[scenario.name];
  assert.ok(entry, `${scenario.name}: manifest entry is missing`);
  assert.equal(entry.fixture_path, scenario.fixture_path, `${scenario.name}: fixture path mismatch`);
  assert.ok(entry.semantic_bindings && typeof entry.semantic_bindings === "object",
    `${scenario.name}: semantic_bindings is required`);

  const concreteIds = new Set();
  for (const ref of collectSemanticRefs(scenario)) {
    assert.ok(Object.hasOwn(entry.semantic_bindings, ref), `${scenario.name}: binding missing for ${ref}`);
    const concreteId = entry.semantic_bindings[ref];
    assert.equal(typeof concreteId, "string", `${scenario.name}: ${ref} must bind to a string ID`);
    assert.ok(concreteId.trim(), `${scenario.name}: ${ref} has an empty ID`);
    assert.ok(!concreteIds.has(concreteId), `${scenario.name}: concrete ID ${concreteId} is reused`);
    concreteIds.add(concreteId);
  }
}

console.log("fixture_binding=PASS");
console.log(`fixture_version=${manifest.fixture_version}`);
console.log(`scenario_count=${goldset.scenarios.length}`);
