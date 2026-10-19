# Diagnosing the simple-login generation failure

> Historical investigation: the current [UI draft compiler architecture](ui-draft-architecture.md)
> replaces model-generated IDs/names, request-specific grammars, and runtime
> keyword-based coverage rejection. Measurements below describe the earlier implementation.

## Exact failure and evidence

The reported registration prompt succeeded, while this request repeatedly
returned HTTP 502 with `INVALID_PROVIDER_OUTPUT`:

```text
Create a simple login form with email, password, and a Login button.
```

Using the same installed `qwen3:4b-instruct`, temperature 0, seed 0, context 8192,
and output budget 2048, two local API attempts reproduced the failure. Both
reached the **authoritative UI validator**, with exactly this issue:

```json
{
  "stage": "ui_schema",
  "message": "The model document failed authoritative UI validation.",
  "issues": [{
    "path": ["root", "children", 0, "id"],
    "code": "custom",
    "message": "Component IDs must be unique."
  }]
}
```

The form root and its first child reused the same ID. No raw IDs, model JSON,
labels, or submitted text were logged or saved during this investigation.

| Pipeline step | Observed result |
| --- | --- |
| Local HTTP request | Succeeded |
| HTTP body JSON parsing | Succeeded |
| Ollama response envelope validation | Succeeded |
| `message.content` JSON parsing | Succeeded |
| Output normalization | No normalization exists: parsed JSON is returned unchanged |
| Authoritative `uiSpecificationSchema` | Failed: duplicate component ID |
| Semantic coverage | Not reached until structural validation succeeds |

There were no optional-null, missing-prop, unsupported-component, or form-nesting
issues in these two responses. An in-memory check of known optional registry
properties also found no explicit null values. Optional properties remain
non-nullable; a separate regression confirms `disabled: null` is still rejected.

## Why the wording changed the result

The earlier form planner recognized only an exact simple introduction and a small
field/action vocabulary. In the registration request, every item was understood,
so the decoder got a fixed tuple of typed controls with distinct fixed IDs.

For the login request, two gaps forced the broader form grammar:

- `simple` was not an accepted introduction modifier.
- `Login button` was not recognized as a form-submit action; only explicit
  `submit` and `reset button` actions were understood.

The broader grammar enforces the shape of each node, but JSON Schema does not
generally express uniqueness of an `id` property across an arbitrary tree. Zod
correctly performs that whole-document check. This is why the failure was
`INVALID_PROVIDER_OUTPUT`, rather than a JSON parser error. The adapter did not
introduce the duplicate or remove controls.

## The fix

The existing conservative planner now accepts the harmless modifiers `simple`
and `basic`, and recognizes conventional form-submit labels `Login`, `Sign in`,
`Register`, and `Sign up`. The aliases are a small documented vocabulary, not
complete form response templates. They do not implement authentication.

The same request-derived tuple builder now constrains the login request to:

- A form and one vertical layout, with distinct container IDs.
- An email control with ID `control-email` and field name `email`.
- A password control with ID `control-password` and field name `password`.
- A button with ID `control-login`, label `Login`, and type `submit`.

Different requested fields still produce different tuples. The model generates
the document; no response fixture is substituted. It still chooses the form
label, field labels, and supported optional properties. Only recognized action
labels become fixed label constraints, preserving the requested action. System
instructions now explain these conventional submit labels and that “simple”
never authorizes omitting requested controls.

Final Zod validation remains mandatory. If Ollama ignores the supplied grammar
and sends duplicate IDs, the API still rejects the result. There is no ID
renaming, null stripping, JSON repair, extra inference retry, model switch, or
unconstrained fallback. The `GenerationProvider` interface and authoritative UI
schema were not changed.

## Opt-in local diagnostics

Diagnostics are **disabled by default** and require both settings:

```bash
NODE_ENV=development API_LOCAL_DIAGNOSTICS=true npm run dev:backend
```

Alternatively set both variables in your ignored local backend `.env`. The flag
is ignored if `NODE_ENV` is unset, `test`, or `production`. The backend remains
bound to loopback. Set `API_LOCAL_DIAGNOSTICS=false` or remove the flag to disable
it. No server/daemon environment files were changed during this investigation.

