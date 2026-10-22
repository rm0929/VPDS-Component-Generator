# Flat-selection backend integration

This report describes the original seven-leaf integration. The current
[first component increment](selection-poc-results/component-increment-v1/README.md)
adds textarea, switch, text badge, divider, and link to the flat-selection catalog.
The [practical milestone](selection-poc-results/practical-milestone-v1/README.md)
adds native select, radio group, content card, payment-card fields, and progress,
with one concise catalog/instruction revision and one real-model acceptance pass.
Historical benchmark files, expectations, and the older draft/semantic model
catalogs remain unchanged. Counts and unchanged-source claims below describe
the original integration rather than the expanded catalog.

This change connects the existing SelectionPoC v2 to `POST /api/generate`.
It preserves Qwen3, the benchmarked contract/messages/composer, authoritative
UiSpecification v1.0, the public API envelope and both existing Ollama workflows.
This report records the backend integration stage. The subsequent
[Experimental AI frontend](experimental-ai-frontend.md) connects this workflow
to Nova suggestions, preview, and copyable TSX. AI is now the default frontend;
keyword generation is an explicitly selected legacy demo. Use
`npm run dev:backend:ai` to start the required real flat-selection backend.

## Selection and local commands

Both services remain on loopback. Use the already installed `qwen3:4b-instruct`
model and the existing [local Ollama setup](phase-2b-local-ollama.md). No model
download, new service or live inference is performed by tests or CI.

The backend defaults to `API_PROVIDER=mock`. When `ollama` is explicitly selected,
its workflow still defaults to `draft`. Choose a workflow at process startup;
clients cannot override it through the request body. Restart after changing it.

From the repository root, with Node 22.14+:

```bash
# Flat component selection, using the benchmark settings.
API_PROVIDER=ollama OLLAMA_WORKFLOW=flat-selection \
  API_HOST=127.0.0.1 API_PORT=3001 \
  API_GENERATION_TIMEOUT_MS=5000 API_REQUEST_TIMEOUT_MS=15000 \
  OLLAMA_BASE_URL=http://127.0.0.1:11434 OLLAMA_MODEL=qwen3:4b-instruct \
  OLLAMA_TIMEOUT_MS=60000 OLLAMA_CONTEXT_SIZE=8192 \
  OLLAMA_MAX_OUTPUT_TOKENS=2048 OLLAMA_RESPONSE_LIMIT_BYTES=65536 \
  npm run dev:backend
```

The same bounded settings use temperature 0, seed 0, thinking off, streaming off
and `keep_alive: 2m`. For the other workflows, change only the explicit selection:

```bash
API_PROVIDER=ollama OLLAMA_WORKFLOW=draft npm run dev:backend
API_PROVIDER=ollama OLLAMA_WORKFLOW=semantic-plan npm run dev:backend
API_PROVIDER=mock npm run dev:backend
```

These shorter commands assume a valid existing local configuration. The sample
`backend/.env.example` now agrees with code defaults: mock provider, draft
workflow, 5000 ms fallback and 15000 ms HTTP receive timeout. Previously its
90000 ms fallback exceeded the validator's 30000 ms maximum and its provider
value contradicted the mock-default comment. No actual `.env` file is changed;
correct old local values or use the explicit overrides in the full command.
Ollama's provider deadline is 60000 ms, separate from the mock fallback. The HTTP
receive timeout bounds incoming request upload, not completed-upload inference.

In another terminal:

```bash
curl --fail-with-body http://127.0.0.1:3001/api/health
# provider: ollama-local-flat-selection; isMock: false

curl --fail-with-body --max-time 75 http://127.0.0.1:3001/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Show a heading titled Preferences, an optional Email input, and an Updates checkbox. No form."}'
```

These are manual commands, not a claim that this request was run against a model
during integration. Health reports the selected provider and process liveness;
it does not prove Ollama/model readiness.

## Conversion and import boundary

```text
POST { prompt }
  → existing request validation, body limits and cancellation/deadline
  → existing production Ollama /api/chat transport (one inference call)
      format: buildSelectionModelSchema()
      messages: unchanged selectionMessages() + actual request
  → existing bounded envelope/content JSON parsing
  → compileSelectionPoc(unknown)
      strict selection validation → explicit unsupported OR composition
      ordered leaves → adjacent horizontal runs → default vertical stacking
      form.enabled → optional form; null label → Generated form
  → existing compileModelUi: stable IDs/names + authoritative validation
  → existing API final validation and JSON envelope
```

