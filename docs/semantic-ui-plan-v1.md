# SemanticUiPlan v1 — Step 1 implementation

This report records the approved Step 1 foundation. The subsequent
[Step 2 Ollama integration](semantic-ui-plan-ollama.md) is separately selectable;
the plan format, relationship checks and composition rules below remain in force.

Step 1 adds a strict, internal semantic-plan contract and a pure deterministic
composer. It does not connect the plan to Ollama, change an active prompt,
modify the API or frontend, or perform live inference. Step 2 requires review.

The new entry points are:

```ts
const validation = semanticUiPlanSchema.safeParse(input); // input: unknown
const specification = compileSemanticUiPlan(input); // UiSpecification v1.0
```

Call the schema when only validating. Call the compiler directly when composing;
it validates its unknown input internally, so a separate validation call is optional.

The composer calls the existing `compileModelUi`. That compiler still assigns
IDs and field names and runs authoritative `uiSpecificationSchema` validation.
Those existing modules and all registry validators remain unchanged.

## Plan format

A supported plan contains exactly these fields:

| Field | Meaning |
| --- | --- |
| `planVersion: "1"` | Version of this internal plan language; output remains UiSpecification `"1.0"`. |
| `status: "supported"` | This plan describes supported UI. |
| `elements` | Nonempty inventory of leaf components and their supported props, without IDs or field names. |
| `groups` | Inventory of semantic rows, columns, and forms; it may be empty. |
| `content` | Nonempty ordered list of top-level references. |

An element is `{ "type": TYPE, "props": PROPS }`. Its type is one of
`textInput`, `emailInput`, `passwordInput`, `checkbox`, `button`, `text`, or
`heading`. Props reuse `draftPropsSchemas`, which in turn reuse the authoritative
registry schemas, omitting only compiler-owned field names. Labels, placeholders,
required/disabled flags, input limits, button types and heading levels have the
same validation rules as before. Unknown properties and `null` optional values
are rejected. Omission is preserved; explicit `false` remains present.

A group contains `kind`, `props`, and an ordered nonempty `members` list:

| Group kind | Props | Compiled component |
| --- | --- | --- |
| `row` | Optional gap: `none`, `small`, `medium`, `large` | `horizontalLayout` |
| `column` | Same gap properties | `verticalLayout` |
| `form` | Required accessible `label` | `form` |

A reference is **exactly one** of `{ "element": INDEX }` or
`{ "group": INDEX }`. Indexes are zero-based integers into the corresponding
inventory. An object containing both keys is invalid. Forward and backward
group references are supported; declaration order is not a dependency order.

`elements` and `groups` are inventories, not presentation sequences. **Only
`content` and `members` define presentation order.** The composer never sorts
these lists by index, label, component type, or group kind.

### Example: paragraph and button in a row

```json
{
  "planVersion": "1",
  "status": "supported",
  "elements": [
    { "type": "text", "props": { "content": "Ready" } },
    { "type": "button", "props": { "label": "Inspect", "type": "button", "disabled": false } }
  ],
  "groups": [
    {
      "kind": "row",
      "props": { "gap": "small" },
      "members": [{ "element": 0 }, { "element": 1 }]
    }
  ],
  "content": [{ "group": 0 }]
}
```

This produces one horizontal layout with those two direct children. There is
no outer column or per-element layout inserted by the composer. The existing
renderer still owns field-label/input presentation wrappers where needed.

### Example: explicit form membership and mixed layout

```json
{
  "planVersion": "1",
  "status": "supported",
  "elements": [
    { "type": "textInput", "props": { "label": "First name" } },
    { "type": "textInput", "props": { "label": "Last name" } },
    { "type": "emailInput", "props": { "label": "Email", "required": true } },
    { "type": "button", "props": { "label": "Save Profile", "type": "submit" } }
  ],
  "groups": [
    { "kind": "row", "props": { "gap": "small" }, "members": [{ "element": 0 }, { "element": 1 }] },
    { "kind": "column", "props": { "gap": "medium" }, "members": [{ "group": 0 }, { "element": 2 }, { "element": 3 }] },
    { "kind": "form", "props": { "label": "Profile" }, "members": [{ "group": 1 }] }
  ],
  "content": [{ "group": 2 }]
}
```

The resulting structure is a form containing a column: the name row, email,
then submit action. These are illustrative data, not production responses to
recognized prompts. No prompt text is accepted by the composer.

