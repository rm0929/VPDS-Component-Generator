# Investigating incomplete local UI generation

> Historical investigation: the current [UI draft compiler architecture](ui-draft-architecture.md)
> replaces model-generated IDs/names, request-specific grammars, and runtime
> keyword-based coverage rejection. Measurements below describe the earlier implementation.

## Why a valid response could still be wrong

The original registration response was a single `text` node. That is a valid
version 1.0 UI: the contract intentionally permits text-only interfaces. Zod
checks whether data describes a permitted, safe UI. It cannot know that the
user asked for five fields/checkboxes and a submit button unless we separately
represent those requirements.

The general decoding schema allowed any registered component at the root. It
did not require a form or any particular controls for a form request. The old
instructions described legal components and encouraged small output, but did
not sufficiently distinguish a complete interface from a description of one.
Temperature was already zero; lowering it could not fix this missing constraint.

The output adapter does not traverse, filter, shorten, or repair the component
tree. It parses the HTTP envelope, then parses `message.content` and returns it
unchanged to the API's Zod validator. Regression tests pass both a complete tree
and the reported text-only response through this path. There is no adapter step
that could turn a complete registration tree into the observed single node.
Historical raw Ollama messages were not retained, so this is a finding about the
code path, not a claim that an old raw message was recovered.

## Changes and their purpose

1. **Explicit instructions and a complete example.** The system message now says
   every requested supported field/action needs its own correctly typed node.
   A title or a list of field names does not count. Password and confirmation are
   distinct password inputs; terms is a checkbox; submit is `type: "submit"`.
   The existing full registration fixture is embedded as a Zod-validated example,
   with instructions to adapt it and avoid copying unrelated fields.
2. **A small, inspectable request checklist.** `deriveFormExpectation` recognizes
   explicit English form field lists. It understands name, first/last name,
   email, password/confirmation, terms, short message, submit, and reset button.
   It extracts fields after a list marker, so “password reset form with email”
   does not incorrectly require a password input. Negative/conditional or
   descriptive requests cause it to abstain rather than invent a positive plan.
3. **Request-specific decoding constraints.** Explicit positive form requests
   select a form root. Fully recognized simple lists additionally get a fixed
   tuple of typed controls inside one vertical layout. The tuple is built from
   the checklist, so login, contact, and registration have different fields.
   It fixes unique IDs, role-based field names, and submit/reset types; the model
   still generates labels and supported optional properties. Every property
   schema comes from the authoritative registry.
4. **A coverage gate after Zod.** For non-mock output, known requested controls
   must actually occur together in one form. A password field cannot count twice;
   a label saying “Submit” cannot turn an ordinary button into a submit button.
   A structurally valid but incomplete result returns HTTP 502 with stable code
   `INCOMPLETE_REQUIREMENTS`. Unsafe/invalid structures still fail first with
   `INVALID_PROVIDER_OUTPUT`. Neither error reveals raw output or submitted text.
5. **An independent evaluation suite.** Human-authored expectations measure the
   result, separately from automatic checklist extraction. They also detect
   unrelated fields copied from the worked example.

The grammar is a narrower subset of the existing UI contract, not a replacement
contract. No schema rule was loosened. The adapter does not add omitted nodes,
substitute a fixture, retry, or execute model output. The mock provider retains
its previous behavior. There is no frontend or Phase 2C change.

### Why use a typed tuple for simple forms?

