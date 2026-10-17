# Phase 1B implementation report

Phase 1B adds deterministic React rendering and TSX generation for all ten v1
building blocks. It uses the existing specification and registration fixture.
The keyword generator, raw-source snippets, and existing preview components
remain unchanged. Work is confined to `feature/ai-component-generation`.

## Demo and public entry points

Run `npm run dev` and open `http://localhost:5173/?demo=specification#generator`,
using the actual Vite port if different. The demo displays the registration form,
its complete generated TSX, and the existing copy-code control. It explicitly
states that the form is local and does not create accounts or send form data.
The same query works in the production build; no development-only API is needed.

The query selects the fixture demo in place of the keyword generator section.
Other page sections and theming remain available. The default view still shows
the existing keyword UI. Switching views uses ordinary navigation; the demo's
back link removes the query. Both generators are not mounted together, avoiding
collisions between fixture field IDs and legacy preview IDs.

```tsx
import { uiSpecificationSchema } from '../src/specification/uiSpecification';
import { UiSpecificationPreview } from '../src/specification/UiSpecificationPreview';
import { generateTsx } from '../src/specification/generateTsx';

const specification = uiSpecificationSchema.parse(unknownJsonData);
const tsx = generateTsx(specification); // Source text only.
const preview = <UiSpecificationPreview specification={specification} />;
```

Both consumers accept the existing `UiSpecification` type and revalidate it at
runtime through the shared presentation builder. A cast or a mutation of
previously valid data cannot bypass validation. Invalid input throws the existing
Zod error. Future editable clients should use `safeParse` and display errors
before invoking these consumers. The fixed demo fixture is validated at module
load; this phase adds no JSON editor, upload path, or network input.

## Shared semantics and trusted rendering

The pipeline is:

```text
UiSpecification → existing Zod validation → closed presentation tree
                                            ├─ static Nova React elements
                                            └─ deterministic TSX serialization
```

`presentation.ts` owns the only specification-to-element mapping. Each node maps
to a small internal union of `Utility`, `Label`, `InputContainer`, `Input`,
`Checkbox`, `Button`, `Typography`, or native `form`. New props are constructed
explicitly from validated fields; the original spec property object is never
spread onto React elements. The presentation tree is internal data, not a new
user-facing schema or a configurable component loader.

`UiSpecificationPreview.tsx` selects only statically imported Nova components
through an exhaustive switch. Its prop spreads contain exclusively the trusted
props constructed above. It never selects arbitrary React types, imports user
modules, injects HTML, or evaluates generated source. TypeScript checks each
trusted prop set against the actual installed Nova component declarations.

| Specification node | Implemented semantics |
| --- | --- |
| `textInput`, `emailInput`, `passwordInput` | Vertical `Utility` containing associated `Label` and `InputContainer`/`Input`. Fixed native type `text`, `email`, or `password`. Preserve ID, name, placeholder, required, disabled, and maxLength. |
| `checkbox` | Horizontal centered `Utility`, native Nova `Checkbox`, associated `Label`. Preserve ID, name, required, disabled. |
| `button` | Nova `Button`, preserving ID, native button type, disabled, and literal label. |
| `text` | Nova `Typography`, semantic `p`, `body-1`, original ID and literal content. |
| `heading` | Nova `Typography`, semantic `h1`–`h4` paired with `headline-1`–`headline-4`. |
| `verticalLayout`, `horizontalLayout` | Nova `Utility`, original ID, `vFlex`, `vFlexCol` or `vFlexRow`, and ordered children. |
| `form` | Native `form`, original ID, accessible `aria-label`, ordered children, fixed submit prevention. |

Layout tokens map to `vGap` values `none → 0`, `small → 8`, `medium → 16`, and
`large → 24`. An omitted gap deterministically uses medium (16). Input and
checkbox wrapper gaps are fixed at 8. Leaf IDs remain on the actual input,
checkbox, button, or typography element, not on extra wrappers. Labels use the
exact corresponding ID in `htmlFor`. Unspecified optional properties are omitted
from generated code, and explicit `false` values are preserved.

