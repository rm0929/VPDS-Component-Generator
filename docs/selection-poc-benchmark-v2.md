# Frozen SelectionPoC v2 benchmark

## Protocol fixed before inference

This is the explicitly approved full benchmark after structural feasibility. The
earlier semantic feasibility gate is waived for this run. Exactly twelve frozen
cases run in dataset order, for three consecutive rounds: **36 attempts**, with
no retries, omitted cases, inference warm-up calls or prompt adjustments.

Only the manual runner gains `POC_BENCHMARK_ONLY=true`. The SelectionPoC v2
contract, prompt, composer, draft compiler, authoritative schema, frontend and
production workflows remain unchanged. The original gated mode is still available.

Frozen input SHA-256 values:

| Input | Hash |
| --- | --- |
| Twelve-case dataset | `cd20106e24e0d55fdb6c457551d14a5ce3e301f3256f7d834bc092afe8c8dd7b` |
| Model-facing schema | `385bab39b1c0e9fe1f9b3f1da0f1011cb76a34f43edfc1f33e04ad30854d23ad` |
| Trusted messages | `c50372ff66d3568ad1da08a7040fbe933fda546f3a6e44d92d9993a89f65700f` |

The approved local model is `qwen3:4b-instruct`. Inference settings remain
temperature 0, seed 0, context 8192, maximum output 2048 tokens, response limit
65536 bytes, timeout 60000 ms, thinking off and streaming off. Runtime version
and model digest are recorded and checked again after the run. Source fingerprints
are saved separately to verify that generation and evaluation inputs did not change.

