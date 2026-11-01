# Verification — 1 November 2026

- **Current design:** user-provided Gemini keys. A visitor enters their own key in AI settings; it is kept in memory and sent directly to Google in a header. It is not saved or sent to Firebase. The default generation path needs neither Firebase sign-in nor Blaze billing.
- **14 automated tests passed:** brief and output validation, budgets/dates/IDs, UI editing, local persistence, corrupt storage recovery, sample creation, header-only credentials, invalid keys/models, quota/network failures, malformed/truncated plans, generation without sign-in, key removal/storage exclusion, and retaining an existing plan when Google rejects a request.
- **Builds passed:** strict TypeScript + Vite frontend, plus the retained optional Firebase Function TypeScript build, from `/Users/navaneeth/Developer/gather`.
- **Live Hosting:** https://gather-promptwars-2026-8f31.web.app serves the BYOK interface; the hosting deployment completed successfully. The published Add Gemini key panel was verified in-browser, with an empty password field and model selector. Firebase project `gather-promptwars-2026-8f31` and Gather Web app are registered. A Firestore database in `us-central1` and owner-only rules/indexes are deployed. Existing projects were not changed.
- **Integration limit:** direct Gemini calls are tested with mocked responses. No real user key was available for a live model request. Enter your real key directly in the live app; never in chat or source files.
- **Optional features:** Google sign-in/cloud saving need Auth and optional App Check configuration. The earlier server-key Function is retained as an alternative, is not called by this UI, and is not deployed. It would require Blaze and a server secret; that is not needed for BYOK.
- **Security Rules tests:** provided but blocked by the installed Java 8. Install Java 21+ and run `npm run test:rules`. Rules compiled successfully and are deployed; this does not replace emulator verification.
- **Dependency audits:** frontend and Function installs previously reported zero known vulnerabilities after patched dependencies and overrides. No new dependencies were added for BYOK.
- **Build warnings:** Firebase data chunk ~517 kB (136 kB gzipped); two third-party annotation comments are stripped. Build succeeds.
- **Repository showcase:** eight compressed screenshots captured from the live sample app; added visual README, architecture/setup/demo guides, contributor/security guidance, issue and PR templates, and a tracked-source size check. All local documentation links resolve. Publication target: `https://github.com/Navaneeth-007/gather`.

See README.md for BYOK use, local development, optional account saving, publishing and privacy details.
