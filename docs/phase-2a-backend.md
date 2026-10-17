# Phase 2A: backend foundation

## Scope and inspection

The repository initially had a Vite/React frontend at the root, a single npm
package/lockfile, a browser-independent v1 UI specification/registry under
`src/specification`, a deterministic renderer/code generator, and 298 tests.
CI installed dependencies with `npm ci` and ran build, lint, and tests on Node 22.

The existing schema imports only Zod and its TypeScript registry. Neither file
imports React, Nova, DOM APIs, Vite raw imports, or rendering utilities. That
allows the backend to reuse the authoritative schema directly without relocating
the frontend, copying the schema, or inventing a second version of the contract.

Phase 2A adds an Express API with an explicitly non-AI deterministic mock. It
does not connect the frontend to the API, integrate an LLM, or change keyword
matching, existing previews, schema rules, the registration fixture, or rendering.

## Directory structure

```text
package.json                     # Existing frontend + one backend workspace
package-lock.json                # One installation/lockfile
src/                             # Existing frontend and shared schema unchanged
  specification/
    uiSpecification.ts           # Authoritative v1 validation
    componentRegistry.ts         # Zod property schemas and UI types
    fixtures/registration-form.json
backend/
  package.json                   # @vpds/backend, private CommonJS package
  .env.example                   # Local defaults; no secrets
  tsconfig.json                  # Strict Node types; source + tests checked
  tsconfig.build.json            # Emit backend + imported shared modules
  vitest.config.mts              # Node API/config tests
  src/
    app.ts                       # Injectable Express app; no listener on import
    httpServer.ts                # HTTP server factory with transport limits
    server.ts                    # Configuration, listen, graceful shutdown
    config.ts                    # Zod-validated environment configuration
    errors.ts                    # Stable error codes/statuses/messages
    provider.ts                  # Small provider interface + async deadline
    mockProvider.ts              # Exact supported examples; no AI
  test/
    api.test.ts                  # Real loopback HTTP integration tests
    config.test.ts               # Environment and server-limit tests
  dist/                          # Ignored compiled deployment output
    backend/src/*.js
    src/specification/*.js
    src/specification/fixtures/registration-form.json
```

The root stays the frontend package. A single `backend` workspace is installed
through the root lockfile. The backend emits CommonJS under its own CommonJS
package boundary; the frontend remains ESM. TypeScript preserves relative paths
to the imported shared schema in `backend/dist`, so compiled Node code needs no
browser bundler, path alias loader, source-tree access, or TypeScript runtime.
The copied registration JSON is a static build asset, not request storage.

This deliberately produces a slightly nested output tree. A separate shared
schema package could give prettier deployment paths later, but moving the current
schema would add churn and new package/build coupling without helping this phase.

## API contract

Default base URL: `http://127.0.0.1:3001`. Responses set `Cache-Control: no-store`
and a server-generated UUID in `X-Request-ID`. The JSON body repeats the ID for
correlation. Client-supplied IDs are ignored. Express branding and ETags are disabled.

### GET /api/health

```json
{
  "status": "ok",
  "provider": "deterministic-mock",
  "isMock": true,
  "requestId": "a-server-generated-uuid"
}
```

This is a local process-liveness check; it does not call a provider or claim
readiness for an external service. HEAD follows normal HTTP semantics without a
response body.

### POST /api/generate

Send uncompressed `application/json` (UTF-8 recommended):

```json
{ "prompt": "registration form" }
```

The request is a strict Zod object: only `prompt` is allowed. The prompt must be
a string with 1–2000 UTF-16 code units after trimming. No coercion occurs. Null,
arrays, extra properties, blank text, wrong property types, and malformed JSON
are rejected before invoking the provider. The JSON parser separately caps raw
body bytes, including unknown-length/chunked requests. Compression is disabled;
unsupported media types, charsets, and encodings receive JSON errors.

Success is HTTP 200:

```json
{
  "data": { "specification": { "version": "1.0", "root": {} } },
  "meta": { "provider": "deterministic-mock", "isMock": true },
  "requestId": "a-server-generated-uuid"
}
```

The empty `root` above abbreviates the returned document; actual results always
pass the existing complete `uiSpecificationSchema`. Every provider result is
untrusted `unknown` until that validation succeeds. The API returns a UI
specification, not TSX or HTML. It does not return or store the prompt.

### Exact supported non-AI mock prompts

| Prompt after normalization | Result |
| --- | --- |
| `registration form` | Existing handcrafted registration fixture |
| `create a registration form` | Same registration fixture |
| `contact form` | Static contact form: heading, name, email, single-line message, submit button |
| `create a contact form` | Same contact form |

Normalization trims, lowercases, and collapses whitespace. Matching is otherwise
exact: punctuation, extra instructions, and arbitrary form requests do not infer
new behavior. Unsupported input returns 422. There is no fallback to the frontend
keyword matcher, fuzzy matching, model, remote service, or arbitrary composition.
Fresh objects are returned so one request cannot mutate another request's fixture.

### Error envelope and stable codes

