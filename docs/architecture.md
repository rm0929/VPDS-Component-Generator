# Architecture

```text
React description → POST /api/generate → Express → local Ollama
  → strict flat selection → deterministic draft compiler
  → UiSpecification v1.0 → suggestions + Nova preview + TSX
```

## Boundaries

- `apps/web`: application state, accessible workspace, typed API client, request ownership/cancellation, clipboard feedback, theme selection and secondary demos. The default generator uses the API; keyword matching exists only under `src/legacy`.
- `apps/api`: request validation, CORS/size limits, stable error envelopes, health, safe logging and configuration. `src/ai` owns production Ollama HTTP transport, catalog/messages, selection schema/composer, identity compiler and draft validators. `src/ai/compatibility` retains draft/semantic-plan workflows without making them the primary UI.
- `packages/ui-specification`: authoritative registry, Zod contract, JSON fixture, shared presentation tree, trusted Nova renderer, TSX serializer and dialog/flag helpers. Explicit exports keep validation independent from React. API runtime imports core validation/registry/fixture only; rendering is used by web and tests.
- `tools/evaluation`: manual flat-selection evaluation, frozen datasets and coverage/layout scorer tests. Application runtime does not import this workspace.

Shared API error definitions/types live in `contracts/apiErrors`; the server-owned `ApiError` class remains in the API. Consumers no longer import frontend/backend source folders across application boundaries.

## Contract and compilation

The model contract remains `selection-poc-2`: bounded ordered components, `form:{enabled,label}`, optional `besidePrevious` and explicit unsupported categories. There are 20 leaf families; the authoritative specification adds vertical/horizontal layouts and forms. Existing property schemas, catalog, examples, settings and messages are unchanged by the workspace move.

The composer supplies meaningful default vertical wrappers, adjacent rows and an explicitly declared optional form. The retained draft compiler creates stable structural IDs, normalized unique field names and validates the final versioned specification. It does not recognize prompt templates or repair wrongly selected component types. Unsupported outcomes reject the result rather than silently dropping requested features.

Preview and code use one shared presentation mapping. Dialog/flag TSX helper source intentionally mirrors trusted preview implementations; an equality test prevents drift. This is purposeful duplication, not model-executable code.

## API and safety

Successful responses remain `{data:{specification},meta:{provider,isMock},requestId}`; errors remain `{error:{code,message},requestId}` with stable status codes. The client validates responses again and rejects the wrong provider/workflow.

Ollama runs on loopback. A single-active-request guard, bounded response reader, provider timeout and actual HTTP AbortSignal cancellation remain intact. The Vite proxy propagates premature client disconnection without confusing it with normal completed upload. UI request versions ignore stale successes, failures and finalizers. New successes remount the preview.

No eval, dynamic code execution, arbitrary imports, handlers or styling objects enter the model contract. Strict validation rejects unsafe destinations. Preview navigation/submission is contained while copied destinations remain intact. Generated source is displayed as text; compilation tests parse/type-check it without executing it.

## Compatibility and packaging

Root npm commands delegate to four private workspaces. The shared package has explicit browser-source and compiled CommonJS entry points with declarations, preserving the API's module format. Web Vite uses browser conditions; Node uses compiled core. Build the shared workspace before starting or testing consumers.

Compatibility workflows, compiler/scorer tests and manual flat-selection tooling were retained. Rejected prompt-variant runners and their exclusive tests were removed. Defaults remain mock provider and draft workflow; the AI startup shortcut explicitly selects real Ollama/flat selection.
