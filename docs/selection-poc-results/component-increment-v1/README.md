# First component increment: implementation and manual checks

This increment uses installed **@visa/nova-react 2.5.4**. No dependencies,
model, transport, API envelope, frontend routing, or evaluation expectations
were replaced. The existing default AI view still posts through Vite to Express
and local Ollama, then derives suggestions, preview, and TSX from one validated
UiSpecification v1.0.

## Additive contract

The existing `selection-poc-2` envelope, ordered components, `besidePrevious`,
one optional form, unsupported categories, and twenty-selection limit remain.
Five additional leaf variants bring the flat catalog to twelve. All objects
are strict; IDs and field names still belong to the deterministic compiler.

| Type | Model-facing properties | Trusted Nova mapping |
| --- | --- | --- |
| `textarea` | Required label; optional placeholder, required, disabled, maxLength 1–1000, rows 1–20 | Label, InputContainer, Textarea |
| `switch` | Required label; optional disabled and defaultChecked | Switch, SwitchLabel |
| `badge` | Required content up to 200 characters; optional badgeType critical/neutral/stable/subtle/warning | Badge, text variant only |
| `divider` | Optional dividerType section/decorative | Divider |
| `link` | Required label and href up to 1000 characters | Link |

Labels/placeholders retain the existing nonblank 200-character literal-text
boundary. Explicit false values are retained. Textarea and switch field names
share the existing document-wide collision handling with other fields.
Switch initial state uses `defaultChecked`, allowing native interaction without
model-generated handlers. Arbitrary checked/value bindings, styles, tags,
event handlers, executable content, and unsupported properties remain rejected.

Links accept HTTP(S) destinations and relative references. Other schemes
(including javascript, data, file, mailto, and tel), credentials, protocol-relative
URLs, whitespace/control characters, backslashes, and markup/expression
delimiters are rejected rather than repaired. Preview Link handlers prevent
normal/keyboard activation and auxiliary-click navigation. Copied TSX retains
the exact valid destination, safely escaped, without preview-only handlers.
It therefore navigates normally when used in a host application.

The existing shared presentation representation drives both preview and code;
the TSX serializer automatically imports the added trusted Nova tags. No new
planner, component templates, keyword matching, framework, or executable model
output was introduced. Older draft and semantic model catalogs retain their
original vocabulary via `BASE_COMPONENT_TYPES`.

## Six one-attempt real-Qwen3 checks

[inputs.json](inputs.json) was written before inference and records every exact
prompt and settings. [results.json](results.json) records actual browser DOM,
displayed TSX, checks, metadata, and observed gaps. Each `*.response.json`
contains its complete API response, saved before validation or semantic checks.
Only synthetic UI descriptions and generated examples are included.

All requests used **http://127.0.0.1:5173/** without a view query parameter:
browser Generate → POST `/api/generate` → Vite → Express
`ollama-local-flat-selection` (`isMock:false`) → local Ollama `/api/chat`.
There were **six POSTs, one per prompt, no retries**, and no prompt/schema/model
adjustments during or after the live checks. Runtime was Ollama 0.40.5 with
qwen3:4b-instruct; digest and source fingerprints are in results.json.
Temperature 0, seed 0, context 8192, output 2048, thinking/streaming off,
keep-alive 2m, timeout 60000 ms, response limit 65536 bytes.

| Case | Exact prompt | Actual result | Complete semantic result |
| --- | --- | --- | --- |
| Textarea | Create one required multiline text area labeled "Notes", with 4 rows and a maximum length of 300 characters. No form or other components. | Required Notes textarea, four rows, no form; **maxLength omitted**, unrequested placeholder added | Fail |
| Switch | Create one switch labeled "Email alerts", initially off and not disabled. No form or other components. | **Textarea** labeled Email alerts, one row, disabled:false, required:false; no form | Fail |
| Badge | Create one text badge with the exact text "Ready". No form or other components. | Text badge Ready, stable style, no form | Pass |
| Divider | Create one decorative horizontal divider. No form or other components. | Decorative hr, aria-hidden:true, no form | Pass |
| Link | Create one link labeled "Visa design guidance" pointing to https://design.visa.com/. No form or other components. | **Ordinary button**, correct label, no destination or form | Fail |
| Login regression | I need a login form with remember me | Named Login form with **Email and Password textareas**, optional Remember me checkbox, Login submit button | **Fail/regression** |

