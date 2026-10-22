# Evaluation and selected evidence

The current application is experimental. Structural validity, component/property correctness, layout, unsupported handling and TSX compilation are separate outcomes. Compilable code can still represent the wrong interface.

No inference was run for repository cleanup. The retained records below are historical first-attempt measurements at their recorded catalog, model digest, runtime and settings. Their input/result/raw-response bytes are unchanged; paths have moved. They must not be presented as fresh measurements of the current catalog.

## Retained cases and tools

- [Frozen 12-case flat-selection dataset](../../tools/evaluation/selection/cases-v1.json): exact prompts, component/property expectations, order, rows, form membership, negation and unsupported requests. Its original SHA-256 is enforced by tests.
- [Earlier 11 cases](../../tools/evaluation/coverage/fixtures/legacy-v1.json) and [18 challenges](../../tools/evaluation/coverage/fixtures/challenge-v1.json): retained as compatibility/scorer regressions. These represent an older ten-type scope; do not reinterpret expectations to match the expanded catalog.
- `tools/evaluation/selection`: existing manual runner, independent assessor, safe diagnostics and local HTTP helper. Production uses `apps/api/src/ai/ollamaProvider.ts`, never this manual helper.
- `tools/evaluation/coverage`: requirement/layout scorers, aggregate metrics, bounded runtime metadata and a CLI for scoring saved specifications. API/compiler tests also use the scorer fixtures.

CI runs mocked tests, without model downloads or inference. Rejected prompt-variant machinery has been removed; selectable draft/semantic-plan API workflows remain intact.

### Manual reproduction

These commands are documentation only; running them consumes local inference. Keep Ollama on loopback, use the approved installed model and an unused output directory. From the root:

```bash
API_PROVIDER=ollama POC_OUTPUT_DIRECTORY=/tmp/vpds-feasibility-new \
  npm run poc:feasibility --workspace @vpds/evaluation
```

The default performs the three fixed feasibility cases and keeps first attempts. The existing full 12 × 3 path requires explicit opt-in:

```bash
API_PROVIDER=ollama POC_BENCHMARK_ONLY=true \
  POC_OUTPUT_DIRECTORY=/tmp/vpds-benchmark-new \
  npm run poc:feasibility --workspace @vpds/evaluation
```

This uses today's retained catalog/messages, so compare it only with matching input/schema/settings fingerprints. It does not reproduce an older catalog merely by using the same dataset. The runner refuses an existing output directory. Preserve failures; do not retry or change expectations to improve results.

For offline coverage scoring of a saved specification or API envelope:

```bash
npm run build:shared
npm run eval:coverage --workspace @vpds/evaluation -- simple-login /absolute/path/to/specification.json
```

Use a case ID from the tool's usage output. This command does not call Ollama.

## Selected historical measurements

### Flat-selection v2: 12 cases × 3

[Inputs](flat-selection-v2/inputs.json), [results](flat-selection-v2/results.json), [summary](flat-selection-v2/summary.json), [source fingerprints](flat-selection-v2/source-integrity.json).

This was the seven-leaf contract. Overall complete success was **15/36**. For the 27 supported attempts, exact types matched **27/27**, properties **21/27**, form membership **21/27**, and generated specifications/TSX were valid **27/27**. Requested horizontal grouping matched **3/6**. Unsupported outcomes were correct **3/9**; six other unsupported attempts failed output validation. Median latency was **1,752.5 ms**, p95 **2,690 ms**, including errors.

### Expanded Nova families: six first attempts

[Inputs](nova-families/inputs.json), [metadata](nova-families/metadata.json), [complete results](nova-families/results.json). Original `*.response.raw` files are retained beside them to distinguish model selection/omissions from compiler behavior.

| Request family | Exact type | Required properties | Composition | Complete |
|---|---|---|---|---|
| payment-card | Pass | Pass | Fail | Fail |
| content-card | Fail | Fail | Pass | Fail |
| dialog | Pass | Fail | Pass | Fail |
| flag | Pass | Fail | Pass | Fail |
| footer | Pass | Pass | Pass | Pass |
| text-input | Pass | Pass | Pass | Pass |

All six passed structural validation, Nova server rendering and generated-TSX compilation; **only 2/6 met every semantic requirement**. Browser fixtures independently verify implemented dialog/flag behavior and do not turn omitted model properties into semantic successes.

### Broader component selection

[Inputs](component-selection/inputs.json), [metadata](component-selection/metadata.json), [results](component-selection/results.json), and original raw responses preserve a broader first-attempt acceptance pass, including natural descriptions without component names. Per-case prompts, expectations, checks and failures remain in results; this is not a repeated statistical benchmark.

Duplicate HTTP/check/outcome projections were removed where aggregate records already contain their results. Per-attempt generated `.spec.json`/`.tsx.txt` artifacts from the older benchmark were also removed: its retained records preserve metrics/assessments, not complete model outputs. Those older output snapshots remain in Git history; the newer family records retain full compiled output plus raw model responses. Superseded diagnosis/prompt-comparison passes and progress transcripts remain available in Git history rather than a repository archive.
