# Security

Do not post API keys or private event details in public issues. Use GitHub private vulnerability reporting when available; otherwise arrange a private channel with the maintainer before sharing sensitive details. Revoke any exposed key in Google AI Studio.

Visitor keys stay in page memory and go directly to Google Gemini in a request header. They are not saved, exported, or logged. A browser-entered key remains inspectable on that device; use your own key on a trusted browser.

Event plans are saved in ordinary, unencrypted localStorage. Avoid sensitive guest information. Stored records and Gemini output are validated before use, and AI text renders as escaped React text. Planning estimates still require human review.
