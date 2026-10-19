# Semantic UI-only interpretation experiment — results and recommendation

**Recommendation: keep the baseline runtime prompt unchanged. Do not adopt the
candidate.** The clarification did not reduce false unsupported classifications
or produce any UI specifications on supported requests. All 29 cases had identical
quality outcomes in both repetitions. This is a failed quality-improvement
experiment, not a successful generation baseline.

The current runtime prompt remains byte-for-byte unchanged. The isolated variant
and manual evaluation support are retained for reproducibility only. No active
prompt, SemanticUiPlan schema, composer, draft compiler, authoritative Zod schema,
registry, API contract, model or frontend was changed. No commit/push/merge was
performed; work remains on `feature/ai-component-generation`.

## Experiment and reproducibility

The [protocol](semantic-ui-only-experiment-protocol.md) was written before the
live runs. It uses the unchanged frozen `phase2b-eval-v2` dataset: 25 supported
cases and four unsupported cases, with two repetitions each. Both workflows use
SemanticUiPlan v1, the existing semantic composer/draft compiler, and one inference
call per attempt. There are **116 completed live attempts**, 58 per prompt.

The baseline is the current semantic-plan system message, frozen as a new
evaluation fixture without modifying the runtime. The candidate adds only the
prominent general UI-only policy approved for this experiment. It distinguishes
UI/TSX generation from business implementations, makes action labels ordinary UI
content, preserves native button/submit/reset semantics and restricts refusal to
explicitly requested essential unsupported capabilities. It contains no individual
form names, action-label rules, example responses or copied evaluation prompts.

This is a **fresh semantic-plan baseline**, not the historical recursive-draft
baseline that achieved 92% structural validity and 60% complete coverage. Those
historical results and their artifacts remain unchanged and are not substituted
into this comparison.

Both runs used these identical settings and verified matching metadata:

| Setting | Value |
| --- | --- |
| Model | `qwen3:4b-instruct` |
| Model digest | `0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0` |
| Ollama runtime | `0.40.5` |
| Node | `v22.14.0` |
| Context/output/response bounds | 8192 / 2048 tokens / 65536 bytes |
| Temperature/seed | 0 / 0 |
| Deadline | 60000 ms |
| Thinking/streaming/keep-alive | false / false / 2 minutes |
| Repetitions/order | Two, fixed existing case order; baseline completed before candidate |
| Dataset hash | `97e04137a3089d780d994d29c2700253b5bbcfc4434ae5cae5f0883e807b3d9b` |
| Semantic grammar hash | `fa003f11f804c96bb59d65ad5fa80e48f37d2553f15922dd43aaacb3b1f61f22` |
| Existing draft/authoritative compiler revision | `403d1d24115f027e26a28dd686b1458239d4776b3a3143a397c5a386573da49d` |
| Semantic compiler revision | `d873fcc9de9dd35dad08053a48bb9ca3b698ad7da9409f0ad8e234c14f41af41` |
| Scorer/reporting revision | `b4ff1abbf17e998bee372cd19eaf07b1b7652bbe86f01b6fe6f8f423c9b4031d` |

Prompt hashes are SHA-256 of the trusted messages serialized as JSON:

- Baseline, 7289 content characters: `be569383a31cd033cd438418f3e12b658b08340a483a82657259043e5468fc02`.
- Candidate, 8344 content characters: `8b86abe07b8a8efbb67f7532e9c85948fc67b4dcf5f9e96776363076f4b241ba`.
- The baseline plain instruction-text hash also remains the previously diagnosed
  `b6067c0fe51c58609742304d47ffcdfa5c1e384dd4644163e23c92ceabb688d8`.

Artifacts contain only developer-owned metrics, metadata and sanitized diagnostics:

- [Baseline JSONL](evaluation-results/semantic-ui-only-baseline-v1.jsonl)
- [Candidate JSONL](evaluation-results/semantic-ui-only-candidate-v1.jsonl)
- [Full comparison, including all per-case metrics](evaluation-results/semantic-ui-only-comparison-v1.json)

Each artifact has exactly one metadata event, 58 unique case/repetition results,
and one summary. The comparison rejects different datasets, grammars, workflows,
compiler revisions, runtime/model, settings or attempt sets. Both runs completed
with exit status 1 because quality cases failed; neither had an infrastructure
interruption, timeout, missing attempt, invalid JSON or invalid plan outcome.

## Separate quality and latency measurements

| Metric | Baseline | UI-only candidate |
| --- | --- | --- |
| False unsupported on supported requests | **50/50 (100%)** | **50/50 (100%)** |
| Correct unsupported on genuinely unsupported requests | 8/8 (100%) | 8/8 (100%) |
| Schema-valid false acceptance of unsupported requests | 0/8 | 0/8 |
| Other unsupported-case failures | 0 | 0 |
| Structural UI validity on supported requests | 0/50 (0%) | 0/50 (0%) |
| Complete semantic coverage | 0/50 (0%) | 0/50 (0%) |
| Positive requirement matches | 0/166 (0%) | 0/166 (0%) |
| Existing explicit relationship-check credit | 0/20 (0%) | 0/20 (0%) |
| Fully accurate relationship attempts | 0/10 | 0/10 |
| Assessed/unassessed relationship checks | 0 / 20 | 0 / 20 |
| Assessed/unassessed UI layout complexity | 0 / 50 | 0 / 50 |
| Mean layout count/depth/unary/repeated-direction edges | N/A | N/A |
| Forbidden-component violations observed | 0; no UI to assess | 0; no UI to assess |
| Overall median latency | 558 ms | 530 ms |
| Overall p95 latency | 822 ms | 722 ms |
| Successful UI median latency | N/A | N/A |
| Unsuccessful median latency | 558 ms | 530 ms |

