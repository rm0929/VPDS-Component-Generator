# Phase 2B evaluation and prompt experiments

The existing manual evaluator now measures structure, semantic requirements,
layout complexity, and latency independently. A response can be valid JSON and
still omit nearly everything the user requested. A smaller tree is useful only
when it preserves the requested controls and their relationships.

## Frozen inputs

The [protocol](evaluation-baseline-v2.md) was written before changing model
instructions. All eleven original cases retain their original expectations.
Eighteen new challenge cases cover all ten component types, mixed layouts,
direct children, sibling order, literal properties, required/optional controls,
repeated fields, exclusions, and unsupported widgets/behavior. The total is 29
cases: 25 supported and four unsupported. Each experiment runs every case twice.

Fixtures and their hashes live in `backend/evaluation/fixtures/`. The runner
refuses changed dataset, model-facing grammar, or compiler source fingerprints.
Tests also compare the fixtures against their source definitions. Expectation
changes must be reviewed as a new dataset version, never edited to raise scores.

Recorded environment:

- Model: `qwen3:4b-instruct`.
- Digest: `0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`.
- Ollama: `0.40.5`; Node: `v22.14.0`.
- Temperature 0, seed 0, thinking off, streaming off, 8192 context tokens,
  2048 maximum output tokens, 60-second timeout, 65536 response bytes,
  two-minute keep-alive.
- Dataset: `phase2b-eval-v2`, challenge: `challenge-v1`.
- Compiler revision:
  `403d1d24115f027e26a28dd686b1458239d4776b3a3143a397c5a386573da49d`.

Each artifact includes the full dataset/schema/prompt/scorer hashes, source
fingerprints and Git HEAD. Source fingerprints matter because the compiler was
uncommitted; Git HEAD alone would not identify the implementation. The runner
queries public read-only `/api/version` and `/api/tags` endpoints before inference,
then checks that the runtime and selected model digest are unchanged afterward.
It records only that model's digest, not the full installed-model list.

## How scoring works

`evaluateGeneration.ts` remains the entry point for legacy semantic scoring.
`compositionMetrics.ts` adds constraints to the challenge cases without changing
old expectations. It accepts only outputs that pass authoritative Zod validation.

- Structural validity: supported attempts producing a valid `UiSpecification`,
  divided by all supported attempts. An explicit refusal of an unsupported
  request is measured separately, rather than counted as invalid UI.
- Required-property coverage: matched positive requirements divided by all
  expected positive requirements, including failed supported attempts in the
  denominator. Explicit `false` matches the schema's default absence of
  `required`/`disabled`; exact supplied property values otherwise matter.
- Complete semantic coverage: every required component/property, no prohibited
  controls or unexpected fields when prohibited, and every composition rule.
- Composition: distinct direct children in requested sibling order; a group
  must finish before the item described as below it. Descendant presence alone
  cannot satisfy a direct-child requirement.
- Layout complexity: explicit horizontal/vertical node count, maximum layout
  ancestor depth, single-child layouts, repeated-direction edges, and longest
  repeated-direction chain. Form nodes and renderer-owned field wrappers are
  excluded. Frozen layout budgets measure preferences; they are not Zod rules
  or part of semantic success. Only challenge cases with explicit budgets can
  be flagged as over budget; legacy cases have no retroactive budgets. Invalid
  documents have unassessed complexity.
- Latency: elapsed time per attempt, nearest-rank median/p95, with separate
  valid/invalid-output medians. Cold first attempts and failures are retained.

The matcher is an understandable collection of declared assertions, not another
LLM or a general understanding of English. Challenge labels/properties use exact
values. Relationship rules independently search for matching nodes; this is not
whole-tree equivalence or a global binding solver across repeated candidate
groups. Ambiguous duplicate groups require manual review. Layout budgets and
all per-attempt counters remain visible to help that review. Legacy field-role
matching keeps its existing conventions. No keyword analysis selects components,
modifies the model response, or blocks a valid runtime API response.

The `before` rule measures document order, not rendered pixel geometry. By
itself it cannot prove that one group appears below another inside an arbitrary
surrounding layout. Direct-parent assertions test the declared row/column
compositions; complete coverage means these frozen assertions passed, not that
every possible interpretation of a prompt or its visual result was verified.

## Prompt experiments

`promptExperiments.ts` defines four independent changes from the frozen baseline:

1. `deduplicated`: remove the complete registration example from the system
   message, retaining the same trusted user/assistant example pair.
