# Security

## Reporting

Do not post API keys, access tokens, private event data, or exploit details in public issues. Use GitHub's **Report a vulnerability** option if private reporting is enabled on this repository; otherwise arrange a private reporting channel with the maintainer before sharing sensitive details. No dedicated security-response SLA is claimed.

If a key has been exposed, revoke or rotate it in its provider console. Removing it from a file or commit does not invalidate it.

## Design boundaries

- Visitor keys are held in page memory and sent directly to the fixed Google Gemini endpoint in a header. They are not intentionally persisted, exported, logged, or routed through Firebase.
- Browser keys remain inspectable by the browser owner. Use a trusted device and a key restricted to the intended API. Do not bundle a shared production key in the frontend.
- Event data is kept in browser localStorage unless cloud saving is configured. Treat this as ordinary unencrypted browser storage.
- Firestore access is owner-isolated; restored records and model output are validated before use.
- Authentication, App Check, and the retained server-key Function require separate deployment configuration. The default public app does not claim those integrations are enabled.
- AI output is rendered as text; output validation does not guarantee that its suggestions or estimates are correct.

See the [architecture](docs/ARCHITECTURE.md) for the data flow and [verification report](VERIFICATION.md) for tested behavior and remaining limits.
