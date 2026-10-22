# Experimental AI frontend

Open `http://127.0.0.1:5173/`: **Experimental AI** is the default generator and
its Generate button posts to `/api/generate`. The explicitly selected
`?generator=keyword#generator` **Legacy keyword demo** and **Specification demo**
remain available without a backend. The AI flow never falls back to them. This is a
local development integration; the existing hosted site is not provisioned with
an Ollama backend.

## Start locally

Use Node **22.14+ on Node 22**, dependencies already installed with `npm ci`, and
the existing `qwen3:4b-instruct` model. Follow the
[Ollama setup](phase-2b-local-ollama.md) to keep Ollama on `127.0.0.1:11434`.
No paid API, key, or additional dependency is required. Check the installed model
with `ollama list`; these instructions do not require downloading another model.

From the repository root, start the backend in terminal 1:

```bash
# Shortcut: explicitly selects real Ollama and flat selection, overriding .env.
npm run dev:backend:ai
```

For a complete startup command that also overrides stale port/timeout settings:

```bash
API_PROVIDER=ollama OLLAMA_WORKFLOW=flat-selection \
  API_HOST=127.0.0.1 API_PORT=3001 \
  API_CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173 \
  API_BODY_LIMIT_BYTES=8192 API_GENERATION_TIMEOUT_MS=5000 \
  API_REQUEST_TIMEOUT_MS=15000 \
  OLLAMA_BASE_URL=http://127.0.0.1:11434 OLLAMA_MODEL=qwen3:4b-instruct \
  OLLAMA_TIMEOUT_MS=60000 OLLAMA_CONTEXT_SIZE=8192 \
  OLLAMA_MAX_OUTPUT_TOKENS=2048 OLLAMA_RESPONSE_LIMIT_BYTES=65536 \
  npm run dev:backend
```

These explicit environment values override any corresponding old local `.env`
values. The backend loads an optional ignored `backend/.env`; it does not need to
be created or edited for this command. Backend defaults are unchanged: mock
provider and, when Ollama is selected, draft workflow. Restart after changing
configuration. `API_GENERATION_TIMEOUT_MS` is the mock/fallback deadline;
`OLLAMA_TIMEOUT_MS` bounds this Ollama workflow.

In terminal 2:

```bash
npm run dev -- --port 5173 --strictPort
```

Open `http://127.0.0.1:5173/`. Vite binds to loopback and
forwards relative `/api` requests to `http://127.0.0.1:3001`. This proxy is for
development, not `npm run preview` or static hosting. The application does not
contact Ollama directly or accept an arbitrary backend URL from the browser.

Verify the selected backend through that same proxy:

```bash
curl --fail-with-body http://127.0.0.1:5173/api/health
# Expect provider: ollama-local-flat-selection; isMock: false

curl --fail-with-body --max-time 75 http://127.0.0.1:5173/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Create a heading titled Preferences and an optional Email input. No form."}'
```

Health confirms configuration and liveness, not model readiness. This view
rejects mock, draft, or semantic-plan success metadata rather than displaying it
as a flat-selection result. It never silently substitutes a mock response.

If those ports are occupied, leave existing services alone. For example, use
the complete backend command above with `API_PORT=3002` and
`API_CORS_ORIGINS=http://127.0.0.1:5178,http://localhost:5178`, then start Vite with:

```bash
VPDS_API_PORT=3002 npm run dev -- --port 5178 --strictPort
```

Open `http://127.0.0.1:5178/`. `VPDS_API_PORT` configures
only the Vite proxy, accepts ports 1–65535, and defaults to 3001. Match the
backend's CORS allowlist to the actual browser origin, including its port. A
port-in-use error with `--strictPort` avoids silently changing that origin.

## Scope and data flow

SelectionPoC v2 now supports twenty selection types: text, email, and password inputs;
checkbox; button; text; heading; textarea; switch; text badge; divider; link;
native select; radio group; content card; payment-card fields; linear progress;
dialog; flag; footer. See the [Nova families report](selection-poc-results/nova-families-v1/README.md)
for the supported interactions and observed model failures.
The [practical milestone report](selection-poc-results/practical-milestone-v1/README.md)
documents the new property bounds, examples, and uncorrected live selection failures.
Payment-card fields are UI only; they perform no card validation or processing.
The [component increment report](selection-poc-results/component-increment-v1/README.md)
documents property bounds and its six one-attempt live checks. It allows up to twenty ordered
selections, adjacent horizontal groups, vertical stacking, and one optional form.
The deterministic composer creates IDs, field names, and wrappers. This is not
the full Nova catalog. Results can omit controls, flags, or requested rows even
when structurally valid; review the result against your description.

