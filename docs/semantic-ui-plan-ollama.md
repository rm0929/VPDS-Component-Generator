# SemanticUiPlan v1 — Step 2 Ollama integration

Step 2 connects the approved semantic-plan composer to local Ollama as an
**opt-in workflow**. It keeps the original draft workflow and mock provider,
uses the same Qwen3 model, and does not connect or change the frontend.
Work remains on `feature/ai-component-generation`.
No evaluation expectations, historical experiments or authoritative UI schemas
are changed. No live inference is performed by automated tests or CI.

A subsequent [false unsupported-classification investigation](semantic-plan-false-unsupported-diagnosis.md)
records a live `unsupported-behavior` refusal for a supported UI request, its safe
diagnostics and a proposed instruction change. That investigation does not apply
the proposed runtime change.

The approved [UI-only interpretation experiment](semantic-ui-only-experiment-results.md)
subsequently compared both prompts on all 29 frozen cases twice. Both refused all
50 supported attempts, so the candidate is not recommended for adoption and the
runtime baseline remains unchanged.

## Selection and conversion

There are still two providers: `mock` and `ollama`. Step 2 introduced two Ollama
workflows; the subsequent [flat-selection integration](flat-selection-backend.md)
adds a third choice without changing either original workflow. Selection is
configured at backend startup:

| Environment | Behavior | Health/success provider identifier |
| --- | --- | --- |
| `API_PROVIDER=mock` | Existing non-AI deterministic examples; ignores Ollama settings | `deterministic-mock` |
| `API_PROVIDER=ollama OLLAMA_WORKFLOW=draft` | Original recursive UI draft, original system prompt and demonstration | `ollama-local` |
| `API_PROVIDER=ollama OLLAMA_WORKFLOW=semantic-plan` | Flat semantic plan with explicit ordered references | `ollama-local-semantic-plan` |
| `API_PROVIDER=ollama OLLAMA_WORKFLOW=flat-selection` | Benchmarked flat component selection and deterministic composition | `ollama-local-flat-selection` |

The code defaults to `mock`; when Ollama is selected, its workflow defaults to
`draft`. Unknown/empty workflow values fail startup validation. Selection is
server-side configuration, not a request field, header or prompt instruction.
Restart the backend to change it. A failed semantic generation never retries,
switches to the baseline, or returns a mock response.

```text
POST /api/generate { prompt }
  → existing request/body validation
  → one shared Ollama HTTP lifecycle
      draft: original schema + messages → compileModelUi
      semantic-plan: semantic schema + catalog + user message
        → compileSemanticUiPlan
          → bounded JSON + strict plan/props validation
          → reference bounds + unique ownership + cycles + reachability
          → explicit form scope + composed count/depth checks
          → deterministic semantic groups → UI draft tree
          → existing compileModelUi
  → deterministic IDs and document-wide unique field names
  → authoritative uiSpecificationSchema v1.0 validation
  → API independently validates the specification again
  → unchanged response envelope
```

Each attempt makes **one** non-streaming `/api/chat` request. There is no planning
call followed by a composition call: the model supplies the semantic plan and
TypeScript composes it. Model/context/output/deadline/response-byte limits stay
the same. Settings remain `temperature: 0`, `seed: 0`, `think: false`,
`stream: false` and `keep_alive: "2m"`. These aid reproducibility without promising
identical inference across runtime versions or hardware.

## Model contract and catalog

The [Step 1 format and examples](semantic-ui-plan-v1.md) remain unchanged. Seven
leaf types go in `elements`: `textInput`, `emailInput`, `passwordInput`,
`checkbox`, `button`, `text`, and `heading`. Three semantic group kinds cover the
remaining specification types: `row` → `horizontalLayout`, `column` →
`verticalLayout`, and `form` → `form`.

`semanticModelSchema.ts` generates Ollama's JSON Schema from
`semanticUiPlanStructureSchema`, the same structural union used inside the
runtime validator. It does not maintain a handwritten second plan contract.
The catalog lists all ten specification types, their meanings and precise
property types, required keys, enums and bounds derived from `draftPropsSchemas`
and the existing registry. Users can describe ordinary UI requirements without
knowing Nova export names. Neither IDs nor field names belong to the model.

The new system instructions explain positive requirements, scoped exclusions,
explicit false values, presentation order, explicit form membership and small
meaningful layouts. Fields already include label/input presentation wrappers;
forms may own controls/rows directly. There are no prompt classifiers,
request-specific schemas, hardcoded component plans, template answers or trusted
example responses in this workflow. The user request is a separate user message;
there is no retained conversation history. The original draft messages, including
their demonstration, are unchanged.

JSON Schema cannot express graph reachability, dynamic index bounds, unique
ownership or form ancestry. Custom literal-text refinements also require Zod.
Exporting the structural schema for grammar generation does **not** bypass these
checks: the provider always invokes `compileSemanticUiPlan` on unknown parsed
data, which uses the full guarded runtime validator. It never calls the structural
schema alone to accept output. Every declaration must be consumed exactly once.
Malformed/incomplete plans are rejected, not repaired or partially rendered.