All attempts emitted the existing diagnostic `unsupported_request`, with the
developer-owned message "The model reported an unsupported UI request." and an
empty issues array. Thus the model produced validated refusal outcomes; this is
not a compiler rejection being incorrectly counted as a refusal. The closed
refusal reason was not newly logged for this experiment; it should not be inferred
from the earlier profile-only diagnosis.

An unsupported plan can be structurally valid as a *model outcome* without being
a UI specification. The structural validity metric above asks whether a supported
request received a valid authoritative UI specification. It correctly reports zero
when a supported request receives a refusal. A 100% correct-refusal score by itself
does not show useful classification when the model refuses everything.

Layout complexity is unassessed, not zero: no rows/columns were produced. The
20 existing relationship checks receive no success credit because there was no
UI to inspect. This does not establish a specific ordering/layout defect; it
records failure to supply the required structure. No new relationship expectation
was invented for legacy cases and no expected output was changed.

## Per-case comparison

Every supported case has **0/2 valid UI outputs and 0/2 complete outputs in both
variants**. Every unsupported case has 2/2 correct refusals in both. There are
**no per-case quality improvements and no quality regressions**, including the
profile request, single controls, non-form compositions, negation and mixed layouts.

In this table B → C means baseline → candidate. Refusals are false for supported
rows and correct for unsupported rows. Positive matches include both repetitions;
relationship credit uses only the frozen explicit relationship checks. Latency is
nearest-rank as in the existing protocol; with two samples, median is the smaller
and p95 is the larger observation.

| Case | Expected | Positive matches B → C | Refusals B → C | Relationship credit B → C | Median ms B → C | p95 ms B → C |
| --- | --- | --- | --- | --- | --- | --- |
| registration | supported | 0/14 → 0/14 | 2/2 → 2/2 | N/A | 790 → 567 | 3990 → 2311 |
| login | supported | 0/8 → 0/8 | 2/2 → 2/2 | N/A | 820 → 528 | 834 → 541 |
| contact | supported | 0/10 → 0/10 | 2/2 → 2/2 | N/A | 558 → 524 | 643 → 538 |
| split-name | supported | 0/10 → 0/10 | 2/2 → 2/2 | N/A | 553 → 521 | 558 → 526 |
| password-reset | supported | 0/6 → 0/6 | 2/2 → 2/2 | N/A | 736 → 494 | 771 → 516 |
| simple-login | supported | 0/8 → 0/8 | 2/2 → 2/2 | N/A | 793 → 543 | 809 → 574 |
| horizontal-content | supported | 0/6 → 0/6 | 2/2 → 2/2 | N/A | 458 → 485 | 476 → 505 |
| layout-properties | supported | 0/6 → 0/6 | 2/2 → 2/2 | N/A | 480 → 473 | 524 → 524 |
| field-properties | supported | 0/8 → 0/8 | 2/2 → 2/2 | N/A | 785 → 530 | 811 → 556 |
| unsupported-widget | unsupported | N/A | 2/2 → 2/2 | N/A | 715 → 490 | 733 → 491 |
| unsupported-behavior | unsupported | N/A | 2/2 → 2/2 | N/A | 541 → 537 | 569 → 568 |
| c-text-input | supported | 0/2 → 0/2 | 2/2 → 2/2 | N/A | 491 → 556 | 498 → 562 |
| c-email-input | supported | 0/2 → 0/2 | 2/2 → 2/2 | N/A | 452 → 529 | 477 → 545 |
| c-password-input | supported | 0/2 → 0/2 | 2/2 → 2/2 | N/A | 499 → 486 | 503 → 506 |
| c-checkbox | supported | 0/2 → 0/2 | 2/2 → 2/2 | N/A | 448 → 477 | 451 → 497 |
| c-button | supported | 0/2 → 0/2 | 2/2 → 2/2 | N/A | 493 → 545 | 497 → 590 |
| c-text | supported | 0/2 → 0/2 | 2/2 → 2/2 | N/A | 447 → 474 | 455 → 538 |
| c-heading | supported | 0/2 → 0/2 | 2/2 → 2/2 | N/A | 461 → 483 | 464 → 527 |
| c-row | supported | 0/6 → 0/6 | 2/2 → 2/2 | 0/2 → 0/2 | 491 → 481 | 498 → 495 |
| c-column | supported | 0/6 → 0/6 | 2/2 → 2/2 | 0/2 → 0/2 | 491 → 473 | 497 → 506 |
| c-form-actions | supported | 0/8 → 0/8 | 2/2 → 2/2 | 0/4 → 0/4 | 775 → 525 | 804 → 546 |
| c-profile | supported | 0/12 → 0/12 | 2/2 → 2/2 | 0/6 → 0/6 | 800 → 538 | 822 → 540 |
| c-newsletter | supported | 0/8 → 0/8 | 2/2 → 2/2 | N/A | 732 → 548 | 735 → 564 |
| c-negation-login | supported | 0/8 → 0/8 | 2/2 → 2/2 | N/A | 751 → 530 | 758 → 555 |
| c-ui-only-login | supported | 0/8 → 0/8 | 2/2 → 2/2 | N/A | 784 → 545 | 820 → 557 |
| c-mixed | supported | 0/12 → 0/12 | 2/2 → 2/2 | 0/6 → 0/6 | 721 → 722 | 746 → 739 |
| c-repeated-fields | supported | 0/8 → 0/8 | 2/2 → 2/2 | N/A | 725 → 532 | 739 → 548 |
| c-unsupported-image | unsupported | N/A | 2/2 → 2/2 | N/A | 506 → 477 | 514 → 547 |
| c-unsupported-storage | unsupported | N/A | 2/2 → 2/2 | N/A | 530 → 529 | 590 → 555 |

