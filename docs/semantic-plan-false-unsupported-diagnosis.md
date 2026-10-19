# Semantic-plan false unsupported classification: diagnosis and proposal

The confirmed failure is a **model-generated `unsupported-behavior` decision**
for a UI that the existing contract can represent. The backend maps that decision
correctly. No runtime prompt, schema, registry, compiler, API behavior or frontend
was changed during this investigation.

## Reproduction and safe evidence

The exact supplied request was reproduced locally:

> Create a profile form with first name and last name side by side, email below them, and a Save Profile button.

The running API identified itself as `ollama-local-semantic-plan`, `isMock: false`.
Two isolated calls used the existing provider, instructions and schema, loading
the local Ollama configuration. A bounded in-memory response clone was inspected
only to extract validated status/reason discriminators. No raw model output,
generated field values, free-form reasoning, prompts or secrets were logged or
persisted by diagnostic instrumentation. The prompt above is the user-provided
reproduction input, not a captured request log.

| Attempt | Result | Validated model status | Validated closed reason | Duration |
| --- | --- | --- | --- | --- |
| Provider 1 | `UNSUPPORTED_UI_REQUEST` | `unsupported` | `unsupported-behavior` | 3472 ms |
| Provider 2 | `UNSUPPORTED_UI_REQUEST` | `unsupported` | `unsupported-behavior` | 723 ms |
| Running API | HTTP 422, `UNSUPPORTED_UI_REQUEST` | Not independently inspected in the API call | Not independently inspected in the API call | 3937 ms |

Both isolated provider attempts emitted this existing sanitized diagnostic:

```json
{
  "stage": "unsupported_request",
  "message": "The model reported an unsupported UI request.",
  "issues": []
}
```

There were **no JSON parse, semantic-plan validation or authoritative UI Zod
issues** in those calls. An unsupported outcome exits before composing a UI,
so authoritative UI validation is not reached on that path. Empty issues here
mean a validated refusal, not a failed validation with its details suppressed.

Runtime and inference settings observed during reproduction:

- Model: `qwen3:4b-instruct`, unchanged.
- Ollama runtime: `0.40.5`.
- Model digest: `0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`.
- Context: 8192; maximum output tokens: 2048; provider deadline: 25000 ms from local configuration.
- Temperature: 0; seed: 0; `think: false`; non-streaming; keep-alive: 2 minutes.
- Semantic instruction SHA-256: `b6067c0fe51c58609742304d47ffcdfa5c1e384dd4644163e23c92ceabb688d8`.
- Semantic JSON Schema SHA-256 (`JSON.stringify`): `fa003f11f804c96bb59d65ad5fa80e48f37d2553f15922dd43aaacb3b1f61f22`.

These are reproduction observations, not a quality benchmark or general latency
estimate. No model download, model change or frozen-dataset evaluation was done.

## Exact control flow

1. `ollamaProvider.ts` accepts the completed envelope and parses model JSON.
2. `compileSemanticUiPlan` validates the full unknown outcome using
   `semanticUiPlanSchema`. A valid `status: "unsupported"` is an allowed branch.
3. For that branch only, the composer delegates a versioned unsupported outcome
   to `compileModelUi` rather than creating a UI tree.
4. `compileModelUi` validates that outcome, then throws
   `ModelUiCompilationError("unsupported_request")` with no issues.
5. The provider logs the sanitized stage and maps **that specific error stage**
   to `UNSUPPORTED_UI_REQUEST`. The API uses the existing HTTP 422 error contract.

Invalid references, unsupported types/props and form-scope errors instead raise
`SemanticUiPlanCompilationError`, which maps to `INVALID_PROVIDER_OUTPUT` (502).
Final draft/authoritative validation errors also map to 502. JSON failures have
their separate `INVALID_MODEL_JSON` code. The current backend does not classify
the prompt, infer unsupported behavior from a label, or convert these validation
errors into unsupported-request errors.

The exact confirmed root cause is therefore the wrong semantic decision made
by Qwen, upstream of composition. The validated reason identifies the category
of that mistake. It does **not** expose the model's reasoning or prove which
word or instruction caused it. In particular, interpreting the action label as
data persistence is a plausible explanation, not an observed thought process.

## The request fits the current contract

The existing developer-owned `profilePlan()` fixture compiles successfully and
passes authoritative `uiSpecificationSchema` validation, with this tree:

```text
form
├── horizontalLayout
│   ├── textInput (first name)
│   └── textInput (last name)
├── emailInput
└── button (type: submit)
```