```json
{
  "error": {
    "code": "UNSUPPORTED_PROMPT",
    "message": "This non-AI mock supports only the documented example prompts."
  },
  "requestId": "a-server-generated-uuid"
}
```

| Code | HTTP status | Meaning |
| --- | --- | --- |
| `INVALID_REQUEST` | 400 | Invalid JSON or invalid prompt/request shape |
| `PAYLOAD_TOO_LARGE` | 413 | Configured raw body-byte limit exceeded |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Wrong content type, unsupported charset, or compressed body |
| `UNSUPPORTED_PROMPT` | 422 | Input outside the finite mock examples |
| `PROVIDER_FAILURE` | 502 | Provider threw/rejected |
| `INVALID_PROVIDER_OUTPUT` | 502 | Output failed the shared UI specification contract |
| `GENERATION_TIMEOUT` | 504 | Provider exceeded its asynchronous deadline |
| `CORS_ORIGIN_DENIED` | 403 | Origin is not in the explicit allowlist |
| `METHOD_NOT_ALLOWED` | 405 | Unsupported method on a known endpoint; includes `Allow` |
| `NOT_FOUND` | 404 | Unknown endpoint |
| `INTERNAL_ERROR` | 500 | Unexpected application error |

Messages come from a fixed server-owned catalogue. Raw request bodies, parser
errors, Zod issue payloads, provider exceptions, stacks, and output fragments are
not returned or logged. HTTP-parser-level failures before Express, including
incomplete/invalid HTTP headers or low-level transport timeouts, may use Node's
native response or close the connection rather than this application envelope.
Disconnected clients cannot receive an error body.

## Provider boundary, deadlines, and logging

`GenerationProvider` exposes `id`, `isMock`, and
`generate(prompt, { signal }): Promise<unknown>`. `createApp` accepts a provider
and logger for deterministic tests or a later adapter. Server startup currently
selects only the mock; there is no environment switch, key, or real LLM adapter.

The API bounds provider wait time with a Promise race, signals cancellation on
deadline or client disconnect, clears timers/listeners, and handles late provider
rejections without a second response or unhandled rejection. Node's HTTP server
separately limits receiving request bodies/headers and idle keep-alive connections.
The HTTP receive timeout does not replace the provider deadline after upload.
Abort is cooperative: a future provider must honor its signal to stop underlying
work. In-process timers cannot preempt a synchronously blocked event loop.

One structured log entry is emitted on response finish or premature close:
`requestId`, allowlisted HTTP method, fixed route identifier, status, duration in
milliseconds, and optional stable `errorCode`. Unknown paths log as `unmatched`;
the actual URL/query never enters logs. Aborted connections log status 499 as
metadata only. No prompt, body, header, origin, IP, raw error, or output is logged.
A logger failure cannot turn a completed API response into another error.

Prompts exist only transiently while processing a request. There is no storage,
prompt history, cache, analytics payload, file logging, database, or external
generation request. Standard-output log retention belongs to the runtime, but
these logs do not contain submitted content.

## Environment and local commands

Use Node 22.14+ on Node 22 and install from the root with `npm ci`.
Optionally copy `backend/.env.example` to `backend/.env`. Backend scripts use
Node's supported `--env-file-if-exists` option; shell environment values take
precedence. Without the file, defaults apply and Node may print a benign notice.
Environment files are ignored except `.env.example`; no keys or secrets are needed.

| Variable | Default | Bounds/behavior |
| --- | --- | --- |
| `API_HOST` | `127.0.0.1` | `127.0.0.1`, `localhost`, `::1`, or explicitly `0.0.0.0` |
| `API_PORT` | `3001` | Integer 1–65535 |
| `API_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | 1–10 exact HTTP(S) origins, comma-separated; no wildcard, credentials, paths, trailing slash, or opaque `null` |
| `API_BODY_LIMIT_BYTES` | `8192` | Integer 256–65536 |
| `API_GENERATION_TIMEOUT_MS` | `5000` | Integer 1–30000 |
| `API_REQUEST_TIMEOUT_MS` | `15000` | Integer 100–120000; must exceed generation timeout |

HTTP headers timeout is the smaller of 10000 ms and the receive timeout;
keep-alive timeout is 5000 ms. Invalid configuration fails startup with a generic
message rather than dumping environment values.

CORS permits only configured origins, GET/POST/OPTIONS, and `Content-Type` request
headers. It exposes `X-Request-ID`, disables credentials, and caches preflight for
600 seconds. Requests without Origin (CLI/server clients) are allowed. CORS is
browser policy, not authentication; the API is intentionally unauthenticated and
binds to loopback by default. If Vite chooses port 5174 or a deployed origin is
needed, explicitly update the origin list and restart the backend.

```bash
npm ci
cp backend/.env.example backend/.env  # optional

# Separate terminals
npm run dev                          # existing Vite frontend
npm run dev:backend                  # Node watch + tsx, no prebuild needed

curl http://127.0.0.1:3001/api/health
curl -X POST http://127.0.0.1:3001/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"registration form"}'

