# Gather ✳

**Big moments. Little details.** A responsive GenAI planner for weddings, birthdays, and community events, built for Google Hack2Skill PromptWars.

**Live app:** https://gather-promptwars-2026-8f31.web.app

For the product overview and gallery, see the [README](../README.md).

## Bring your own Gemini key — no Firebase billing required

1. Open the app and select **Add Gemini key**.
2. Paste your own key from [Google AI Studio](https://aistudio.google.com/api-keys). The default model is `gemini-2.5-flash`; choose a different structured-output capable `gemini-*` model if needed for your account.
3. Select **Use my key**, then **New event**. Supply the event details and select **Create my plan with Gemini**.
4. Edit the budget, timeline, tasks and vendor checklist. Export your plan as JSON, or use optional Firebase account saving after configuring sign-in.
5. Open **AI connected → Remove key** to forget the key. Reloading or closing the page also forgets it.

Without a key, **Create a sample plan** generates a clearly labeled local template, not a claimed AI response. Gemini failures preserve the existing plan and do not silently substitute a sample.

### Key privacy and usage

The visitor's key stays in memory for this page. It is never placed in localStorage, sessionStorage, Firebase records, exported plans, a URL query string, source files, or logs. It is sent directly to `generativelanguage.googleapis.com` in the `x-goog-api-key` header alongside the event brief. Firebase Hosting serves static files and never receives the visitor's Gemini request. There is no app-owned Gemini key in the bundle and no proxy service.

A browser-entered key is visible to the person using that browser and can be inspected by local scripts or developer tools. This intentionally implements user-provided keys; it is not a secure way to hide a shared operator key. Use a trusted device and your own key. Google API quotas and any charges belong to that key's project. Restrict the key to the Generative Language API and use compatible web referrer restrictions where supported. Avoid entering sensitive personal details in briefs. No sign-in or Blaze upgrade is needed for this direct generation path, although Google may require billing for a particular key/model or quota level.

## Run locally

Requirements: Node 22+ and npm.

```sh
npm ci
npm --prefix functions ci
npm run dev
```

Open the Vite URL. The app works immediately with local sample plans or a visitor-supplied Gemini key. No `.env` file is needed for either path. Local event data stays in this browser; keys do not persist. Cloud changes require explicit saving.

## Architecture

- React 19, Vite, TypeScript, Lucide SVG icons, responsive CSS artwork.
- `src/gemini.ts`: direct HTTPS Gemini requests, memory-only caller key, structured JSON output, 90-second timeout, bounded input validation, model-name validation, readable quota/auth/model/network errors, and validation of the returned budget, IDs and dates.
- `shared/schema.ts`: Zod contracts shared across the app and optional Function.
- Firebase Hosting serves the SPA. The deployed project is `gather-promptwars-2026-8f31`.
- Optional Firebase Authentication (Google) and Firestore persistence at `users/{uid}/events/{eventId}`. Security Rules isolate owners. The database and rules are deployed in `us-central1`.
- `functions/` retains the earlier optional server-key implementation as an alternative for an operator-managed deployment. The current UI does **not** call it. It requires Blaze, Secret Manager, Auth and App Check; none is required for the default visitor-key flow. Never send visitor keys to this function.

## Optional cloud saving

The live version currently keeps events locally. To enable sign-in and cloud saving:

1. In [Firebase Console](https://console.firebase.google.com/project/gather-promptwars-2026-8f31/authentication), initialize Authentication and enable **Google** with a support email.
2. Add the deployed Hosting domain and localhost to Authentication's authorized domains.
3. Copy `.env.example` to `.env.local`. The example already contains this project's **public** Firebase web identifiers. No Gemini key belongs in any environment file or `VITE_*` variable.
4. Optionally register reCAPTCHA v3 in Firebase App Check, fill `VITE_RECAPTCHA_SITE_KEY`, validate its tokens, then enable Firestore enforcement.
5. Rebuild and deploy. Sign in, create or edit a plan, **Save plan**, refresh and reopen it. Check a second account cannot read it. Local and account data are separate; export unsaved work before switching accounts.

App Check alone does not configure Authentication. Google sign-in and Firestore saving remain unverified until that setup is complete. Gemini does not depend on this setup.

## Deploy to the dedicated Firebase project

The project is selected in `.firebaserc`. No billing upgrade or server secret is needed for Hosting + Firestore.

```sh
firebase login
npm run check
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

After changing Firebase environment settings, rebuild: Vite bakes public identifiers into the frontend at build time. Firebase CLI authentication on this computer works; its separate gcloud login may need refreshing for gcloud-only operations. Never commit credentials or real environment files.

To deploy the **optional** server-key alternative, upgrade to Blaze, configure Google Auth and App Check, store `GEMINI_API_KEY` using `firebase functions:secrets:set GEMINI_API_KEY`, and deploy Functions. This alternative authenticates requests, enforces App Check, uses a transactional per-user quota, and validates model output. The frontend would need to explicitly select callable generation rather than the current BYOK client. Do not deploy Functions for the default app.

## Tests and verification

```sh
npm test                         # schema, UI, BYOK privacy and failure handling
npm run build                    # strict TypeScript + Vite
npm --prefix functions run build # optional Function TypeScript
npm run check                    # all the above
```

The Gemini tests mock responses; no test contains a real API key or consumes quota. They verify header-only credentials, output validation, invalid key/model rejection, quota/network handling, key removal, storage exclusion, generation without sign-in, and retention of the existing plan when Google rejects a request. A live generation cannot be verified without a visitor's real key; enter it directly in the app, not in chat.

Security Rules tests require Java 21+ and Firebase emulators:

```sh
npm run test:rules
```

The installed Java 8 cannot run these tests. Rules compiled successfully and are deployed, but emulator tests remain unverified. Tests cover owner access, cross-user/unauthenticated denial, malformed writes and server-only quota isolation. They use `demo-gather`, never production data. CI runs tests and builds on Node 22. See [`VERIFICATION.md`](../VERIFICATION.md) for observed results.

## Features and accessibility

- Weddings, birthdays and community events; personalized ideas and practical vendor categories.
- INR budget allocations and actual spending with over-budget warnings.
- Editable task titles/dates, completion tracking, task creation/removal.
- Vendor notes and research/shortlist/booked status; no fictitious supplier recommendations or actual bookings.
- Accessible landmarks, skip link, labels, keyboard focus, native dialog, live errors and status, reduced motion, mobile navigation.
- JSON export, explicit cloud save/delete, local persistence, guarded switching between saved events.
- AI text renders as escaped React text. Restored records are validated before use. Rules check owners, top-level fields and bounded lists; nested item validation is performed in the application and Function. Client-written provenance labels are not proof of an AI call.

## Public GitHub submission under 10 MB

Source and lockfiles are small enough to remain below the submission limit, including the screenshot gallery. `.gitignore` excludes dependencies, build output, environment files, logs and emulator state. Artwork is CSS/SVG, with no large media files. The folder already has local commits; do not run another `git init` unless desired.

This project uses [Navaneeth-007/gather](https://github.com/Navaneeth-007/gather). For a fork, use your own remote URL:

```sh
cd gather
git remote add origin https://github.com/Navaneeth-007/gather.git
git push -u origin main
```

Verify access while signed out and submit the public repository URL. Record a brief demo showing key entry (hide the actual key), generated event, budget edits, task completion, vendor status and export. Submit an accessible unlisted YouTube or Drive link. Do not include the key in a video, screenshot or Git history.

## Official references

- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [Optional callable Functions](https://firebase.google.com/docs/functions/callable)
