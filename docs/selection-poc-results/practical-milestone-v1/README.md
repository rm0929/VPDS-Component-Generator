# Practical component-support milestone

This is one acceptance pass after **one** flat-selection instruction/catalog
revision. The proposed output-order experiment never ran. There were no retries,
model changes, per-prompt fixes, keyword overrides, new planning stages, or
subsequent tuning. Historical datasets and benchmark results are unchanged.
Backend experimentation stops here pending a new decision.

## Supported families and implementation

The existing default AI flow remains natural language → local Ollama → strict
flat selection → deterministic composition → authoritative UiSpecification v1.0
→ Nova suggestions, preview and reusable TSX from that same specification.
There are now 17 selectable types and three structural specification types
(vertical layout, horizontal layout, form). All AI selection remains experimental.

| Family | Selection type / installed Nova 2.5.4 exports | Limits and behavior |
| --- | --- | --- |
| Single-line fields | textInput, emailInput, passwordInput / Input, Label, InputContainer | Native text/email/password, existing bounded properties |
| Multiline field | textarea / Textarea, Label, InputContainer | rows 1–20, maxLength 1–1000 |
| Checkbox | checkbox / Checkbox, Label | Native required/disabled behavior |
| On/off setting | switch / Switch, SwitchLabel | Uncontrolled defaultChecked; explicit false preserved |
| Native dropdown **new** | select / Select, Label, InputContainer | 1–20 unique nonblank string options; optional matching defaultValue, required, disabled |
| Radio group **new** | radioGroup / Radio, Label | 2–20 unique string options; same optional properties as select; fieldset/legend and shared native radio name |
| Actions/navigation | button / Button; link / Link | Ordinary/submit/reset buttons; HTTP(S)/relative destinations only; preview navigation suppressed |
| Content | text, heading / Typography | Literal bounded text; heading levels 1–4 |
| Status/separation | badge / Badge; divider / Divider | Text badges only; horizontal decorative/section dividers |
| Content summary **new** | contentCard / ContentCard, ContentCardBody, ContentCardTitle, Typography | Required title ≤200 and description ≤1000 characters; optional action with label and optional safe href. No href means ordinary button |
| Payment fields **new** | paymentCard / Input, Label, InputContainer, Utility | Required group label; card number, expiry (MM/YY), masked security code; optional includeCardholder, required, disabled |
| Linear progress **new** | progress / ProgressLinear, ProgressLabel | label and mode; determinate requires value 0–100; indeterminate rejects value; optional paused |

At most 20 flat selections, adjacent horizontal groups, vertical stacking, and
one optional form. No arbitrary JSX, CSS, handlers, dynamic imports, or evaluation
of generated source. Unsupported properties/types are rejected, never repaired.

Choice strings serve as both native option labels and values; custom objects,
per-option disabled states, multiple selection, searchable selects, and remote
data are outside this increment. Without defaultValue, select follows native
first-option behavior and radios begin unchecked. Default membership is checked
at both the flat selection and authoritative document boundaries.

Payment fields reuse the existing project's Nova Input/Label pattern, without
its icons, dynamic expiry-year list or inline styling. They are a fixed registered
composition, not a natural-language template. There is no payment service,
Luhn/expiry/card-brand validation, formatting, secure tokenization, or real card
handling. Do not enter actual card details in this demo. Required means native
non-empty checking only. Group-level required/disabled flags apply to each input.
No field values can be supplied through the payment-card specification.

Composite DOM IDs use a double-hyphen suffix, which specification IDs cannot
contain, avoiding sibling collisions. Payment input names use a bracket namespace
(e.g. card-details[number]); other validated field names cannot contain brackets.
The existing compiler still assigns each specification node's ID and unique name.
Radio options intentionally share their group's name for native exclusivity.

Progress is a static example of a value or an indeterminate indicator, not an
upload/job implementation. Paused controls Nova animation, not a running task.
Card buttons have no business action; card links use the same preview navigation
guard and safe URL validator as standalone links. Copied links retain destinations.
Copied forms prevent submission until a developer implements application behavior.

Preview and TSX reuse the same allowlisted presentation vocabulary. Native
option/fieldset/legend elements are emitted as HTML, never imported from Nova.
Generated code requires React, react-dom, @visa/nova-react 2.5.4 and the host's Nova
style/theme setup, as described in [frontend setup](../../experimental-ai-frontend.md).
There are no new dependencies. Existing draft/semantic model catalogs and transport
settings remain unchanged; only the flat-selection catalog/instructions expand.

## Exact prompts and first results

Prompts were saved in [inputs.json](inputs.json) **before** inference. One attempt
each; both progress modes are separate checks. This is a small feasibility pass,
not a general accuracy benchmark or proof of improvement over historical results.

| Exact prompt | First actual result | Semantic outcome |
| --- | --- | --- |
| Create a Country select with Canada, France, and Japan. | select; exact label/options/order; defaultValue Canada; no form | Correct requested family/options; model supplied an unspecified initial selection |
| Create a Delivery radio group with Standard and Express options. | radioGroup; exact label/options/order; required:false; no form | Correct; optional initial state unspecified, none selected |
| Create a content card titled Project status, with description Ready for review and a Details button. | heading Project status (h2), heading Ready for review (h3), ordinary Details button; vertical, no card | **Fail:** no contentCard; description incorrectly became a heading |
| Create payment-card fields with card number, expiry, and security code. | paymentCard labeled Card details; includeCardholder:true; no form | Correct family and requested fields; **extra unrequested cardholder field** |
| Show Upload progress at 40 percent. | progress, label Upload, determinate, value 40; no form | Correct |
| Show an indeterminate Loading progress indicator. | progress, label Loading, indeterminate, no value; no form | Correct |
| Create a switch labeled Email alerts. | switch, exact label, defaultChecked:false; no form | Correct; default state was unspecified |
| Create a link labeled Visa design guidance pointing to https://design.visa.com/. | ordinary button with correct label; no href, disabled:false; no form | **Fail:** wrong family and missing destination |
| I need a login form with remember me. | Form Login containing three ordinary buttons: Email, Password, Remember me | **Fail:** form exists, but email/password inputs, checkbox and submit control absent |

