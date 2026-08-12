import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const goldsetPath = new URL("../eval/goldset.json", import.meta.url);
const manifestPath = new URL("../fixtures/manifest.json", import.meta.url);

try {
  await access(manifestPath);
} catch {
  console.log("fixture_binding=NOT_RUN");
  console.log("reason=fixtures/manifest.json is not available yet");
  process.exit(2);
}

const [goldset, manifest] = await Promise.all(
  [goldsetPath, manifestPath].map(async (url) => JSON.parse(await readFile(url, "utf8"))),
);

assert.equal(typeof manifest.fixture_version, "string");
assert.ok(manifest.fixture_version.trim(), "fixture_version is required");
assert.equal(typeof manifest.author, "string", "manifest author is required");
assert.ok(manifest.author.trim(), "manifest author must not be blank");
assert.equal(typeof manifest.reviewer, "string", "manifest reviewer is required");
assert.ok(manifest.reviewer.trim(), "manifest reviewer must not be blank");
assert.ok(Array.isArray(manifest.scenarios), "manifest.scenarios must be an array");

const manifestScenarios = new Map(manifest.scenarios.map((entry) => [entry.id, entry]));
assert.equal(manifestScenarios.size, manifest.scenarios.length, "manifest scenario IDs must be unique");

const semanticPattern = /^(goal|task|member|message|attachment|link|checkpoint|test|approval):[a-z0-9_:-]+$/;

function collectSemanticRefs(value, refs = new Set()) {
  if (typeof value === "string") {
    const embeddedPattern = /(goal|task|member|message|attachment|link|checkpoint|test|approval):[a-z0-9_:-]+/g;
    for (const match of value.matchAll(embeddedPattern)) refs.add(match[0]);
    return refs;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSemanticRefs(item, refs);
    return refs;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key !== "bindings") collectSemanticRefs(item, refs);
    }
  }
  return refs;
}

function resolveJsonPointer(root, pointer, scenarioName) {
  assert.equal(typeof pointer, "string", `${scenarioName}: json_pointer must be a string`);
  assert.ok(pointer === "" || pointer.startsWith("/"), `${scenarioName}: invalid JSON pointer ${pointer}`);
  return pointer === "" ? root : pointer.slice(1).split("/").reduce((node, part) => {
    const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
    assert.ok(node != null && Object.hasOwn(node, key), `${scenarioName}: JSON pointer not found ${pointer}`);
    return node[key];
  }, root);
}

const fixtureVersions = new Map();
let bindingCount = 0;
for (const scenario of goldset.scenarios) {
  const entry = manifestScenarios.get(scenario.name);
  assert.ok(entry, `${scenario.name}: manifest entry is missing`);
  assert.equal(entry.path, scenario.fixture_path, `${scenario.name}: fixture path mismatch`);
  assert.equal(typeof entry.expected, "string", `${scenario.name}: expected summary is required`);
  assert.ok(entry.expected.trim(), `${scenario.name}: expected summary must not be blank`);

  const fixtureUrl = new URL(`../${scenario.fixture_path}`, import.meta.url);
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  assert.equal(fixture.scenario, scenario.name, `${scenario.name}: fixture scenario mismatch`);
  assert.equal(typeof fixture.fixture_version, "string", `${scenario.name}: fixture_version is required`);
  assert.ok(fixture.fixture_version.trim(), `${scenario.name}: fixture_version must not be blank`);
  fixtureVersions.set(scenario.name, fixture.fixture_version);
  assert.ok(Array.isArray(fixture.messages), `${scenario.name}: messages must be an array`);
  assert.equal(new Set(fixture.messages.map(({ id }) => id)).size, fixture.messages.length,
    `${scenario.name}: message IDs must be unique`);

  assert.equal(scenario.binding_status, "bound", `${scenario.name}: binding_status must be bound`);
  assert.ok(scenario.bindings && typeof scenario.bindings === "object", `${scenario.name}: bindings are required`);
  for (const ref of collectSemanticRefs(scenario)) {
    assert.ok(semanticPattern.test(ref), `${scenario.name}: invalid semantic ref ${ref}`);
    assert.ok(Object.hasOwn(scenario.bindings, ref), `${scenario.name}: binding missing for ${ref}`);
  }

  const stableIds = new Set();
  for (const [ref, binding] of Object.entries(scenario.bindings)) {
    assert.ok(semanticPattern.test(ref), `${scenario.name}: invalid binding ref ${ref}`);
    assert.equal(binding.kind, ref.split(":", 1)[0], `${scenario.name}: ${ref} kind mismatch`);
    assert.ok(!stableIds.has(binding.id), `${scenario.name}: stable ID ${binding.id} is reused`);
    stableIds.add(binding.id);
    const root = binding.source === "fixture" ? fixture : manifest;
    const actualValue = resolveJsonPointer(root, binding.json_pointer, scenario.name);
    assert.deepEqual(actualValue, binding.expected_value,
      `${scenario.name}: ${ref} expected_value does not match ${binding.source}${binding.json_pointer}`);
    bindingCount += 1;
  }
}

assert.equal(goldset.status, "bound", "goldset status must be bound once all C bindings pass");
assert.equal(goldset.fixture_version, manifest.fixture_version,
  "goldset fixture_version must equal the B collection manifest version");

console.log("fixture_binding=PASS");
console.log(`fixture_collection_version=${manifest.fixture_version}`);
console.log(`scenario_count=${goldset.scenarios.length}`);
console.log(`binding_count=${bindingCount}`);
console.log(`fixture_versions=${[...fixtureVersions].map(([name, version]) => `${name}:${version}`).join(",")}`);
