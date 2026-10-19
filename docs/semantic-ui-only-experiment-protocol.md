# Semantic UI-only interpretation experiment — frozen protocol

This protocol is recorded before running the new live comparison. It extends the
existing manual evaluation harness, without changing any of the 29 expectations
in `phase2b-eval-v2`. The original draft experiments and their artifacts remain
available. This comparison concerns two **semantic-plan** workflows, not a
comparison against the historical draft results.

The runtime `buildSemanticModelInstructions()` is unchanged. Its exact system
message is snapshotted in `semantic-baseline-prompt-v1.json`; a separate
`semantic-manifest-v1.json` freezes the semantic grammar, compiler and both prompt
hashes. The old frozen manifest/datasets are unchanged. The live runner checks
these hashes before inference.

The candidate `ui-only-interpretation-v1` prepends one general policy to the
baseline system message. It explains that the product generates UI and TSX,
button labels do not automatically request persistence/authentication/navigation/
destructive effects, native button/submit/reset properties are supported, and
unsupported outcomes require explicitly requested essential unsupported features.
The model still returns only SemanticUiPlan JSON. No prompt-specific examples,
plans, label classifiers or responses are added. The variant is imported only by
manual evaluation; there is no runtime selection flag for this prompt.

Fixed comparison settings:

- Qwen3 `qwen3:4b-instruct`; record and compare exact Ollama version/model digest.
- `OLLAMA_WORKFLOW=semantic-plan` for both, using the same grammar and compilers.
- All 29 frozen cases, in their existing order; two repetitions per case.
- Temperature 0, seed 0, `think: false`, non-streaming, 2-minute keep-alive.
- 8192 context, 2048 maximum output tokens, 65536 response bytes, 60000 ms timeout.
- Run baseline to completion, then candidate; retain the cold first attempt and
  failures in the latency distribution. Do not alter settings or expectations
  after inspecting results. Two repetitions do not establish statistical certainty.
- One inference call per attempt; no retries, repair or fallback.
- Log developer-owned metrics and sanitized diagnostics only, never prompts,
  raw model responses, generated labels/values or arbitrary provider errors.
- Live runs remain manual, outside application startup/build/tests/CI.

Existing scoring is reused unchanged: structural validity and positive coverage
are independent; complete semantic coverage additionally requires forbidden and
direct relationship/order checks to pass. Layout budgets are quality preferences,
not runtime constraints, and no layout is flattened.

Additional reporting distinguishes false unsupported classifications on supported
requests from correct refusals on unsupported requests. It also counts schema-valid
UI returned for an unsupported request (false acceptance) separately from other
unsupported-case failures such as timeouts or invalid output. An empty or failed
response is not a correct refusal.

Layout accuracy uses only the dataset's existing explicit relationship checks.
Invalid outputs are unassessed checks, included in the denominator as unsuccessful,
rather than being assigned perfect layout accuracy. Cases with no relationship
expectations receive no invented checks. Existing layout count/depth/single-child/
repeated-direction metrics remain separate and report assessed/unassessed output.

Retention uses the existing gates, without alteration:

- Aggregate structural validity, full semantic coverage, positive requirement
  coverage and correct unsupported outcomes must not decrease.
- Forbidden-component violation counts must not increase.
- Successful counts on registration/contact/simple-login/profile/negated-login/
  UI-only-login core cases must not decrease.
- Mean layout count, depth and single-child wrappers must not worsen.
- Latency is reported separately, with median/p95 and successful/failed splits.

Passing these gates is necessary. Adoption will only be recommended if overall
measured quality improves; success on one profile request is insufficient.
Per-case regressions, false refusals and unsupported false acceptance will be
reported even if aggregate metrics improve. The active prompt will remain unchanged
until the comparison and recommendation have been reviewed.

Commands from the repository root with Node 22.14+ and local Ollama running:

```bash
API_PROVIDER=ollama OLLAMA_WORKFLOW=semantic-plan OLLAMA_MODEL=qwen3:4b-instruct \
  OLLAMA_BASE_URL=http://127.0.0.1:11434 OLLAMA_TIMEOUT_MS=60000 \
  OLLAMA_CONTEXT_SIZE=8192 OLLAMA_MAX_OUTPUT_TOKENS=2048 OLLAMA_RESPONSE_LIMIT_BYTES=65536 \
  EVALUATION_REPEATS=2 EVALUATION_CASE_IDS= EVALUATION_VARIANT=baseline \
  EVALUATION_OUTPUT="$PWD/docs/evaluation-results/semantic-ui-only-baseline-v1.jsonl" \
  npm run eval:ollama --workspace @vpds/backend

API_PROVIDER=ollama OLLAMA_WORKFLOW=semantic-plan OLLAMA_MODEL=qwen3:4b-instruct \
  OLLAMA_BASE_URL=http://127.0.0.1:11434 OLLAMA_TIMEOUT_MS=60000 \
  OLLAMA_CONTEXT_SIZE=8192 OLLAMA_MAX_OUTPUT_TOKENS=2048 OLLAMA_RESPONSE_LIMIT_BYTES=65536 \
  EVALUATION_REPEATS=2 EVALUATION_CASE_IDS= EVALUATION_VARIANT=ui-only-interpretation-v1 \
  EVALUATION_OUTPUT="$PWD/docs/evaluation-results/semantic-ui-only-candidate-v1.jsonl" \
  npm run eval:ollama --workspace @vpds/backend

npm run eval:compare --workspace @vpds/backend -- \
  ../docs/evaluation-results/semantic-ui-only-baseline-v1.jsonl \
  ../docs/evaluation-results/semantic-ui-only-candidate-v1.jsonl
```

Output paths must be fresh: the runner refuses to overwrite historical artifacts.
Exit status 1 means a completed run contained failed cases, while status 2 means
an execution/configuration/artifact failure. Continue to the candidate after a
complete baseline with failed quality cases; do not mistake it for an interrupted
run. Clear case selection explicitly as above so a prior local subset setting
cannot reduce the evaluation.
