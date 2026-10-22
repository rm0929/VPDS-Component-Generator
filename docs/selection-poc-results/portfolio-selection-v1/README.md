# Portfolio component-selection milestone

This report covers one focused implementation and one bounded real-Qwen3
acceptance pass. It does not replace the earlier evidence. All historical
benchmarks, prompts saved in old result directories, datasets and expectations
remain unchanged. No model change, dependency upgrade, prompt-based routing,
keyword correction, planner, retry loop or new evaluation framework was added.

## What changed and why

At inspection, the working tree already implemented all 17 requested selection
types through the strict registry, deterministic compiler, Nova renderer, and TSX
generator. No new component family was needed. Saved raw responses showed that
incorrect button/checkbox/textarea choices originated in Ollama, before parsing
and compilation. Each serialized schema variant was already constrained to its
own properties; validation was not dropping or converting components.

The focused change is a single typed model-facing catalog in the existing
`backend/evaluation/selection-poc/model.ts`. The prompt and JSON Schema annotations
share its meanings and representative property examples. Types are checked
against the actual property validators, and automated tests compile every catalog
example. Three short complete single-component examples and one representative
access form demonstrate the intended output, without matching user prompts in
TypeScript or prescribing responses at runtime. Explicit labels, destinations,
input kinds, states, and minimal composition are called out together.

The JSON Schema retains the same acceptance grammar, property order, strict
objects, union, bounds and version. Only standard description/examples annotations
are added. A test strips those annotations and compares the entire grammar with
the original Zod-generated schema. Annotations are explanatory metadata; Ollama
may use them differently from prompt text. They are not semantic validation.

The composer, authoritative schema, API envelope, production HTTP transport,
timeout/cancellation, guard and baseline draft/semantic workflows are unchanged.
There is still one inference call per request. No wrong output is repaired or
substituted. The existing default frontend continues to require a real
`ollama-local-flat-selection` result and reject mock/wrong workflows.

The frontend adds a native keyboard-operable example disclosure, simpler-request
advice, and an explicit warning that examples are not guaranteed outputs. It does
not claim to detect semantic uncertainty. Payment preview fields request
`autoComplete="off"`; there is no new field-state, persistence, logging or network
handler. Input values remain local DOM values and form submission is prevented.
Only the prompt and specification travel through the existing generation path.
Use synthetic card details only; browser/password-manager behavior is outside
this app's control. Copied payment UI does not perform processing, card validation,
authentication, tokenization or secure payment collection.

## Supported families and examples

These are implemented preview/code capabilities, **not guaranteed model accuracy**.
All remain visibly experimental. Labels, wrappers and accessible native bindings
are created by trusted TypeScript, not generated executable source.

| Family | Request users can try | Implementation |
| --- | --- | --- |
| Text input | Create a text input labeled Full name. | Nova Input type text + Label/InputContainer |
| Email input | Create an email input labeled Work email. | Input type email |
| Password input | Create a disabled password input labeled Secret. | Masked Input type password |
| Textarea | Create a multiline Notes field. | Labeled Nova Textarea |
| Checkbox | Create a required checkbox labeled Accept terms. | Checkbox + associated Label |
| Switch | Create a switch labeled Email alerts. | Switch + SwitchLabel |
| Radio group | Create a Delivery radio group with Standard and Express options. | Native fieldset/legend, Nova Radio/Label; one shared name |
| Native select | Create a Country select with Canada, France, and Japan. | Nova Select, native option values, associated label |
| Button | Create a disabled ordinary button labeled Preview. | Nova Button, native button/submit/reset type |
| Heading | Create a level 2 heading with the exact text "Account overview". | Typography h2/headline-2 |
| Text | Create a paragraph with the exact text "Changes saved.". | Typography paragraph |
| Link | Create a link to https://design.visa.com/ labeled Visa design. | Nova Link; validated href retained in TSX; preview navigation prevented |
| Badge | Create a text badge saying Ready. | Text-only Badge |
| Divider | Create a section divider. | Divider |
| Content card | Create a content card with title Project status and description Ready for review. | ContentCard/Body/Title, paragraph, optional fixed button/link action |
| Payment-card fields | Create payment-card input fields. | Number, expiry and masked security-code Input/Label composition; optional cardholder |
| Progress | Show Upload progress at 40 percent. | Labeled ProgressLinear, max 100; unknown progress omits value |

