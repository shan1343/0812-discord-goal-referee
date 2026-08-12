import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { assertSnowflakeString, nowIso } from "../contracts.js";

const FILE_VERSION = 1;
let temporaryFileSequence = 0;

function assertProjectKey(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("projectKey must be a non-empty string");
  }
  return value.trim();
}

function jsonClone(value, name = "value") {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new TypeError(`${name} must be JSON-serializable`, { cause: error });
  }
  if (serialized === undefined) {
    throw new TypeError(`${name} must be JSON-serializable`);
  }
  return JSON.parse(serialized);
}

function assertProject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("project must be an object");
  }
}

function evidenceMessageId(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new TypeError("evidence must be an object");
  }

  const direct =
    evidence.messageId ??
    evidence.message_id ??
    evidence.discordMessageId ??
    evidence.metadata?.message_id;
  if (direct != null) return direct;

  if (typeof evidence.source === "string") {
    const match = /^discord-message#[^/\r\n]+\/(\d+)$/.exec(evidence.source);
    if (match) return match[1];
  }

  if (typeof evidence.id === "string" && /^\d+$/.test(evidence.id)) {
    return evidence.id;
  }
  throw new TypeError("evidence must identify a Discord message");
}

function parseStoreFile(text, filePath) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Project store is not valid JSON: ${filePath}`, { cause: error });
  }

  if (
    !parsed ||
    parsed.version !== FILE_VERSION ||
    !parsed.projects ||
    typeof parsed.projects !== "object" ||
    Array.isArray(parsed.projects)
  ) {
    throw new Error(`Project store has an unsupported format: ${filePath}`);
  }

  const projects = new Map();
  for (const [key, project] of Object.entries(parsed.projects)) {
    assertProject(project);
    projects.set(assertProjectKey(key), jsonClone(project, `project ${key}`));
  }
  return projects;
}

/** A small JSON-backed project store with serialized, atomic mutations. */
export class ProjectStore {
  constructor({ filePath = ":memory:", clock = () => new Date() } = {}) {
    if (typeof filePath !== "string" || !filePath) {
      throw new TypeError("filePath must be a non-empty string");
    }
    if (typeof clock !== "function") throw new TypeError("clock must be a function");

    this.filePath = filePath === ":memory:" ? filePath : resolve(filePath);
    this.clock = clock;
    this.projects = new Map();
    this.initialized = false;
    this.initPromise = null;
    this.mutationTail = Promise.resolve();
  }

  async init() {
    if (this.initialized) return this;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.#initialize();
    try {
      await this.initPromise;
      this.initialized = true;
      return this;
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }

  async #initialize() {
    if (this.filePath === ":memory:") return;

    try {
      const text = await readFile(this.filePath, "utf8");
      this.projects = parseStoreFile(text, this.filePath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await this.#persist();
    }
  }

  async get(projectKey) {
    const key = assertProjectKey(projectKey);
    await this.init();
    await this.mutationTail;
    const project = this.projects.get(key);
    return project === undefined ? null : jsonClone(project, "project");
  }

  async put(projectKey, project) {
    const key = assertProjectKey(projectKey);
    assertProject(project);
    const input = jsonClone(project, "project");
    await this.init();

    return this.#mutate(async () => {
      const timestamp = nowIso(this.clock);
      const existing = this.projects.get(key);
      const stored = {
        ...input,
        projectKey: key,
        createdAt: existing?.createdAt ?? input.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      const projects = new Map(this.projects).set(key, stored);
      await this.#persist(projects);
      this.projects = projects;
      return jsonClone(stored, "project");
    });
  }

  async create(projectKey, project) {
    const key = assertProjectKey(projectKey);
    assertProject(project);
    const input = jsonClone(project, "project");
    await this.init();
    return this.#mutate(async () => {
      if (this.projects.has(key)) throw new Error(`Project already exists: ${key}`);
      const timestamp = nowIso(this.clock);
      const stored = {
        ...input,
        projectKey: key,
        createdAt: input.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      const projects = new Map(this.projects).set(key, stored);
      await this.#persist(projects);
      this.projects = projects;
      return jsonClone(stored, "project");
    });
  }

  async update(projectKey, changes) {
    const key = assertProjectKey(projectKey);
    if (typeof changes !== "function" && (!changes || typeof changes !== "object" || Array.isArray(changes))) {
      throw new TypeError("changes must be an object or updater function");
    }
    await this.init();

    return this.#mutate(async () => {
      const current = this.projects.get(key);
      if (!current) throw new Error(`Project not found: ${key}`);

      const draft = jsonClone(current, "project");
      const result =
        typeof changes === "function"
          ? await changes(draft)
          : { ...draft, ...jsonClone(changes, "changes") };
      const candidate = result === undefined ? draft : result;
      assertProject(candidate);
      const clean = jsonClone(candidate, "project");
      const stored = {
        ...clean,
        projectKey: key,
        createdAt: current.createdAt,
        updatedAt: nowIso(this.clock),
      };
      const projects = new Map(this.projects).set(key, stored);
      await this.#persist(projects);
      this.projects = projects;
      return jsonClone(stored, "project");
    });
  }

  async delete(projectKey) {
    const key = assertProjectKey(projectKey);
    await this.init();

    return this.#mutate(async () => {
      if (!this.projects.has(key)) return false;
      const projects = new Map(this.projects);
      projects.delete(key);
      await this.#persist(projects);
      this.projects = projects;
      return true;
    });
  }

  async addEvidence(projectKey, evidence) {
    const key = assertProjectKey(projectKey);
    const cleanEvidence = jsonClone(evidence, "evidence");
    const messageId = evidenceMessageId(cleanEvidence);
    assertSnowflakeString(messageId, "evidence Discord message ID");
    await this.init();

    return this.#mutate(async () => {
      const current = this.projects.get(key);
      if (!current) throw new Error(`Project not found: ${key}`);

      const evidenceList = Array.isArray(current.evidence) ? current.evidence : [];
      const duplicate = evidenceList.some((item) => {
        try {
          return evidenceMessageId(item) === messageId;
        } catch {
          return false;
        }
      });
      if (duplicate) return jsonClone(current, "project");

      const stored = {
        ...current,
        evidence: [...evidenceList, cleanEvidence],
        updatedAt: nowIso(this.clock),
      };
      const projects = new Map(this.projects).set(key, stored);
      await this.#persist(projects);
      this.projects = projects;
      return jsonClone(stored, "project");
    });
  }

  #mutate(operation) {
    const result = this.mutationTail.then(operation, operation);
    this.mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async #persist(projectMap = this.projects) {
    if (this.filePath === ":memory:") return;

    const directory = dirname(this.filePath);
    await mkdir(directory, { recursive: true });
    const projects = Object.fromEntries(
      [...projectMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, project]) => [key, project]),
    );
    const body = `${JSON.stringify({ version: FILE_VERSION, projects }, null, 2)}\n`;
    temporaryFileSequence += 1;
    const temporaryPath = `${this.filePath}.${process.pid}.${temporaryFileSequence}.tmp`;

    try {
      await writeFile(temporaryPath, body, { encoding: "utf8", flag: "wx" });
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