2. `layout`: explain direct row/column relationships, atomic field wrappers,
   meaningful grouping, keeping actions inside forms, and minimal trees.
3. `examples`: retain the baseline and add three concise demonstrations using
   different requests: paragraph/action row, workspace mixed layout, and alert
   preferences with exclusions. Tests compile every example. No evaluation
   prompt is copied into the demonstrations.
4. `negation`: retain all positive requirements and interpret each exclusion
   within its own scope; UI-only requests remain supported.

`evaluationProvider.ts` substitutes only trusted messages through the provider's
existing injected HTTP seam. Model/schema/settings, HTTP cancellation, bounded
reads, safe diagnostics, draft compilation and final Zod validation follow the
production path unchanged. No prompt is inspected to choose an experiment.

`compareExperiments.ts` rejects mismatched metadata or attempt sets and applies
the predeclared retention gates. It reports improvements and regressions rather
than hiding them in one combined score. Latency is a separate trade-off, never
a reason to accept missing controls.

## Reproducing the measurements

Use Node 22.14+ on Node 22. Run Ollama on loopback with the already-installed
model. These are manual commands, excluded from CI. Run experiments sequentially
so inference requests do not compete with each other. Run from the repository
root; workspace scripts use `backend` as their working directory.

```bash
API_PROVIDER=ollama OLLAMA_MODEL=qwen3:4b-instruct \
OLLAMA_TIMEOUT_MS=60000 OLLAMA_CONTEXT_SIZE=8192 \
OLLAMA_MAX_OUTPUT_TOKENS=2048 OLLAMA_RESPONSE_LIMIT_BYTES=65536 \
EVALUATION_REPEATS=2 EVALUATION_VARIANT=baseline \
EVALUATION_OUTPUT=../docs/evaluation-results/my-baseline.jsonl \
npm run eval:ollama --workspace @vpds/backend
```

Repeat with `EVALUATION_VARIANT=deduplicated`, `layout`, `examples`, or `negation`
and a different output path. Existing artifacts cannot be overwritten. To
diagnose just the exact profile request, additionally set
`EVALUATION_CASE_IDS=c-profile`; subset runs cannot be compared to full runs.

```bash
npm run eval:compare --workspace @vpds/backend -- \
  ../docs/evaluation-results/baseline-v2.jsonl \
  ../docs/evaluation-results/deduplicated-v2.jsonl \
  ../docs/evaluation-results/layout-v2.jsonl \
  ../docs/evaluation-results/examples-v2.jsonl \
  ../docs/evaluation-results/negation-v2.jsonl
```

Evaluation exit code 1 means one or more measured cases failed, not a crashed
harness. Exit code 2 indicates setup/metadata/artifact failure. Comparison emits
JSON decisions; rejecting a candidate is a valid completed comparison.

Artifacts store metrics, fixed case IDs, safe error codes, and safe diagnostics.
No raw model responses, submitted prompts, or generated labels/field values are
logged. The public synthetic prompts and human-authored expectations are stored
in the versioned dataset, not copied into diagnostic records. Diagnostics are
explicitly enabled only in this manual local runner; normal opt-in development
diagnostic policy remains unchanged.

## Exact profile diagnosis

The baseline reproduced the requested failure twice for:

> Create a profile form with first name and last name side by side, email below them, and a Save Profile button.

Both attempts returned `INVALID_PROVIDER_OUTPUT` with:

```json
{
  "stage": "ui_schema",
  "issues": [{
    "path": ["root", "children", 0, "children", 2],
    "code": "custom",
    "message": "Submit/reset buttons require a form ancestor."
  }]
}
```

JSON parsing and draft compilation reached authoritative validation. The
rejected action had submit/reset semantics without a form ancestor. This is
not evidence of duplicate IDs, broken JSON, or a compiler dropping controls.
The exact returned draft is intentionally not logged. The evidence establishes
the violated relationship, not why the model chose it. Adding prose about forms
cannot be assumed to fix the relationship without measured results.

The compiler deliberately creates technical identities, not missing UI semantics.
Inventing a form or moving actions would change the model's component selection
and nesting. Rejecting that tree preserves the authoritative contract. Similarly,
neither valid IDs nor valid JSON prove that the requested fields are present.

## Results

All five runs completed: 290 attempts, 58 per variant. Structural and complete
coverage denominators are the 50 supported attempts per variant. The unsupported
accuracy denominator is eight unsupported attempts. Required-property coverage
has 166 positive requirements per variant; it does not include relationship or
forbidden-component assertions, which additionally affect complete coverage.

