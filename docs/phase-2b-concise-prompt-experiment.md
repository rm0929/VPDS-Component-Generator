# Concise replacement prompt experiment

## Plan frozen before inference

This is one independent experiment, `concise-v1`, against the existing
`phase2b-eval-v2` dataset: all 29 cases, their unchanged expectations, two
repetitions in the same fixed order. No subsets, prompt tuning after inspecting
scores, schema changes, retries to replace failed samples, or altered retention
gates are part of this experiment. Prior artifacts and runtime prompts remain
unchanged. The reference is `evaluation-results/baseline-v2.jsonl`.

Only trusted messages change: a new single system message replaces the old
system message and registration example pair. The actual request is still the
final user message. The complete replacement is in
`backend/evaluation/concisePrompt.ts`; its trusted-message JSON SHA-256 is
`4b29aa0742b5c86ff1e8d1c2c9ef51e53b5662e3227d9fe4b7f6d0b5d439725e`.
Message content totals 3117 characters versus 5389 for the baseline (joined
with newlines), a 42% reduction. These are character counts, not tokenizer counts.

The replacement teaches whole-request interpretation, gives a compact reference
for all ten components and supported properties, preserves positive requirements
while scoping exclusions, and explains form ancestry and meaningful shallow
grouping. Fields already own label/input wrappers. Unsupported components and
executable behavior get the existing explicit unsupported outcome. There are
no examples, request classifiers, component plans, or evaluation-specific labels.
The silent final check is an instruction within a single inference call, not a
new planning pipeline or emitted intermediate representation.

Controls remain identical: `qwen3:4b-instruct`, digest
`0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`,
Ollama `0.40.5`, temperature 0, seed 0, thinking/streaming off, context 8192,
maximum output 2048 tokens, timeout 60000 ms, response cap 65536 bytes, keep-alive
two minutes. Compiler, grammar, dataset and scorer fingerprints must match the
existing baseline. The runtime/model will be checked before and after inference.

The [frozen retention protocol](evaluation-baseline-v2.md) requires no decrease
in structural validity, complete coverage, positive coverage or unsupported
accuracy; no additional forbidden violations; no decrease in the six core-case
success counts; and no worsening of mean layout count, depth or single-child
layouts. Latency is reported separately. Passing gates would justify only a
recommendation; this experiment does not edit the runtime prompt.

The existing comparator additionally reports both summaries per case, including
structural and property regressions on cases that already failed complete
coverage. It does not change scoring or gates. Layout measurements are still
observations, not normalization. Outputs remain subject to the same draft
compiler and authoritative Zod validation, with safe diagnostics only.

## Manual commands

Run on Node 22.14+ (Node 22) from the repository root, with Ollama already running
on loopback. No model downloads or inference occur in CI.

```bash
API_PROVIDER=ollama OLLAMA_MODEL=qwen3:4b-instruct \
OLLAMA_TIMEOUT_MS=60000 OLLAMA_CONTEXT_SIZE=8192 \
OLLAMA_MAX_OUTPUT_TOKENS=2048 OLLAMA_RESPONSE_LIMIT_BYTES=65536 \
EVALUATION_REPEATS=2 EVALUATION_VARIANT=concise-v1 \
EVALUATION_OUTPUT=../docs/evaluation-results/concise-v1.jsonl \
npm run eval:ollama --workspace @vpds/backend

npm run eval:compare --workspace @vpds/backend -- \
  ../docs/evaluation-results/baseline-v2.jsonl \
  ../docs/evaluation-results/concise-v1.jsonl
```

Use a fresh output path for any later reproduction; the runner never overwrites
an existing artifact. Exit code 1 from inference records quality failures; exit
code 2 means setup failure. Comparison reports gate decisions as data.

## Results

The run completed on 2026-10-19 (IST), with all 58 attempts retained. The
runner checked that the selected runtime/model were unchanged afterward. The
saved comparison confirms identical dataset, grammar, compiler, scorer, model
digest, runtime, settings and case/run sets. Only the trusted prompt differs.

