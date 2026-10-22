# Groq release checks — 2026-10-22

Three authorized live requests, one first attempt each and **no retries**, used the production strict-schema adapter and composer through a temporary loopback Express `/api/generate`. `API_PUBLIC_MODE=false` and `API_PUBLIC_GENERATION_ENABLED=false` throughout. The private key was loaded by Node from the ignored/untracked API environment file; no credentials are retained here. No deployment or billing changes occurred.

[Exact prompts, settings, sanitized results, token usage and source fingerprints](summary.json). The capacity prompt is exactly 2,000 trimmed ASCII characters. It requests the same single input but includes deterministic synthetic hexadecimal context that must not be displayed, exercising a higher token density than ordinary prose. It is not a worst-case tokenizer proof for every possible Unicode input. Historical benchmarks are unchanged.

| Check | Actual UI | Input tokens | Output tokens | Total | Schema / semantics / TSX |
|---|---|---:|---:|---:|---|
| Full name input | One `textInput`, label Full name, no form | 4,441 | 83 | 4,524 | All passed |
| Login form | Email input Work email, masked password Access key, Enter submit button, all in a form | 4,447 | 151 | 4,598 | All passed |
| Maximum-length input (2,000 characters) | One `textInput`, label Full name, no form; reference context not displayed | 5,496 | 91 | 5,587 | All passed |

All upstream/API responses were HTTP 200. Generated TSX was type-checked against the installed React/Nova APIs without executing it. Reasoning counts were 13, 22 and 17 respectively; these are **already included** in completion totals, not extra tokens to add. Total measured usage across the three calls was 14,709 tokens. Latency was 1,307 / 1,366 / 993 ms respectively (local API request duration, excluding TSX checks).

## Capacity and admission decision

The upstream headers reported **8,000 TPM** and **1,000 RPD**. For the maximum-length case:

```text
5,496 actual input + 2,048 maximum completion allowance = 7,544 tokens
8,000 TPM - 7,544 = 456 tokens of measured reservation headroom (5.7%)
20 such maximum-completion reservations = 150,880 tokens/day
```

No completion-limit reduction was needed for this measured input. Completion cap remains 2,048 and input cap remains 2,000 characters, preserving existing simple requests. These are measured-reservation calculations, not proof that all permitted input strings tokenize the same way. Arbitrary text may produce higher input counts and encounter a safe provider quota/configuration error. No local tokenizer or universal token guarantee was added.

The old fixed-window admission implementation could allow two requests on opposite sides of a window boundary, exceeding TPM even though it nominally allowed one per minute. It was replaced with bounded rolling timestamps for the short window and rolling 24-hour budget. The recommended/default window is now **61,000 ms with max 1**, adding a second of margin; the daily cap remains 20. This avoids boundary bursts in one uninterrupted process. Clock-controlled regression tests cover late first arrivals, window boundaries, daily boundaries, and configurable multi-request windows. No extra live call was made to test admission; all three live checks ran in private mode with rate limiting disabled.

Limits are per-process memory only: restarts reset them, replicas multiply them, and other clients can use the same organization's quota. They are neither durable quota protection nor a financial guarantee. Keep one instance and billing disabled. Raising the request/output caps or changing catalog/schema/prompt requires renewed budget review.

## Readiness

Live strict-schema compatibility and measured maximum-length capacity **passed for these three cases**. This is not a broad accuracy benchmark. The account owner subsequently confirmed the actual limits on 2026-10-22: **30 RPM, 1,000 RPD, 8,000 TPM and 200,000 TPD**. TPM/RPD were also observed in response headers; RPM/TPD confirmation came from the account owner, not another API request. Twenty measured maximum-completion reservations total 150,880 tokens/day, leaving 49,120 tokens of daily headroom. Usage by other organization clients remains outside this application's control. See [official limits and header meanings](https://console.groq.com/docs/rate-limits).

Public generation remains disabled. The confirmed limits cover the measured reservation and chosen 20/day cap. Next: authorize a controlled Render/Vercel deployment and hosted smoke check after reviewing the implementation. Hosted routing/CORS/cancellation/cold-start behavior has not been verified. No further inference is authorized by this report.

Backend build, lint, 725 backend tests (19 files; mocks/fake HTTP only), and `git diff --check` passed after the admission correction. The three saved live outputs each passed generated-TSX compilation. No frontend behavior, model prompt, schema or completion/input cap changed in this correction.