This needs four leaf elements and two groups. The form explicitly owns the row,
email and action; the row owns both name fields. Every declaration has one owner,
with six components and maximum depth three, within the existing 100/six limits.
The current registry already permits every property and relationship. IDs and
unique field names are assigned by the existing compiler. Nothing requires real
profile persistence, authentication, a network call or a generated handler.
The fixture verifies representability; it is not a production response lookup.

## Prompt/schema findings and proposed general fix

The grammar has both a supported plan and a three-field unsupported branch.
The latter can be completed without declaring components or demonstrating which
requirement falls outside the catalog. This is an intentional refusal mechanism,
but it cannot establish that a refusal is semantically correct. Its shorter shape
is a possible contributor to false refusals; these observations do not prove a
decoding preference caused this case. Removing the branch or forcing supported
status would hide legitimate unsupported requests and is not recommended.

The instructions accurately list the supported components. They also repeat
"No executable behavior", prohibit code/network calls, and end with an
`unsupported-behavior` rule. They already state that ordinary UI controls are
allowed without business implementation, but the distinction is spread across
several paragraphs. A small model can still misclassify an ordinary action UI.

The first proposed experiment is a **single, prominent UI-only interpretation
policy**, replacing dispersed/ambiguous behavior-refusal wording rather than
adding more prompt-specific examples:

> Generate the requested UI definition. Action labels describe controls, not a
> request to implement their business effects. Native button, submit and reset
> types are supported presentation semantics. Missing business implementations
> are not a reason to refuse a request for UI controls. Use unsupported-behavior
> only when the user explicitly requires executable logic or side effects that
> this contract cannot express. Use unsupported-component for required controls
> or properties outside the catalog. Never omit a requested unsupported feature
> and pretend the remainder satisfies the request.

This is a meaning-based rule for arbitrary action wording, not a list of button
keywords or exceptions for named form types. It leaves the IR, structured-output
grammar, explicit form membership, one inference call, API errors and all strict
runtime checks unchanged. Unsupported/unsafe properties still fail Zod even if
the model incorrectly chooses supported status. The backend must never override
a refusal or fabricate a plan merely because a request resembles a known form.

Before retaining any instruction change, compare it against the same frozen
29-case expectations and settings. Report false unsupported decisions on
supported cases separately from correct refusals and false acceptance of genuinely
unsupported requests, alongside structural validity, semantic coverage, layout
and latency. Do not retain a change based only on this one request. A stricter
future refusal-evidence contract could improve observability, but it would be an
IR change requiring separate review and would not itself prove correct intent
classification. No such change or new pipeline is implemented here.

## Regression coverage and scope

Five tests were added to `backend/test/semanticOllamaProvider.test.ts`:

- For the **same generic supported UI request**, mock the observed closed behavior
  refusal, a valid action plan and an invalid supported plan. Verify respectively
  422-mapped error/stage with no issues, successful compilation, and 502-mapped
  reference-validation error with its safe issue path. The HTTP request messages
  remain identical across the three attempts and each attempt uses one call.
- Parameterize different action labels and native submit/reset/button types to
  verify that valid action UIs compile without backend business-behavior inference,
  while preserving explicit false. These are test inputs, not runtime mappings.

The first test captures the diagnosed mechanism and guards against incorrectly
mapping validation failures to refusal or silently overriding a model decision.
It cannot prevent a real model from choosing the wrong branch. Any eventual
prompt-quality improvement must be demonstrated with manual evaluation, not a
mock claiming to understand English. Existing unsafe/unsupported input and
refusal tests remain in place.

Verification on Node 22.14.0:

| Check | Result |
| --- | --- |
| Focused semantic provider/composer tests | 184 passed |
| `npm run build` | Passed for frontend and backend |
| `npm run lint` | Passed |
| `npm test` | **847 passed**: 298 frontend + 549 backend |
| Previous tests | All 842 preserved; five regression tests added |
| Frozen evaluation/compiler/prompt regression checks | Passed without expectation changes |

The existing Vite large-bundle and dependency annotation warnings remain
non-fatal. Manual inference was limited to the three reproduction calls above;
automated tests made no actual inference calls.

Only this report, its setup-guide link and the regression tests were changed.
Runtime code/instructions, schemas, registry, baseline workflow, frontend,
frozen expectations and historical experiments remain unchanged. Work stops at
diagnosis and the proposed fix for review; no frontend integration, commit, push
or merge was performed.
