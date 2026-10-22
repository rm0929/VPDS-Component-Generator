# Phase 2B: local Ollama UI generation

The Express backend supports local `qwen3:4b-instruct` through Ollama's HTTP API.
`API_PROVIDER=mock` remains the code default; explicitly select `ollama` for local
inference. No paid service, SDK, model download, or cloud fallback is part of
application generation. The frontend remains unchanged until Phase 2C.

The [UI draft architecture and implementation report](ui-draft-architecture.md)
describes the default `OLLAMA_WORKFLOW=draft` baseline and its live quality results.
The [Step 2 semantic-plan workflow](semantic-ui-plan-ollama.md) is a separate,
opt-in path selected with `OLLAMA_WORKFLOW=semantic-plan`; it uses the same local
HTTP safeguards and public response contract. The pipeline below describes the
unchanged draft baseline. The earlier
[coverage](ollama-requirement-coverage.md) and [login diagnosis](ollama-login-diagnosis.md)
reports describe historical findings, before draft compilation replaced full-UI
model output and request-specific grammars.

The [flat-selection backend integration](flat-selection-backend.md) adds a third
opt-in workflow, `OLLAMA_WORKFLOW=flat-selection`, using the benchmarked
SelectionPoC v2 contract unchanged. It shares this provider's transport and API
envelope. Mock/draft defaults remain unchanged. The opt-in
[Experimental AI frontend](experimental-ai-frontend.md) uses flat selection explicitly.

## Current generation pipeline

```text
POST /api/generate { prompt }
  → existing request validation/body limits
  → explicitly selected provider
      mock: unchanged deterministic examples
      ollama: one JSON Schema for versioned UI drafts, without IDs/names
  → bounded envelope/content JSON parsing
  → strict draft validation
  → pure deterministic compiler adds IDs and field names
  → authoritative uiSpecificationSchema validation
  → existing API success envelope, or stable safe error

Manual evaluator → separate schema-validity and semantic-coverage metrics
```

`modelUiDraft.ts` reuses registry props, omitting only technical field names.
`modelSchema.ts` constructs finite depth-bounded grammar references and a compact
catalog. Every request uses the same schema, system instructions, and trusted
user/assistant example. The actual prompt is the final user message, and no user
conversation history is retained.

`compileModelUi` assigns structural IDs and document-wide unique names derived
from labels. It preserves every semantic property and never drops unsupported
components, renames labels, changes action types, repairs nulls, or inserts missing
controls. Draft and final Zod validation remain mandatory. Invalid nesting,
unknown keys/types, unsafe text, null optional props, and complexity violations
are rejected. The authoritative schema and successful API contract are unchanged.

A valid explicit unsupported outcome becomes HTTP 422 `UNSUPPORTED_UI_REQUEST`.
Its reasons are a closed internal enum, never model free text. A schema-valid
but incomplete UI can receive HTTP 200: keyword-based completeness rejection was
removed, and independent evaluation reports those quality failures instead.