Select/radio options remain bounded unique strings. Card actions are optional;
non-navigation actions have no business implementation. Progress is static or
indeterminate, not tied to a running operation. Layout remains vertical blocks,
adjacent horizontal runs and one optional accessible form. No arbitrary CSS,
callbacks, JSX, IDs, names or graph references come from the model.

## Frozen acceptance plan

[inputs.json](inputs.json) was saved before inference and its hash was checked
again afterward. It contains the exact 22 prompts and their expected types,
properties, form membership, and horizontal-group count. There is one request
per selectable type, a second progress mode, two login requests, and two natural
requests without component names. No new family was added in this change.

- Ordered component types must match exactly: no missing/extra selections.
- Required explicit properties match exactly. Unspecified optional properties are
  recorded rather than scored as explicit requirements.
- All expected controls must have the declared form membership, with no
  unrequested form or horizontal group.
- Payment composition must render labeled number/expiry/masked security code.
- Structural validity, actual Nova rendering, preview/code structure consistency
  and generated-TSX type checking are separate technical checks.

The property metric is conservative and position-aligned: a wrong/missing type
also fails its required-property slot. For basic login, the unrequested checkbox
occupies the expected submit slot; the actual submit button itself is correct.
The raw response and observations below preserve this distinction. No scoring
or expectations were adjusted after seeing output.

## First-attempt results

| Case | Type list | Required props | Composition | Actual observation |
| --- | --- | --- | --- | --- |
| text-input | Pass | Pass | Pass | Full name text input |
| email-input | Pass | Pass | Pass | Work email email input |
| password-input | Pass | Pass | Pass | Secret password input, disabled:true |
| textarea | Pass | Pass | Pass | Notes textarea, rows:4 |
| checkbox | Pass | Pass | **Fail** | Correct required Accept terms checkbox, but an unrequested form |
| switch | Pass | Pass | Pass | Email alerts switch, initially off |
| radio | Pass | Pass | Pass | Delivery radios, Standard then Express |
| select | Pass | Pass | Pass | Country dropdown, Canada/France/Japan |
| button | Pass | **Fail** | Pass | Preview ordinary button, **disabled omitted** |
| heading | Pass | Pass | Pass | Exact Account overview, h2 |
| text | Pass | Pass | Pass | Exact Changes saved. paragraph |
| link | **Fail** | **Fail** | Pass | Visa design ordinary button; **no href** |
| badge | Pass | Pass | Pass | Ready text badge; model chose stable variant |
| divider | Pass | Pass | Pass | Section divider |
| content-card | Pass | Pass | Pass | Actual contentCard with exact title/description |
| payment-card | Pass | Pass | Pass | Correct three-field composition, includeCardholder:false |
| progress | Pass | Pass | Pass | Upload determinate progress, value:40 |
| progress-indeterminate | Pass | Pass | Pass | Loading progress without value |
| login | **Fail** | **Fail*** | Pass | Email input + masked password + submit in a form, **plus unrequested Remember me checkbox** |
| login-remember | **Fail** | **Fail** | Pass | **Only Remember me checkbox** inside a form; email/password/submit absent |
| natural-notes | Pass | Pass | **Fail** | Correct Feedback textarea, **unrequested form** |
| natural-toggle | Pass | Pass | Pass | Notification emails switch |

*Basic login's requested input kinds and submit behavior were present; it fails
strict list/position criteria because of the extra checkbox. This is not a claim
that the actual submit button had an incorrect type.*

No retries, manual corrections or inference followed this pass. All 22 raw bodies
were saved and flushed before parsing/checks; every call returned normally with
no provider validation failure. Actual raw types are preserved by the compiler.

Separate totals:

