# Phase 2B: UI drafts and deterministic compilation

## Why the boundary changed

The model previously emitted full UI specifications, including component IDs
and field names. Live failures reused the form root's ID on its first child.
Request-specific schemas avoided this for selected phrases but made behavior
depend on a small English recognizer.

The new boundary separates semantic choices from mechanical identity:

```text
Natural-language prompt
  → local Ollama, one fixed draft grammar and trusted example
  → bounded HTTP body / envelope / content JSON parsing
  → strict internal draft validation
  → deterministic component IDs and field names
  → authoritative UiSpecification Zod validation
  → unchanged successful API response

Independent evaluator → schema validity, semantic coverage, refusal accuracy
```

The compiler does not receive the prompt. It cannot substitute a registration
template, choose controls, reinterpret labels, or infer a missing submit action.
It accepts the validated model tree, adds identity, and validates the final UI.

## Internal draft contract

The draft has its own `irVersion: "1"`, independent of the authoritative output's
unchanged `version: "1.0"`. It has two strict outcomes:

```json
{
  "irVersion": "1",
  "status": "supported",
  "root": {
    "type": "form",
    "props": { "label": "Login" },
    "children": [
      { "type": "emailInput", "props": { "label": "Email", "required": true } },
      { "type": "passwordInput", "props": { "label": "Password", "required": true } },
      { "type": "button", "props": { "label": "Login", "type": "submit", "disabled": false } }
    ]
  }
}
```

For a request that requires an unavailable widget or real executable behavior:

```json
{ "irVersion": "1", "status": "unsupported", "reason": "unsupported-component" }
```

The other permitted reason is `unsupported-behavior`. Unsupported outcomes have
no root or free-text explanation. Mixing outcomes, unknown reasons, or additional
properties is invalid. A mixed request requiring an unsupported widget must be
refused as a whole; instructions prohibit silently dropping or substituting it.
Whether a request needs refusal remains a model semantic decision and is evaluated.

`modelUiDraft.ts` reuses the existing registry's property validators. It omits
`name` only from text/email/password inputs and checkbox props. Nodes never have
an `id`. Both properties are rejected if the model supplies them; they are not
silently stripped. All ten existing types remain available. There is no `any`
component, arbitrary props bag, coercion, JSX, import, handler, or style escape.

Optional props must be omitted when unused, not set to null. Literal text rules,
enum/range constraints, and explicit boolean values still use the existing Zod
validators. Containers need nonempty children; leaves cannot have children.

Unknown compiler input is bounded before Zod reads it: the walk inspects own data
descriptors and rejects accessors, cycles, shared objects, sparse arrays, unusual
prototypes, non-JSON values, and excessive traversal. Node depth is at most six,
including the root; total components are at most 100. The existing JSON/text
budgets also apply. The authoritative schema source was not modified.

## The compiler

`compileModelUi(input: unknown): UiSpecification` is a pure function. It has no
network calls, environment reads, randomness, clock dependency, logging, or I/O.

1. Validate the complete draft, including its version and outcome.
2. For supported drafts, traverse the tree in child-array order.
3. Assign `node-0` to the root, `node-0-0` to its first child, and so on.
4. Assign names to input/checkbox fields using their unchanged labels.
5. Validate the entire compiled document with `uiSpecificationSchema`.

Structural paths are unique across the tree, including identical components.
Names use Unicode NFKD normalization, lowercase, removal of combining marks,
and conversion to ASCII letters/digits/single hyphens. Non-letter beginnings
receive `field-`; an empty result uses `field`. Names are capped at 64 characters.

A document-wide used-name set handles collisions in traversal order. `Email`,
`Email`, and another `Email` become `email`, `email-2`, `email-3`. Existing suffixes
and truncation collisions are also checked. The base is shortened before adding
a suffix, and every candidate is checked until unused. Separate forms share the
set because the existing contract requires document-wide uniqueness.

Only IDs and field names are added. Component types, order, nesting, labels,
placeholder/content strings, gaps, heading levels, lengths, required/disabled
values, and button types are preserved. Explicit `false` is never lost through
truthiness defaults. Input is not mutated; the result does not share mutable
objects with it.

Invalid relationships are rejected by the authoritative schema: nested forms,
including through layouts; prohibited direct children; and submit/reset buttons
without a form ancestor. The compiler never reparents, changes action types,
flattens excess depth, truncates component lists, or repairs unsupported nodes.

Identical drafts produce identical IDs/names under the same compiler/runtime.
JSON object property order does not affect identity. Child insertion/reordering
can change structural IDs; changing a label can change its field name. These are
not persistent identities for an editor or external API bindings. Non-Latin-only
labels may receive generic `field` names; labels themselves are preserved.

## Ollama integration and API compatibility