The candidate's median is higher on eight cases: `horizontal-content`,
`c-text-input`, `c-email-input`, `c-checkbox`, `c-button`, `c-text`, `c-heading` and
`c-mixed`. Per-case p95 is higher on ten cases, additionally including cases whose
median improved; all changes are visible above. These are refusal-latency changes,
not faster UI generation. The overall median improved by 28 ms, about 5%, without
any quality gain. Run ordering, prompt-prefix caching and first-request effects
limit causal performance claims. First attempts (3990 ms baseline; 2311 ms
candidate) are retained rather than removed.

## Retention decision and interpretation

The **unchanged existing non-regression gates pass**: all measured quality scores
and core-case successful counts are equal, no forbidden count increases, and there
are no assessed layout means to compare. Consequently the existing comparison
artifact truthfully reports `retain: true`, with empty reasons/improvements/
regressions. That field represents the old non-regression gate, not an automatic
runtime promotion decision.

The approved experiment also requires **overall improvement before recommending
adoption**, as documented before inference. That condition fails: the clarification
does not reduce false refusals or improve structural/semantic/layout outcomes.
Therefore the recommendation is **do not adopt**. These gates were not changed
after seeing the results, and equal all-refusal results are not presented as
evidence that the generator works.

This experiment rules out this particular clarification as a sufficient fix under
these settings. It does not prove an internal model rationale or distinguish a
learned refusal preference from a structured-output grammar interaction. A future
controlled diagnosis of supported-versus-unsupported branch selection would be
more informative than promoting this prompt. That investigation would require
separate approval; this task does not remove refusals, force supported output,
weaken validation, retry/repair outputs, change models or add another pipeline.

## Implementation and automated verification

Changes are confined to manual evaluation, tests and documentation:

- `backend/evaluation/semanticPromptExperiments.ts`: isolated candidate policy,
  frozen baseline messages and semantic compiler source metadata.
- `backend/evaluation/fixtures/semantic-baseline-prompt-v1.json` and
  `semantic-manifest-v1.json`: pre-inference baseline/schema/compiler/prompt freeze.
- `backend/evaluation/runOllama.ts`: selects the matching workflow's experiment
  messages and freeze, retains the original draft experiments, records semantic
  metadata and separate classification/layout accuracy. Explicit empty case
  selection means the full dataset so local subset configuration can be cleared.
- `backend/evaluation/semanticExperimentMetrics.ts`: reporting-only classification
  and layout measurements; existing coverage/scoring functions remain unchanged.
- `backend/evaluation/compareExperiments.ts`: rejects mixed workflow/compiler
  comparisons, reports the extra metrics globally/per-case, and exports the existing
  artifact reader. Established retention conditions are unchanged.
- `backend/test/semanticPromptExperiments.test.ts`: nine tests for prompt/source
  freezes, no copied requests or case rules, isolated messages with identical
  schema/options, unchanged refusal/validation, separate metrics and comparison
  safeguards. All model responses are mocked.
- Protocol, this report, links in the setup guide, and the three result artifacts.

| Check | Result |
| --- | --- |
| `npm run build` | Passed, frontend and backend |
| `npm run lint` | Passed |
| `npm test` | **856 passed**: 298 frontend + 558 backend |
| Regression preservation | All previous 847 tests preserved; nine added |
| Focused new/historical evaluation checks | 51 passed |
| Live evaluation | 116 completed attempts; failures retained and reported |
| Existing runtime prompt, schema and frozen expectations | Unchanged |

Build output retains the existing nonfatal Vite bundle-size and dependency
annotation warnings. No inference runs during build, lint, tests or CI. Manual
inference was completed before these checks to avoid their CPU load affecting the
comparison. The exact commands for reproducing and comparing the experiment are
in the linked protocol; use fresh artifact names rather than overwriting these.
