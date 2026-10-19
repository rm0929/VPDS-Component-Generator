# Flat component-selection PoC v1

This report records the original nullable-form-label experiment. See the
[explicit-form follow-up](selection-poc-form-v2.md) for the current isolated PoC
contract, preserved diagnostic evidence and new results. Historical artifacts and
the twelve-case fixture remain unchanged.

This is an isolated manual experiment, not a new production provider or frontend.
It tests whether Qwen3 can select a flat list of supported components before any
further architecture change. Draft and semantic-plan workflows remain unchanged.

## Contract and composition

```json
{
  "version": "selection-poc-1",
  "formLabel": "Editor",
  "components": [
    { "type": "textInput", "props": { "label": "Region" } },
    { "type": "textInput", "props": { "label": "Zone" }, "besidePrevious": true },
    { "type": "button", "props": { "label": "Apply", "type": "submit" } }
  ],
  "unsupported": []
}
```

`formLabel` is optional; omitted or null means no form. Otherwise it must pass the
existing form-label validator. The seven selectable leaf types reuse the existing
`draftPropsSchemas`: text/email/password inputs, checkbox, button, text and heading.
Their properties are unchanged, except technical field names remain compiler-owned.
No component property accepts null unless its authoritative validator allows it.
Unknown keys/types, styling, handlers, IDs, names, children trees, arbitrary values
and unsafe text are rejected. Supported explicit false values remain intact.

The list contains at most 20 components. Omitted/false `besidePrevious` starts a
new block; true joins the previous horizontal run. True on the first item is an
error. Groups with two or more controls become one horizontal layout each; groups
never nest within rows. Multiple blocks get one vertical layout. All generated
layouts use the existing medium gap. A single block needs no extra column. A
declared form encloses that result. Submit/reset buttons without a form are
rejected rather than changed or placed in an inferred form.

The composer does not accept a prompt or choose controls. It preserves order and
props, then calls the existing deterministic draft compiler to assign IDs/names
and perform authoritative UiSpecification v1.0 validation. Twenty leaves with ten
rows, a column and a form total at most 32 nodes and depth four, within existing
limits. Unknown input is bounded and checked without invoking accessors or code.

`unsupported` contains only `component`, `property`, `behavior`, or `composition`.
Repeated categories are invalid. A nonempty list rejects the entire result, even
if it contains some supported selections. Empty components are permitted only
for an explicit unsupported outcome. No partial UI is returned as success.

The PoC supports one optional enclosing form, vertical stacking and horizontal
runs. Multiple independent forms, arbitrary nested layouts and custom/adaptive
layout behavior are outside its current scope. These are PoC composition limits,
not changes to Nova's capabilities or the authoritative specification.

## Fixed inputs before inference

The twelve cases approved in the proposal are frozen, with their original wording
and explicit expectations, in
`backend/evaluation/selection-poc/cases-v1.json`. No repository fixture existed for
them before this step; this file materializes the approved proposal without changing
the cases. Its file SHA-256 is
`cd20106e24e0d55fdb6c457551d14a5ce3e301f3256f7d834bc092afe8c8dd7b`.
A regression test locks that hash. **The twelve-case benchmark is not run here.**
The prior frozen 29-case dataset and historical experiments are also unchanged.

Only these exact three prompts are run, once each, without retries or edits:

1. Create an email input with a label.
2. Responsive login form with remember me.
3. Create a profile form with first name and last name side by side, email below, and a Save Profile button.

Expected selection checks are defined separately from generation code: a labeled
email control; then a form/email/password/remember-me checkbox/action combination;
then a form, separate first/last fields, email and the named action. The last case
must have both name controls directly in one row, in order, email after the entire
row and the action after email. Button type is not prescribed where the user did
not specify it. All selected props/types are preserved without compiler correction.

The second request's broad "responsive" requirement is not encoded as CSS or
breakpoints by this contract. Basic vertical composition can be assessed, but
this PoC must not claim that responsive behavior is implemented or browser-tested.
Any explicit composition refusal must be reported alongside that limitation,
rather than indiscriminately called an unsupported-component classification error.

One general catalog and the same two developer-owned demonstrations are used for
all three prompts; none copies a feasibility or twelve-case prompt. There is no
keyword recognizer, request-specific schema, form template or fallback. Inference
uses the local Ollama JSON Schema API, temperature 0, seed 0, 8192 context, 2048
maximum output tokens and a 60000 ms deadline. Actual HTTP cancellation, loopback
configuration validation, response-size limits and safe stage diagnostics remain.

Frozen pre-inference inputs:

| Input | SHA-256 |
| --- | --- |
| Model schema (`JSON.stringify`) | `33ea5c1edbc1b83d5adc91831fa1d8675b90bd812b6c1b6f6c39d65cf42d35e6` |
| Trusted messages (`JSON.stringify`) | `21e401f551b43ffdccecb4d57cd00e1e7debc16d2e7f93192cf669ea09d14397` |
| Three feasibility cases (`JSON.stringify`) | `4fabfe21b8a1ec11ed0596e0bf054ee4c072dfe773ac4bfd7afb66b834713536` |

## Running the isolated path

With existing local Ollama running on loopback and Node 22.14+ on Node 22, from
the repository root:

```bash
API_PROVIDER=ollama OLLAMA_MODEL=qwen3:4b-instruct \
  OLLAMA_BASE_URL=http://127.0.0.1:11434 OLLAMA_TIMEOUT_MS=60000 \
  OLLAMA_CONTEXT_SIZE=8192 OLLAMA_MAX_OUTPUT_TOKENS=2048 OLLAMA_RESPONSE_LIMIT_BYTES=65536 \
  npm run poc:feasibility --workspace @vpds/backend
```

This command never changes `OLLAMA_WORKFLOW`, registers a provider or starts an
API endpoint. It records runtime/model metadata, calls only the three prompts,
and saves results under `docs/selection-poc-results/feasibility-v1`. Reruns require
a fresh `POC_OUTPUT_DIRECTORY`; previous artifacts are not overwritten. No model
is downloaded. No inference is imported or invoked by CI, builds or tests.

Diagnostics contain only safe stages, bounded allowlisted issue paths/codes and
developer-owned messages. Parsing errors, validation errors, declared unsupported
outcomes, form conflicts, timeouts and HTTP errors retain distinct stages.
No raw model output, submitted prompts, provider error body or generated field
values are printed in logs. Successful outputs are separately saved as validated
`.spec.json` and trusted-generator `.tsx.txt` artifacts for review, not executed.
Only fixed, nonpersonal feasibility inputs are used here.

The existing `generateTsx` is fed the same validated specification that the Nova
preview can consume. Generated code is parsed and type-checked against installed
React/Nova APIs, without emission or execution. The existing accessible labels,
input types, native properties and prevent-submit handler are preserved.

## Scope and eventual frontend path

Implementation lives under `backend/evaluation/selection-poc`, with independent
mocked tests and one manual npm command. Production source and frontend files
remain unchanged. TypeScript validation/compiler/code-generation helpers are reused
directly; no framework or dependencies are added.

After feasibility review, a successful approach could get a separately selected
backend adapter returning the existing API specification envelope. The frontend
could then revalidate that specification and pass it to `UiSpecificationPreview`
and `generateTsx`/`OutputPanel`. No generated code would be executed. Copied TSX
requires React, `@visa/nova-react`, Nova styles/theme setup and the installed
compatible package versions. It implements presentation/native controls, not
authentication, persistence or navigation.

This step does not create that adapter, frontend connection or a preview page.
It stops after the three-request feasibility check and verification, without a
full benchmark, alternative-model download, production switch, commit or push.

## Initial live results

Exactly three Ollama inference calls completed, using the frozen prompt/schema
above. No retries, phrase-specific patches, alternate prompts or model changes
were made after observing failures.

- Model: `qwen3:4b-instruct`.
- Ollama: `0.40.5`.
- Model digest: `0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`.
- Runtime/model metadata matched before and after the run.
- Safe metrics: [results.json](selection-poc-results/feasibility-v1/results.json).

| Request | Flat JSON/selection validation | UI specification | Generated TSX | Observed result |
| --- | --- | --- | --- | --- |
| Email input with a label | Passed | Passed v1.0 | Type-check passed | One labeled `emailInput`; no extra fields or layout nodes. |
| Responsive login with remember me | Passed | Not produced | Not generated | Composition rejected a submit/reset action without a declared form. |
| Profile with name row | Passed | Not produced | Not generated | Same missing-form relationship failure. |

All three passed bounded JSON, strict component/property validation and the
empty-unsupported check. Thus the result is **3/3 valid flat selections, 1/3
successful compiled UIs, and zero explicit unsupported classifications**. This
distinguishes format feasibility from correct component selection and composition.
It does not establish a general improvement over historical workflows from three
different-contract samples.

Both failed requests reported the same actual safe diagnostic:

```json
{
  "stage": "composition",
  "issues": [
    {
      "path": ["components", 3, "props", "type"],
      "code": "custom",
      "message": "Submit/reset buttons require a declared form."
    }
  ]
}
```

