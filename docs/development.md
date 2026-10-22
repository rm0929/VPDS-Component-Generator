# Development

Use Node 22.14+ on Node 22, npm, and local Ollama with `qwen3:4b-instruct`. Keep services bound to loopback. From the repository root:

```bash
npm ci
npm run dev:backend:ai
# Separate terminal:
npm run dev -- --port 5173 --strictPort
```

Root commands are preserved. `dev`, `dev:backend`, build and test commands compile the shared workspace before consumers. For continuous shared-package edits, additionally run `npm run build --workspace @vpds/ui-specification -- --watch`; web source is served by Vite and API source by its existing Node/tsx watcher. Restart the API after shared-package changes if it has not restarted itself.

## Configuration

An environment file is optional:

```bash
cp apps/api/.env.example apps/api/.env
```

Do not overwrite an existing local file. Existing `backend/.env` was moved intact to `apps/api/.env` during workspace cleanup. Actual environment files are ignored and must never be staged.

`npm run dev:backend:ai` explicitly overrides provider/workflow to `API_PROVIDER=ollama` and `OLLAMA_WORKFLOW=flat-selection`. Plain `npm run dev:backend` preserves safe mock defaults and optional local-file settings. Draft and semantic-plan workflows remain available for compatibility; they are rejected by the primary frontend, which requires flat-selection metadata.

Default addresses:

- Frontend: `http://127.0.0.1:5173/`
- API: `http://127.0.0.1:3001`
- Ollama: `http://127.0.0.1:11434`

If Ollama is not already running: `OLLAMA_HOST=127.0.0.1:11434 ollama serve` in its own terminal. Do not start a duplicate service. `ollama list` checks installed models; downloading/changing a model is a separate decision.

The example file documents request/body limits, CORS, model, context/output bounds and timeouts. Ollama uses temperature 0, seed 0, `think:false`, context 8192 and output limit 2048 by default. Provider timeout is 60000 ms; mock/fallback API timeout is 5000 ms. Do not expose these development endpoints publicly.

Safe diagnostics require both `NODE_ENV=development` and `API_LOCAL_DIAGNOSTICS=true`. They record allowlisted stages/issues, not prompts, responses or field values.

## Verify configuration

```bash
curl --fail-with-body http://127.0.0.1:5173/api/health
# AI mode: provider=ollama-local-flat-selection, isMock=false
```

A manual request consumes local inference:

```bash
curl --fail-with-body --max-time 75 http://127.0.0.1:5173/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Create a text input labeled Full name."}'
```

Vite proxies relative `/api` requests to loopback API port 3001, including cancellation after upload. It never contacts Ollama directly. `npm run preview` and static hosting do not supply this development proxy.

## Shutdown and occupied ports

Press Ctrl+C in each owned frontend/backend terminal. This stops the watcher as well as its child. Leave Ollama and unrelated processes running unless you intend to stop them. Inspect ownership before stopping a process:

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
ps -o pid,ppid,command -p <PID>
```

An occupied API port reports `EADDRINUSE` with its validated address. Use the owning terminal to stop that watcher, or select alternate matched ports:

```bash
API_PORT=3002 API_CORS_ORIGINS=http://127.0.0.1:5178 npm run dev:backend:ai
# Separate terminal:
VPDS_API_PORT=3002 npm run dev -- --port 5178 --strictPort
```

## Checks and compiled startup

```bash
npm run build
npm run lint
npm test
npm run test:frontend  # web + shared tests
npm run test:api       # API + retained evaluation tests
npm run start:backend  # requires build; optional apps/api/.env is loaded
npm run preview       # static web build only
```

`apps/api/dist/server.js` is the compiled API entry point. Shared core is compiled CommonJS; Vite consumes shared browser source entry points. No browser renderer is imported by API runtime code.

Manual evaluation lives in `tools/evaluation`. The flat-selection runner retains explicit opt-in and writes new output directories; CI runs only automated tests. Rejected prompt experiments and their runner/comparison commands have been removed. Do not rewrite frozen datasets, manifests or past results when code moves. Source-path changes legitimately produce new compiler revision hashes.