A form can also contain elements and rows directly. Columns are not compulsory
inside forms. Multiple separate forms can be listed in `content`, or grouped
within a row or column. Each has its own explicit membership.

### Unsupported outcome

```json
{
  "planVersion": "1",
  "status": "unsupported",
  "reason": "unsupported-component"
}
```

The other permitted reason is `unsupported-behavior`. Unsupported outcomes must
omit `elements`, `groups`, `content`, and free-form explanations. The schema
accepts the outcome; composition delegates to the existing draft compiler,
which raises `ModelUiCompilationError` with `stage: "unsupported_request"`.
It never fabricates an empty or substitute UI specification.

## Validation and conversion stages

1. **Bound unknown input before Zod traversal.** Accept bounded JSON data; reject
   object cycles, shared object aliases, accessors, sparse arrays, custom object
   prototypes, symbols, functions, non-finite numbers, and excessive JSON size
   or nesting. Accessor values are never read. Independent equal JSON values
   are allowed; reusing the same JavaScript object instance is not JSON input.
2. **Validate the strict shape and props.** Discriminated unions select the
   permitted element/group schemas. No model-owned IDs, field names, children
   trees, event handlers, imports, styling objects, or executable expressions
   enter this language. Existing literal-text restrictions remain enforced.
3. **Validate bounds and ownership across all declarations.** Every reference
   must identify an actual array entry. Each element and group must have exactly
   one incoming reference, from either `content` or one group's `members`.
   Check integer/lower/upper bounds again before indexing: Zod can continue
   refinements after reporting a range error. Negative/fractional member-index
   regressions ensure validation returns a controlled plan error, not `TypeError`.
4. **Detect group cycles across the entire inventory.** A visiting/finished
   traversal checks even groups disconnected from `content`. Together with
   exactly-one ownership, this guarantees every declaration is reachable once.
5. **Validate composed depth and explicit form scope.** Count the synthesized
   root when necessary. A form cannot occur beneath another form, including
   through layouts. Submit/reset actions require a form ancestor declared by
   membership. Another form elsewhere in the document does not satisfy this.
6. **Compose the existing draft vocabulary.** Each group becomes its mapped
   component. Each element is consumed once, with all supported props intact.
   One top-level reference becomes the root directly. Multiple references get
   exactly one implicit `verticalLayout` with empty props, using the existing
   default medium gap. No other wrappers, flattening or repairs are introduced.
7. **Run the existing draft compiler.** `compileModelUi` assigns structural IDs,
   normalizes unique names document-wide and runs the authoritative v1.0 schema.
   The semantic composer does not duplicate those algorithms or replace the
   final validation boundary.

All declared elements/groups plus any implicit root count against the existing
**100-component** limit. Output depth is at most **six**, with the specification
root at depth one. A plan with 100 top-level leaf elements is rejected: the
necessary root would make 101 nodes. Labels/content and JSON budgets retain
the existing bounds. These are output/unknown-input limits, not just array limits.

## Why ownership and cycle checks are both necessary

An entry used by two parents has conflicting ownership and could duplicate a
control or form. It is rejected rather than cloned or assigned to a guessed
parent. Two separate fields with the same label must be two element entries.
They then receive unique IDs and names through the existing compiler.

An unused element or group has no owner and is rejected rather than omitted.
An entire disconnected cycle can nevertheless give each group exactly one
owner. That is why counting references alone is insufficient: cycle detection
must inspect every group, not just those found from `content`.

For a finite acyclic graph, an unreachable branch would have an ownerless root.
Since every node must have exactly one owner and cycles are rejected, all nodes
must ultimately lead back to `content`. No repair, reparenting, topological
reordering or best-effort omission is needed. Bounds/ownership/cycle work is
linear in the bounded number of declarations and references.

## Cross-array reference trade-offs

Flat inventories keep JSON nesting shallow and remove model-generated technical
IDs, while allowing general mixed layouts. They add a reference-correctness
burden: bad indexes, conflicting membership and disconnected cycles are possible.
These failures have explicit rejection tests and Zod issue paths.

There is also a subtler risk: inserting/reordering an inventory without updating
its references can still produce a structurally valid plan with the wrong
meaning. A compiler cannot infer which label the author intended an index to
select. Tests demonstrate both the changed result with stale indexes and the
identical specification after references are updated correctly. Future model
evaluation must measure that semantic risk; Step 1 establishes no LLM quality gain.