- Exact ordered component lists: **19/22**.
- Position-aligned required-property checks: **18/22**.
- Expected composition: **20/22**.
- Every frozen semantic requirement satisfied: **16/22**.
- Selection/composition/authoritative structural validation: **22/22**.
- Actual installed Nova server rendering: **22/22**.
- Generated TSX AST matches the shared preview presentation: **22/22**.
- Generated TSX compilation: **22/22**, zero TypeScript diagnostics.
- Provider latency: median **1.237 s**, p95 nearest-rank **2.037 s**; maximum
  **4.347 s**. Nine earlier cases are not treated as a comparable baseline.

Settings remained qwen3:4b-instruct, Ollama 0.40.5, temperature 0, seed 0,
think:false, stream:false, context 8192, output limit 2048, timeout 60000 ms,
response limit 65536 bytes. Exact model digest, prompts, schema, messages and
source fingerprints are in [metadata.json](metadata.json).

This is real loopback Ollama through the existing production provider transport,
then trusted React/Nova server rendering and static code inspection. It is not a
new browser or Vite-proxy review. API/lifecycle and default-AI routing remain
covered by automated tests using mocks. Server rendering does not establish
visual layout, native keyboard behavior or assistive-technology behavior for
these live results. No model-accuracy claim is made from mocked tests.

## Remaining limitation and next decision

Basic selection remains unreliable after the focused change: especially links,
login with extra requirements, required/disabled flags, and unwanted form creation.
The app cannot detect these semantic errors today. They remain experimental,
even when validation and TypeScript succeed. Historical disabled/layout failures
remain relevant; this pass did not test side-by-side requests. Single attempts
are not a reliable estimate of repeatability or a controlled prompt comparison.

Stop further tuning. Before describing generation as reliable, the concrete next
decision is whether to authorize **one local-model comparison on these unchanged
cases**. No comparison or model change has begun. Meanwhile the frontend can
remain an honest experimental portfolio demonstration of validated Nova rendering
and reusable code, with the failures visible in its evidence.

Defer dialogs/modals, tabs, accordions, data tables, date pickers, rich navigation,
searchable/multi-select controls and real payment flows. Those need interaction,
data/state and accessibility contracts beyond the existing flat selections.
Legacy preview imports do not make them supported in the AI catalog.

## Verification and exact change scope

- `npm run build`: frontend and backend pass; existing large-bundle and Zod
  annotation warnings remain.
- `npm run lint`: pass.
- `npm run test:frontend -- --reporter=dot`: **781 pass** (including examples,
  false values, Nova/TSX structure, generated-code compilation and clipboard/races).
- `npm run test:api`: **782 pass**; automated provider/API checks use mocked
  responses/local fake servers and do not invoke Ollama.
- All 22 real-model generated sources compiled separately with zero diagnostics.
- `git diff --check`: pass.

Files changed **during this milestone**, distinguished from the substantial
pre-existing uncommitted implementation:

1. `backend/evaluation/selection-poc/model.ts` — typed catalog, descriptive schema
   annotations, one prompt/example revision.
2. `backend/test/selectionPoc.test.ts` — unchanged grammar assertion, all catalog
   examples, valid complete demonstrations, updated current hashes. Frozen case
   files and historical hashes/results were not edited.
3. `src/components/AiGeneratorSection.tsx` — visible examples, honest simpler-input
   guidance, synthetic payment-data note.
4. `src/components/AiGeneratorSection.test.ts` — example disclosure and wording checks.
5. `src/specification/presentation.ts` — fixed autocomplete off for payment inputs.
6. `src/specification/practicalComponents.test.ts` — verify the fixed payment attribute.
7. `README.md` — link to this milestone's actual evidence.
8. This new directory only: `README.md`, `inputs.json`, `metadata.json`,
   `results.json`, plus each of the 22 case IDs' `.http.json`, `.response.raw`,
   `.outcome.json` and `.checks.json` records. All prompts are synthetic. No
   actual environment, secrets, entered input values, build output or caches included.

Full response records are diagnostic artifacts for this manual pass, not runtime
logging or an added evaluation framework. The temporary runner reused existing
metadata/production-provider/TSX-check helpers and was not added to the repository.
No files were staged, committed or pushed. Existing local work is preserved.
