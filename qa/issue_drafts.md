# C baseline issue drafts

연결된 GitHub 계정은 canonical repo에 읽기 권한만 있어 Issue를 직접 만들 수 없었다. 아래 내용은 repo owner 또는 A가 그대로 Issue로 옮긴 뒤 URL을 `qa/test_matrix.md`와 `qa/retest_log.md`에 연결하기 위한 초안이다.

## FAIL-001 — local env variants can be committed

**Suggested title**

```text
[Security] Ignore local env variants while keeping sanitized .env.example
```

**Body**

```text
Failure ID: FAIL-001
Requirement: Discord/OpenAI/DB secrets must remain outside Git.
Tested ref: 5938b3206cb8ee3fa32cb0fe91c38c34ed60a178

Reproduction
1. Run: git check-ignore -q -- .env.local
2. Observe that the file is not ignored.

Expected
- .env and local .env.* variants are ignored.
- !.env.example is the only tracked exception.

Actual
- The stock rule ignores exact .env only.

Acceptance
- Add narrowly scoped ignore rules.
- Prove .env, .env.local, and .env.production are ignored.
- Prove .env.example remains trackable.
- Link the fix commit and same-input retest evidence.
```

## FAIL-002 — sanitized environment template is missing

**Suggested title**

```text
[Config] Add a value-free .env.example for the Discord MVP
```

**Body**

```text
Failure ID: FAIL-002
Requirement: v3 requires .env.example and forbids committing real tokens or API keys.
Tested ref: 5938b3206cb8ee3fa32cb0fe91c38c34ed60a178

Reproduction
1. Run: Test-Path -LiteralPath '.env.example'
2. Actual result: False.

Expected
- A tracked .env.example exists.
- It contains key names and safe defaults only.
- DISCORD_BOT_TOKEN, OPENAI_API_KEY, and DATABASE_URL have no real values.

Acceptance
- Add .env.example.
- Run a redacted secret scan.
- Link the fix commit and same-input retest evidence.
```

## FAIL-003 — five required Discord fixtures are absent

**Suggested title**

```text
[Fixture] Add and bind the five v3 Discord scenarios
```

**Body**

```text
Failure ID: FAIL-003
Requirement: C must evaluate five B-owned scenarios with stable Task/Owner/Evidence IDs.
Tested ref: 5938b3206cb8ee3fa32cb0fe91c38c34ed60a178

Reproduction
1. Inspect fixtures/conversations/ and the fixture manifest.
2. Actual result: directory and scenarios are absent.

Expected files
- fixtures/conversations/happy_path.json
- fixtures/conversations/missing_evidence.json
- fixtures/conversations/deadline_conflict.json
- fixtures/conversations/completion_without_file.json
- fixtures/conversations/version_conflict.json
- manifest with fixture_version, author, reviewer, and semantic_ref → `{id, kind, json_pointer}` bindings

Acceptance
- Add at least 20 total fake messages and at least 5 fake files/links.
- Use no real personal data or secrets.
- Bind every semantic_ref required by eval/goldset.json to an existing fixture object and matching kind.
- C validates all bindings and reruns the same five scenarios.
- Link the fixture commit and retest evidence.
```
