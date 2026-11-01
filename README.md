# Gather ✳

**Big moments. Little details.** A responsive, accessible GenAI event planner for Google Hack2Skill PromptWars. Plan weddings, birthdays, and community events with a realistic INR budget, editable checklist and dates, vendor notes, and personal ideas.

## Try it in 60 seconds

Requirements: Node 22+ and npm.

```sh
npm ci
npm --prefix functions ci
npm run dev
```

Open the local URL printed by Vite. No keys needed for the **clearly labeled local sample mode**. Create an event, edit allocations and spending, complete or edit tasks, shortlist vendors, and export a JSON plan. Local demo data persists in this browser. It is template-based, not an AI response. Cloud mode requires configuration below; it never silently substitutes sample data when Gemini fails.

## Architecture

React 19 + Vite + TypeScript → Firebase Authentication (Google) → callable Firebase Function (Node 22, us-central1) → Gemini → validated structured plan. Firestore stores events at `users/{uid}/events/{eventId}`; Security Rules isolate owners. Firebase Hosting serves the built SPA. Zod validates briefs, restored records, saved documents, and model output. The Gemini key exists only in Secret Manager and the server runtime, never in a browser environment variable.

The Function requires Firebase Auth and App Check. It reserves a Firestore transaction-based daily quota (10 calls/user/day; 15-second minimum interval, including failures), enforces input limits, has a 75-second upstream deadline and a 90-second function deadline, limits instances, and avoids logging event details or secrets. These are per-user limits, not a global spending cap: configure Google Cloud budget alerts and API quotas before public promotion. AI text is rendered as escaped React text. No booking, payment, or vendor-search claims are made.

## Connect Firebase and deploy

1. Create/select a Firebase project and enable the **Blaze** billing plan for Functions and Secret Manager. Install Firebase CLI (`npm install -g firebase-tools`), then:

   ```sh
   firebase login
   firebase projects:list
   firebase use --add
   ```

   Select your intended project and use alias `default`. This writes `.firebaserc`; no project is preselected in this repository.

2. In Firebase Console, register a Web App. Enable **Authentication → Google**; add your local/deployed hostname to Authorized domains. Create Firestore in Native/production mode (choose your region deliberately).
3. Copy `.env.example` to `.env.local` and fill the public Firebase web config. These identifiers are public, not authorization credentials. Never add `GEMINI_API_KEY` to any `VITE_*` value. Never commit real environment files.
4. Register the web app in **App Check** using reCAPTCHA v3. Add the site key to `VITE_RECAPTCHA_SITE_KEY`, authorize your Hosting domain in reCAPTCHA, and enable App Check enforcement for Firestore after validating tokens. The callable function always enforces App Check. For local cloud testing use Firebase's documented App Check debug provider with a registered debug token; never enable debug bypass on a public build.
5. Obtain a Gemini API key in Google AI Studio, restrict it to the Generative Language API, and store it interactively:

   ```sh
   firebase functions:secrets:set GEMINI_API_KEY
   ```

   Paste the key only at the CLI prompt. Optional model override: copy `functions/.env.example` to `functions/.env.<PROJECT_ID>` and set `GEMINI_MODEL` to a structured-output capable model available to your account. Default: `gemini-2.5-flash`. Model availability is account-dependent.

6. Run and deploy:

   ```sh
   npm run check
   firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
   ```

   The CLI prints the real Hosting URL. Visit it, sign in, create a Gemini plan, **Save plan**, refresh, reopen it, edit and save again. Verify a second user cannot see it. Deployment cannot be completed without an authenticated account, selected project, configuration, billing, and API secret; no live deployment is claimed by this source project.

**Important:** client configuration is baked in at build time. Build again after any `.env.local` change. Popup-blocked or unauthorized-domain errors are fixed in browser/Auth domain settings, not by weakening rules.

## Workflow

- **New event** opens a keyboard-accessible modal with event type, name, date, location, guests, budget and preferences.
- Signed-out mode creates local sample plans. Signed-in mode calls server-side Gemini; failures retain your current plan and offer a retry.
- **Budget** edits allocations and actual spending, showing over-budget warnings.
- **Timeline** edits titles/dates, adds/removes tasks, marks completion.
- **Vendors** stores research notes and status; all entries are categories to research, not fabricated suppliers.
- **Ideas** reflects the generated plan and original preferences.
- **Save plan** persists to the signed-in user's account. Cloud edits are explicitly saved, not autosaved. The saved-event selector opens other saved plans; switching with unsaved edits prompts first. Sign-out clears cloud state. Export before leaving unsaved work.
- **Export plan** downloads JSON; **Delete event** permanently removes a saved record after confirmation. Browser-local sample data is separate from cloud accounts.

## Tests and verification

```sh
npm test                       # schema, budget/date bounds, UI editing, local persistence, creation
npm run build                  # strict TypeScript + production frontend build
npm --prefix functions run build # strict server build
npm run check                  # all the above
```

Security Rule tests require **Java 21+**, Firebase CLI, and downloaded emulators:

```sh
npm run test:rules
```

These tests use no production data. They verify owner access, cross-user and unauthenticated denial, malformed writes and quota isolation.

For full-stack local development, copy web config with a demo project ID, set `VITE_USE_EMULATORS=true`, build Functions, then `firebase emulators:start --project demo-gather`. The Gemini key for emulator tests belongs in ignored `functions/.secret.local` (`GEMINI_API_KEY=...`); use an App Check debug token per Firebase docs. Live generation, auth redirects, production App Check, network failures, and cloud persistence require connected service verification; unit tests do not prove these integrations.

## Accessibility and design

Semantic landmarks, skip link, labeled controls, native dialog focus trapping/Escape behavior, visible focus rings, reduced-motion support, responsive layouts, readable errors and live status messages. All decorative artwork is compact CSS and SVG icons: no large media assets, remote fonts, or stock-photo dependencies. Test with keyboard and a screen reader before a broad launch. Dates display in the viewer's locale; generation quotas use UTC days. Currency is intentionally INR.

## Security and data

Do not enter sensitive guest details in prompts. Only brief fields are sent to Gemini. Event records stay under the signed-in owner's Firestore path. App Check mitigates unauthorized clients; it is not a spending cap. Rules validate owner and top-level schema/bounded list sizes; nested item validation happens in the application and Function. Owners can modify their own data directly, so restored data is always parsed again. Rules do not treat the client-written `source` field as trusted proof of AI provenance. Quotas are server-only. No service account key is shipped. Firebase authorized domains, API quotas, billing alerts, App Check domain setup, and deployed rules are required operational controls.

## Submission under 10 MB

Commit source and lockfiles only. `.gitignore` excludes dependencies, compiled output, environment files, logs, and local emulator state. This source is comfortably under 10 MB; validate before submission:

```sh
git ls-files -z | xargs -0 du -ch | tail -1
```

Create a **public** GitHub repository, push the project root, and verify it while signed out. Do not commit `node_modules`, `dist`, `functions/lib`, credentials, or this output ZIP. Record a 2-minute demo: create a personalized event, show budget edits and task completion, shortlist a vendor, save and refresh. Submit the public repository and an accessible unlisted YouTube/Drive video link.

## Official references

- [Firebase callable functions](https://firebase.google.com/docs/functions/callable)
- [Function secrets](https://firebase.google.com/docs/functions/config-env#secret-manager)
- [App Check enforcement](https://firebase.google.com/docs/app-check/cloud-functions)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)

Built for a thoughtful, demo-ready hackathon entry. Verify current PromptWars terms and deadlines on the organizer platform before submitting.