All six returned HTTP 200 and authoritative-schema-valid specifications.
Nova previews and component suggestions reflected the actual selected types;
displayed TSX matched `generateTsx` of the response specification exactly.
All six sources type-checked against installed React/Nova with zero diagnostics.
Form membership was correct in all six. Complete semantic success was **2/6**.
Latencies, including browser/API capture overhead, were 4877, 1724, 1326, 1217,
1524, and 3564 ms respectively. These are smoke observations, not a benchmark.

Live switch toggling and link-navigation containment are **unverified** because
the model did not select those components. Deterministic rendering tests cover
the switch's actual role, labels and initial states, plus both link handlers and
the retained code destination. The live login Password textarea is unmasked:
the result is unsuitable as a login interface even though it compiles. No output
was repaired or replaced to hide this failure.

## Verification and boundaries

Build and lint pass. Automated checks cover strict properties and bounds,
unsafe URLs, explicit false values, field-name collisions, adjacent rows/forms,
all fifteen registered specification types, preview/code consistency, generated
TSX compilation, and mocked production Ollama responses. Existing HTTP lifecycle
tests remain in the API suite; they use mocked Ollama, not real inference.
Final verification: **565 frontend tests + 747 backend tests = 1312 passing**.
The focused backend catalog/compiler/baseline run also passed 148 tests before
the final unsafe-link regression was added and covered by the complete API run.
All six live generated sources compiled without TypeScript diagnostics.
Existing nonfatal Zod annotation and large-bundle build warnings remain.

The initial sandboxed API run could not bind loopback sockets (`listen EPERM`);
it was rerun successfully with permission. Historical fixtures/results remain
unchanged. Tests now distinguish the original ten-type benchmark vocabulary
from the expanded registry, and preserve the historical compiler hash rather
than claiming that the changed compiler is the original revision. Older default
view assertions were aligned with the already implemented AI-default routing.
Original registration output/import expectations remain unchanged.

This implements deterministic support, not reliable natural-language selection
of every added type. The login regression is material. Review and address the
expanded catalog's selection accuracy before claiming broader reliable support;
do not add more components or silently introduce keyword corrections. Existing
disabled-state/horizontal-grouping limitations also remain. Radio/select and
other deferred components are not included in this increment.

## Files changed for this increment

Existing unrelated local work is retained. Increment-specific changes are:

- Registry/validation/presentation: `src/specification/componentRegistry.ts`,
  `uiSpecification.ts`, `presentation.ts`, `UiSpecificationPreview.tsx`.
  `generateTsx.ts` is reused without edits; its shared presentation vocabulary
  supplies the additional imports and JSX.
- Flat selection: `backend/evaluation/selection-poc/selection.ts`, `model.ts`,
  `diagnostics.ts`.
- Compiler/baseline compatibility: `backend/src/modelUiDraft.ts`,
  `compileModelUi.ts`, `modelSchema.ts`, `semanticModelSchema.ts`, `diagnostics.ts`.
- Supported descriptions: `src/components/AiGeneratorSection.tsx`, root
  `README.md`, `docs/experimental-ai-frontend.md`, `docs/flat-selection-backend.md`.
- New focused tests: `src/specification/additionalComponents.test.ts`,
  `backend/test/additionalSelection.test.ts`.
- Extended tests: `src/specification/rendering.test.ts`, `uiSpecification.test.ts`,
  `src/components/SpecificationDemo.test.ts`; backend tests `selectionPoc`,
  `flatSelectionProvider`, `modelSchema`, `semanticModelSchema`, `semanticUiPlan`,
  `semanticOllamaProvider`, `promptExperiments`, and `benchmark` (`.test.ts`).
- This documentation directory: report, fixed inputs, results, and six complete
  API response files. The temporary Chrome driver was not added to the repository.