The frozen dataset has nine supported cases and three expected unsupported
outcomes (including the PoC's one-form limit). All axes are reported separately:

- Exact leaf-type multiset, missing/extra components, forbidden components and
  each explicitly expected property. Frozen label normalization and native false
  defaults are preserved; supplied values themselves are not written to diagnostic logs.
- Expected component order and exact horizontal row membership.
- Form intent, validated native action ancestry and expected accessible naming.
- Selection validity, authoritative UiSpecification validity and generated TSX
  compilation against installed Nova APIs. Unsupported outcomes do not require a
  fabricated specification or TSX and are reported as not applicable on those axes.
- Explicit unsupported categories, false unsupported outcomes on supported cases,
  unexpected successful UI for unsupported cases and invalid/transport failures.
- Complete success: every frozen component/property/order/layout/form/name and
  compilation requirement for supported cases, or the exact explicit unsupported
  categories for unsupported cases. Structural validity alone does not qualify.

The report shows every case's three attempts. Missing semantic measurements after
an earlier validation/transport failure are unavailable, not silently marked correct.
Latency uses all 36 completed attempts, including refusals and failures. Median
is the middle value (average of the middle two for an even sample); p95 uses the
nearest-rank value at `ceil(0.95 * N)`. End-to-end duration includes validation and
TSX type-checking where reached; request/selection time is also reported where
available. No browser interaction or responsive-breakpoint testing is performed.

Reproduce manually from the repository root with Node 22.14+ and existing
loopback Ollama:

```bash
API_PROVIDER=ollama OLLAMA_MODEL=qwen3:4b-instruct \
  OLLAMA_BASE_URL=http://127.0.0.1:11434 OLLAMA_TIMEOUT_MS=60000 \
  OLLAMA_CONTEXT_SIZE=8192 OLLAMA_MAX_OUTPUT_TOKENS=2048 \
  OLLAMA_RESPONSE_LIMIT_BYTES=65536 POC_BENCHMARK_ONLY=true \
  POC_OUTPUT_DIRECTORY=../docs/selection-poc-results/benchmark-v2 \
  npm run poc:feasibility --workspace @vpds/backend
```

The output directory must be fresh. This is manual evaluation, outside CI.

## Observed results

All **36/36** attempts completed: twelve distinct cases, three rounds, zero
retries and zero additional feasibility calls. Every case was evaluated in every
round. Runtime was Ollama **0.40.5**, model digest
`0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`.
The runtime and digest matched the previous feasibility run and were unchanged
after this benchmark.

Evidence:

- [Attempt records and frozen settings](selection-poc-results/benchmark-v2/results.json).
- [Per-attempt, per-case and aggregate measurements](selection-poc-results/benchmark-v2/summary.json).
- [Trusted schema/messages snapshot](selection-poc-results/benchmark-v2/inputs.json).
- [Before/after source integrity](selection-poc-results/benchmark-v2/source-integrity.json).

Each successful compilation also has a separately retained validated `.spec.json`
and generated `.tsx.txt` artifact in that directory. Diagnostic records contain
only safe stages, issue paths/codes, component types, indexes and comparison
booleans, not raw responses or submitted text. Invalid outputs were not salvaged.

### Aggregate axes and denominators

| Metric | Result |
| --- | --- |
| Selection contract validity, all outcomes | **30/36 (83.3%)** |
| Supported-request selection validity | **27/27 (100%)** |
| Exact leaf-type selection, supported attempts | **27/27 (100%)** |
| Expected leaf instances matched | **63/63**, zero missing, zero extra |
| Forbidden leaf instances | **0** |
| All explicitly expected properties correct, supported attempts | **21/27 (77.8%)** |
| Individual expected property assertions correct | **120/126 (95.2%)** |
| Component order correct | **27/27 (100%)** |
| Exact row relationships, all supported attempts | **24/27 (88.9%)** |
| Exact row relationships when a row was requested | **3/6 (50%)** |
| No unwanted row when none requested | **21/21 (100%)** |
| Expected form membership/structure | **21/27 (77.8%)** |
| Explicitly expected accessible form names | **9/9 (100%)** |
| Correct native submit/reset ancestry | **12/12 action instances** |
| Supported UiSpecification validity | **27/27 (100%)** |
| Supported generated TSX type-checking | **27/27 (100%)** |
| False explicit unsupported outcomes on supported requests | **0/27** |
| Correct explicit unsupported outcome | **3/9 (33.3%)** |
| Invalid selection instead of an unsupported outcome | **6/9** |
| Unexpected valid UI on an unsupported request | **0/9** |
| Complete supported-request success | **12/27 (44.4%)** |
| Complete success, including unsupported cases | **15/36 (41.7%)** |

Leaf metrics exclude technical form/layout wrappers: six unwanted forms are
reported as form-membership errors, not hidden by the zero-extra-leaves score.
Form naming is checked only where a specific name is expected; the raw runner's
`nameCorrect: true` for unnamed/no-form expectations is not counted as a naming
achievement. Native action ancestry is structurally valid even when some other
semantic requirement fails. Correct unsupported outcomes have no specification
or TSX to compile, so these axes are not applicable to those outcomes.

### Complete success per case

`Pass` requires every applicable frozen expectation. All three repetitions had
the same categorical result for each case; latency varied.

| Frozen case | Round 1 | Round 2 | Round 3 | Complete successes | Failure or outcome | Median / p95 duration |
| --- | --- | --- | --- | --- | --- | --- |
| `text-entry` | Fail | Fail | Fail | 0/3 | Added an unwanted form around the standalone field | 1.706 / 4.834 s |
| `email` | Pass | Pass | Pass | 3/3 | Required field and placeholder preserved | 1.574 / 1.587 s |
| `password` | Fail | Fail | Fail | 0/3 | Omitted explicitly requested `disabled: true` | 1.753 / 1.774 s |
| `checkbox` | Fail | Fail | Fail | 0/3 | Added an unwanted form around the standalone checkbox | 1.371 / 1.379 s |
| `content-action` | Fail | Fail | Fail | 0/3 | Heading `content` changed; remaining expected properties correct | 2.327 / 2.330 s |
| `form-row` | Fail | Fail | Fail | 0/3 | Missing horizontal grouping of the two name/team fields | 2.609 / 2.644 s |
| `mixed` | Pass | Pass | Pass | 3/3 | Paragraph/button row and field below preserved | 2.210 / 2.217 s |
| `negation` | Pass | Pass | Pass | 3/3 | Form and positive controls preserved; prohibited controls absent | 2.608 / 2.690 s |
| `repeated-actions` | Pass | Pass | Pass | 3/3 | Repeated fields and native reset/submit types preserved | 2.575 / 2.618 s |
| `unsupported-control` | Pass | Pass | Pass | 3/3 | Valid explicit `component` unsupported outcome | 0.826 / 0.893 s |
| `unsupported-behavior` | Fail | Fail | Fail | 0/3 | Duplicate unsupported categories rejected by validation | 1.184 / 1.189 s |
| `poc-composition-limit` | Fail | Fail | Fail | 0/3 | Empty supported selection instead of an explicit `composition` outcome | 0.799 / 0.816 s |

With only three values, each per-case nearest-rank p95 is its maximum. These
figures are descriptive, not a reliable population tail estimate.

### Separate supported-case measurements

All supported cases selected exactly the expected leaf types and order and
produced valid UiSpecifications and compilable TSX in all three rounds. The
remaining measurements show why that is not equivalent to complete success:

| Case | All expected properties | Horizontal grouping | Form membership | Missing / extra leaves, total |
| --- | --- | --- | --- | --- |
| `text-entry` | 3/3 | 3/3: no row | **0/3** | 0 / 0 |
| `email` | 3/3 | 3/3: no row | 3/3 | 0 / 0 |
| `password` | **0/3** | 3/3: no row | 3/3 | 0 / 0 |
| `checkbox` | 3/3 | 3/3: no row | **0/3** | 0 / 0 |
| `content-action` | **0/3** | 3/3: no row | 3/3 | 0 / 0 |
| `form-row` | 3/3 | **0/3: requested row absent** | 3/3 | 0 / 0 |
| `mixed` | 3/3 | 3/3: requested row correct | 3/3 | 0 / 0 |
| `negation` | 3/3 | 3/3: no row | 3/3 | 0 / 0 |
| `repeated-actions` | 3/3 | 3/3: no row | 3/3 | 0 / 0 |

The password failure is a missing property, confirmed from validated artifacts,
not a TypeScript or schema failure. The heading-content mismatch is not explained
solely by capitalization or outer whitespace; the frozen literal-content
expectation remains unchanged. Optional/false property expectations in the other
cases passed under the original rules, including native false defaults.

### Actual failure stages

The six invalid outcomes all failed at **`selection_schema`**:

| Case | Repetitions | Safe issue path | Code | Developer-owned message |
| --- | --- | --- | --- | --- |
| `unsupported-behavior` | 3/3 | `unsupported` | `custom` | `Unsupported categories must be unique.` |
| `poc-composition-limit` | 3/3 | `components` | `custom` | `A supported selection must contain components.` |

The latter validation rule establishes that the response contained neither
components nor an explicit unsupported category. It is not credited as a correct
unsupported response. The former is not silently deduplicated. No HTTP errors,
timeouts, malformed JSON failures, composition validation failures or TSX
compilation errors occurred. The semantic failures in otherwise valid outputs
have **no Zod issue path**; they are expectation failures rather than structural
validation errors.

### Are horizontal-layout errors recurring?

Yes, but not universal. `form-row` missed its row **3/3** times, while `mixed`
created its requested row **3/3** times. Thus requested-row accuracy is **50%**,
not the more flattering 88.9% obtained by including no-row cases. The earlier
profile feasibility request also omitted a row, providing evidence across two
distinct requests; that earlier attempt is not added to this benchmark's scores.
The composer and grouping tests still pass. A compiler cannot recover an omitted
relationship without guessing, so it correctly preserves the selected stacking.

### Latency, including failures

| Population | N | Median | p95 | Maximum |
| --- | --- | --- | --- | --- |
| All attempts, including semantic and validation failures | 36 | **1.7525 s** | **2.690 s** | 4.834 s |
| Complete successes | 15 | 2.210 s | 2.690 s | 2.690 s |
| Failed attempts | 21 | 1.706 s | 2.644 s | 4.834 s |

Total measured attempt duration was **67.776 s**. These durations include model
request time, validation/composition and TSX type-checking when reached. The
first attempt was retained; there was no discarded warm-up. For the 30 responses
that passed selection validation, request-plus-selection latency was median
**2.0195 s**, p95 **2.502 s**. That narrower metric excludes six invalid selections
because the existing runner only stores `inferenceMs` after successful selection
validation; it must not be presented as the all-attempt latency. All-attempt
`durationMs` includes every error and is the primary latency measurement above.

## Recommendation

**Compare a different locally runnable model using the same frozen contract and
dataset before making another architecture change.** Keep Qwen3 as the measured
baseline; no model has been switched or downloaded in this task.

Qwen3's component-type selection and order are strong in this sample, and the
flat contract reliably compiles valid supported outputs. However, complete
supported success is only 44.4%. Failures span more than row representation:
unwanted form wrappers, a lost disabled property, changed literal content and
invalid unsupported outcomes are all reproducible. Fixing only the observed
horizontal omissions could add at most three successes here, moving overall
success from 15/36 to **18/36 (50%)** while leaving the other failures untouched.
That is insufficient evidence to expand the compiler or replace `besidePrevious`
yet. A controlled model comparison can test whether these interpretation problems
are model-dependent while keeping the now-useful composition boundary stable.

This is a small, fixed benchmark. Three repetitions with temperature/seed fixed
are reproducibility checks, not three independent samples of model ability.
Identical categorical failures suggest systematic behavior under these settings,
but do not prove the model will behave identically on arbitrary future prompts.
No comparison with older 29-case aggregate scores is claimed: their dataset,
contracts and scoring differ. No real browser interaction, functional business
logic or arbitrary-layout support is established by successful TSX compilation.

## Changes and verification

The only implementation change is in
`backend/evaluation/selection-poc/runFeasibility.ts`: an explicit benchmark-only
opt-in, honest mode/gate metadata and actual feasibility-call count. Existing
gated behavior and frozen scoring remain intact. This report and the new
`benchmark-v2` result directory contain the evaluation evidence. Before/after
hashes confirm the frozen PoC contract/composer, model messages/schema, evaluator,
dataset, draft compiler, authoritative registry/schema, production providers,
semantic-plan contract/composer and TSX generator did not change.

Because the runner changed, verification was repeated using Node **22.14.0**:

| Check | Result |
| --- | --- |
| `npm run build` | Pass: frontend and backend |
| `npm run lint` | Pass |
| `npm test` | **964 passed**: 298 frontend + 666 backend |
| `git diff --check` | Pass |

Existing dependency annotation and frontend chunk-size warnings remain. No new
dependencies, frontend changes, production workflow changes, inference in CI,
model changes/downloads, retries, commits, pushes or merges were introduced.
Work remains on `feature/ai-component-generation`; Phase 2C was not started.