Explicit `content`/`members` order wins over inventory order. Identical valid
plans compile deterministically. Renumbering inventories while preserving the
same semantic tree also preserves structural IDs and names. Changing the tree
can change those technical identities; they are not persistent database keys.

Explicit one-child groups and repeated directions are retained, including their
gaps. The composer avoids inventing redundant wrappers, but does not assume
that a declared layout is meaningless and remove it. Future layout-quality
evaluation remains separate from validity.

## Errors and safety boundaries

Invalid shape, properties, references, ownership, form scope, or complexity raise
`SemanticUiPlanCompilationError` with `stage: "semantic_plan"`, a fixed message
and Zod issues. Unsupported outcomes use the existing unsupported-request error.
Any final draft/authoritative rejection remains an existing compiler error.

No logging or HTTP error mapping is added in Step 1. Future integration must
sanitize Zod issue details with the existing diagnostic approach, rather than
logging raw validation issues. No generated code is evaluated or executed by
the composer. This is a JSON-to-JSON conversion with validation boundaries.

The compiler preserves the plan's declared meaning, not an unprovided English
request. A valid plan can still misunderstand a natural-language requirement.
The frozen evaluator remains necessary once Ollama is connected in a later step.

## Extending the Nova catalog

An installed Nova export is not automatically permitted. A reviewed new type
needs registry validators/allowed relationships, authoritative specification
and draft support, and trusted preview/TSX mappings first. Then add its typed
semantic element entry reusing the draft props validator, plus compiler and
rendering/TSX tests. Ordinary leaf additions use existing references and do not
need a new composition algorithm.

A new semantic container needs a new explicit group kind, props schema and
deterministic mapping, with ownership/form/depth tests. Change `planVersion` if
the syntax or meaning becomes incompatible; review authoritative specification
versioning separately when changing that public contract. A later model-facing
JSON Schema must reflect the catalog, while runtime validation must retain graph
checks that a decoding grammar alone cannot guarantee. No new component or
Ollama grammar is added in this step.

## Scope, tests and verification

Changed files:

- `backend/src/semanticUiPlan.ts`: strict Zod contract, JSON preflight and graph validation.
- `backend/src/compileSemanticUiPlan.ts`: deterministic composition into the existing compiler.
- `backend/test/semanticUiPlan.test.ts`: structural fixtures and safety/regression tests.
- This document and a README link.

Fixtures cover all ten output types, complete login/registration/contact forms,
profile rows, paragraph/button compositions, mixed groups, multiple forms,
ordered references, explicit false values, repeated/Unicode labels, determinism,
unique identities, invalid indexes/ownership/cycles/unreachable branches,
malformed props, unsafe content, unsupported outcomes, and output limits.
These are compiler inputs, not hardcoded production responses or keyword rules.

Final verification on Node 22.14.0:

| Check | Result |
| --- | --- |
| `npm run build` | Passed for frontend and backend. |
| `npm run lint` | Passed. |
| `npm test` | **758 passed**: 298 frontend and 460 backend. |
| New semantic-plan tests | **120 passed**; all prior 638 tests remain passing. |
| Existing frozen compiler/schema/prompt checks | Passed without changing their expectations. |

The existing Vite large-bundle and dependency `@__PURE__` annotation warnings
remain non-fatal. No dependency or unrelated refactor was introduced.

Existing generation behavior, active Ollama instructions, frontend code,
dependencies, frozen evaluation data, and historical experiments remain
unchanged. No live model evaluation is part of Step 1. The schema/composer
modules are not imported by the active provider or frontend. Work stops here
for review before Step 2; no commit, push, or merge was performed.

## Interview explanation

The model-facing representation is a flat inventory plus ordered relationships.
It describes what the UI contains and how those items belong together, while
TypeScript constructs the technical tree. Graph validation proves that each
declaration has one owner and that no cycles exist. This makes composition a
bounded tree walk instead of a best-effort repair algorithm.

Form ancestry is established by explicit membership, not by matching prompt
keywords or guessing where a submit button belongs. The existing compiler
then supplies technical IDs/names and the same final output contract that the
preview and code generator already understand. Reusing that boundary reduces
the chance that two independent compilers disagree about valid UI.

The trade-off is that positional references are another thing a model can get
wrong. Validation catches malformed relationships; it cannot infer an author's
intention when a well-formed index points at the wrong item. That distinction
between structural guarantees and semantic quality is why later live evaluation
is still required before claiming a better generator.
