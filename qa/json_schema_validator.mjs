import assert from "node:assert/strict";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  if (typeof value === "number") return "number";
  return typeof value;
}

function deepEqual(left, right) {
  try {
    assert.deepEqual(left, right);
    return true;
  } catch {
    return false;
  }
}

function resolvePointer(root, ref) {
  if (!ref.startsWith("#/")) throw new Error(`Only local JSON Schema refs are supported: ${ref}`);
  return ref.slice(2).split("/").reduce((node, part) => {
    const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!isObject(node) || !Object.hasOwn(node, key)) throw new Error(`Unresolvable schema ref: ${ref}`);
    return node[key];
  }, root);
}

function add(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function testSchema(value, schema, root, path, errors) {
  if (schema === true) return;
  if (schema === false) {
    add(errors, path, "value is forbidden by schema");
    return;
  }
  if (!isObject(schema)) throw new TypeError(`Invalid schema at ${path}`);

  if (schema.$ref) {
    testSchema(value, resolvePointer(root, schema.$ref), root, path, errors);
    return;
  }

  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    add(errors, path, `must equal ${JSON.stringify(schema.const)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => deepEqual(value, candidate))) {
    add(errors, path, `must be one of ${schema.enum.map(JSON.stringify).join(", ")}`);
  }

  if (schema.oneOf) {
    const matches = schema.oneOf.filter((branch) => {
      const branchErrors = [];
      testSchema(value, branch, root, path, branchErrors);
      return branchErrors.length === 0;
    }).length;
    if (matches !== 1) add(errors, path, `must match exactly one oneOf branch (matched ${matches})`);
  }
  for (const branch of schema.allOf ?? []) testSchema(value, branch, root, path, errors);
  if (schema.if) {
    const conditionErrors = [];
    testSchema(value, schema.if, root, path, conditionErrors);
    if (conditionErrors.length === 0 && schema.then) testSchema(value, schema.then, root, path, errors);
    if (conditionErrors.length > 0 && schema.else) testSchema(value, schema.else, root, path, errors);
  }

  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = valueType(value);
    const matches = allowed.some((expected) => expected === actual || (expected === "number" && actual === "integer"));
    if (!matches) {
      add(errors, path, `must have type ${allowed.join("|")}; received ${actual}`);
      return;
    }
  }

  if (typeof value === "string") {
    if (schema.minLength != null && value.length < schema.minLength) add(errors, path, `must have length >= ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) add(errors, path, `must match ${schema.pattern}`);
    if (schema.format === "date-time" && !Number.isFinite(Date.parse(value))) add(errors, path, "must be a date-time");
  }

  if (typeof value === "number") {
    if (schema.minimum != null && value < schema.minimum) add(errors, path, `must be >= ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) add(errors, path, `must be <= ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) add(errors, path, `must have at least ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) add(errors, path, `must have at most ${schema.maxItems} items`);
    if (schema.uniqueItems) {
      for (let index = 0; index < value.length; index += 1) {
        if (value.slice(0, index).some((item) => deepEqual(item, value[index]))) {
          add(errors, `${path}/${index}`, "must be unique");
        }
      }
    }
    if (schema.items) value.forEach((item, index) => testSchema(item, schema.items, root, `${path}/${index}`, errors));
  }

  if (isObject(value)) {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) add(errors, path, `missing required property ${key}`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) testSchema(value[key], child, root, `${path}/${key}`, errors);
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) add(errors, `${path}/${key}`, "additional property is not allowed");
      }
    }
  }
}

export function validateJsonSchema(value, schema) {
  const errors = [];
  testSchema(value, schema, schema, "$", errors);
  return errors;
}