In a general array, the model can legally stop after one child. In a fixed tuple,
each position has an expected type and the array has an exact length. That makes
omitting the confirmation input or changing email into text impossible for a
decoder that honors the supplied grammar. Draft 7 tuple arrays are supported by
the upstream [llama.cpp JSON Schema grammar implementation and tests](https://github.com/ggml-org/llama.cpp/blob/master/tests/test-json-schema-to-grammar.cpp).
Actual behavior is still checked against the installed Ollama runtime and final
Zod validator; JSON Schema support can vary between runtime versions.

This approach is deliberately narrow. The entire simple field list must be
understood, with no unknown words/modifiers/repeated roles. The introduction must
be a simple create/build/make/generate request for a generic, registration,
signup, login, contact, or password-reset form. A custom label, optional/required
modifier, unknown field, heading, or layout instruction selects the full form
grammar instead. For example, a horizontal layout request is never silently
forced into the simple vertical tuple. Ambiguous/non-form prompts retain the
general grammar. This trades layout freedom for coverage only on an explicit,
documented subset, rather than pretending a few regular expressions understand
all natural language.

## Measuring semantic coverage

For the reported request, the independently specified checklist is:

| Requirement | Evidence required |
| --- | --- |
| Form | A real form container |
| Name | A distinct name `textInput` |
| Email | An `emailInput` |
| Password | A primary `passwordInput` |
| Confirm password | A separate confirmation `passwordInput` |
| Terms | A terms `checkbox` |
| Submit | A button whose type is `submit` |

Coverage is matched requirements / expected requirements: the original title-only
response scores **0/7**, despite passing Zod. The complete existing fixture scores
**7/7**. All controls must belong to the same form; two partial forms cannot be
combined to pass. Names/labels identify field roles. Offline cases additionally
reject unrelated fields, so copying the registration example for a login request
fails even if it contains all login fields. Non-form cases check component types
and nesting presence, not exact prose or visual quality.

Six curated cases live in `backend/evaluation/coverageCases.ts`: registration,
login, contact, split-name signup, password reset, and horizontal heading/text.
The subsequent [simple-login investigation](ollama-login-diagnosis.md) adds a
seventh case with a named Login submit action, support for simple/basic modifiers,
and opt-in safe failure diagnostics.
Their expectations are manually authored, not generated by the recognizer or
the model. Tests check complete outputs, omitted controls, incorrect types,
confirmation conflation, invalid structures, and unwanted copied fields.

Evaluate either a saved UI document or an API response envelope, without Ollama:

```bash
npm run eval:coverage --workspace @vpds/backend -- registration "$PWD/src/specification/fixtures/registration-form.json"
npm run eval:coverage --workspace @vpds/backend -- login /absolute/path/to/login-response.json
```

The command reports schema validity, assessment status, coverage fraction,
matched/missing requirements, and unexpected field IDs. Exit status is 0 for a
pass, 1 for a failed quality/structure check, and 2 for usage/file/JSON errors.
It reads files only, caps input at 1 MiB, performs no inference, and prints no
prompt or generated label values.

For future prompt/model changes, run each curated request several times using
the same model/settings, score against these independent expectations, and
report strict-schema pass rate, complete-coverage rate, unwanted-field rate,
latency, and failures per case. Compare cases individually, not just averages:
a 6/7 registration form is still a failed registration request. Keep live checks
manual and outside CI; mocked HTTP regression tests remain deterministic.

## Limitations and safety boundaries

- This recognizer is a small English subset, not an LLM planner or a general
  semantic validator. Automatic coverage can assess only recognized requirements;
  it does not certify all requirements in arbitrary prompts. When it abstains,
  `assessed` is false and coverage is null, rather than claiming 100% success.
- Unknown fields, relationships, exact wording, most property modifiers,
  multilingual instructions, multiple forms, and visual quality need manual
  review and richer future evaluations. Offline evaluators may explicitly check
  `required`, but the runtime extractor currently measures roles/actions only.
- Fixed IDs/names are decoding constraints for simple forms, not generated-data
  rewrites. Labels remain model output; role/name coverage does not prove every
  label is good. The example can bias optional properties or wording.
- The full grammar still needs Zod for uniqueness, total node count, custom text
  restrictions, and indirect form nesting. A runtime that ignores grammar rules
  may still produce rejected output. There is no automatic retry/fallback.
- Temperature 0 and seed 0 reduce variation but do not guarantee identical output
  across runtimes, hardware, model revisions, or context changes. Model name,
  context/output limits, cancellation, response-byte bounds, and loopback-only
  HTTP behavior remain unchanged.
- No generated code is executed, no prompts are stored by the application, and
  there is no real form submission, authentication, or password matching logic.

See [local Ollama setup](phase-2b-local-ollama.md) for configuration and errors.

## Verification and live observations

Inspection confirmed the existing temperature was already 0. A live test using
stronger wording, the full example, and only a form-root restriction still
returned one ordinary button and a duplicated ID. Zod rejected it. This is why
the final implementation also uses request-derived typed slots, rather than
claiming the improved wording alone solved the issue.

After the typed-slot change, the original registration request produced all
five requested fields/checkboxes and a submit button, with distinct IDs/names,
correct types, meaningful labels, and the existing form/layout structure.
Direct provider validation passed. A separate end-to-end local API run produced
these results with the same installed `qwen3:4b-instruct`, temperature 0, seed 0,
8K context and 2K output budget:

| Case | HTTP | Zod valid | Coverage | Approximate elapsed |
| --- | --- | --- | --- | --- |
| Registration | 200 | Yes | 7/7, no extra fields | 8.6 s |
| Login | 200 | Yes | 4/4, no extra fields | 3.4 s |
| Contact | 200 | Yes | 5/5, no extra fields | 4.0 s |
| Split-name signup | 200 | Yes | 5/5, no extra fields | 4.4 s |
| Password reset | 200 | Yes | 3/3, no extra fields | 2.8 s |
| Horizontal heading/text | 200 | Yes | **0/3: failed** | 1.1 s |

This six-request smoke test has a 6/6 structural pass rate and a **5/6 complete
semantic pass rate**. It is not a statistical reliability or memory benchmark.
Registration passed in both the direct-provider check and the end-to-end API
check. The non-form case uses the unrestricted grammar and has no automatic
runtime checklist, so its incomplete result still receives HTTP 200. The offline
human-authored evaluation exposes this remaining gap. General layout coverage
needs future work; this investigation does not claim arbitrary-prompt success.

No model or daemon settings were changed, no weights were downloaded, and no
production secrets were used. Live requests used only these synthetic examples.
CI tests use mocked HTTP responses and never make inference calls.

Final verification under Node 22.14.0:

These results describe this original six-case investigation. The subsequent
[login report](ollama-login-diagnosis.md) records the latest checks (521 tests).

| Check | Result |
| --- | --- |
| `npm run build` | Pass, frontend and backend |
| `npm run lint` | Pass |
| `npm test` | Pass: 298 frontend + 193 backend = **491 tests** |
| Existing tests | All preserved; 59 additional semantic regressions over the initial Phase 2B suite |
| Offline original incomplete response | Correctly fails, 0/7, exit 1 |
| Offline fixture and saved complete live response | Both pass, 7/7, exit 0 |
| `git diff --check` | Pass |

Existing Vite bundle-size and Zod comment-annotation warnings remain. Checks ran
on `feature/ai-component-generation`. No commit, push, merge, or Phase 2C work
was performed.

Changed implementation files for this investigation:

- `backend/src/modelSchema.ts`: complete example, explicit coverage instructions,
  optional form root, and request-derived typed tuples.
- `backend/src/ollamaProvider.ts`: select the request's constrained grammar and
  append a controlled checklist; preserve lossless output parsing/settings.
- `backend/src/requirementCoverage.ts`: bounded role recognizer, conservative
  tuple eligibility, and separate validated-tree coverage evaluation.
- `backend/src/app.ts`, `errors.ts`: post-Zod non-mock coverage gate and safe error.
- `backend/test/modelSchema.test.ts`, `ollamaProvider.test.ts`,
  `requirementCoverage.test.ts`: deterministic schema/prompt/adapter/API/quality
  regressions, including both observed live failure shapes.
- `backend/evaluation/coverageCases.ts`, `runCoverage.ts`: independent quality
  cases and the offline evaluator.
- `backend/package.json`, `tsconfig.json`: evaluation command and type checking.
- This document and `docs/phase-2b-local-ollama.md`: explanation, commands,
  measured outcomes, and limitations.

The authoritative frontend UI schema, registry, fixture, preview, and keyword
generator were not modified. No dependencies, lockfiles, CI configuration, or
model settings were changed by this investigation. The working tree also contains
the earlier uncommitted Phase 2B implementation; it was preserved.