**Reject `concise-v1`; do not change the runtime prompt.** The frozen gates fail
on all four aggregate quality rates, five previously successful core cases,
and all three gated layout means. No prompt changes or replacement samples
were made after examining outcomes.

| Metric | Baseline | Concise replacement |
| --- | --- | --- |
| Structural validity, supported attempts | 46/50 (92%) | 29/50 (58%) |
| Complete semantic coverage | 30/50 (60%) | 6/50 (12%) |
| Positive requirement coverage | 122/166 (73.5%) | 23/166 (13.9%) |
| Correct unsupported outcomes | 8/8 (100%) | 4/8 (50%) |
| False refusals of supported requests | 0 | 0 |
| Forbidden-component violating valid outputs | 0 | 0 |
| Failed relationship assertions on valid supported outputs | 4 | 10 |

Zero forbidden-component violations does not compensate for missing positive
requirements or rejected documents. Structural failures receive zero positive
coverage under the unchanged protocol; they do not establish that the model
generated no requested controls. Valid-but-incomplete outputs are distinguished
from those rejected documents in the per-case results.

Layout means use structurally valid supported outputs only. There are 46 such
baseline documents and 29 replacement documents; invalid outputs remain
unassessed, not zero-complexity successes.

| Layout metric | Baseline | Replacement |
| --- | --- | --- |
| Mean explicit layout count | 3.39 | 5.28 |
| Mean layout depth | 3.35 | 4.76 |
| Mean single-child layouts | 2.74 | 4.76 |
| Mean repeated-direction edges | 1.70 | 3.14 |
| Mean longest same-direction chain per document | 2.39 | 3.83 |
| Over-budget valid challenge attempts | 20 | 20 |
| Unassessed supported outputs | 4 | 21 |

Latency includes every attempt and follows the original nearest-rank definition.

| Latency metric | Baseline | Replacement |
| --- | --- | --- |
| Median ms | 4322 | 5348 |
| p95 ms | 6120 | 12201 |
| Maximum observed ms | 9081 | 196146 |
| Valid-UI median ms | 4441 | 4507 |
| No-valid-UI median ms, including correct unsupported outcomes | 582 | 6678 |

Two samples returned `GENERATION_TIMEOUT`: registration run 2 at **178655 ms**
and unsupported-image run 2 at **196146 ms**, despite a configured 60000 ms
timeout. The logs do not establish why elapsed time exceeded that setting.
They are retained as failures; no inferred model-quality cause, resampling or
post-hoc exclusion is applied. The p95 hides these two tail samples, which is
why the maxima and sample identities are explicit. Timing/scheduling or
cancellation-latency diagnosis needs a separate instrumented run. The strong
quality regressions also occur on completed, non-timeout responses, so these
two samples do not justify promoting this prompt. Tail-latency attribution is
limited by this unresolved observation.

### Per-case findings

The [complete 29-case tables](evaluation-results/concise-v1-per-case.md) compare
validity, complete coverage, positive requirement matches, explicit refusals,
layout count/depth/unary wrappers/repeated chains and median latency. The
[machine-readable comparison](evaluation-results/concise-v1-comparison.jsonl)
includes both summaries and decreased quality metrics per case. The
[safe run artifact](evaluation-results/concise-v1.jsonl) preserves both samples,
all diagnostic paths/codes and metadata, without raw responses or field values.

- Thirteen supported cases that previously achieved complete coverage now fail:
  registration, login, contact, split-name, password-reset, simple-login,
  field-properties, checkbox, paragraph text, form-actions, newsletter, negated
  login and UI-only login.
- The unsupported-widget and unsupported-image cases also regress: neither
  produces a correct explicit refusal in either repetition. Unsupported behavior
  and storage requests still produce the expected refusal in both repetitions.
- Two additional cases lose quality despite already failing complete coverage:
  `layout-properties` falls from 4/6 to 2/6 positive matches, and
  `c-repeated-fields` falls from 6/8 to 0/8 and loses structural validity. This
  brings the total to **17 quality-regressed cases**, beyond the 15 cases in
  the legacy pass-to-fail regression list.