Unsupported essential components/properties or executable behavior must produce
the existing closed `unsupported` outcome with a versioned plan envelope. The
compiler maps this to the existing HTTP 422 error, never a partial specification.
This is model interpretation, not a keyword gate; a misclassified unsupported
request remains a quality failure for independent evaluation.

## HTTP contract, diagnostics and cancellation

A successful request still returns:

```json
{
  "data": {
    "specification": {
      "version": "1.0",
      "root": { "id": "node-0", "type": "text", "props": { "content": "Ready" } }
    }
  },
  "meta": { "provider": "ollama-local-semantic-plan", "isMock": false },
  "requestId": "server-generated-request-id"
}
```

This minimal text specification illustrates the envelope; other responses contain
their complete validated UI tree. The renderer and TSX generator can consume
`data.specification` through their existing interfaces when frontend integration
is approved in a later step. No generated source is executed by this provider.

| Failure | Existing code | HTTP |
| --- | --- | --- |
| Non-JSON/invalid UTF-8 HTTP body or model content | `INVALID_MODEL_JSON` | 502 |
| Malformed plan, unsupported props/types, bad references, ownership, form scope, depth/count | `INVALID_PROVIDER_OUTPUT` | 502 |
| Explicit supported-contract refusal | `UNSUPPORTED_UI_REQUEST` | 422 |
| Invalid/incomplete Ollama envelope | `INVALID_PROVIDER_OUTPUT` | 502 |
| Output token limit reached | `MODEL_OUTPUT_TRUNCATED` | 502 |
| HTTP response byte limit exceeded | `PROVIDER_RESPONSE_TOO_LARGE` | 502 |
| Ollama connection failure | `OLLAMA_UNAVAILABLE` | 503 |
| HTTP 404 from Ollama | `OLLAMA_MODEL_NOT_FOUND` | 503 |
| Other Ollama HTTP failure | `OLLAMA_REQUEST_FAILED` | 502 |
| Deadline exceeded | `GENERATION_TIMEOUT` | 504 |
| Another generation already running | `GENERATION_BUSY` | 503 |

Errors retain `{ "error": { "code": "...", "message": "..." }, "requestId": "..." }`
with developer-owned messages. The original API error strings are unchanged.
No model refusal text or provider error bodies are echoed. The shared transport
retains loopback-only origins, redirect rejection, one active attempt, bounded
body reads and actual `fetch` cancellation. Aborting the API request or exceeding
the deadline cancels the downstream HTTP connection, including an unfinished
response stream. The busy slot is released after failure/cancellation.

Opt-in diagnostics require **both** `NODE_ENV=development` and
`API_LOCAL_DIAGNOSTICS=true`. The new `semantic_plan` stage uses the same capped,
sanitized logger: only stage, bounded issue paths/codes and allowlisted
developer-owned messages. Plan field names/index keys are allowlisted for paths;
unknown keys and arbitrary custom messages are redacted. It never logs prompts,
raw model output, generated labels/values, secrets or raw Zod errors. Existing
parsing, envelope, draft, unsupported and authoritative validation stages remain.

## Exact local commands

Use Node 22.14+ on Node 22, as in CI, from the repository root. The existing model
must already be installed. Follow the [local-only Ollama setup guide](phase-2b-local-ollama.md)
if needed; do not start a second daemon if the Ollama app is already running.
For a terminal-managed daemon:

```bash
OLLAMA_HOST=127.0.0.1:11434 OLLAMA_NO_CLOUD=1 OLLAMA_NUM_PARALLEL=1 OLLAMA_MAX_LOADED_MODELS=1 ollama serve
```

In another terminal, choose **one** backend command. Stop it before switching.
These explicit environment variables override values loaded from `backend/.env`.

Original draft baseline:

```bash
API_HOST=127.0.0.1 API_PORT=3001 API_PROVIDER=ollama OLLAMA_WORKFLOW=draft \
  API_GENERATION_TIMEOUT_MS=5000 API_REQUEST_TIMEOUT_MS=120000 \
  OLLAMA_MODEL=qwen3:4b-instruct OLLAMA_BASE_URL=http://127.0.0.1:11434 \
  OLLAMA_TIMEOUT_MS=60000 npm run dev:backend
```

Opt-in semantic plan:

```bash
API_HOST=127.0.0.1 API_PORT=3001 API_PROVIDER=ollama OLLAMA_WORKFLOW=semantic-plan \
  API_GENERATION_TIMEOUT_MS=5000 API_REQUEST_TIMEOUT_MS=120000 \
  OLLAMA_MODEL=qwen3:4b-instruct OLLAMA_BASE_URL=http://127.0.0.1:11434 \
  OLLAMA_TIMEOUT_MS=60000 npm run dev:backend
```

Existing non-AI mock (no Ollama required):

```bash
API_HOST=127.0.0.1 API_PORT=3001 API_PROVIDER=mock \
  API_GENERATION_TIMEOUT_MS=5000 API_REQUEST_TIMEOUT_MS=120000 npm run dev:backend
```