The model selected a native action at position four while omitting `formLabel` or
setting it to null. That combination passes the shape/property validators but
cannot be compiled under the approved explicit-form rule. The compiler rejected
it before generating the authoritative tree; it did not invent a form label,
change the button type, add a fallback form or call the model again. This is a
composition failure, **not** an unsupported refusal or an authoritative Zod failure.
The error does not reveal whether that action was submit versus reset, so this
report does not claim one specifically.

For the email result, the generated label is the literal `email`, preserved without
capitalization changes. The existing compiler assigned `node-0` and the valid name
`email`. The existing generator emitted `Input`, `InputContainer`, `Label` and
`Utility` imports, with matching `htmlFor`/input IDs. The exact artifacts are:

- [Validated email specification](selection-poc-results/feasibility-v1/email-label.spec.json)
- [Generated, type-checked email TSX](selection-poc-results/feasibility-v1/email-label.tsx.txt)

For the two failed requests, a complete selection/label/row-quality assessment is
**unassessed**, not counted as success. The initial runner retains no selection
artifact when compilation fails. Its safe diagnostics establish valid flat data,
an empty unsupported list and the missing-form conflict, but do not retain the
other selections, their labels or the `besidePrevious` values. It would be incorrect
to infer that all requested controls or the name row were chosen correctly.
The deterministic row behavior is covered by unit tests; that does not prove the
model chose the row correctly in this live attempt.

Observed wall times were 3888 ms, 2275 ms and 2135 ms respectively. The email
inference/selection compilation portion was 3525 ms; its remaining time includes
TSX type-checking and artifact writing. These single samples are feasibility
observations, not comparable model latency distributions.

The check shows that the smaller format can produce a valid component result, but
form generation is not ready for integration. Before a full benchmark or model
comparison, review the general form-declaration policy and improve pre-composition
quality observation. Neither change is implemented as a workaround here. Browser
responsiveness remains unverified and no live frontend preview was added.

## Verification and changed files

Verified using Node 22.14.0:

| Check | Result |
| --- | --- |
| `npm run build` | Passed for existing frontend and backend |
| `npm run lint` | Passed |
| `npm test` | **934 passed**: 298 frontend + 636 backend |
| New focused PoC tests | 78 passed |
| Existing tests | All prior 856 preserved |
| Initial live inference | Three calls completed; one compiled UI, two preserved composition failures |
| Twelve-case benchmark / alternate models | Not run / not downloaded |

Tests exercise every leaf type and property validator, deterministic IDs/names,
repeated/Unicode labels, explicit false, optional form declarations, native button
types, multiple adjacent rows, maximum leaves/wrappers, unsafe and unknown props,
malformed/deep/non-JSON/accessor data, unsupported outcomes, safe issue redaction,
mocked HTTP failures/limits/parsing/truncation/cancellation/deadlines, accessible
label bindings and TSX compilation against installed React/Nova. The existing
nonfatal Vite bundle-size and dependency annotation warnings remain.

Files added:

- `backend/evaluation/selection-poc/selection.ts`: strict shape, bounded JSON
  validation and deterministic composition into the existing draft compiler.
- `backend/evaluation/selection-poc/model.ts`: one registry-derived grammar/catalog
  and two fixed developer demonstrations.
- `backend/evaluation/selection-poc/ollama.ts`: isolated single-call local HTTP
  path, bounded reads, cancellation and safe stage-specific errors.
- `backend/evaluation/selection-poc/diagnostics.ts`: bounded sanitized diagnostics.
- `backend/evaluation/selection-poc/checkTsx.ts`: in-memory type-checking without
  emitting, importing or executing generated source.
- `backend/evaluation/selection-poc/runFeasibility.ts`: explicit manual entry point
  for three calls, safe metrics and validated output artifacts.
- `backend/evaluation/selection-poc/feasibilityCases.ts`: exactly the three approved
  requests and independent evaluation-only expectations.
- `backend/evaluation/selection-poc/cases-v1.json`: frozen twelve-case proposal.
- `backend/test/selectionPoc.test.ts` and `selectionPocOllama.test.ts`: 78 tests,
  using mocked HTTP; no inference in CI.
- This document and the three initial result/specification/code artifacts.

`backend/package.json` adds only the `poc:feasibility` command in this step.
No dependencies or lockfile changes are needed. The existing production compiler,
semantic compiler and active semantic prompt hashes were also checked unchanged;
historical frozen prompt/schema/evaluation checks pass. The frontend, existing
keyword generator, API provider registration and production workflows are intact.