`modelSchema.ts` supplies one finite Draft 7 grammar for all requests. Property
schemas come from the draft validators, and child allowlists/limits come from the
existing registry. No prompt words select a different root, tuple, or field list.
The compact catalog lists required/optional properties and allowed children;
instructions explain types, limits, coverage, and unsupported outcomes.

Every request sends four messages: system instructions, one trusted example user
request, its validated draft assistant answer, and the actual user request. The
same example is also shown in the system instructions. This small redundancy
proved useful in the manual comparison. The fixed example is demonstration data,
not a request lookup or response fallback. No previous user conversation is kept.
The actual prompt appears only as the final user message.

After JSON parsing, the provider calls the compiler and returns its specification.
The existing API route still applies final Zod validation, which also protects
output from mock or future providers. `GenerationProvider` and successful HTTP
200 responses are unchanged:

```text
{ data: { specification }, meta: { provider, isMock }, requestId }
```

| Result | HTTP / API code |
| --- | --- |
| Valid supported draft and compiled UI | 200, existing success envelope |
| Valid explicit unsupported outcome | 422, `UNSUPPORTED_UI_REQUEST` |
| Invalid draft or invalid compiled relationships | 502, `INVALID_PROVIDER_OUTPUT` |
| Invalid JSON | 502, `INVALID_MODEL_JSON` |
| Existing network/timeout/limit/cancellation failures | Existing error behavior |

The model's reason text is never echoed; only the enum is accepted internally.
The unsupported API response uses the existing `{ error: { code, message },
requestId }` envelope with a developer-owned message and no specification.

Strict-valid but incomplete UI data now receives HTTP 200. The incomplete keyword
recognizer no longer rejects it. `completeFormSlots` and `coverageInstructions`
were removed; `deriveFormExpectation` remains only as an optional offline aid.
The historical `INCOMPLETE_REQUIREMENTS` constant remains for compatibility but
is no longer emitted by generation. Semantic coverage is measured separately.

The mock provider, frontend, renderer, TSX generator, and original keyword matcher
are unchanged. The keyword matcher searches prompt substrings and returns mapped
suggestions; this compiler does no keyword matching. It transforms validated
model data into the existing contract without making UI design decisions.

HTTP byte/token bounds, temperature 0, seed 0, local-only URLs, redirect refusal,
timeout cancellation, client-disconnect cancellation, one-active-request limit,
and cleanup remain in place. No generated code is executed. Application code
does not store submitted prompts or model responses.

Opt-in diagnostics still require both `NODE_ENV=development` and
`API_LOCAL_DIAGNOSTICS=true`. New `model_draft` and `unsupported_request` stages
join the existing parser/envelope/`ui_schema` stages. They retain redacted paths,
bounded issue lists, codes, and developer-owned messages only. No raw values,
Zod messages, exception messages, prompts, or free-form model explanations are
logged or added to API responses.

## Fixed evaluation and reproduction

`coverageCases.ts` retains all seven previous human-authored cases unchanged.
`evaluateGeneration.ts` adds four independent cases: exact layout properties,
field properties, an unsupported widget, and unsupported executable behavior.
Expected properties include heading level, layout gap, labels, length limits,
required/disabled behavior, and action types. Layout-ancestor requirements are
checked. Semantic evaluation understands the existing omitted boolean/gap
defaults without modifying the specification.

The eleven prompts/expectations are fixed source data. The recognizer and model
do not generate their expected answers. A partial 6/7 form is a failure, and copied
extra fields fail cases that prohibit them. No expectations were relaxed based
on live model results.

Offline, evaluate a saved final UI or existing API success envelope:

```bash
npm run eval:coverage --workspace @vpds/backend -- registration /absolute/path/to/result.json
```

For deliberate live evaluation (not invoked by tests, build, or CI):

```bash
API_PROVIDER=ollama OLLAMA_MODEL=qwen3:4b-instruct EVALUATION_REPEATS=3 npm run eval:ollama --workspace @vpds/backend
```

Repeats must be 1–5. Configuration uses the backend's existing local environment
loading and bounds. The command never pulls or changes a model. It prints fixed
case IDs, settings, counts/rates, stable error codes, and elapsed times—not raw
prompts, model output, labels, or field values. Exit 0 means all cases passed;
exit 1 means a measured failure; exit 2 means invalid configuration/setup.

Metrics distinguish:

- **Schema-validity rate:** valid compiled UIs / expected-supported requests.
- **Complete-coverage rate:** complete, permitted UI results / expected-supported requests.
- **Requirement coverage:** matched expected requirements / all expected requirements.
- **Unsupported accuracy:** correct explicit unsupported outcomes / expected-unsupported requests.
- **False unsupported count:** supported requests incorrectly refused.

Invalid responses and false refusals remain in supported-request denominators.
Expected refusals are measured separately, not counted as invalid UI attempts.
These are final output-schema metrics; HTTP 200 alone is not semantic success.

