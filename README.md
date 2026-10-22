# VPDS UI Generator

A single‑page React application inspired by Visa’s Product Design System (VPDS) that lets developers describe UI patterns in plain English and instantly:

- **Preview** a live Nova‑React component  
- **Copy** ready‑to‑use React/TypeScript code  
- **Switch** between light & dark themes  

[Live Website Link](https://vpds-component-generator-s1a9.vercel.app/)  

For the local AI experience, start `npm run dev:backend:ai` and `npm run dev`
in separate terminals, with local Ollama and `qwen3:4b-instruct` available.
Open `http://127.0.0.1:5173/`. The static hosted site does not provide a local
Ollama backend; see the [complete startup instructions](docs/experimental-ai-frontend.md).

---

## 🚀 Features

- **Natural‑language input**  
  Describe what you want (“login form with remember me”), and the tool picks the right Visa Nova components.

- **Component suggestions**  
  Uses local Ollama's validated flat selections to suggest supported Nova components.
  Keyword examples are a separate, explicitly labeled legacy demo.
  

- **Live preview**  
  Instantly render the Nova‑React component so you can verify the output.

- **Get Code**  
  Review the generated TSX beside the preview and copy it with **Copy Code**.

- **Theme toggle**  
  Use the switch in the navbar to toggle between **light** and **dark** themes.

- **Responsive & accessible**  
  Built with Nova `Utility`, `Typography`, and a focus on WCAG‑compliant patterns.

---

## 📝 Instructions

1. **Describe your UI need** in the input box:

   > “login form with remember me”

   > "credit card details form”
   
   > “would like to set date and time”
   
   > “responsive user profile form”
   
   > "show table with rows and columns”
   
   > "show linear progress”
   
   > "address form with city, state and zip”
   
   > "open notifications panel”

2. **Click Generate**  
   - A **live preview** appears below.
   - The **Get Code** button shows the React/TypeScript snippet.

3. **Toggle theme**  
   - Flip the switch in the top‑right navbar to switch between light and dark.

---

## 🔍 Sample Inputs and Outputs

| Input Phrase                | Expected Output      |
| --------------------------- | -------------------- |
| `login form`                | LoginFormPreview     |
| `login form with remember me` | LoginForm + Checkbox |
| `card number entry`         | CardFormPreview      |
| `sign up`                   | SignupFormPreview    |
| `address`                   | AddressFormPreview   |
| `user profile`              | UserProfilePreview   |
| `set date and time`         | DateTimePreview      |
| `table with rows`           | TablePreview         |
| `show notifications`        | NotificationTray     |
| `open modal`                | ModalPreview         |
| `progress linear`           | DeterminateProgress  |

---

## 🎨 Design & UX Highlights

- **Simple, clear, intuitive UI**  
  A single‑scroll page: About → Hero → How It Works → Try It Now.

- **Visa color theme**  
  Uses VPDS light/dark palettes, `Typography`, `Utility`, `Surface`, etc.

- **Theme Customization**  
  Dynamically load Nova‑styles themes via the navbar toggle.

- **Advanced Developer Experience**  
  - **Agentic mock**: IDE‑style previews you can embed.  
  - **Live preview**: Always‑on rendering of composed UI.  
  - **Onboarding tour**: (future) guided walkthrough for first‑time users.  
  - **Keyboard navigation**: Tab‑friendly inputs & focus‑trap in modals.  
  - **Accessibility**: WCAG‑compliant labels, ARIA roles, focus management.

- **Sticky Features**  
  - **Copy to Clipboard**: One‑click copy of generated code.  
  - **Insert into Project**: (future) download `.tsx` snippets.  
  - **Favorites**: (future) star patterns & persist in `localStorage`.

---

## 🛠️ Development

Use Node.js 22.14+ (Node 22) and npm. CI runs build, lint, and tests
independently on pushes and pull requests.

```bash
# Install dependencies
npm ci

# Start dev server
npm run dev

# Build frontend and backend
npm run build

# Lint TypeScript and React
npm run lint

# Run frontend and API tests
npm test

# Watch tests during development
npm run test:frontend -- --watch

# Preview production build
npm run preview
```

Vitest shares the Vite configuration and runs tests in Node. Coverage includes
the existing keyword/snippet utilities, specification validation, actual Nova
server-rendered markup, preview/code consistency, and TypeScript compilation of
generated TSX. Full browser interactions and visual regression are not covered.

The additive [UI specification and component registry](docs/phase-1a-ui-specification.md)
define the validated JSON contract. A handcrafted
[registration fixture](src/specification/fixtures/registration-form.json) exercises
that contract through the [deterministic preview and TSX generator](docs/phase-1b-rendering.md).

With `npm run dev`, open `http://localhost:5173/?demo=specification#generator`
(use the port printed by Vite) to view the registration preview and copy its
generated TSX. The demo does not create accounts or send form data. Its generated
code is displayed as text and is never executed by the app. Remove the query
parameter or use the demo's back link to return to the AI generator.

The [Phase 2A backend foundation](docs/phase-2a-backend.md) is a small Express
workspace alongside the existing frontend. It defaults to a deterministic
**non-AI mock**. [Phase 2B adds optional local Ollama generation](docs/phase-2b-local-ollama.md)
with `qwen3:4b-instruct`; no paid service or API key is used. The default
[Experimental AI view](docs/experimental-ai-frontend.md) now calls the existing
flat-selection API and shows its validated Nova preview, component suggestions,
and copyable TSX. Start its real backend with `npm run dev:backend:ai`, then
`npm run dev` and open the default URL. Keyword matching is available only through
the explicitly labeled **Legacy keyword demo** (`?generator=keyword#generator`);
the AI flow has no keyword or mock fallback.

```bash
# Optional local backend configuration (no API keys needed)
cp backend/.env.example backend/.env

# In separate terminals
npm run dev          # Vite frontend, normally http://localhost:5173
npm run dev:backend  # API, normally http://127.0.0.1:3001

# Check API health
curl http://127.0.0.1:3001/api/health

# Request one of the documented mock examples
curl -X POST http://127.0.0.1:3001/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"registration form"}'

# Focused checks, or build then run the compiled backend
npm run test:frontend
npm run test:api
npm run build:backend
npm run start:backend
```

Run `npm ci` once at the repository root to install both packages from the shared
lockfile. Use Node 22.14+ on Node 22, as in CI. Backend `.env` files are ignored.
See the backend report for exact supported prompts, response/error contracts,
environment limits, CORS configuration, and verification results.

To opt into local inference, set `API_PROVIDER=ollama` in `backend/.env`, install
the model with `ollama pull qwen3:4b-instruct`, and run Ollama on
`127.0.0.1:11434`. Follow the [local-only setup guide](docs/phase-2b-local-ollama.md)
to disable Ollama cloud features, configure memory/output limits, and diagnose
failures. Both services must remain on loopback; public bind addresses are rejected.
The baseline draft workflow returns an internal UI
draft without technical IDs or field names; a deterministic compiler produces the
existing UI specification. See the [draft architecture and verification report](docs/ui-draft-architecture.md)
for the unsupported-request outcome and separate validity/coverage evaluation.

The [SemanticUiPlan v1 schema and composer](docs/semantic-ui-plan-v1.md) now have an
[opt-in Ollama workflow](docs/semantic-ui-plan-ollama.md). With `API_PROVIDER=ollama`,
select `OLLAMA_WORKFLOW=semantic-plan` to use it; `OLLAMA_WORKFLOW=draft` remains
the default baseline with its original prompt. Each workflow uses one inference
call and returns the same validated UI specification. Restart the backend after
changing selection. These baseline workflows remain available separately from
the Experimental AI view, which explicitly requires flat selection.

The benchmarked [flat-selection workflow](docs/flat-selection-backend.md) is also
available through the same backend API. Select `API_PROVIDER=ollama` and
`OLLAMA_WORKFLOW=flat-selection` and restart the backend. It uses the
SelectionPoC v2 flat structure and deterministic composer through the production transport;
health/success metadata identifies it as `ollama-local-flat-selection`.
The sample environment now validates and defaults to the non-AI mock. The
Ollama workflow still defaults to `draft`. To use the frontend, follow the
[exact local startup and proxy instructions](docs/experimental-ai-frontend.md)
and select **Experimental AI** in the generator navigation.

Experimental AI supports twenty selection types: text/email/password inputs,
checkbox, button, text, heading, textarea, switch, text badge, divider, link,
native select, radio group, content card, payment-card fields, linear progress,
dialog, flag, and footer.
It retains one optional form and adjacent horizontal groups. All families remain
experimental: selection, disabled state, and requested horizontal grouping can
be inaccurate even when the specification and generated TSX are valid.
See the [practical milestone report and example prompts](docs/selection-poc-results/practical-milestone-v1/README.md)
for property limits, the one-pass real-Qwen3 results, and known failures.
Payment-card fields implement UI only, without payment processing or card validation.
The [Nova families milestone](docs/selection-poc-results/nova-families-v1/README.md)
documents dialog interactions, flag dismissal, safe footer links, card refinements,
and the six first-attempt model results. Only footer and text input met all
requirements in that pass; other families remain experimental.
The [portfolio selection milestone](docs/selection-poc-results/portfolio-selection-v1/README.md)
records the subsequent focused catalog/example change and 22 first-attempt checks.
Sixteen met all frozen expectations; link/login composition and some flags remain
unreliable. All families remain experimental; try a simpler description or name
the component directly, then review the actual result.
Historical [first-increment results](docs/selection-poc-results/component-increment-v1/README.md)
and [earlier prompt comparisons](docs/selection-poc-results/experimental-ai-v1/README.md)
remain unchanged. No output-order experiment or further tuning followed this milestone.

Manual local-model quality checks extend the existing harness with a frozen,
versioned challenge dataset and isolated prompt experiments. See the
[evaluation protocol](docs/evaluation-baseline-v2.md) and
[experiment report and commands](docs/phase-2b-prompt-evaluation.md).
Automated tests verify the evaluator without downloading models or running inference.
The subsequent [concise replacement experiment](docs/phase-2b-concise-prompt-experiment.md)
records all 29 per-case comparisons and explains why the runtime prompt was retained.

## 📦 Deployment

This project is hosted on Vercel:
[Website Link](https://vpds-component-generator-s1a9.vercel.app/)

---

## ℹ️ Credits

- Built with [@visa/nova-react](https://github.com/visa-design-system/nova)  
- Icons from [@visa/nova-icons-react](https://github.com/visa-design-system/nova-icons)  
- Animations via [LottieFiles React Player](https://github.com/LottieFiles/dotlottie-react)  


## 🤖 AI Assistance

Throughout development I leaned on AI tools sparingly—mostly as a coding sidekick. I used it to:

- **Spot syntax errors** and suggest small bug‑fixes  
- **Brainstorm UI/UX ideas**, layouts and workflows  
- **Generate concise examples** and boilerplate snippets  

Everything core to the component logic, theming, and accessibility was hand‑crafted—AI only stepped in when it could save a few keystrokes or spark a fresh idea.  
