# Contributing to Gather

Use Node 22+ and npm. Fork or branch the repository, install both sets of dependencies, and run the checks before opening a pull request:

```sh
npm ci
npm --prefix functions ci
npm run check
npm run check:repo
```

Keep changes focused, preserve responsive layouts and keyboard access, and explain the user-visible result plus how you verified it. For Gemini-related changes, cover validation and failure behavior with mocked requests; never add a real API key to a test or screenshot.

Report ordinary bugs with reproduction steps and expected behavior. For security issues, follow [SECURITY.md](SECURITY.md). Add screenshots for visible interface changes, using fictional event data and an empty key field.