Failure metadata is written as JSON to stderr. Nothing is persisted by the
application or added to API responses. There are five supported stages:

| Stage | Meaning |
| --- | --- |
| `ollama_response_json` | Invalid HTTP body JSON or UTF-8 |
| `ollama_envelope` | Wrong/incomplete Ollama response envelope |
| `model_json` | `message.content` is not JSON |
| `ui_schema` | The final document violates the authoritative UI contract |
| `requirement_coverage` | A structurally valid UI omits recognized requirements |

Each record includes only stage, developer-owned messages, and bounded Zod issue
paths/codes. Arbitrary path keys are replaced by `[redacted]`. The formatter
never spreads Zod issues or logs their raw messages, unknown-key lists, nested
union details, expected literal values, exception messages, or model output.
Only exact allowlisted custom messages get a specific explanation, such as
duplicate IDs; other custom issues get a generic developer-owned message.
The formatter limits a record to 20 issues and each path to 24 segments. A failed
stderr/sink write cannot change API behavior. Existing request metadata logging
is separate and unchanged.

This mode diagnoses parse/envelope/UI/coverage failures. Existing stable API
error codes continue to identify network, timeout, size, and cancellation errors.
It is not a payload debugger or a complete trace of inference internals.

## Regression coverage and verification

`backend/test/fixtures/login-duplicate-id.json` is a developer-authored minimal
reproduction of the observed duplicate-ID relationship and issue path, not a
copy of a raw model response. Mocked HTTP tests show that parsing preserves it
unchanged and the final validator rejects it. Correcting that fixture's ID at
the source makes it valid; the API never performs that correction itself.

Additional tests cover the exact request's typed tuple/action label, other
recognized action aliases, unknown/repeated-action abstention, optional-null
rejection, precise parsing-stage diagnostics, sensitive-data redaction, disabled
and production/test modes, diagnostic volume bounds, and failed diagnostic sinks.
The new independent `simple-login` evaluation case checks all four requirements,
including the actual `Login` submit label and absence of unrelated fields.

After implementation, the same local API check returned HTTP 200 for **both
repeated login attempts and registration**, passing final Zod and runtime
coverage checks. This small smoke test establishes the specific regression;
it is not a statistical model-reliability benchmark. No model downloads, model
configuration changes, or raw response logging were needed.

Final checks under Node 22.14.0:

| Check | Result |
| --- | --- |
| `npm run build` | Pass, frontend and backend |
| `npm run lint` | Pass |
| `npm test` | **521 passed: 298 frontend + 223 backend** |
| Existing tests | Preserved; 30 additional regressions over the previous 491 |
| `git diff --check` | Pass |

Existing Vite bundle-size and Zod annotation warnings remain.

Changed files for this investigation:

| Files | Change |
| --- | --- |
| `backend/src/diagnostics.ts` | New opt-in, bounded, redacted failure formatter |
| `backend/src/ollamaProvider.ts` | Stage-specific parse/envelope diagnostics |
| `backend/src/app.ts`, `providers.ts` | Wire diagnostics without changing the provider interface or API envelope |
| `backend/src/requirementCoverage.ts` | Recognize simple/basic forms and conventional named submit actions; check requested labels |
| `backend/src/modelSchema.ts` | Constrain recognized action labels and explain their semantics |
| `backend/evaluation/coverageCases.ts` | Independent exact-request login coverage case |
| `backend/test/diagnostics.test.ts`, `ollamaProvider.test.ts`, `requirementCoverage.test.ts`, `fixtures/login-duplicate-id.json` | Safe diagnostics and login regression tests |
| `backend/.env.example` | Disabled diagnostic setting and development requirement |
| This document and the existing Ollama documentation | Setup, findings, updated scope, and results |

Unknown fields, custom layouts, arbitrary button labels, negation, and repeated
roles still select the general grammar or cause the planner to abstain. That
grammar can still generate invalid IDs, which Zod rejects. This fix covers the
recognized form language; it does not claim universal natural-language support.
The earlier non-form layout coverage limitation also remains.

Work stays on `feature/ai-component-generation`, preserving the earlier
uncommitted Phase 2B work. No frontend, Phase 2C, dependency, authoritative schema,
commit, push, or merge changes were made.
