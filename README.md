# VPDS UI Generator

A single‑page React application inspired by Visa’s Product Design System (VPDS) that lets developers describe UI patterns in plain English and instantly:

- **Preview** a live Nova‑React component  
- **Copy** ready‑to‑use React/TypeScript code  
- **Switch** between light & dark themes  

[Live Website Link](https://vpds-component-generator-s1a9.vercel.app/)  

---

## 🚀 Features

- **Natural‑language input**  
  Describe what you want (“login form with remember me”), and the tool picks the right Visa Nova components.

- **Component suggestions**  
  Maps keywords ↔︎ patterns:
  

- **Live preview**  
  Instantly render the Nova‑React component so you can verify the output.

- **Get Code**  
  Click **Get Code** to reveal the exact `.tsx` needed—copy to clipboard with one click.

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
parameter or use the demo's back link to return to the unchanged keyword generator.

The [Phase 2A backend foundation](docs/phase-2a-backend.md) is a small Express
workspace alongside the existing frontend. It uses a deterministic **non-AI mock**,
not an LLM. The frontend does not call the API yet.

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
