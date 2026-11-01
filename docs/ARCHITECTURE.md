# Architecture and design decisions

Gather keeps its default deployment small: a static React application on Firebase Hosting, a direct connection from the visitor's browser to Gemini, and local event persistence. Firebase account saving is an optional enhancement.

## Generation lifecycle

1. The visitor enters a key in a password field. React retains it in a ref, clears the field after acceptance, and forgets it on reload or explicit removal.
2. A validated brief supplies event type, name, date, location, guest count, INR budget, and preferences.
3. `src/gemini.ts` sends one request to the fixed Google endpoint using an `x-goog-api-key` header. Model names are validated; no arbitrary API URL is accepted. Cookies are omitted and redirects are rejected.
4. The request specifies a JSON response schema derived from the shared Zod contract. The prompt asks for accessibility/dietary consideration, realistic budget estimates, a contingency, actionable dates, and vendor categories rather than invented businesses.
5. The response passes structural validation and budget/date/ID checks. Malformed, truncated, over-budget, or incorrectly scheduled plans are rejected.
6. A valid plan replaces the current event. Failures leave it unchanged. Users can edit and export the result.

## Persistence boundaries

| Data | Location | Lifetime |
| --- | --- | --- |
| Visitor Gemini key | Page memory only | Until reload, close, or removal |
| Event brief and plan | Browser localStorage when signed out | Until cleared or replaced |
| Exported event | Visitor-downloaded JSON | Controlled by the visitor |
| Signed-in saved event | `users/{uid}/events/{eventId}` | Until explicit deletion |
| Optional Function quota | Server-only Firestore document | Used only by the server-key alternative |

No visitor key is part of the event schema. Firebase Hosting receives static page requests; Gemini receives the key and event brief directly. Model quotas and any usage costs belong to the visitor's Google project.

## Optional account persistence

Firebase Authentication uses Google sign-in. Firestore Rules restrict event access to the matching authenticated UID. Rules validate top-level fields and bounded arrays; Zod validates nested items in the app. Saved documents are parsed again on retrieval. The current public build does not enable cloud sign-in until its configuration is supplied. App Check can additionally protect Firestore once registered and enforced.

## Optional server-key alternative

`functions/src/index.ts` preserves a callable Function implementation for a different hosting model in which the operator pays for Gemini. It uses Secret Manager, authenticated callables, App Check, a transaction-based per-user quota, timeouts, and output validation. It requires Blaze and is not called by the default UI. This is an alternative, not an extra hop for visitor keys. Integrating it requires explicitly changing the frontend generation path.

## Interface and accessibility

A warm sage palette, serif headings, restrained typography, and compact CSS illustration support a calm planning workspace. Navigation separates the overview, budget, timeline, vendors, and ideas. The same plan state drives each view.

The implementation includes semantic landmarks, a skip link, labels, focus outlines, keyboard-operable controls, a native dialog, live error/status regions, and reduced-motion support. Manual assistive-technology auditing remains future work; these features are not a certification of full accessibility compliance.

## Practical limits

- Currency is currently INR and user-facing dates use browser locale.
- Gemini availability and quota depend on each visitor's key; no live key is bundled.
- Local browser storage is not encrypted and should not hold sensitive guest records.
- A browser-supplied key is inspectable locally. The design avoids storing it, but cannot make it invisible to the browser owner or compromised scripts.
- AI estimates and vendor checklists require human review; no procurement or booking is performed.