For comparisons, record Node and Ollama versions, the installed model digest
(`ollama list`), inference settings, and the source revision/diff. Because this
work is uncommitted, also hash the schema/compiler/prompt/evaluation files, e.g.:

```bash
node --version
ollama --version
ollama list
shasum -a 256 backend/src/modelUiDraft.ts backend/src/compileModelUi.ts backend/src/modelSchema.ts backend/src/ollamaProvider.ts backend/evaluation/coverageCases.ts backend/evaluation/evaluateGeneration.ts
```

Keep model/runtime/settings fixed and compare per-case results over repeated
runs. Seed/temperature do not guarantee identical inference across runtimes or
hardware. None of this requires paid APIs, a database, an agent, or an LLM SDK.

## Observed live results

The final single-pass manual run used the unchanged local `qwen3:4b-instruct`,
temperature 0, seed 0, 8192 context, 2048 output tokens, and the existing local
25000 ms timeout. No model or local environment files were modified.

| Case | Final schema | Coverage / outcome |
| --- | --- | --- |
| Registration | Valid | 7/7 |
| Login | Valid | 4/4 |
| Contact | Valid | 5/5 |
| Split-name signup | Valid | 5/5 |
| Password reset | Valid | 3/3 |
| Simple login with Login button | Valid | 4/4 |
| Horizontal heading/text | Valid | **2/3, incomplete** |
| Layout property requirements | Valid | **2/3, incomplete** |
| Field property requirements | Valid | 4/4 |
| Unsupported widget | No UI returned | Correct explicit refusal |
| Unsupported executable behavior | No UI returned | Correct explicit refusal |

Schema validity was **9/9 (100%)**; complete supported-request coverage was
**7/9 (77.8%)**; matched requirements were **36/38 (94.7%)**; correct unsupported
outcomes were **2/2 (100%)**, with no false refusals. The command intentionally
exited 1 because two cases were incomplete. This smoke test is not a statistical
reliability or memory benchmark, and its metrics are not CI test results.

An initial comparison with only the example embedded in the system message had
100% supported-schema validity but 0/9 complete coverage and 50% unsupported
accuracy. Adding the fixed user/assistant demonstration improved adherence
without changing the schema, model, or evaluation expectations. Remaining layout
errors are not repaired or rejected by keyword heuristics; the compiler preserves
the model's decisions and the evaluator exposes them.

## Implementation and verification

| Files | Responsibility |
| --- | --- |
| `backend/src/modelUiDraft.ts` | Versioned strict draft/outcome schema, reused props, bounded validation |
| `backend/src/compileModelUi.ts` | Pure identity assignment and final authoritative validation |
| `backend/src/fixtures/registration-draft.json` | Trusted complete draft demonstration |
| `backend/src/modelSchema.ts` | One model-facing grammar and compact catalog/instructions |
| `backend/src/ollamaProvider.ts` | Static example messages, draft compilation, safe errors |
| `backend/src/app.ts` | Retain final Zod boundary; remove keyword-based coverage rejection |
| `backend/src/errors.ts`, `diagnostics.ts` | Explicit unsupported error and sanitized draft stages |
| `backend/src/requirementCoverage.ts` | Offline-only analysis; property/ancestor evaluation |
| `backend/evaluation/evaluateGeneration.ts`, `runOllama.ts` | Fixed eleven-case suite, separate metrics, manual-only runner |
| `backend/package.json` | Explicit manual evaluation command |
| `backend/test/compileModelUi.test.ts`, `evaluation.test.ts` | Compiler, safety, limits, identity, independent metric tests |
| Existing model/provider/coverage tests; login/contact draft fixtures | Migrate replaced contracts while retaining regression cases and HTTP safeguards |
| README and Phase 2B documentation | Current contract, commands, historical-report notices |

Final verification under Node 22.14.0:

| Command | Result |
| --- | --- |
| `npm run build` | Pass, frontend and backend |
| `npm run lint` | Pass |
| `npm test` | **596 passed: 298 frontend + 298 backend**, no skipped tests |
| `git diff --check` | Pass |

All existing regression cases remain, with assertions for superseded tuple and
runtime-coverage-gate behavior migrated to this approved contract. There are 75
additional tests over the prior 521. Tests cover all ten types; complete forms;
semantic preservation; Unicode/collision handling; explicit false values;
determinism; malformed/unsafe inputs; strict unsupported outcomes; depth/count
boundaries; mocked HTTP; diagnostics; cancellation; and independent evaluation.
CI still uses mock/fake HTTP only and does not invoke the manual evaluation.

Existing Vite bundle-size and Zod comment-annotation warnings remain. No frontend
source, authoritative schema, dependencies, lockfile, model, or daemon settings
were changed. Earlier uncommitted Phase 2B work was preserved. Work stays on
`feature/ai-component-generation`; no Phase 2C, commit, push, PR, or merge work
was performed.