- `horizontal-content` is the only newly complete case (0/2 to 2/2). Ordinary
  button and heading remain complete. Row and column cases improve positive
  matches from 2/6 to 4/6 each, but still fail the direct-child relationship.
- `c-mixed` becomes structurally valid in both repetitions while matching zero
  positive requirements and failing all three composition relationships. That
  is a useful example of valid structure without requested meaning.
- No form case achieves complete coverage. Contact stays valid in both runs
  while falling from 10/10 to 2/10 positive matches; registration's completed
  first attempt matches only 1/7 requirements and has 11 layouts, 10 single-child.

Core-case complete successes out of two attempts:

| Case | Baseline | Replacement |
| --- | --- | --- |
| Registration | 2 | 0 |
| Contact | 2 | 0 |
| Simple login | 2 | 0 |
| Exact profile | 0 | 0 |
| Negated login | 2 | 0 |
| UI-only login | 2 | 0 |

### Safe failure-stage evidence

All 23 diagnosed validation failures occur at `ui_schema`, with `custom` Zod
codes. Their 31 issues comprise 14 nested-form issues and 17 missing-form-ancestor
issues; some attempts have multiple issues. No JSON-parsing or draft-shape
failure is recorded. There are also four correct unsupported outcomes and the
two timeouts described above. Twenty validation failures and one timeout occur
on supported requests; the remaining three validation failures and one timeout
occur on unsupported widget requests.

The exact profile request fails in both repetitions at:

```text
stage: ui_schema
path: root.children[0].children[1].children[0]
code: custom
message: Submit/reset buttons require a form ancestor.
```

For login and negated login, safe diagnostics report nested forms at
`root.children[0].children[0].children[0].children[0]` and
`root.children[0].children[0].children[1].children[0]`. These paths establish
invalid form composition, not a failure to parse JSON or assign unique IDs.
The unchanged compiler correctly rejects those structures instead of silently
inventing a different UI. The logs do not identify the model's internal reason
for choosing them or the exact property responsible for every positive-match
failure; generated field values were deliberately not recorded.

## Architectural options if retention fails

These are future options, not implemented changes. All should retain the final
authoritative schema and the frozen evaluation expectations.

| Option | What it could improve | What it does not establish | Cost and evaluation needed |
| --- | --- | --- | --- |
| Improve the current single-stage representation | Keep the same IR and compiler, but consider a context-aware model grammar: form descendants cannot contain another form, and submit/reset actions are available only inside forms. Review representational ambiguity separately from prompting. | Structural constraints do not prove that the requested controls, properties or meaningful groups are present. Extra grammar complexity can change decoding behavior, so gains cannot be assumed. | Smallest change to the current product architecture, though grammar implementation/testing is real work. Run a separate grammar-only experiment with the baseline prompt and unchanged expectations; measure semantic regressions too. |
| Two-stage semantic planning and composition | An explicit inventory of controls, properties, exclusions and grouping relationships makes missing requirements and composition decisions easier to inspect independently. A composer could turn a sufficiently precise validated plan into the existing draft. | A valid plan can still omit requirements. A second model call can repeat or introduce mistakes; planning is not a semantic correctness guarantee. | Largest engineering change: another versioned contract, validation, composition semantics, tests and end-to-end evaluation. Two model calls add sequential latency; a deterministic composer avoids a second call but requires its own carefully specified semantics. Evaluate plan quality and final UI quality separately. |
| Benchmark another locally runnable model | Keeping the same IR, compiler, grammar, prompt and dataset gives evidence about whether another model follows this contract more reliably before redesigning the application. | A different model is not guaranteed to fit memory, improve quality, or have acceptable latency. These prompt experiments alone cannot prove a model-capacity limitation. | Requires approval and a model chosen to fit the machine, including context/cache memory. Record its digest/runtime/settings and keep the Qwen reference. The current runner intentionally pins Qwen and the comparator rejects different digests; add a reviewed model-comparison mode rather than silently bypassing those controls. |