No horizontal relationship was requested in these prompts; none was generated.
Payment-field order is the registered number/expiry/security-code composition,
with the optional extra cardholder field preceding it. No unsupported outcome or
validation failure occurred; incorrect selections passed validation because their
shape was legal. **Structural validity is not semantic correctness.**

All 9 responses passed selection/composition/final specification validation,
rendered using the actual installed Nova components with React server rendering,
and their generated TSX compiled with zero TypeScript diagnostics. Six of nine
requests selected the intended family/composition; the content-card, link and
login requests failed basic selection. Payment selection also added an unwanted
field. This intentionally reports these differences rather than one aggregate
"success" score.

Measured production-provider latency: median **1.293 s**, maximum/p95 (nearest
rank over nine attempts) **3.962 s**. Small sample; not a performance guarantee.

## Records and checks

- [metadata.json](metadata.json): exact system/example messages, model-facing
  schema, source fingerprints, model digest, runtime version and inference settings.
- Each `*.response.raw`: full original Ollama HTTP body, flushed to disk **before**
  parsing/validation. Synthetic prompts only; no environment files or credentials.
- Each `*.http.json`: status and loopback request path (`/api/chat`).
- Each `*.outcome.json`: provider result/errors recorded before further checks.
- Each `*.checks.json`: per-attempt structure, static Nova rendering and generated code.
- [results.json](results.json): final results including compilation checks.

Real Qwen3 model: qwen3:4b-instruct, Ollama 0.40.5, temperature 0, seed 0,
context 8192, maximum output 2048, think:false, timeout 60000 ms, response limit
65536 bytes. No downloads, changed inference settings, or mock substitution.
Requests used the existing production createOllamaProvider and HTTP transport
against loopback Ollama; this pass did **not** exercise a browser or the Vite proxy.
No new browser review cycle or evaluation framework was introduced. Automated
mocked transport checks are separate from these real-model observations.

Verification for the increment:

- `npm run build`: frontend and backend pass. Existing Zod annotation and large
  bundle warnings remain.
- `npm run lint`: passes.
- `npm run test:frontend -- --reporter=dot`: 780 pass, including strict bounds,
  native accessible labeling, composites, explicit false/zero, preview/TSX
  consistency, and representative generated-code compilation.
- `npm run test:api`: 764 pass, including mocked Ollama cases for the new families,
  default membership, strict existing errors, cancellation and API/proxy checks.
- All 9 first-response TSX outputs: zero TypeScript diagnostics against installed Nova.
- `git diff --check`: passes.

An initial new assertion assumed HTML attribute order and was corrected; the
implementation already emitted the correct password type. Backend socket tests
need execution outside the sandbox. The initial invocation from the repository
root found no backend tests; they were then run using the package's own command.
No production fixes or prompt tuning followed the acceptance results.

## What users can try and what remains unreliable

Use the select, radio, progress and switch prompts above as simple examples.
For the other families try “Create a multiline Notes field”, “Show a Ready badge”,
or “Add a section divider”; these examples were not re-run in this pass. Existing
single-line text/email/password, checkbox, text/heading and button implementations
remain supported, but model combinations can be wrong, as the login result shows.

Content-card, link, login composition, disabled state, exact text and horizontal
grouping remain experimental. This single pass does not establish reliability
for unspecified combinations, accessibility beyond the trusted structural patterns,
or interactive business behavior. Always compare the returned controls and
properties with the request. Basic selection still fails after the one revision;
no additional backend experiment or model change is underway.

## Files changed in this increment

Existing local implementation work was preserved. This increment changes:

- `src/specification/componentRegistry.ts`, `uiSpecification.ts`: five strict
  component definitions, default-option membership and authoritative union.
- `backend/src/modelUiDraft.ts`, `compileModelUi.ts`: reused property validators,
  added variants and deterministic naming for the new fields.
- `backend/evaluation/selection-poc/selection.ts`, `model.ts`, `diagnostics.ts`:
  flat catalog, one concise instruction revision, and safe diagnostic property paths.
- `backend/src/diagnostics.ts`: safe property paths for the added props.
- `src/specification/presentation.ts`, `UiSpecificationPreview.tsx`,
  `generateTsx.ts`: shared trusted rendering and serialization, including native
  option/fieldset/legend elements and fixed payment-field composition.
- `src/components/AiGeneratorSection.tsx`: supported-family descriptions and
  suggestion names only; no frontend refactor.
- `src/specification/uiSpecification.test.ts`, `rendering.test.ts`, new
  `practicalComponents.test.ts`; `backend/test/selectionPoc.test.ts`,
  `additionalSelection.test.ts`: validation, rendering, compilation and mocked transport checks.
- `README.md`, `docs/experimental-ai-frontend.md`, `docs/flat-selection-backend.md`,
  and this new results directory: scope, examples, limitations and first responses.

No dependency/lockfile, frontend request-lifecycle, production transport, existing
benchmark dataset, or historical result changes were made for this increment.
No files were staged, committed or pushed.
