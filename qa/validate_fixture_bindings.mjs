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
assert.ok(manifest.scenarios && typeof manifest.scenarios === "object", "manifest.scenarios is required");

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
    for (const item of Object.values(value)) collectSemanticRefs(item, refs);
  }
  return refs;
}

for (const scenario of goldset.scenarios) {
  const entry = manifest.scenarios[scenario.name];
  assert.ok(entry, `${scenario.name}: manifest entry is missing`);
  assert.equal(entry.fixture_path, scenario.fixture_path, `${scenario.name}: fixture path mismatch`);
  assert.equal(entry.fixture_version, manifest.fixture_version, `${scenario.name}: fixture_version mismatch`);
  assert.equal(typeof entry.author, "string", `${scenario.name}: author is required`);
  assert.ok(entry.author.trim(), `${scenario.name}: author must not be blank`);
  assert.equal(typeof entry.reviewer, "string", `${scenario.name}: reviewer is required`);
  assert.ok(entry.reviewer.trim(), `${scenario.name}: reviewer must not be blank`);
  assert.ok(entry.semantic_bindings && typeof entry.semantic_bindings === "object",
    `${scenario.name}: semantic_bindings is required`);

  const fixtureUrl = new URL(`../${scenario.fixture_path}`, import.meta.url);
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  function resolveJsonPointer(root, pointer) {
    assert.equal(typeof pointer, "string", `${scenario.name}: json_pointer must be a string`);
    assert.ok(pointer === "" || pointer.startsWith("/"), `${scenario.name}: invalid JSON pointer ${pointer}`);
    return pointer === "" ? root : pointer.slice(1).split("/").reduce((node, part) => {
      const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
      assert.ok(node != null && Object.hasOwn(node, key), `${scenario.name}: JSON pointer not found ${pointer}`);
      return node[key];
    }, root);
  }

  const concreteIds = new Set();
  for (const ref of collectSemanticRefs(scenario)) {
    assert.ok(Object.hasOwn(entry.semantic_bindings, ref), `${scenario.name}: binding missing for ${ref}`);
    const binding = entry.semantic_bindings[ref];
    assert.ok(binding && typeof binding === "object", `${scenario.name}: ${ref} binding must be an object`);
    const { id: concreteId, kind, json_pointer: pointer } = binding;
    assert.equal(typeof concreteId, "string", `${scenario.name}: ${ref} must bind to a string ID`);
    assert.ok(concreteId.trim(), `${scenario.name}: ${ref} has an empty ID`);
    assert.ok(!concreteIds.has(concreteId), `${scenario.name}: concrete ID ${concreteId} is reused`);
    const expectedKind = ref.split(":", 1)[0];
    assert.equal(kind, expectedKind, `${scenario.name}: ${ref} kind mismatch`);
    const target = resolveJsonPointer(fixture, pointer);
    assert.ok(target && typeof target === "object", `${scenario.name}: ${ref} pointer does not resolve to an object`);
    assert.equal(target.id, concreteId, `${scenario.name}: ${ref} ID does not match pointed object`);
    concreteIds.add(concreteId);
  }
}

assert.equal(goldset.status, "bound", "goldset status must be bound once a B manifest exists");
assert.equal(goldset.fixture_version, manifest.fixture_version,
  "goldset fixture_version must equal the B manifest version");

console.log("fixture_binding=PASS");
console.log(`fixture_version=${manifest.fixture_version}`);
console.log(`scenario_count=${goldset.scenarios.length}`);