The existing [`format` structured-output API](https://docs.ollama.com/capabilities/structured-outputs)
helps constrain shape; final validation enforces the contract. Neither grammar nor
compilation proves that the model fulfilled every user requirement. No generated
code is evaluated or executed.

## Local setup on the 16 GB MacBook Air

Use native Ollama on macOS; install it from the [official macOS
download](https://ollama.com/download/mac) if needed. Do not run a second daemon
if the menu-bar app is already listening. Either configure that app's environment
as described in the [Ollama FAQ](https://docs.ollama.com/faq), or quit it and use
this explicit local-only terminal setup:

```bash
# Terminal 1: local daemon, cloud features disabled
OLLAMA_HOST=127.0.0.1:11434 OLLAMA_NO_CLOUD=1 OLLAMA_NUM_PARALLEL=1 OLLAMA_MAX_LOADED_MODELS=1 ollama serve
```

In a second terminal, download the configured model once:

```bash
ollama pull qwen3:4b-instruct
ollama list
curl http://127.0.0.1:11434/api/tags
```

Pulling weights needs network access; subsequent inference uses the local model.
The [published model tag](https://ollama.com/library/qwen3:4b-instruct) lists about
2.5 GB of Q4_K_M weights. That is a download/weight size, not total working RAM:
macOS, the browser, model runtime, and context cache share the 16 GB memory.
The 8K context and 2K output defaults are conservative starting choices, not a
performance or fit benchmark on your machine. Keep one loaded model and one
parallel request; larger contexts/parallelism increase memory use.

From this repository, install existing dependencies with `npm ci`. If you have
no backend environment file yet, copy `backend/.env.example` to `backend/.env`.
Otherwise edit the existing file. Set:

```dotenv
API_HOST=127.0.0.1
API_PORT=3001
API_PROVIDER=ollama
OLLAMA_WORKFLOW=draft
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b-instruct
OLLAMA_TIMEOUT_MS=60000
OLLAMA_CONTEXT_SIZE=8192
OLLAMA_MAX_OUTPUT_TOKENS=2048
OLLAMA_RESPONSE_LIMIT_BYTES=65536
```

Use `OLLAMA_WORKFLOW=flat-selection` for flat component selection, or
`semantic-plan` for the existing semantic workflow; restart after changing it.
The sample `.env.example` defaults to `API_PROVIDER=mock`, with valid fallback
timeouts (`API_GENERATION_TIMEOUT_MS=5000`, `API_REQUEST_TIMEOUT_MS=15000`).
Existing local `.env` files are not rewritten: if yours retains the old 90000 ms
fallback, change it to a permitted value (at most 30000). Ollama uses its separate
`OLLAMA_TIMEOUT_MS` deadline, 60000 ms by default.

Then run:

```bash
npm run dev:backend
# Or, for compiled Node execution:
npm run build:backend
npm run start:backend
```

Backend `.env` settings configure our adapter, not the separate Ollama daemon.
`OLLAMA_HOST`/`OLLAMA_NO_CLOUD`/parallelism settings must be applied to the daemon
process itself. For the macOS app, changing shell variables alone does not change
an already running service; restart it with the intended settings. Keep cloud
features disabled even when using a custom local model alias.

No tunnels, public reverse proxy, wildcard binding, cloud model, or paid service
is part of this setup. Both the API and Ollama remain on loopback. The backend
rejects `API_HOST=0.0.0.0`/`::` and remote Ollama origins. `localhost` is normalized
to `127.0.0.1`; literal `::1` is also supported. Redirects are disabled so a local
endpoint cannot redirect a prompt to a remote server. CORS remains the existing
explicit local frontend allowlist; CORS alone is not authentication.

### Sample requests

Health reports which provider is selected; it is process liveness, not a model
readiness/inference probe:

```bash
curl http://127.0.0.1:3001/api/health
# provider: ollama-local, isMock: false

curl --max-time 75 http://127.0.0.1:3001/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Create a registration form with name, email, password, confirm password, terms checkbox and a submit button."}'

curl --max-time 75 http://127.0.0.1:3001/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Create a contact form with name, email, a short message and a submit button, arranged vertically."}'
```

Success preserves the Phase 2A response contract:

```text
{ data: { specification: <validated v1 document> },
  meta: { provider: "ollama-local", isMock: false }, requestId: "..." }
```

To return to deterministic examples, set `API_PROVIDER=mock` and restart. The
mock requires neither Ollama nor valid Ollama-specific settings, and still
supports only its four documented phrases. The frontend can continue running
with `npm run dev`; it does not submit prompts to either backend provider yet.

## Configuration and resource bounds

| Setting | Default | Allowed range/behavior |
| --- | --- | --- |
| `API_PROVIDER` | `mock` | Exactly `mock` or `ollama` |
| `OLLAMA_MODEL` | `qwen3:4b-instruct` | 1–120 characters, model/tag syntax; known cloud-name markers rejected |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | HTTP loopback origin only; no credentials, path, query, fragment, or redirects |
| `OLLAMA_TIMEOUT_MS` | 60000 | 100–180000 ms |
| `OLLAMA_CONTEXT_SIZE` | 8192 | Integer 4096–16384, sent as `options.num_ctx` |
| `OLLAMA_MAX_OUTPUT_TOKENS` | 2048 | Integer 128–4096, at most half the context; sent as `options.num_predict` |
| `OLLAMA_RESPONSE_LIMIT_BYTES` | 65536 | Integer 4096–262144; total Ollama response bytes, including its JSON envelope |

The adapter uses [`POST /api/chat`](https://docs.ollama.com/api/chat), `stream:
false`, schema `format`, `think: false`, temperature 0, seed 0, and a fixed
two-minute keep-alive. These reduce output variability and avoid spending the
budget on a thinking trace. They do not make LLM results perfectly deterministic.
The [runtime options](https://docs.ollama.com/modelfile#valid-parameters-and-values)
are public Ollama API parameters. The draft schema travels as decoding grammar; a
compact catalog and rules travel as system instructions, with a fixed trusted
example supplied in user/assistant roles as well.

One adapter instance permits one active inference request. Additional requests
receive `GENERATION_BUSY`; they are not queued with prompts held in memory.
This is a per-process limit, not a distributed semaphore; run one backend process
for this local setup. Ollama's own single-parallel-request setting also bounds
work if other local clients use it.

The output-token cap bounds generation work. The response-byte cap bounds what
we buffer before JSON parsing, including chunked responses whose Content-Length
is missing or incorrect. A non-streaming Ollama response is still read through
fetch's body stream so an oversized response can be cancelled early. Invalid
UTF-8, malformed JSON, empty content, unfinished envelopes, and token truncation
are rejected without extracting/repairing partial documents.

`GenerationProvider.timeoutMs` is an optional deadline override. Mock/test
providers without it retain `API_GENERATION_TIMEOUT_MS` (5000 ms by default).
The Ollama override prevents the old mock deadline from cutting every local
inference off after five seconds. Ollama also owns a fetch deadline for direct
provider use. Both timeout paths abort the actual HTTP request/body.

The existing `API_REQUEST_TIMEOUT_MS` concerns receiving HTTP requests; it is
separate from time spent awaiting inference after upload. It need not exceed
`OLLAMA_TIMEOUT_MS`. Its previous relationship with the mock timeout remains
unchanged. Timers, body readers, and abort listeners are cleaned up on success,
failure, oversize, timeout, and client disconnect.

## Errors and diagnosis

All errors keep `{ error: { code, message }, requestId }`; no raw daemon response,
prompt, model content, stack, or exception text is returned/logged.

| Code | Status | What to check |
| --- | --- | --- |
| `OLLAMA_UNAVAILABLE` | 503 | Daemon running, loopback URL/port correct, connection not dropped |
| `OLLAMA_MODEL_NOT_FOUND` | 503 | HTTP 404 from the fixed chat endpoint; check `ollama list`, configured tag, pull status, and runtime version |
| `OLLAMA_REQUEST_FAILED` | 502 | Other HTTP rejection; update Ollama if schema `format`/`think` is unsupported, check model/runtime settings |
| `INVALID_MODEL_JSON` | 502 | HTTP envelope or content is not JSON/valid UTF-8; fences and prose are not repaired |
| `INVALID_PROVIDER_OUTPUT` | 502 | Envelope is incomplete/wrong, or final UI violates the authoritative schema |
| `UNSUPPORTED_UI_REQUEST` | 422 | Model returned a valid explicit unsupported-components/behavior outcome; no UI or free-text reason is returned |
| `MODEL_OUTPUT_TRUNCATED` | 502 | Token cap reached; ask for a smaller UI or cautiously increase the bounded output budget |
| `PROVIDER_RESPONSE_TOO_LARGE` | 502 | Hard response-byte cap exceeded |
| `GENERATION_TIMEOUT` | 504 | Cold loading or inference exceeded its deadline; simplify the request or raise timeout within bounds |
| `GENERATION_BUSY` | 503 | Wait for the active request; no automatic retry is performed |

Existing request validation, body limits, CORS, 404/405, and safe logging behavior
are preserved. There is no request retry or automatic model pull. If an older
Ollama version rejects structured output, generation fails clearly instead of
falling back to unconstrained text. Update the local runtime before retrying.

The application does not persist prompts or retain conversation history.
Ollama is a separate local process and maintains runtime/model caches; do not
enable payload/debug logging when working with sensitive data. The two-minute
keep-alive retains a loaded model for reuse; `ollama stop qwen3:4b-instruct` can
release it when finished. Neither JSON grammar nor prompt instructions guarantee
that the model understood the requested UI correctly.

## Diagnostics, tests, and quality evaluation

Enable safe failure metadata only for local development:

```bash
NODE_ENV=development API_LOCAL_DIAGNOSTICS=true npm run dev:backend
```

It is disabled by default and ignored in production/test. Stages distinguish
HTTP JSON, envelope, model JSON, draft/semantic/flat-selection validation, flat
composition, final UI validation, and explicit unsupported outcomes. Only redacted paths, issue codes, and
developer-owned messages are emitted; no raw prompts/output/values or parser
messages are logged. Diagnostics are never added to API responses.

Verification under Node 22.14.0:

| Command | Result |
| --- | --- |
| `npm run build` | Pass, frontend and backend |
| `npm run lint` | Pass |
| `npm test` | **596 passed: 298 frontend + 298 backend** |
| `git diff --check` | Pass |

Existing regression coverage is retained, with superseded tuple/gate assertions
migrated to the draft contract. There are 75 additional cases over the previous
521. Tests use injected responses or fake loopback servers; CI never contacts
Ollama or downloads models. Existing frontend bundle-size and Zod annotation
warnings remain. No dependencies or lockfiles were changed.

Run a deliberate manual evaluation outside CI:

```bash
API_PROVIDER=ollama OLLAMA_MODEL=qwen3:4b-instruct EVALUATION_REPEATS=3 npm run eval:ollama --workspace @vpds/backend
```

The fixed eleven-case dataset separates output schema validity, complete semantic
coverage, per-requirement coverage, and expected unsupported outcomes. The final
one-pass smoke test measured 9/9 supported outputs schema-valid, 7/9 fully
complete, 36/38 requirements covered, and 2/2 correct refusals. Two layout cases
remained incomplete, so the evaluator correctly exited 1. See the
[implementation report](ui-draft-architecture.md) for exact cases, reproduction
settings, changed files, limitations, and metric definitions.

The model, daemon settings, authoritative UI contract, frontend, and mock behavior
are unchanged. No Phase 2C, commit, push, PR, or merge work was performed.
