# Experimental AI: live checks and rejected prompt revision

These records document manual local Qwen3 checks during end-to-end integration.
They are separate from the frozen twelve-case benchmark in `../benchmark-v2/`;
that dataset, its expectations, and all historical results remain unchanged.
No inference runs in CI. These small checks are not broad model-accuracy evidence.

## Initial six-request application check

[Inputs](browser-six/inputs.json) contain all six exact prompts and the explicit
startup settings, with their provenance. [Results](browser-six/results.json)
preserve the original saved browser record without alteration. Requests went
through the actual React Experimental AI view, Vite proxy, Express backend, and
local Ollama. There was one attempt per prompt, with no retries or mock fallback.

| Case | Actual result | Assessment |
| --- | --- | --- |
| Standalone Full name text input, no form | Correct input and label, no extra leaves or form | Pass |
| Disabled Password input, no form | Correct password input and label; `disabled` omitted, so the input remained enabled | Fail: disabled state |
| Login with Email, Password, Remember me, and Login submit | HTTP 200; detailed capture was lost during a browser-check submission assertion | **Unverified**, not a measured model failure |
| Preview and Cancel buttons side by side, no form | Correct ordinary buttons and order; vertical stacking | Fail: horizontal grouping |
| Heading with exact text Build once. Share everywhere. | One heading, exact text, no form | Pass |
| Unsupported Name/Email data table | `UNSUPPORTED_UI_REQUEST`, no partial preview or code | Pass |

There were **3 passes, 2 semantic failures, and 1 unverified case**. The four
retained successful specifications matched the actual preview and displayed TSX;
their generated TSX compiled without diagnostics. The original HTTP/model
envelopes were not retained for this browser check. The inputs file identifies
exactly which response data is available; no missing response has been invented
or replaced with a later run. Initial runtime version/digest were not separately
retained. Recorded computed link styles came from actual generated UI, not an
additional inference request.

## Baseline versus two-rule revision

[Baseline](prompt-comparison/baseline.json) and
[revised](prompt-comparison/revised.json) records contain the exact prompts,
complete model messages and JSON Schema, settings, measured model digest/runtime,
selected components, compiled specifications, generated TSX, and check outcomes.
The twelve complete Ollama HTTP response bodies are preserved byte for byte in
[responses](prompt-comparison/responses/), named by version and case number.

The unchanged baseline ran first, then exactly two rules were inserted before
the component catalog: preserve explicit `props.disabled:true`, and express
explicit rows through top-level `besidePrevious:true` on their later members.
The exact revised wording is retained in the revised record's system message.
There were six attempts per version, twelve model calls total, and no retries.
Each full response was saved before provider parsing and semantic checks.
All twelve captures and checks completed; none is unverified in this comparison.

Both versions used `qwen3:4b-instruct`, Ollama **0.40.5**, temperature **0**, seed
**0**, context **8192**, output limit **2048**, thinking/streaming off, keep-alive
**2m**, timeout **60000 ms**, and response limit **65536 bytes**. The identical
model digest is recorded in both metadata objects. The system-message and schema
fingerprints establish that only the two approved rules changed: schema and
few-shot examples were unchanged.

| Case | Baseline | Revision |
| --- | --- | --- |
| Standalone text input | Pass; no form | Pass; no form |
| Disabled password input | Fail: enabled password input | Fail/regression: disabled **button** labeled Password |
| Login form | Pass: all four controls, correct submit type and form membership | Pass: same |
| Side-by-side buttons | Fail: correct buttons, vertical; `besidePrevious` omitted | Fail: same |
| Exact heading text | Pass | Pass |
| Unsupported table | Correct unsupported outcome | Correct unsupported outcome |
| Complete semantic success | **4/6** | **4/6** |

Both versions produced valid selections, five valid specifications and one
explicit unsupported outcome. All ten generated TSX components compiled without
diagnostics. Structural validity did not imply semantic completeness. The new
baseline login attempt is verified; it does not repair the earlier lost record.

The revision was rejected because neither target case passed and component
selection regressed. **The original runtime prompt was restored**, with message
fingerprint `c50372ff66d3568ad1da08a7040fbe933fda546f3a6e44d92d9993a89f65700f`.
The evaluated revision's fingerprint is
`afd91c492db7101b551397217758a5073e09e713f85c2980f6e5008931282c94`.

Only synthetic UI descriptions and generated examples are included. Actual
environment files, credentials, browser profiles, screenshots, scripts, repeated
per-request payloads, intermediate summaries, and caches are excluded. Complete
request bodies can be reconstructed from each comparison record's settings,
schema, shared messages, and exact user prompts.