```text
Description → POST /api/generate → existing flat-selection backend
  → UiSpecification v1.0 validated again by the frontend
  → one stored specification
      ├─ selected-component documentation from registry metadata
      ├─ existing UiSpecificationPreview (trusted Nova components)
      └─ existing generateTsx → displayed source and Copy Code
```

No client keyword selection is used. The catalog increment extends the strict
schemas, compiler field naming, shared presentation, and flat-selection catalog.
Suggestions list actual returned nodes, including composed wrappers,
with trusted registry documentation links. Preview and code consume exactly the
same validated document. The source is displayed and copied, never evaluated.

Generating clears the previous result. A new request aborts the previous fetch;
cancelling or leaving the view also aborts it. Version checks ignore late
successes, failures, and finalizers even when a transport ignores cancellation.
Each success remounts the preview, resetting edited input values. Backend
single-request protection can briefly return `GENERATION_BUSY` after a cancel;
the client shows it and does not retry automatically.
The development proxy forwards a premature client-response close upstream even
after upload completes, so Express can cancel its Ollama call. Ordinary upload
completion does not cancel generation; listeners are removed on completion.

Known API errors use fixed, safe messages. Server error text, raw model output,
and exception details are never rendered. Malformed success envelopes and
invalid specifications produce no preview. The client adds no prompt storage or
logging. Local generation still sends your description to the local backend;
avoid sensitive data in example descriptions.

## Accessibility, preview, and copied code

The description has an associated label and scope description. Enter submits;
Generate, Cancel, view links, and Copy Code work with a keyboard. Loading and
cancellation use a persistent polite status region; failures use alerts. The
code block and overflowing preview are keyboard focusable. Preview and code
stack on narrow screens and sit side by side on wide screens; fixed horizontal
groups may scroll inside the preview instead of changing requested layout.

Copy feedback follows the clipboard promise: copying, then success or failure.
If permission is denied or the API is unavailable, select the code and copy it
manually. A superseded copy cannot update a newer result's feedback.

Generated inputs retain the renderer's labels and native validation. Native
form submission is prevented in both the renderer and preview boundary, so it
cannot navigate or send field data. Buttons do not implement authentication,
persistence or application business logic. Link clicks are prevented in the
preview, including auxiliary clicks; copied TSX retains the validated destination
and behaves as a normal link in a host app. Native reset semantics
remain available. No generated event handlers or executable expressions are
accepted from the model.

The copied component is a complete default-exported `GeneratedUI` function with
its required Nova imports. Use it in a React/TypeScript project with the
automatic JSX runtime, `react`, `react-dom`, `@visa/nova-react` (this repository
uses 2.5.4), and Nova base styles plus a theme from `@visa/nova-styles`. The host
app loads those styles, as `src/App.tsx` does here. This is a component, not a
complete application or backend. See the existing
[rendering/code-generation contract](phase-1b-rendering.md).

## Verification boundaries

Automated tests use mocked HTTP and deferred promises to cover response
validation, safe errors, races, cancellation, shared specification consumers,
remount keys, and clipboard completion. Existing tests cover compilation of
generated TSX against installed React/Nova types. No CI test runs inference.
Manual browser fixtures and real-model smoke results must be reported separately;
one smoke check is not a repeat of the frozen quality benchmark. This integration
does not change that dataset, its expectations, or the model's measured accuracy.

```bash
npm run build
npm run lint
npm test
git diff --check
```

Verification for this integration, with Node **22.14.0**:

