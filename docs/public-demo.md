# Public AI demo: Render API + Vercel web + Groq

Three authorized local live checks passed strict-schema acceptance, requested semantics and TSX compilation, including one maximum-length prompt. Its measured input plus the full completion allowance fits the observed TPM. See [release-check evidence](evaluation/groq-release-checks/README.md). **Public generation remains disabled**: the account limits are confirmed (30 RPM, 1000 RPD, 8000 TPM, 200000 TPD), while hosted end-to-end behavior remains unverified. No deployment or billing changes were made. Health success is liveness, not release approval.

## How it works

Vercel's browser app calls Render's `/api/generate` over HTTPS. Express calls Groq once using its private key. Groq returns a strict selection wire object; the adapter validates it, removes only schema-declared optional null placeholders, and passes it into the unchanged selection validator/compiler and authoritative UiSpecification validator. The frontend validates that same specification, then derives suggestions, Nova preview and TSX. There is no keyword/mock fallback, model code execution, retry, or browser API key.

`API_PROVIDER=groq` explicitly selects `openai/gpt-oss-20b` with temperature 0, low reasoning effort, nonstreaming JSON Schema output and bounded completion tokens. Groq documents strict structured output for this model. This does not guarantee correct component selection. See [Groq structured outputs](https://console.groq.com/docs/structured-outputs).

The strict adapter derives from the existing selection schema. Every wire object has `additionalProperties:false` and all keys required; optional keys become nullable. A null disappears only when its original property was optional and did not accept null. Explicit false, zero, required null form labels and originally nullable values survive. Bounds and URL/composition checks remain enforced locally even where the wire grammar omits constraint keywords. Unsupported properties cannot be stripped into validity. Groq-specific instruction/example encoding leaves local Ollama messages/settings unchanged.

## Release gates and operator checks

1. Configure a key securely in a backend-only environment. Do not paste it into a command, browser, screenshot, Git, test fixture or documentation. Do not read/log it to demonstrate configuration. **A configured key is not authorization to make a live request.** Obtain explicit authorization first.
2. After authorization, use a **loopback-only** Groq backend (`API_PUBLIC_MODE=false`, `API_PROVIDER=groq`, host `127.0.0.1`, deadline 25000, HTTP request timeout 120000). Submit a small synthetic request once. Confirm that Groq accepts the **actual full serialized strict schema**, all adapted examples, selected model and inference settings, and that the returned selection compiles to valid UI/TSX. Mock acceptance is insufficient. Record commit/configuration and outcome without raw secrets or personal data. A provider 400/422 means this gate has failed; do not weaken validation or enable the public endpoint.
3. Record **actual prompt tokens, completion tokens, total tokens (including reasoning where reported), request count and account limits** from Groq's usage console for that isolated request. The application's response envelope deliberately does not expose usage or provider metadata to clients. If the console cannot attribute actual per-request usage, the gate remains blocked; an authorized backend-only diagnostic of the upstream usage fields would then be needed. Serialized bytes or a guessed characters/token ratio are not measurements. Repeat only with explicit authorization if representative maximum-size requests are needed to establish a safe budget.
4. Compare actual complete-request usage (schema + catalog + examples + user input + output/reasoning) against the account's TPM/TPD and request limits. Validate a conservative `GROQ_MAX_OUTPUT_TOKENS`, short-window request count and daily count with headroom. One request itself must fit the available TPM budget. A 20/day default is a request cap, **not a proven token budget**. Record results in release notes before enabling anything. Do not enable paid billing to pass the gate.
5. Only after both schema and measured-budget gates pass may an operator explicitly enable public generation. Verify hosted CORS, error states, cancellation and preview/TSX, without claiming perfect semantic accuracy. These hosted checks have not been run in this implementation.

The account owner confirmed the actual `openai/gpt-oss-20b` limits on 2026-10-22: **30 RPM, 1,000 RPD, 8,000 TPM and 200,000 TPD**. TPM/RPD were also observed in the live response headers. Limits apply across the organization and can change; recheck after account/model changes. [Official rate limits](https://console.groq.com/docs/rate-limits). The current full schema passed three live checks; the measured maximum-length input plus the 2048 completion allowance was 7544 tokens against the observed 8000 TPM. Twenty reservations of that measured input plus the maximum completion allowance total 150880 tokens/day, leaving 49120 below the confirmed daily allowance. This does not bound every possible 2000-character input or reserve quota against other organization clients. Schema/prompt changes require renewed compatibility and budget review.

## Exact Render setup (instructions only; do not deploy before approval)

Create a **Node Web Service / Free instance**, repository root `.` (not `apps/api`; workspace dependencies live above it).

- Build: `npm ci --include=dev && npm run build:backend`
- Start: `npm run start:backend`
- Health path: `/api/health`
- Node: `NODE_VERSION=22.14.0` (Node 22 supported by this repository).
- Do not upload `.env`. Configure the following in Render's backend environment settings:

```dotenv
NODE_ENV=production
API_PROVIDER=groq
API_PUBLIC_MODE=true
API_PUBLIC_GENERATION_ENABLED=false
API_HOST=0.0.0.0
API_CORS_ORIGINS=https://YOUR-FRONTEND.vercel.app
API_BODY_LIMIT_BYTES=8192
API_GENERATION_TIMEOUT_MS=25000
API_REQUEST_TIMEOUT_MS=120000
API_RATE_LIMIT_ENABLED=true
API_RATE_LIMIT_WINDOW_MS=61000
API_RATE_LIMIT_MAX=1
API_DAILY_LIMIT_MAX=20
GROQ_MODEL=openai/gpt-oss-20b
GROQ_MAX_OUTPUT_TOKENS=2048
GROQ_RESPONSE_LIMIT_BYTES=65536
```

Add `GROQ_API_KEY` as a private backend secret in Render, with its real value entered there only. Do not set `API_PORT`; Render supplies `PORT` (usually 10000). An explicit `API_PORT` takes precedence if supplied. Do not set `GROQ_TIMEOUT_MS`: there is only one inference deadline, owned by the API and propagated to the real HTTP request's AbortSignal. The 120-second HTTP request timeout limits incoming uploads; it is not a second inference timer. Local Ollama still uses its existing timeout behavior.

Public binding requires explicit public mode, real Groq, HTTPS CORS origins and enabled request limits. The gate returns `503 PUBLIC_GENERATION_DISABLED` without inference until explicitly enabled. Exact origins only; no wildcard, path, credentials or trailing slash. Multiple allowed origins can be comma-separated, at most ten. Don't allow arbitrary Vercel preview domains. No keys in CORS settings.

Render requires `0.0.0.0` and its supplied port: [web service documentation](https://render.com/docs/web-services). Free services sleep after 15 idle minutes and may take about a minute to wake. The shared free allowance is 750 instance hours/month and resources are limited. Review bandwidth/build-minute limits; with no payment method, exceeding the included allowances can suspend services/builds. Do not attach billing as part of this setup. [Free-service limits](https://render.com/docs/free).

## Exact Vercel setup

Keep the working frontend project. For a repository-root build, use:

- Root directory: `.`
- Install: `npm ci --include=dev`
- Build: `npm run build:frontend`
- Output directory: `apps/web/dist`
- Node: 22.x
- Public build variable: `VITE_API_BASE_URL=https://YOUR-API.onrender.com`

Use the exact API origin without `/api` or a trailing slash. Rebuild the frontend after a build-variable change. There is no Vercel server-side proxy or rewrite required: the browser calls the configured HTTPS API directly, using no cookies. No Groq key belongs in Vercel or any `VITE_*` value. Local development leaves this variable empty, preserving the Vite loopback proxy.

## Limits, failures and privacy

The API accepts JSON bodies up to 8192 bytes and trimmed descriptions of 1–2000 characters. Public defaults admit one request per 61-second rolling global window and twenty per rolling 24-hour process window; these values are configurable and admitted failures consume budget. There is one active Groq generation, no queue and no automatic retries. Quota responses use `429 RATE_LIMITED` with bounded `Retry-After`; concurrency uses `503 GENERATION_BUSY`. Schema/configuration/auth errors use safe `503 PROVIDER_CONFIGURATION_ERROR`, service/network failures `503 PROVIDER_UNAVAILABLE`, deadline expiry `504 GENERATION_TIMEOUT`, and malformed/invalid output `502 INVALID_PROVIDER_OUTPUT`. No upstream error body is shown. Cancel/disconnect aborts upstream HTTP and frees its guard. Unsupported selections retain the existing 422 contract.

The browser's hosted transport ceiling is 90 seconds, allowing a free-server cold start; it is distinct from the 25-second inference deadline that starts after admission. Plain-text hosting/proxy failures produce connection messages. A timeout message says a server *may* be waking, because the client cannot know the cause. No background warming or automatic retry consumes quota.

Rolling admission timestamps avoid short/daily fixed-window boundary bursts. Use max 1 and a window of at least 61000 ms for the measured 8000 TPM budget; increasing limits requires another budget review. Budgets are **in-memory and per process**: restarts reset them and multiple replicas multiply them. CORS is a browser restriction, not authentication; non-browser clients can still reach a public endpoint. This is a low-volume demo, not durable abuse protection or a guaranteed free spending limit. Keep one free instance and billing disabled; shut generation off if abused. Durable distributed rate limiting/auth is outside this milestone.

Hosted descriptions and requested labels/content go to Groq, unlike local Ollama. Do not enter secrets, personal information or payment-card values. The app does not persist prompts, log model responses/Authorization, or send entered preview values. API logs contain request IDs, allowlisted route/method, status, timing and stable error codes. Hosting/provider infrastructure has its own logging and retention policies; do not promise zero retention. Review [Groq data handling](https://console.groq.com/docs/your-data) and account controls. Local diagnostic metadata remains development-only and allowlisted.

## Local commands remain unchanged

```bash
npm ci
npm run dev:backend:ai
# Separate terminal (VITE_API_BASE_URL unset/empty):
npm run dev -- --port 5173 --strictPort
```

Stop each owned terminal process with Ctrl-C, including the backend watcher. Leave Ollama and unrelated processes alone. For a built backend use `npm run build:backend` then `npm run start:backend`; defaults still use mock unless explicitly configured. The main frontend rejects mocks and compatibility workflows. Never expose the local Ollama service publicly.