At Step 2, `.env.example` retained a pre-existing 90000 ms fallback, exceeding
`readConfig`'s 30000 ms maximum. The later flat-selection integration corrects the
sample to 5000 ms and `API_PROVIDER=mock`; existing local `.env` files are not
rewritten. Keep a valid fallback there or override it as above. Ollama generation
uses its own `OLLAMA_TIMEOUT_MS=60000` deadline; the 5000 ms API value is the
fallback for providers without a deadline (such as the mock).

Confirm the workflow and test either Ollama path from a separate terminal:

```bash
curl --fail-with-body http://127.0.0.1:3001/api/health

curl --fail-with-body --max-time 75 http://127.0.0.1:3001/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Show a heading titled Preferences, then an optional email field and a checkbox labeled Product updates side by side. Put a disabled Preview button below. Do not add a form or a password field."}'

curl --fail-with-body --max-time 75 http://127.0.0.1:3001/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Create a profile form with first name and last name side by side, email below them, and a Save Profile button."}'

# Unsupported outcome should be HTTP 422 if the model interprets it correctly.
curl --max-time 75 -i http://127.0.0.1:3001/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Create a native date-picker control."}'

# With the mock selected, use its documented example vocabulary.
curl --fail-with-body http://127.0.0.1:3001/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"registration form"}'
```

For safe local diagnostics, prefix the selected backend command with
`NODE_ENV=development API_LOCAL_DIAGNOSTICS=true`. Keep API and Ollama bound to
loopback. The frontend has not changed; using curl is the way to test this step.

## Verification and limitations

Verified with Node 22.14.0:

| Check | Result |
| --- | --- |
| `npm run build` | Passed, frontend and backend |
| `npm run lint` | Passed |
| `npm test` | **842 passed**: 298 frontend + 544 backend |
| Regression preservation | All 758 previous tests retained; 84 added |

Tests cover the grammar and registry catalog; all ten component types; mixed
form/row/column composition; ordering, deterministic IDs/names and explicit false;
single-call transport and unchanged settings; separate roles/history isolation;
incomplete/malformed plans, unsupported outcomes, unsafe/unknown props/types;
bad indexes, duplicate ownership, unreachable entries and disconnected cycles;
nested forms, submit/reset scope, count/depth limits; malformed JSON/envelopes,
invalid UTF-8, truncation, response bounds, HTTP failures, unavailable servers;
busy requests, pre-aborts, cancellation/deadlines and slot release; sanitized
diagnostics and the unchanged API envelopes. Fake loopback HTTP servers verify
real downstream stream cancellation for **both** workflows without inference.
Original compiler, baseline schema/prompt fingerprints and evaluation tests pass.

The existing Vite bundle-size and dependency `@__PURE__` warnings remain non-fatal.
No dependency, model, frontend, registry property restriction, authoritative schema,
frozen evaluation expectation or historical experiment changed.

Structural success is not proof of semantic completeness. Missing *plan members*
are rejected, but a well-formed plan can still omit a control requested in English
or point a valid reference at the wrong element. There is no incomplete keyword
recognizer rejecting otherwise valid output. Explicit redundant layouts remain
unchanged rather than being flattened. Those limitations require the later
approved evaluation step; no live quality gain, latency result or retention-gate
success is claimed here. The historical experiment runner remains a **draft**
runner: explicitly select `OLLAMA_WORKFLOW=draft` for its existing experiments;
semantic-plan evaluation integration is outside Step 2.

## Files changed in Step 2

- `backend/src/semanticModelSchema.ts`: new grammar and registry-derived semantic catalog/instructions.
- `backend/src/semanticUiPlan.ts`: exports its existing structural union for grammar generation; full validation unchanged.
- `backend/src/ollamaProvider.ts`: startup-selected schema/messages/compiler; shared HTTP lifecycle unchanged.
- `backend/src/providerConfig.ts`: bounded enum `OLLAMA_WORKFLOW`, default `draft`.
- `backend/src/diagnostics.ts`: safe semantic-plan stage, path keys and owned messages.
- `backend/.env.example`: documents default workflow selection.
- `backend/test/semanticModelSchema.test.ts`, `backend/test/semanticOllamaProvider.test.ts`, `backend/test/fixtures/semantic-plans.ts`: grammar/catalog and mocked semantic workflow coverage.
- `backend/test/providerConfig.test.ts`, `backend/test/ollamaProvider.test.ts`: selection and API/cancellation regression coverage alongside existing tests.
- `README.md`, `docs/phase-2b-local-ollama.md`, `docs/semantic-ui-plan-v1.md`, this report: current selection/setup links and implementation details.

The key maintenance decision is to vary only the model-facing contract and the
compiler at startup. This avoids implementing cancellation, limits and error
handling twice. The schema helps the model speak our language; runtime graph
validation proves the relationships are safe; the existing compiler supplies
technical identity and the public UI contract. None of these layers proves the
model understood the English request, which is why evaluation stays separate.

Work stops after Step 2. No commit, push, merge, PR or Step 3 work is performed.