Production imports only `backend/evaluation/selection-poc/model.ts` and
`selection.ts`. Their transitive dependencies are Zod, registry/draft schemas,
and the existing pure compiler. There are no filesystem writes, inference calls
at import time, evaluator execution or runner imports in that graph. Keeping the
modules at their existing paths avoids a relocation/refactor and preserves their
benchmarked source bytes. TypeScript emits these runtime dependencies in the
backend build even though the build's entry files are under `backend/src`.

The manual PoC HTTP helper, benchmark runner, evaluators, datasets, TypeScript
compilation harness and result-file writers are not imported into production.
Production uses its original transport with its single-active-request guard,
bounded response reading, actual HTTP cancellation, timer cleanup, no retries
and no fallback to another workflow. Generated code is never executed.

Success remains:

```text
{ data: { specification: UiSpecification },
  meta: { provider: "ollama-local-flat-selection", isMock: false },
  requestId: "..." }
```

## Existing error contract and safe diagnostics

| Outcome | HTTP / existing code | Diagnostic stage |
| --- | --- | --- |
| Valid nonempty explicit unsupported categories | 422 `UNSUPPORTED_UI_REQUEST` | `unsupported_request` |
| Invalid selection, unknown props/types, contradictory form declaration, duplicate unsupported categories | 502 `INVALID_PROVIDER_OUTPUT` | `selection_schema` |
| Submit/reset outside an enabled form | 502 `INVALID_PROVIDER_OUTPUT` | `composition` |
| Invalid compiled authoritative document | 502 `INVALID_PROVIDER_OUTPUT` | `ui_schema` |
| Invalid envelope | 502 `INVALID_PROVIDER_OUTPUT` | `ollama_envelope` |
| HTTP/model JSON parsing failure | 502 `INVALID_MODEL_JSON` | `ollama_response_json` / `model_json` |
| Response too large or token truncation | Existing 502 size/truncation codes | Existing handling |
| Deadline or concurrent request | 504 `GENERATION_TIMEOUT` / 503 `GENERATION_BUSY` | Existing handling |

Unsupported categories never become a partial success, and malformed refusals
are not repaired or deduplicated. The public unsupported message remains the
existing one, including its reference to the UI draft contract, to preserve the
error response. Internal stage details and model values are not added to it.

Diagnostics remain off by default. Enable only in local development with
`NODE_ENV=development API_LOCAL_DIAGNOSTICS=true`. New selection/composition
stages use allowlisted paths, codes and developer-owned messages; arbitrary
keys/messages are redacted. Prompts, raw output, labels and field values are not
logged. Production/test environments ignore the opt-in.

## Quality and verification boundaries

The [frozen PoC benchmark](selection-poc-benchmark-v2.md) is historical live-model
evidence: 15/36 complete successes, 27/27 supported specifications/TSX valid,
and 3/6 requested horizontal rows correct. This integration does not improve
those semantic results or change expectations. A valid but incomplete selection
can still receive 200; no keyword coverage gate, automatic repair or retry is
introduced. The flat contract remains limited to seven leaf types, adjacent
rows, twenty selections and one optional form. IDs/names and wrappers are
deterministic, not model-generated.

Integration tests use mocked fetch or a local fake Ollama HTTP server. They
verify exact benchmark messages/schema/options, successful API/health envelopes,
unsupported and invalid-output mappings, safe paths, response bounds, actual
timeout/disconnect cancellation and concurrency/recovery. No real Ollama process
or downloaded model is used; these are protocol/regression checks, not fresh
model-quality or latency measurements.

Verification for this integration, using Node **22.14.0**:

| Check | Result |
| --- | --- |
| `npm run build` | Pass: frontend and backend |
| `npm run lint` | Pass |
| `npm test` | **1001 passed**: 298 frontend + 703 backend |
| Focused provider/configuration/diagnostic tests | **72 passed**, included in the full suite |
| Compiled provider import smoke check | Pass: loads only the two pure PoC modules; no network requests |
| `git diff --check` | Pass |

The full suite preserves all previous 964 tests and adds 37 cases. Existing fake
Ollama HTTP timeout/disconnect tests now also exercise flat selection; pre-aborted
signals, timeout recovery, single-active-request behavior and subsequent-request
recovery are covered explicitly. The runtime test file rejects filesystem,
benchmark-runner and manual-PoC-transport imports to guard this boundary. A
compiled Node import check confirms production TypeScript output contains the
needed modules and loads no evaluator or runner.

Build warnings remain for dependency annotation comments and the existing
frontend chunk above 500 kB. No new dependencies, frontend edits, live model
measurements, benchmark changes, commits or pushes are included. The implementation
remains an uncommitted backend/documentation/test diff for review on
`feature/ai-component-generation`, based on checkpoint `ea21577`.