These APIs were verified against the installed `@visa/nova-react` 2.5.4 public
declarations and [Visa's official component source](https://github.com/visa/nova-react/tree/main/libs/nova-react/src).
The [Phase 1A contract](phase-1a-ui-specification.md) documents the allowed API
subset and links to the library's input, checkbox, typography, and utility docs.

## Deterministic and safely escaped generated TSX

`generateTsx` emits one standalone default-exported `GeneratedUI` function,
alphabetically sorted and deduplicated named imports for only the Nova components
used by its presentation tree, and statically nested JSX. Native forms do not
create an import. It uses the project's automatic React JSX runtime, so a default
React import is unnecessary. A consuming application must already load Nova base
styles and a theme, as this repository does; the snippet is a component rather
than a complete application.

Property names and tag names come exclusively from the closed trusted mapping.
Strings are always JSON-escaped JavaScript string literals inside JSX expression
containers, including text children. Quotes, backslashes, newlines, tabs, and
control characters are escaped. HTML-sensitive characters and JavaScript line
separators additionally use Unicode escapes. Ampersands and punctuation retain
their literal meaning. Text never becomes raw JSX, HTML entities supplied by a
user, a template literal, a property expression, or executable code.

The Phase 1A text restrictions remain intact: markup and expression delimiters
are rejected before mapping. Code-looking permitted prose such as `alert(1)`
remains a string. Escaping is still applied to every string rather than relying
only on those restrictions. Fixed names, property construction order, indentation,
and import sorting make output independent of object key order and repeat calls.
No timestamps, random values, component-name options, formatting service, or new
dependency was introduced.

## Form behavior

Every preview form uses a fixed `onSubmit` handler that calls only
`event.preventDefault()`. Generated forms contain the same trusted handler as
literal application code. Specifications cannot provide handlers, action URLs,
submission logic, or data bindings. The renderer/generator do not read field
values, submit requests, collect FormData, or persist input.

Native required/email validation and disabled controls work normally. Reset
buttons retain native reset behavior. Inputs and checkboxes are uncontrolled and
editable; no controlled values are synthesized. The registration form has no
authentication, password matching, account creation, or success flow. The fixed
submit guard deliberately keeps copied components inert until a developer adds
real behavior outside this specification.

Generated TSX is passed to the existing syntax highlighter and clipboard only.
The app never imports or executes it. There is no eval, Function constructor,
arbitrary dynamic import, or HTML injection API in this implementation.

## Verification

| Check | Result |
| --- | --- |
| `npm run build` | Pass: TypeScript and Vite production build. |
| `npm run lint` | Pass: no errors or warnings. |
| `npm test` | Pass: 298 tests across 5 files. All 243 previous tests preserved, including the original 49 baseline tests. |
| Generated TSX compilation | Pass: 12 generated components checked in memory with the installed TypeScript compiler, real React/Nova declarations, strict mode, unused checks, and automatic JSX runtime. No source execution or filesystem artifacts. |
| Preview/code consistency | Pass: all ten types, fixture, nested layouts, heading levels, gap tokens, button types, and escaped text compared as structural trees. |
| `git diff --check` | Pass. |

There are 55 new tests: 51 renderer/generator tests and 4 demo/view-selection
tests. They use real Nova components and server rendering, not component mocks.
Coverage includes actual label/control HTML, field flags, semantic headings,
native form naming, minimal imports, nested child order, repeatability,
non-mutation, literal text escaping, runtime rejection of forged/unsupported or
mutated data, and the submit handler's prevent-default behavior. Generated TSX
is parsed into a TypeScript AST and compared with the renderer's actual React
element tree; it is not evaluated to perform this comparison.

The complete demo is server-rendered in tests, including the preview and existing
syntax highlighter/copy UI. App view-selection tests verify that the default
keyword UI still mounts and the demo does not mount duplicate field IDs.

The existing large-bundle warning remains. The new statically imported demo
brings Zod validation into the application graph, increasing the JavaScript
bundle from approximately 1,357 kB to 1,457 kB before gzip. Vite also reports two
nonfatal PURE-comment annotation warnings in the installed Zod package. Those
warnings are reported rather than suppressed; dependency upgrades and bundle
splitting are outside this phase. No dependency or lockfile was changed.

## Changed files

| File | Change |
| --- | --- |
| `src/specification/presentation.ts` | Shared validated mapping and closed typed element vocabulary. |
| `src/specification/UiSpecificationPreview.tsx` | Trusted static Nova renderer with inert form submission. |
| `src/specification/generateTsx.ts` | Deterministic imports, JSX, escaping, and fixed form handler generation. |
| `src/specification/rendering.test.ts` | Renderer/generator, consistency, invalid-input, and generated-code compilation tests. |
| `src/components/SpecificationDemo.tsx` | Existing registration fixture rendered beside its generated source; reuse LivePreview and OutputPanel. |
| `src/components/SpecificationDemo.test.ts` | Full demo markup and default/demo App view tests. |
| `src/App.tsx` | Select demo section only when `demo=specification`. |
| `README.md` | Demo access instructions and updated test scope. |
| `docs/phase-1b-rendering.md` | This implementation, verification, and limitations report. |

## Limits and architectural trade-offs

- Revalidation on both consumer boundaries costs a bounded schema traversal but
  prevents TypeScript casts or post-validation mutation from bypassing limits.
  Phase 1A schema, registry, fixture, versions, and validation behavior are unchanged.
- A small shared presentation representation avoids maintaining two independent
  semantic mappings. Rendering and serialization have different output mechanics
  but consume the same trusted props and children. Both switches are exhaustive.
- The query-based demo avoids adding routing/state dependencies and avoids ID
  collisions. Multiple copies of the same specification on one page would still
  require a deliberate caller-owned ID-namespacing design in a later phase.
- Snippets require the existing Nova styles/theme and modern React JSX tooling.
  They are not downloadable projects, authenticated forms, or interactive builders.
- Verification covers server markup, actual React handlers, static syntax and
  types, and default/demo selection. It does not include a real browser, visual
  regression, end-to-end clipboard interaction, or native browser validation UX.
- No remote GitHub Actions run was triggered. Nothing was committed or pushed.
  No PR, merge, LLM integration, backend, RAG, database, or agent framework was
  added. Work stops at Phase 1B.