| Experiment | Valid UI | Complete coverage | Required-property coverage | Correct unsupported | False refusals of supported requests |
| --- | --- | --- | --- | --- | --- |
| [Baseline](evaluation-results/baseline-v2.jsonl) | 46/50 (92%) | 30/50 (60%) | 73.5% | 8/8 | 0 |
| [Remove duplicate](evaluation-results/deduplicated-v2.jsonl) | 48/50 (96%) | 24/50 (48%) | 50.6% | 8/8 | 0 |
| [Layout guidance](evaluation-results/layout-v2.jsonl) | 48/50 (96%) | 28/50 (56%) | 66.3% | 6/8 | 0 |
| [Diverse examples](evaluation-results/examples-v2.jsonl) | 38/50 (76%) | 24/50 (48%) | 60.2% | 8/8 | 6 |
| [Negation guidance](evaluation-results/negation-v2.jsonl) | 44/50 (88%) | 30/50 (60%) | 68.7% | 8/8 | 0 |

Layout means below use structurally valid supported attempts only. The chain
column averages each document's longest same-direction chain. Per-document
values, including a maximum observed chain of five in every variant, are kept
in the artifacts. There were respectively 4, 2, 2, 12, and 6 unassessed documents.

| Experiment | Layout count | Layout depth | Single-child layouts | Repeated-direction edges | Longest chain (mean) | Over budget |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline | 3.39 | 3.35 | 2.74 | 1.70 | 2.39 | 20 |
| Remove duplicate | 3.29 | 2.21 | 2.71 | 1.50 | 1.54 | 14 |
| Layout guidance | 3.13 | 2.92 | 2.63 | 1.88 | 2.33 | 16 |
| Diverse examples | 2.89 | 2.79 | 2.26 | 1.58 | 2.00 | 16 |
| Negation guidance | 3.64 | 3.59 | 3.00 | 1.95 | 2.82 | 24 |

Latency includes every attempt, including correct refusals and failed supported
requests. A faster incomplete response is not a quality improvement.

| Experiment | Median ms | p95 ms | Legacy complete coverage | Challenge complete coverage |
| --- | --- | --- | --- | --- |
| Baseline | 4322 | 6120 | 14/18 (77.8%) | 16/32 (50%) |
| Remove duplicate | 1757 | 8927 | 8/18 (44.4%) | 16/32 (50%) |
| Layout guidance | 7025 | 11598 | 10/18 (55.6%) | 18/32 (56.3%) |
| Diverse examples | 5664 | 12491 | 12/18 (66.7%) | 12/32 (37.5%) |
| Negation guidance | 7731 | 32167 | 12/18 (66.7%) | 18/32 (56.3%) |

Core-case complete successes out of two attempts:

| Experiment | Registration | Contact | Simple login | Exact profile | Negated login | UI-only login |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline | 2 | 2 | 2 | 0 | 2 | 2 |
| Remove duplicate | 0 | 0 | 2 | 0 | 0 | 0 |
| Layout guidance | 2 | 2 | 2 | 0 | 0 | 2 |
| Diverse examples | 2 | 0 | 2 | 0 | 2 | 2 |
| Negation guidance | 2 | 2 | 2 | 0 | 2 | 2 |

Observed regressions and decisions:

- Removing the duplicate example improves validity and average layout depth,
  but loses registration, contact, password-reset, field-property, newsletter,
  and both login-with-exclusion cases. Two attempts violate exclusions.
- Layout guidance improves validity, standalone input cases, and repeated-field
  coverage, but regresses password-reset, field properties, newsletter, negated
  login, and refusal of the unsupported select widget. Two exclusion violations
  remain; repeated-direction edges increase despite the lower layout count.
- Diverse examples improve the legacy layout-properties case and repeated-field
  coverage, but regress contact, field properties, checkbox, ordinary-button,
  form-actions, and newsletter cases. Six supported requests are falsely refused
  (contact, checkbox, profile, twice each). Some outputs violate form nesting.
- Negation guidance preserves all six core-case successful counts and the 60%
  aggregate complete rate, but loses the field-properties case, reduces validity
  and positive coverage, increases all three gated layout means, and produces
  invalid repeated-field documents. It improves the standalone text-input case.

