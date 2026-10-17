# Phase 1A: UI specification and registry

This phase introduces a data contract alongside the existing keyword generator.
It does not render specifications, generate TSX, call an LLM, or add a backend.

## Document format and public API

`src/specification/uiSpecification.ts` exports `uiSpecificationSchema`,
`UiSpecification`, and `UI_SPEC_VERSION`. The document has exactly two keys:

```json
{
  "version": "1.0",
  "root": {
    "id": "welcome",
    "type": "heading",
    "props": { "content": "Create an account", "level": 2 }
  }
}
```

Every node has `id`, `type`, and `props`. Containers additionally require a
nonempty `children` array. Leaves must omit `children`, including empty arrays.
Any registered type can be the root; submit/reset buttons require a form ancestor.
Unknown versions, component types, keys, and properties are errors. No coercion,
unknown-key stripping, or default insertion occurs. Accepted documents round-trip
through JSON unchanged.

```ts
import { uiSpecificationSchema } from '../src/specification/uiSpecification';

// JSON syntax errors are handled by the caller before schema validation.
const result = uiSpecificationSchema.safeParse(JSON.parse(jsonText));
if (result.success) {
  const specification = result.data; // UiSpecification
  // Store or inspect this validated data; rendering belongs to Phase 1B.
  console.log(specification.version);
} else {
  console.log(result.error.issues); // Includes paths for structural/semantic errors.
}
```

The [handcrafted registration fixture](../src/specification/fixtures/registration-form.json)
contains a form, vertical layout, heading, name, email, password, confirm password,
terms checkbox, and submit button. Password confirmation is a separate field;
matching passwords is future application behavior, not an executable schema rule.

## Registry and supported properties

`src/specification/componentRegistry.ts` is the allowlist. Each entry supplies a
strict Zod property schema, permitted direct child types, and descriptive mapping
metadata with documentation links. `ComponentType` is a literal union;
`ComponentProps<T>` comes from each registry schema. `UiNode` is a discriminated
union, so checking `node.type` narrows its property type. Recursive children use
an interface to support TypeScript's recursive type rules. Runtime validation
enforces IDs, tree limits, and contextual relationships that TypeScript cannot
prove for externally supplied JSON.

| Type | Required properties | Optional properties | Direct children |
| --- | --- | --- | --- |
| `textInput` | `name`, `label` | `placeholder`, `required`, `disabled`, `maxLength` | None |
| `emailInput` | `name`, `label` | Same as text input | None |
| `passwordInput` | `name`, `label` | Same as text input | None |
| `checkbox` | `name`, `label` | `required`, `disabled` | None |
| `button` | `label`, `type` | `disabled` | None |
| `text` | `content` | None | None |
| `heading` | `content`, `level` | None | None |
| `verticalLayout` | None (`props: {}` is valid) | `gap` | Any registered type |
| `horizontalLayout` | None (`props: {}` is valid) | `gap` | Any registered type |
| `form` | `label` | None | Any registered type except `form` |

Property constraints:

- IDs and field names: 1–64 characters, matching
  `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`. Both IDs and field names must be unique
  across the entire document, including separate sibling forms.
- Labels/placeholders: nonblank, 1–200 characters. Content: nonblank, 1–1000
  characters. Text is preserved without trimming; Unicode and punctuation work.
- `required`/`disabled`: actual booleans, never strings.
- `maxLength`: integer 1–1000. No initial input values or passwords are stored.
- Button `type`: `button`, `submit`, or `reset`. Submit/reset buttons require a
  form ancestor, including through layouts. No action names or callbacks exist.
- Heading `level`: integer 1–4. Gap: `none`, `small`, `medium`, or `large`.
- No form may have a form ancestor, even through intervening layouts.

## Bounds and trust boundary

`SPEC_LIMITS` sets six component levels (root = level 1) and 100 total components
(root and all containers count). Each child array is also capped at 100; the
document-wide count remains authoritative across branches. Containers at the
last level cannot have valid nonempty children, so level-six nodes must be leaves.

Before Zod traversal, an iterative JSON preflight rejects cycles, shared object
references, functions, accessors, symbols, bigint, undefined, nonfinite numbers,
sparse arrays, and nonplain objects. It limits the document to 4096 JSON values,
1000 characters per string, and 21 JSON nesting levels (a separate defensive cap
allowing node objects, property objects, and child arrays). The component schema
itself is expanded to a finite depth, so extremely deep input cannot cause
unbounded recursive Zod parsing. Preflight errors use a document-level issue;
normal property and semantic errors include paths.

The intended boundary is JSON text parsed with `JSON.parse`, or ordinary unknown
data. This is not an in-process sandbox for hostile JavaScript objects such as
Proxies. A future transport must separately bound response bytes before JSON
parsing; schema limits do not replace transport limits.

Strict allowlists exclude JSX, JavaScript payload fields, handlers (`onClick`,
`onSubmit`, etc.), style objects, arbitrary tags, HTML injection APIs, URLs,
imports, and expression/binding objects. Text additionally rejects `<`, `>`,
backticks, braces, and arrow delimiters. These restrictions intentionally exclude
some otherwise harmless prose. A code-looking string without those delimiters,
such as `alert(1)`, is still only literal text, never an executable expression.
The contract has no evaluation mechanism. A future renderer/code generator must
escape all accepted strings and select trusted implementations explicitly; it
must never evaluate text, spread unfiltered props, or inject HTML.

