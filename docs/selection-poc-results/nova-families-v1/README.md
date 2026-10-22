# Nova card, dialog, flag and footer milestone

This bounded increment retains the existing AI pipeline, Nova 2.5.4, local Qwen3,
previous implementations and all historical evidence. It adds three selectable
families (dialog, flag, footer), refines the existing paymentCard/contentCard types,
and stops after one six-request real-model pass. There are now 20 flat-selection
types and 23 authoritative specification types including the three containers.
No new planner, model, dependency, keyword correction, retry loop or evaluation
framework was introduced.

## Official references and version checks

Read the official [component catalog](https://design.visa.com/components/) and
[pattern catalog](https://design.visa.com/patterns/), and the relevant component
usage/anatomy, behavior and accessibility guidance:

- [Card input pattern](https://design.visa.com/patterns/card-input/).
- [Content card usage](https://design.visa.com/components/content-card/usage/).
- [Dialog usage](https://design.visa.com/components/dialog/usage/) and
  [accessibility](https://design.visa.com/components/dialog/accessibility/).
- [Flag usage](https://design.visa.com/components/flag/usage/).
- [Footer usage](https://design.visa.com/components/footer/usage/) and
  [accessibility](https://design.visa.com/components/footer/accessibility/).

Some dynamic Code panels and the content-card/flag accessibility pages were
inaccessible through the documentation reader. Official **React v2.5.4** workshop
examples were retrieved directly, not Angular examples or newer React APIs:

- [Default dialog](https://github.com/visa/nova-react/blob/v2.5.4/apps/workshop/src/examples/components/dialog/default-dialog.tsx).
- [Success flag](https://github.com/visa/nova-react/blob/v2.5.4/apps/workshop/src/examples/components/flag/default-success-flag.tsx).
- [Default footer](https://github.com/visa/nova-react/blob/v2.5.4/apps/workshop/src/examples/components/footer/default-footer.tsx).
- [Content card with actions](https://github.com/visa/nova-react/blob/v2.5.4/apps/workshop/src/examples/components/content-card/with-buttons-content-card.tsx).

The installed package reports 2.5.4. Its public `index.d.ts`, component declarations
and implementations were checked for Dialog/Header/Content, useFocusTrap,
Flag/FlagContent/FlagCloseButton/MessageIcon, Footer, and ContentCard/Body/Title.
Existing installed icons provide VisaCardGenericLow. No DialogFooter or newer
modal/hook API is invented. In this version Dialog's declarations do not expose
React onClose, so a native close listener with cleanup restores focus.

## Implementation and bounded contracts

All properties remain strict, bounded literal data. Existing limits remain
20 selections, authoritative depth 6/count 100, label length 200 and text length
1000. Unsafe URLs, handlers, styles, arbitrary children, model-owned IDs/names,
unknown props and unsupported types are rejected. Safe diagnostics only add the
new known property keys. The flat catalog supplies concise typed meanings and
valid examples; the older draft/semantic model catalogs remain unchanged.

### Payment-card fields (existing type, refined)

The original composition already supplied labeled number/expiration/security
inputs with optional cardholder, explicit required/disabled flags, and no input
value properties. It now adds numeric input hints for number/security code,
a generic decorative card icon, MM/YY placeholder, an associated security-code
explanation, and a native expandable help disclosure. Security code remains a
password input. Autocomplete is off, and no payment values enter React state,
generation requests, logs or storage. All fields start empty; use synthetic values.

This is **partial pattern support**, not full Visa pattern compliance. The
published pattern also describes separate month/year selects, date restrictions,
focus-dependent icons, formatting and network detection. This increment retains
one combined expiration input; those behaviors, card-number validation and real
payment processing are deferred. No card-number character limit was introduced.
The generic icon is static and conveys no detected payment network.

### Content card (existing type, refined)

The same Nova ContentCard/Body/Title composition retains title, description and
optional action. Optional headingLevel 2/3/4 provides semantic heading control;
the existing default remains h3. Link actions keep their validated destination,
while no href means an ordinary button with no business implementation. Link
navigation is prevented only in the live preview; copied code retains destinations.
Images, whole-card click behavior and complex nested content remain outside scope.

### Dialog (new)

Props: required title; optional content, triggerLabel and closeLabel. Defaults are
an `Open <title>` trigger, `Close` action, and a fixed UI-only explanatory message
when content is absent. A requested Cancel action is expressed as closeLabel.
Only one closing action is supported; arbitrary nested fields/actions are not.

The trusted DialogExample uses Nova's native dialog and useFocusTrap with a
trigger ref. showModal provides modal state, inert background and native Escape;
Nova wraps Tab navigation. The action initially receives focus. A native close
listener restores focus to the trigger and is removed on cleanup. DialogHeader
uses h2 and title/content are associated through ARIA. It starts closed and can
be reopened. Fixed responsive sizing bounds it to the viewport.

### Flag (new)

Props: required content; optional title, variant and dismissible. Variants are
information (default Nova styling), success, warning, error and subtle. Information
is not passed as an unsupported Nova messageType: it maps to undefined. Icons
come from MessageIcon and Nova's message context. The container uses status,
polite live announcement and atomic content. Explicit dismissible:false remains
false; true renders a labeled FlagCloseButton with local useState dismissal.
No auto-dismiss timer or real operation is implemented. A new generated result
remounts the preview and resets local dismissal state.

### Footer (new)

Props: required text and optional list of at most eight strict {label,href} links.
Uses native Nova Footer, a paragraph and a labeled navigation list. Order and
labels are preserved, and existing URL validation rejects executable destinations.
Primary/auxiliary preview link actions are contained; copied links work normally.
This is a text/link subset: no brandmark is invented, no full footer-branding
compliance is claimed, and sticky placement or multi-column navigation is deferred.

### Shared preview and TSX boundary

One validated specification still drives registry suggestions, presentation,
preview and code. Two closed internal presentation tags instantiate small trusted
DialogExample/FlagExample React components. The TSX generator includes their
standalone hook/handler helpers, only once when needed, with all React/Nova imports.
A source comparison test requires each copied helper function body to match its
preview counterpart exactly. Model data enters only escaped literal props.
Generated source is never executed by the application; host developers decide
when to compile/use copied TSX. Native markup is not imported from Nova, and the
card icon is imported from the already-installed icons package.

## Automated and targeted browser verification

- `npm run build`: frontend and backend pass; existing Zod annotation and
  large-bundle warnings remain.
- `npm run lint`: pass.
- `npm run test:frontend -- --reporter=dot`: **941 pass**.
- `npm run test:api`: **800 pass** across 24 files; no live inference in tests/CI.
- `git diff --check`: pass.

Tests cover new strict unions and bounds, unsafe nested links/actions, explicit
false, form/layout compilation, all component presentation/TSX structures,
representative and mixed generated-source compilation, and production-provider
mock responses. Multiple dialogs/flags have independent helper instances; copied
helper imports and function bodies are checked without evaluating generated code.

The targeted browser check used one synthetic fixture via a mocked API response
in the actual default frontend, **not Ollama**. The fixture is saved separately.
It verified initial closed state, native modality/focus entry, Tab/Shift+Tab
containment, Escape dismissal, Cancel dismissal, focus restoration, flag dismissal,
contained footer/content-card links, semantic card heading and empty masked/local
payment inputs. It did not collect or save entered card values.

A follow-up inspected inner text colors because the dialog container's inherited
color differed from its actual message content. No code fix was needed. At 360
and 1280 px, dialog bounds fit the viewport. Light theme title/content were black
on white; dark theme title/content were white on rgb(10,10,10). Footer text was
black on rgb(245,245,245) in light mode and white on rgb(26,26,26) in dark mode;
links followed Nova themed colors. No unrelated landing-page layout audit ran.
See [browser-interactions.json](browser-interactions.json),
[browser-themes.json](browser-themes.json), and [browser-fixture.json](browser-fixture.json).
Assistive-technology behavior was not manually verified with a screen reader.

## One real-Qwen3 acceptance pass

The exact six requested prompts and expectations were saved in
[inputs.json](inputs.json) before inference. There was one attempt each, with no
retries, prompt corrections or model/settings changes. The unquoted description
and message could optionally end in a period, as declared before the pass.

| Exact prompt | First actual selection | Semantic result |
| --- | --- | --- |
| Create payment-card input fields. | paymentCard, includeCardholder:false, **inside a form** | Correct field family; **composition fail** for unrequested form |
| Create a content card titled Analytics with description View your reports. | **dialog** titled Analytics with content View your reports | **Wrong family**; no content card |
| Create a dialog titled Confirm changes with a Cancel button. | dialog with correct title/content, **closeLabel omitted** | Correct family; **requested Cancel missing** (trusted default is Close) |
| Show a dismissible success flag saying Changes saved. | flag, success, correct message, **dismissible omitted** | Correct family/message; **no dismissal control** |
| Create a footer with Copyright 2026 and a Privacy link pointing to https://example.com/privacy. | footer with exact text, label and href | **Pass** |
| Create a text input labeled Full name. | standalone textInput with exact label | **Pass** |

Exact types matched 5/6; required properties matched 3/6; expected composition
matched 5/6; **2/6 met every frozen requirement**. All six passed selection,
composition and authoritative structural validation, rendered using actual Nova
server rendering, matched generated TSX structure, and compiled with zero
TypeScript diagnostics. Structural validation is not semantic correctness.

The raw wrong type/omitted properties are already present in the saved Ollama
message. The compiler did not discard Cancel/dismissal or convert a content card.
Deterministic browser fixtures with explicit properties confirmed the implemented
Cancel and dismissal behavior. These are model errors/omissions, distinct from
implementation failures. No further model calls or tuning followed the pass.

Real requests used the existing production createOllamaProvider transport to
loopback Ollama, then the trusted renderer/code generator; this is not a claim
that all six were exercised interactively in the browser. Settings remain
qwen3:4b-instruct, temperature 0, seed 0, think:false, context 8192, output 2048,
timeout 60000 ms and response limit 65536 bytes. [metadata.json](metadata.json)
contains model digest, runtime/source information, exact messages and schema.
Each `*.response.raw` was flushed before parsing/validation; outcomes were saved
before further checks. [results.json](results.json) includes failures and code.
Only synthetic prompts appear; no secrets or environment files are included.
Historical datasets and benchmark evidence were not modified.

## Changed files and stop point

Changes during this increment, separate from all preserved pre-existing work:

- `src/specification/componentRegistry.ts`, `uiSpecification.ts`.
- `backend/src/modelUiDraft.ts`, `diagnostics.ts`.
- `backend/evaluation/selection-poc/selection.ts`, `model.ts`, `diagnostics.ts`.
- `src/specification/presentation.ts`, `UiSpecificationPreview.tsx`, `generateTsx.ts`.
- New `src/specification/interactions/DialogExample.tsx`, `FlagExample.tsx`,
  `interactionSource.ts`.
- `src/components/AiGeneratorSection.tsx` (family names/descriptions/examples only).
- `src/specification/rendering.test.ts`, `uiSpecification.test.ts`, new `familyPatterns.test.ts`.
- `backend/test/additionalSelection.test.ts`, `selectionPoc.test.ts`, new `interactionSource.test.ts`.
- `README.md`, `docs/experimental-ai-frontend.md`, and this new results directory.

Existing supported families, legacy separation, backend startup fixes and local
work are preserved. No source refactor, dependency upgrade, model change, commit,
push or merge. The bounded milestone ends here; remaining model inaccuracies and
partial pattern support are documented rather than silently repaired.