npm run build                        # existing frontend build, then backend tsc emit
npm run lint                         # all source/tests, Node globals for backend
npm test                             # frontend suite, then API suite
npm run test:api                      # backend source/test type-check + HTTP/config tests
npm run test:frontend                 # existing 298 frontend tests
npm run build:backend
npm run start:backend                 # compiled Node entry; no tsx required
```

Do not install from inside a second independent package/lockfile. The workspace
uses existing root TypeScript, ESLint, and Vitest tooling. Deploying only the
backend requires its complete compiled `dist` tree and resolved Express/CORS/Zod
runtime dependencies. No automated deployment packaging is added in this phase.
SIGINT/SIGTERM stop accepting connections and force-close remaining connections
after ten seconds.

## Dependencies and CI

Backend runtime dependencies are exact versions of public packages: Express
5.3.0, CORS 2.8.6, and the existing Zod 4.6.7. Development dependencies add tsx
4.23.15 plus Express/CORS/Node 22 type declarations. No API testing library was
needed: tests use Node HTTP and built-in fetch over ephemeral loopback sockets.
No existing direct dependency was upgraded. npm updated transitive `debug`
4.4.1 → 4.4.3 while resolving the added dependencies.

The existing Node 22 GitHub Actions matrix now independently runs `build`, `lint`,
`test:frontend`, and `test:api`, with `npm ci` and npm caching. `build` compiles
both applications. A failing backend test does not cancel the frontend check.
The common ignore rule excludes both build output directories from lint.

## Verification and changed files

Verified locally using Node 22.14.0 and npm 10.9.2 after a clean lockfile install:

| Check | Result |
| --- | --- |
| `npm ci` | Pass: 334 packages installed, workspace lockfile accepted |
| `npm run build` | Pass: frontend production assets and backend CommonJS output |
| `npm run lint` | Pass: no errors or warnings |
| `npm test` | Pass: 298 existing frontend tests + 56 backend tests (354 total) |
| `npm run test:api` | Pass as the API stage above: 40 real HTTP tests + 16 config tests; includes source/test type-checking |
| Compiled runtime smoke | Pass: health and registration generation through the emitted Node server |
| Development runtime smoke | Pass: health and registration generation through Node's tsx loader |
| `git diff --check` | Pass |

API tests cover supported prompts, deterministic fresh output, schema validation,
invalid/missing/oversized requests, exact byte boundaries, multibyte and chunked
uploads, unsupported media/encoding, mock misses, provider failure/invalid output,
cycles, timeouts, late rejection, client cancellation, CORS/preflight, 404/405,
request IDs, and content-free logs. Test servers and connections are closed after
each case. Real network tests required local loopback permission in the sandbox;
they are not skipped or replaced by mocked HTTP handlers.

The frontend retains its existing large-bundle warning and two nonfatal Zod
annotation warnings. Application bundle asset names and raw sizes are unchanged.
No existing schema, preview, frontend utility, or frontend test file changed.

| Changed file/group | Purpose |
| --- | --- |
| Root `package.json`, `package-lock.json` | One backend workspace, exact dependency graph, combined/focused commands |
| `.github/workflows/ci.yml` | Separate frontend/API test jobs, combined build |
| `eslint.config.js` | Backend Node globals and nested build-output ignore |
| `.gitignore` | Ignore environment files; keep example configuration |
| `backend/package.json`, TypeScript configs, Vitest config | Isolated runtime/build/test setup |
| `backend/src/config.ts`, `errors.ts` | Configuration bounds and stable safe error catalogue |
| `backend/src/provider.ts`, `mockProvider.ts` | Extensible interface, cancellation/deadline, non-AI examples |
| `backend/src/app.ts`, `httpServer.ts`, `server.ts` | Routes, limits, CORS, logging, server lifecycle |
| `backend/test/api.test.ts`, `config.test.ts` | API integration, privacy, provider, and configuration coverage |
| `backend/.env.example` | Safe local defaults |
| `README.md`, `docs/phase-2a-backend.md` | Setup, contract, architecture, verification, and limitations |

## Deliberate limitations

- This foundation accepts only four exact mock phrases for two static examples.
  It does not synthesize arbitrary UI or perform AI inference.
- The frontend remains disconnected from this API. No prompt submission UI,
  frontend error state, or replacement of keyword behavior is implemented.
- There is no authentication, rate limiting, deployment gateway, persistence,
  external provider, TLS termination, or distributed cancellation. These are
  outside the local foundation milestone, not claims of production readiness.
- Low-level HTTP parser/timeout responses are controlled by Node, not Express.
  A future provider must honor AbortSignal and bound its own response size before
  parsing remote data; validation cannot interrupt synchronous CPU-bound work.
- GitHub Actions has not been run remotely for these edits. Nothing was committed,
  pushed, opened as a PR, or merged. Work stops at Phase 2A.

Public API references: [Express 5](https://expressjs.com/en/5x/api/),
[CORS middleware](https://github.com/expressjs/cors#configuration-options),
[Node HTTP](https://nodejs.org/docs/latest-v22.x/api/http.html),
[Node environment files](https://nodejs.org/docs/latest-v22.x/api/cli.html#--env-file-if-existsconfig),
and [Zod](https://zod.dev/api).