| Check | Result |
| --- | --- |
| Build | Frontend and backend passed |
| Lint | Passed |
| Automated tests | **1091 passed**: 363 frontend + 728 backend; includes 11 proxy lifecycle/listener checks |
| Whitespace | `git diff --check` passed |
| Chrome 155, synthetic HTTP/clipboard fixtures | Keyboard Generate/Cancel; cancellation and stale responses; preview remount; safe unsupported/wrong-provider states; prevented submission; pending, successful and failed clipboard operations passed |
| Browser layouts | AI panel fits 360 px with stacked output and 1280 px with two columns |
| Real Qwen3 smoke, one request | HTTP 200 in **4555 ms**, provider `ollama-local-flat-selection`, `isMock: false`; required Email input, requested placeholder, no form |
| Real result's copied TSX | Matches `generateTsx` of the validated response exactly; **zero** TypeScript diagnostics against installed React/Nova |
| Backend preservation | All 77 existing tracked/untracked backend source/config/test/evaluation files retained byte for byte |
| Actual Vite proxy with mocked Ollama | Cancels after upload before headers and during streaming; provider connection closes within 1 second, subsequent generation succeeds; normal responses, deadlines, error mapping, and listener cleanup pass |
| Themed links | Nova Link used for view navigation and component documentation; actual generated UI shows light/dark text colors and visible keyboard focus (library dashed outline, 1 px, offset 1 px) |

The live prompt was “Create a required Email input with placeholder
you@example.com. No form.” It was submitted through the actual browser API
client and Vite proxy to a separate loopback backend on port 3002, without
reconfiguring the already running service on port 3001. There were no inference
retries or substitutions. Browser clipboard tests used controlled promises;
native operating-system clipboard permissions and screen-reader announcements
were not independently verified. Screenshots were manually inspected, but no
visual-regression suite or full accessibility audit was added.

At 360 px, unchanged landing-page content (the hero heading/animation) still
extends the document to 468 px. The AI panel itself stays at 360 px without
overflow; unrelated landing-page styling was left alone. Existing nonfatal
Zod annotation and large-bundle build warnings remain. This smoke check does
not establish broad semantic accuracy; the existing model can still miss details
and horizontal relationships.

The later [six-request application check and controlled prompt comparison](selection-poc-results/experimental-ai-v1/README.md)
preserve exact inputs, available response data, all twelve full comparison
responses, and outcomes. Explicit disabled state and horizontal grouping remain
unreliable. The two-rule prompt revision passed the same four of six cases and
regressed password selection to a disabled button, so the original prompt was
restored. The initial browser login capture remains unverified; a later verified
login attempt is reported separately. These manual results do not replace the
frozen twelve-case benchmark.

For the earlier local commit preparation, build, lint, and the 1091-test run
above applied to unchanged implementation files. The most recent focused schema/manual-transport/
production-provider suite passed **118 tests** after baseline restoration, with
targeted lint also passing. Subsequent edits only archive records and update
documentation; archive integrity/JSON checks and staged whitespace checks are
performed separately. The subsequent switch to AI as the default and explicit
proxy-connection error handling require their own focused verification; the
historical verification counts above are not claims about those later edits.

## Default AI flow verification

The default URL now mounts only the AI generator. The primary Generate action
uses `POST /api/generate`; keyword matching is confined to
`?generator=keyword#generator`. A mock or different workflow is rejected with
explicit configuration instructions, and an unavailable backend produces a
connection error without substituting keyword results.

Manual Chrome checks at **`http://127.0.0.1:5173/`**, with no view query parameter,
submitted exactly **“I need a login form with remember me”** once in each state:

| State | Actual request and result |
| --- | --- |
| Express stopped | `POST /api/generate` reached Vite, whose upstream connection failed; the browser displayed “Cannot reach the generation backend.” No suggestions, preview, or TSX appeared. |
| Express and Ollama running | The same POST passed through Vite to Express and real local Ollama (`qwen3:4b-instruct`); HTTP 200, `provider: ollama-local-flat-selection`, `isMock: false`. |

The live result contained required Email and Password inputs, an optional
Remember me checkbox, and a Login submit button, all inside a form named Login.
The browser rendered all four controls, showed the matching Nova registry
suggestions, and displayed TSX identical to `generateTsx` of the validated API
specification. That source type-checked against installed React/Nova with zero
diagnostics. No mock response, retry, keyword fallback, prompt change, or model
change was used. These checks demonstrate routing and one successful result,
not general semantic accuracy.

Focused verification after these changes: **66 tests passed** across the AI
presentation, API client, and request lifecycle suites; targeted ESLint,
`tsc -b`, and `git diff --check` passed. The full suite was not rerun for this
focused routing/connection-error change.