The exact profile request succeeds semantically in none of the variants.
Deduplication and layout guidance produce valid UI, but both match only four
of six exact requirements and fail `names-same-row`. Their profile layout counts
are four and six respectively. Additional examples falsely refuse the profile.
Negation guidance still reports `ui_schema`, `custom`, at `root.children[1]`:
the same missing-form-ancestor rule, at a different structural position. These
are observations from safe assertions/diagnostics, not guesses about unlogged
labels or the model's internal reasoning.

The baseline's two new negated-login cases succeed, while deduplication breaks
both and layout guidance breaks the explicit control-exclusion case. Therefore
negation failures depend on the full prompt/context; the earlier report of a
failure on another wording does not establish a universal negation failure.

The [machine-readable comparison](evaluation-results/comparison-v2.jsonl)
rejects all four candidates under the rules frozen before these experiments.
No candidate qualifies for promotion and no unmeasured combination is deployed.
The runtime system prompt and trusted example conversation remain unchanged.

## Recommendation

Keep the baseline runtime prompt and retain these candidates only as reproducible
experiments. The baseline is still insufficient for reliable requirement
fulfillment: 92% structural validity does not compensate for 60% complete
coverage, and the exact profile request remains unresolved. More instruction
text or more examples cannot be assumed to improve this model's behavior.

For a subsequent reviewed experiment, test a shorter replacement instruction set
instead of accumulating more appendices, then measure it against the same frozen
dataset. Review ambiguous matching groups and visual-layout assertions as a
separate evaluator improvement with a new dataset/scorer version. Preserve this
baseline and its expectations so that future gains can be measured honestly.
Do not repair missing controls, invent forms, or flatten layouts in the compiler
to make scores pass. No further model/architecture or frontend change was made.

## Changed files and verification

This task adds/extends:

- `backend/evaluation/challengeCases.ts`, `compositionMetrics.ts`, `benchmark.ts`:
  versioned expectations and separate composition/layout/latency scoring.
- `backend/evaluation/evaluateGeneration.ts`: export its existing case type;
  the eleven case definitions and expectations are unchanged.
- `backend/evaluation/runOllama.ts`, `metadata.ts`: extend the existing manual
  runner with frozen-input checks, runtime fingerprints and safe JSONL artifacts.
- `backend/evaluation/evaluationProvider.ts`, `promptExperiments.ts`,
  `compareExperiments.ts`: isolated trusted-message experiments and retention gates.
- `backend/evaluation/fixtures/{legacy-v1,challenge-v1,baseline-prompt-v1,frozen-manifest}.json`:
  frozen data, trusted baseline messages and source/grammar hashes.
- `backend/src/requirementCoverage.ts`: export the existing pure node matcher for
  reuse by the evaluator; matching behavior and runtime provider behavior are unchanged.
- `backend/test/benchmark.test.ts`, `evaluationMetadata.test.ts`,
  `promptExperiments.test.ts`: 33 new tests, including a developer-authored
  regression that reproduces the observed profile issue path without saving
  a raw model response.
- `backend/package.json`: `eval:compare` script; no dependency changes.
- `README.md`, `docs/evaluation-baseline-v2.md`, this report, and six safe
  measurement/comparison artifacts in `docs/evaluation-results/`.

Final checks on Node 22.14.0:

- `npm run build`: passed for frontend and backend. Existing Vite large-chunk
  and dependency `@__PURE__` annotation warnings remain non-fatal.
- `npm run lint`: passed.
- `npm test`: passed, **629 tests** (298 frontend, 331 backend). The 596 tests
  present before this task remain passing, including all earlier baseline tests.
- All five manual evaluations completed; their exit code 1 correctly reports
  quality failures. Offline comparison completed and rejected all candidates.
- Branch remains `feature/ai-component-generation`. No commit, push, merge,
  frontend implementation change, automatic flattening, or Phase 2C work.

## Scope and limitations

No layout normalization, IR/compiler/schema changes, frontend changes, model
switch, paid service, or additional framework are part of these experiments.
No real inference runs during build, tests, startup, or CI. The automated tests
exercise evaluator behavior, metadata mocks, prompt isolation, valid trusted
examples and retention decisions.

Two repetitions of a small hand-authored dataset provide development evidence,
not a statistical guarantee or a claim of general language understanding.
Temperature/seed settings improve repeatability but do not guarantee identical
outputs on every runtime/hardware combination. Fixed experiment order, caching,
model loading, concurrent local activity, and thermal conditions affect timings.
Layout averages include incomplete but valid documents and use different valid
subsets when structural validity changes; lower averages alone cannot demonstrate
better composition. Repeated runs, broader independently reviewed datasets, and
manual review are still needed before relying on generated UI.