Changing the grammar or representation and changing the model simultaneously
would obscure which change helped. A two-stage system also needs an independently
evaluated planner; it should not be introduced merely because a shorter prompt
failed. The current compiler assigns identities and validates semantics supplied
by the model; none of these options justify inventing missing fields, silently
moving actions into forms, or automatically flattening layouts.

## Recommendation

Keep the baseline runtime prompt. A 42% character reduction did not improve
this configured model's behavior, and none of the documented retention gates
justify adopting this candidate. Its prompt source remains evaluation-only so
the exact experiment can be reproduced.

Before adding a two-stage pipeline, prefer an **approved controlled local-model
benchmark** using the same existing baseline prompt, IR, compiler, grammar and
dataset. That offers useful evidence with little product-architecture change.
Select a candidate only after checking memory/context requirements for the
16 GB machine; no model is selected, downloaded or switched in this task. Use
the same inference controls where supported and document any required difference
rather than presenting it as a prompt-only comparison. This recommendation is
about learning whether a different model follows the existing contract, not an
assumption that it will perform better.

If Qwen must remain the only candidate, the next narrow experiment should improve
the current single-stage model-facing grammar's form-ancestry constraints, with
the baseline prompt held fixed. That targets the validation failures we actually
observed. It does not directly solve the baseline's 16 supported attempts that
were valid but semantically incomplete, so semantic metrics remain essential.

Reserve a two-stage planner/composer for a reviewed design if single-stage/model
benchmarks still show systematic inventory-versus-layout failures. It offers
better observability but adds contracts and potential failure points; require
measured plan coverage and end-to-end gains before accepting that complexity.
Investigate the two delayed timeout settlements separately before making strong
tail-latency comparisons. None of these follow-up options was implemented.

## Changed files and verification

- `backend/evaluation/concisePrompt.ts`: one frozen, evaluation-only system prompt.
- `backend/evaluation/promptExperiments.ts`: register `concise-v1`; previous
  trusted messages retain their original fingerprints.
- `backend/evaluation/compareExperiments.ts`: additive per-case summaries and
  regression flags; aggregate scoring and retention gates are unchanged.
- `backend/test/promptExperiments.test.ts`, `evaluationMetadata.test.ts`: nine
  new tests for old/new fingerprints, prompt isolation, per-case regression
  visibility, unchanged HTTP settings/grammar, and final authoritative rejection.
- This report, its README link, and three artifacts:
  `concise-v1.jsonl`, `concise-v1-comparison.jsonl`, `concise-v1-per-case.md`.

Final verification on Node 22.14.0:

- `npm run build`: frontend and backend pass; existing Vite bundle-size and
  dependency annotation warnings remain non-fatal.
- `npm run lint`: passes.
- `npm test`: **638 pass** (298 frontend, 340 backend), including all previous
  629 tests. Automated inference responses are mocked; CI never calls Ollama.
- Manual evaluation completed all 58 attempts with exit code 1 for quality
  failures. Offline comparison completed with `retain: false`.
- Frozen dataset/schema/compiler fingerprints and all prior prompt variants
  remain unchanged. No API contract, frontend, runtime prompt, IR, model or
  pipeline change; no commit, push, merge, or Phase 2C implementation.

## Interpretation limits

This is one complete replacement, not a factorial study. It changes wording,
catalog presentation and example usage together. A failure would reject this
candidate, not prove that every concise prompt fails, that examples alone caused
the difference, or that the model cannot handle another representation.

The two repetitions are not 58 independent language tasks: they repeat 29 fixed
requests with temperature/seed held constant. Exact-label/property assertions
and the documented relationship-matcher limitations remain unchanged. Layout
averages use valid supported outputs, so changing validity changes the measured
subset. Latency is elapsed request time, including loading/caching effects and
failed attempts, not a controlled hardware microbenchmark. Unsupported accuracy
measures the explicit unsupported outcome, not the correctness of its reason
category. Safe diagnostics establish violated validation rules, not the model's
internal reasoning or unlogged field values.
