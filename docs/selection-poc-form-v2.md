# Explicit forms in the flat selection PoC

This focused change affects only the isolated PoC. Existing draft/semantic-plan
providers, authoritative specification, registry, deterministic IDs/names, Nova
renderer, TSX generator and frontend remain unchanged.

## Controlled diagnosis of the earlier outputs

The earlier failed selections were not saved. Before changing the contract or
instructions, two controlled calls repeated the exact login/profile prompts with
the original grammar, messages, model and settings. Only validated component
types, property-match booleans, order/group indexes and safe errors were retained.
Raw responses, prompts, field values and labels were not logged.

The [controlled diagnostic](selection-poc-results/form-diagnostic-v1/results.json)
found:

| Request | Components | Checked labels | Order | Row | Form |
| --- | --- | --- | --- | --- | --- |
| Login | email, password, checkbox, button; no extras | Expected field/remember labels matched | Correct | None, as expected | Not declared |
| Profile | two text inputs, email, button; no extras | First/last/email/action labels matched | Correct | Missing requested name row | Not declared |

Both failed at `composition`, path `components[3].props.type`, code `custom`,
message `Submit/reset buttons require a declared form.` The native action type
was not logged in this old diagnostic, so submit versus reset is not inferred.
The profile had a real row-selection failure in addition to the form problem.
These new diagnostic calls are not represented as recovered original responses.
Their [trusted schema/messages snapshot](selection-poc-results/form-diagnostic-v1/inputs.json)
matches the original PoC hashes recorded in the first report.

## Revised contract and accessible naming

This is the versioned `selection-poc-2` contract. The only model-facing structural
change replaces `formLabel` with a required declaration:

```json
{
  "version": "selection-poc-2",
  "form": { "enabled": true, "label": null },
  "components": [
    { "type": "textInput", "props": { "label": "Asset tag", "required": false } },
    { "type": "button", "props": { "label": "Apply", "type": "submit" } }
  ],
  "unsupported": []
}
```

- Both `enabled` and `label` are required. Extra form keys and legacy `formLabel`
  are rejected, not migrated silently.
- `enabled` alone controls whether the compiler creates a form. It is never
  inferred from a prompt, field count or action label.
- For `enabled: true`, a valid supplied label is preserved exactly. `label: null`
  uses the fixed application-owned accessible name **Generated form**. The source
  selection stays null; the report identifies default-name use explicitly.
- A non-null label must pass the existing strict registry validator. Blank,
  whitespace-only, unsafe, oversized and non-string labels are rejected rather
  than trimmed, repaired or replaced with the default.
- For `enabled: false`, `label` must be null. A supplied unused name is rejected
  as contradictory metadata.
- Submit/reset outside an enabled form remain invalid. Ordinary buttons are valid
  outside forms. A provided label cannot turn a disabled form on.

This separates structural intent from accessible naming. The default guarantees
a nonblank programmatic name without inventing a user-facing heading, copying
an action label or preventing form creation because the model lacks a title.
It is generic, not necessarily the best name for a real product form. Explicitly
requested names remain semantic requirements in evaluation: a generic fallback
does not satisfy a specific name in the frozen dataset.

All component props, flat order, adjacent `besidePrevious` grouping, medium-gap
defaults, strict safety boundaries and authoritative v1.0 validation are retained.
Only the form paragraph and corresponding form fields in the same two trusted
demonstrations change; no layout/keyword/example-prompt special case is added.

## Evaluation policy fixed before the new live run

The original twelve-case JSON and expectations are unchanged, with file SHA-256
`cd20106e24e0d55fdb6c457551d14a5ce3e301f3256f7d834bc092afe8c8dd7b`.
The existing fixture calls its expected accessible name `formLabel`; this is
evaluation data, not the revised model contract. It is not renamed or rewritten.
Case order, expected controls/properties, native button types, row relationships,
forbidden controls and unsupported categories are preserved.

The manual runner first calls the same three feasibility prompts once each.
It captures safe metadata **before composition**, so a failed form no longer
hides selection or row measurements. It records these axes separately:

1. Component multiset, missing/extra controls and property/label match booleans.
2. Presentation order and exact horizontal row membership.
3. Form intent, membership, model-name/default-name use and naming correctness.
4. Selection validation, composition/authoritative validation and safe failure paths.
5. Generated TSX compilation against installed React/Nova APIs, with no execution.

The complete benchmark is authorized only when **all three** initial cases pass
all applicable axes. A valid specification alone is insufficient if a row or a
requested control is missing. Browser responsiveness/breakpoints remain unverified;
the same login prompt's basic controls and representable layout are assessed.

If the gate opens, the runner performs the unchanged twelve cases in fixed order,
three repetitions each, in the same process using the same frozen messages,
grammar, model/settings. If it stays closed, it records the reason and makes zero
benchmark calls. No prompts, expectations or settings may be edited during a run.
Failed cases are retained without retries or repairs.

Fixed hashes before the new run:

| Input | SHA-256 |
| --- | --- |
| Model schema | `385bab39b1c0e9fe1f9b3f1da0f1011cb76a34f43edfc1f33e04ad30854d23ad` |
| Trusted messages | `c50372ff66d3568ad1da08a7040fbe933fda546f3a6e44d92d9993a89f65700f` |

Model settings are unchanged: local `qwen3:4b-instruct`, temperature 0, seed 0,
8192 context, 2048 maximum output tokens, 65536 response bytes, 60000 ms deadline,
non-streaming, thinking disabled. Manual runs remain outside CI.

From the repository root with Node 22.14+ and existing loopback Ollama running:

```bash
API_PROVIDER=ollama OLLAMA_MODEL=qwen3:4b-instruct \
  OLLAMA_BASE_URL=http://127.0.0.1:11434 OLLAMA_TIMEOUT_MS=60000 \
  OLLAMA_CONTEXT_SIZE=8192 OLLAMA_MAX_OUTPUT_TOKENS=2048 OLLAMA_RESPONSE_LIMIT_BYTES=65536 \
  POC_BENCHMARK_IF_PASS=true npm run poc:feasibility --workspace @vpds/backend
```

The default output directory is `docs/selection-poc-results/form-v2`; it must be
fresh. For a deliberate later run set a different `POC_OUTPUT_DIRECTORY`. The
runner saves only safe metadata and separately identified validated specification/
trusted-generated TSX artifacts. Production configuration is not switched.

## Observed revised-contract results

One fixed attempt per feasibility request was run on local `qwen3:4b-instruct`,
Ollama **0.40.5**, model digest
`0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`.
The runtime version and digest were checked before and after inference. The
[results](selection-poc-results/form-v2/results.json) and
[trusted input snapshot](selection-poc-results/form-v2/inputs.json) retain the
frozen hashes and settings above.

| Request | Selection/checked labels | Order | Requested row | Form/membership | Selection + UiSpec validation | TSX compilation | Inference |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Email input | Correct; nonblank label validated | Correct | Correct: no row | Correct: no form | Pass | Pass | 4.145 s |
| Login + remember me | Email, password, checkbox, submit; checked labels correct | Correct | Correct: no row | Enabled, named, valid ancestry | Pass | Pass | 2.405 s |
| Profile | First name, last name, email, submit; checked labels correct | Correct | **Fail: no horizontal row selected** | Enabled, named, valid ancestry | Pass | Pass | 2.456 s |

All three had zero extra components and empty unsupported lists. Both forms
received valid model-supplied names; neither used the generic fallback. The
email/button labels where the request did not specify exact wording are checked
for schema validity, not for an invented exact expected phrase. Native button
types are recorded separately; both observed form actions were `submit`.

Across these **three attempts only**, selection validation, checked component
coverage, order, form membership, authoritative validity and generated-source
compilation were each **3/3**. Representable layout accuracy and complete
feasibility success were **2/3**. There were **0/3 false unsupported outcomes**;
this tiny supported-only sample says nothing about genuinely unsupported requests.
Median inference time was **2.456 s**; total per-attempt times including compilation
were 4.522, 2.647 and 2.655 seconds respectively. No browser rendering, breakpoint
behavior, authentication or persistence was exercised by these checks.

The profile issue is a **semantic layout omission**, not a validation failure:
the validated selection contained no adjacent-row relationship (`rows: []`),
so the composer correctly stacked the name fields. There is no Zod failure stage
or issue path for this attempt. Creating a row anyway would invent a relationship
the model did not select; the compiler deliberately does not do that.

The declared gate therefore **failed**. The full twelve-case, three-repetition
benchmark was **not run (0/36 calls)**. Its frozen file and expectations were not
modified. No phrase-specific fixes, extra inference retries or prompt changes
were made after observing this outcome. The focused form-contract fix removes
the reproduced composition failures, but reliable natural-language row selection
remains unresolved. These results do not establish generalization across the
full catalog or justify replacing either production workflow.

## Changed files and verification

Only the isolated PoC, its tests and reports changed in this task:

- `backend/evaluation/selection-poc/selection.ts`: explicit form contract, strict
  contradictory-label rejection and accessible fallback in composition.
- `backend/evaluation/selection-poc/model.ts`: matching grammar and form instructions;
  same catalog, grouping rules and two demonstrations.
- `backend/evaluation/selection-poc/ollama.ts`: expose validated selections before
  composition, preserving the existing combined helper and HTTP safeguards.
- `backend/evaluation/selection-poc/diagnostics.ts`: safe form-related issue paths
  and developer-owned messages.
- `backend/evaluation/selection-poc/assessSelection.ts`: independent evaluation-only
  component/property, order, row and form comparisons, emitting safe metadata.
- `backend/evaluation/selection-poc/runFeasibility.ts`: preserve metrics on composition
  failure, compile generated TSX, and conditionally run the unchanged benchmark.
- `backend/test/selectionPoc.test.ts`, `selectionPocOllama.test.ts`, and
  `selectionPocAssessment.test.ts`: adapted fixtures and contract/evaluation regressions.
- This report, the historical report's follow-up link, and the two result directories
  `form-diagnostic-v1` and `form-v2` (including validated specification/TSX artifacts).

With Node **22.14.0**:

| Check | Result |
| --- | --- |
| `npm run build` | Pass: frontend and backend |
| `npm run lint` | Pass |
| `npm test` | **964 passed**: 298 frontend + 666 backend |
| Focused PoC tests | **108 passed**, included in the full suite |

The full suite preserves the previous 934 tests and adds 30 focused cases.
Tests cover all seven leaf types, ordinary buttons outside forms, native
submit/reset inside forms and rejection outside, optional/false properties,
adjacent grouping, repeated/Unicode labels, strict label handling, malformed or
unsafe data, limits, mocked transport failures, safe metadata, gate behavior and
generated TSX type-checking against installed Nova. CI does not call Ollama.

Build warnings remain for dependency annotation comments and the frontend chunk
above 500 kB; neither blocks the build. No dependencies were added. Existing
production providers, frontend and frozen datasets were preserved. No model was
changed or downloaded, and no commit, push or merge was performed.
