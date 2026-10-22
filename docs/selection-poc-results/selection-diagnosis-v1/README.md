# Component-selection regression: targeted diagnosis

**No application implementation defect was identified. No production code,
prompt, schema, model, dependency, or historical benchmark was changed.** The
requested ten diagnostic calls were completed before considering a correction.
Wrong component choices already exist in raw Ollama output, and the compiler
faithfully preserves them. The selection regression remains unresolved.

## Exact boundary examined

- [metadata.json](metadata.json) records the actual shared messages, complete
  serialized JSON Schema, runtime/settings, and source fingerprints.
- [inputs.json](inputs.json) was saved before inference and contains the five
  fixed prompts and two-repetition/no-retry policy.
- Each `CASE-N.request.json` is the exact serialized body sent to Ollama.
  Each `CASE-N.response.raw` is the complete raw HTTP response body, streamed to
  disk and fsynced before provider JSON parsing, compilation, or semantic checks.
- [summary.json](summary.json) compares raw selections with final specifications,
  records separate type/property/form/layout checks, and contains generated TSX.
  Per-attempt HTTP metadata, immediate outcomes, and check records are retained.

Calls used the existing `createOllamaProvider` with a recording fetch wrapper,
then the real loopback Ollama HTTP API. They were **not browser requests** and
did not use the manual PoC transport or a mock provider. The wrapper records
requests/responses; the existing production provider performs parsing,
validation, composition, cancellation/deadline handling, and final validation.
One provider call and one HTTP inference request were made for each repetition:
**ten total, no retries, no corrections between attempts**.

Model: qwen3:4b-instruct; Ollama 0.40.5. Temperature 0, seed 0, context 8192,
output limit 2048, thinking/streaming off, keep-alive 2m, timeout 60000 ms,
response limit 65536 bytes. Model digest and prompt/schema hashes match the
prior component-increment run. All inspected source hashes remained unchanged.

## Schema, catalog, and compiler findings

The exact request schema has twelve `components.items.oneOf` branches. Each
requires `type` and `props`, fixes `type` with its own literal `const`, binds
that type to its own property object, and rejects additional properties at both
levels. [schema-assessment.json](schema-assessment.json) records checks using
the already installed Ajv against the serialized schema and the existing Zod
schema. Five valid minimal cases passed both validators, and six cross-type/
missing-property cases failed both. Both existing assistant examples validate.

Examples of correctly rejected combinations include switch with rows,
textarea with defaultChecked, email/password with rows, button with href,
and link without href. Identical label/disabled property names in different
branches do not make their type discriminators interchangeable. Custom
literal-text and safe-URL refinements remain enforced by Zod even though those
custom refinements are not expressed in the generated JSON Schema.

The catalog explicitly distinguishes ordinary text, email, masked password,
multiline textarea, on/off switch, and navigation link. Instructions require
preserving controls and forbid substituting a button for a link. Neither
example conflicts: one combines text/button, the other textInput/submit in a
form. The examples do not demonstrate most catalog types; whether broader
examples would improve selection is untested, not an established defect.

The raw response directly names the incorrect types. For example:

```json
{"props":{"label":"Email alerts","disabled":false,"required":false},"type":"checkbox"}
```

The compiler does not rename this to checkbox: it receives checkbox, retains
that type and those properties, and generates only its technical ID/name.
The raw login responses already contain textarea nodes with rows:1 for Email
and Password. A textarea labeled Password is structurally valid but does not
mask passwords or implement a password field. Static validation cannot infer
that the user's request required another otherwise permitted type.

An observed clue for a future controlled investigation is property ordering:
the request schema lists `type` before `props`, but raw component objects
consistently emit `props` before `type`. JSON Schema does not itself require
object-property order. Whether decoder ordering contributes to selection
errors is **not proven** by these captures. No ordering experiment was made.

## Fixed-prompt results

| Exact prompt | Attempt 1 | Attempt 2 | Requested properties, assessed separately | Form/layout |
| --- | --- | --- | --- | --- |
| Create a switch labeled Email alerts. | checkbox — fail | checkbox — fail | Exact label retained; added disabled:false and required:false | No form, one leaf |
| Let me turn email notifications on or off. | switch — pass | switch — pass | Descriptive label; disabled:false; initial state was not requested | No form, one leaf |
| Create a multiline Notes field. | textarea — pass | textarea — pass | Notes label retained; added placeholder, rows:5, required:false | No form, one leaf |
| Create a link labeled Visa design guidance pointing to https://design.visa.com/. | button — fail | button — fail | Exact label retained; destination missing — fail | No form, one leaf |
| I need a login form with remember me. | textarea, textarea, checkbox, button — fail | Same types — fail | Email/Password/Remember me/Login labels and submit type retained; wrong field types remain a material failure | All controls in named Login form, vertically stacked |

Component-type success: **4/10 attempts**. All ten raw selections and compiled
specifications validate. All raw types and supported properties are preserved
in compilation; only generated IDs, field names, and wrappers are added.
Label/destination/submit-property checks pass 8/10, independently of type
selection. This does not turn wrong component choices into successful UIs.

All form-membership checks pass. No exact layout was requested; observed layouts
are single leaves or a default vertical login form, without unrequested
horizontal groups. Layout checks here do not measure complex composition.
Unspecified defaults added by the model are recorded rather than treated as
requested properties or silently removed. The two login repetitions differ
only in explicit versus omitted besidePrevious:false flags; both stack vertically.

## Verification and decision

- **121 focused tests passed** across selectionPoc, additionalSelection, and
  flatSelectionProvider. HTTP in those tests is mocked; inference is separate.
- All ten generated TSX sources compiled against installed React/Nova with
  **zero TypeScript diagnostics**. Source was not executed.
- Exact request/response records, repetition counts, type/property preservation,
  schema/prompt fingerprints, and unchanged source hashes were checked.
- `git diff --check` passed. No full build/lint rerun was needed because no
  production or test code changed during this diagnosis.

Per the requested stop condition, no speculative fix was applied. A possible
next step for review is an isolated investigation of discriminator-first
decoding versus the observed props-first output, keeping semantic meaning and
strict validation unchanged. The evidence does not yet justify changing the
runtime schema or claiming that such an experiment would fix these failures.
All five new component implementations and existing local work are preserved.