## Future Nova React mappings

The mapping metadata names public elements, not live React components. The
following plan was checked against the installed `@visa/nova-react` 2.5.4 public
TypeScript declarations and existing previews, using the library's
[official source](https://github.com/visa/nova-react/tree/main/libs/nova-react/src)
and documentation links exported in those declarations:

| Specification | Future trusted mapping |
| --- | --- |
| Inputs | [Label + InputContainer + Input](https://design.visa.com/react/components/input), with fixed native type `text`, `email`, or `password`. Associate label `htmlFor` with the validated node ID; forward only named input properties. |
| Checkbox | [Checkbox + Label](https://design.visa.com/react/components/checkbox), with associated label and validated native `name`, `required`, `disabled`. |
| Button | [Button](https://design.visa.com/react/components/button), with native `type` and `disabled`; label as text children. |
| Text | [Typography](https://design.visa.com/react/components/typography), fixed `tag="p"`, `variant="body-1"`. |
| Heading | Typography with paired `tag="h1"`…`"h4"` and `variant="headline-1"`…`"headline-4"`, derived only from the level enum. |
| Layouts | [Utility](https://design.visa.com/react/utilities/api) with `vFlex`, fixed `vFlexCol` or `vFlexRow`; gap tokens may map to `vGap` 0/8/16/24. |
| Form | Native semantic `form`, as in the existing address preview, with the label mapped to `aria-label`. Nova has no form wrapper required here. No action URL or submission handler comes from the spec. |

These mappings are design guidance for Phase 1B, not an implementation. The spec
deliberately offers fewer options than Nova's broad native/React property surface.
It does not expose Nova `tag`, `element`, styles, or arbitrary React props.

## Future LLM production

A later LLM integration can receive this versioned contract, the registry's
property/child allowlists, limits, and the registration fixture as a worked
example. It should return one JSON document with `version: "1.0"`, not TSX,
markdown, event handlers, or invented component types. Its output remains
untrusted: bound response size, parse JSON, and run `uiSpecificationSchema` before
storage or consumption. Return validation paths for correction or reject the
response; never execute output or silently remove unsupported keys.

Provider-specific structured-output/JSON Schema adapters are deferred. If added,
they must preserve strict object schemas and finite depth, while keeping runtime
validation authoritative for uniqueness, total counts, and ancestor rules.
Version changes must be explicit; unsupported versions are rejected rather than
guessed or migrated automatically. The current keyword path is independent and
continues to operate exactly as before.

## Trade-offs and implementation report

- One dependency, Zod 4.6.7, provides validation and inferred property types.
  No existing dependency version changed. No schema-to-UI framework was added.
- Strict types, literal text, named gap tokens, and finite depth constrain design
  flexibility in exchange for predictable validation. No custom CSS, links,
  arbitrary actions, conditional expressions, or cross-field validation exist.
- The registry owns property schemas and child allowlists. The finite node union
  explicitly enumerates all ten types for sound discrimination; a relationship
  matrix test checks all 100 parent/child pairs against the registry.
- Node types encode leaf/container shape and property discrimination. Contextual
  rules and limits are runtime checks; assigning a `UiNode` directly is not a
  substitute for validating external input.
- The schema validates documents; it does not claim browser accessibility,
  interactive correctness, secure submission, or completed rendering.

Changed files:

| File | Purpose |
| --- | --- |
| `package.json`, `package-lock.json` | Add exact runtime dependency Zod 4.6.7. |
| `src/specification/componentRegistry.ts` | Allowlist, strict property schemas, node/prop types, limits, descriptive public API mappings. |
| `src/specification/uiSpecification.ts` | Versioned finite discriminated schema, JSON preflight, tree/context validation, inferred document type. |
| `src/specification/fixtures/registration-form.json` | Handcrafted registration document. |
| `src/specification/uiSpecification.test.ts` | Valid/invalid documents, all types/relationships, unsafe properties, IDs, limits, JSON safety, and compile-time type checks. |
| `README.md` | Link to the additive contract and fixture. |
| `docs/phase-1a-ui-specification.md` | Schema reference, design decisions, LLM production guidance, and this report. |

Verification: `npm run build`, `npm run lint`, and `npm test` pass. There are
243 passing tests: all 49 unchanged baseline tests plus 194 specification tests.
The build retains the existing large-chunk warning. Dependency installation
reports the same 26 audit findings (1 low, 5 moderate, 20 high); no broad fixes
were applied. Existing generation utilities and previews remain untouched.
GitHub Actions has not been rerun remotely because no changes were pushed.

Work is confined to `feature/ai-component-generation`. No commit, push, PR,
merge, LLM integration, backend, dynamic renderer, or TSX generator was added.
Phase 1A ends here; Phase 1B requires a separate task.

Schema implementation references: [Zod strict objects, discriminated unions,
and refinements](https://zod.dev/api).
