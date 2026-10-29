# Verification record

- 10 focused Node tests passed locally on Node 24.16.0. Run `npm test`.
- Browser exercised the working queue, evidence workspace, source documents, sample amendment, reviewer acceptance, eligibility comparisons and decision saving.
- Browser observed the original November deadline flagged for re-review after applying Amendment 1; the new proposal cites amendment.pdf, physical PDF page 1, printed label A-1. Both versions remained inspectable.
- Restarted the server and reloaded the browser: the amendment and prior accepted review persisted. Accepted the December proposal through the browser and saved a needs-discussion rationale.
- Initial desktop screen visually checked at 1280×720. The browser later used a 320-pixel-wide panel: decision controls remained readable and usable; wide eligibility table scrolls horizontally. No full tablet or accessibility audit was performed.
- Print preview is implemented; native PDF printing/output pagination was not exercised. JSON export and HTTP access/error handling are tested by `smoke.ts` against the running server.
- No live OCR/model or production authorization testing was claimed. The session/organization boundary is for local demonstration only.
- `review-preview.png` shows only synthetic data from the browser decision screen.

To run the optional HTTP smoke checks with the server already running:

```sh
DEMO_URL=http://127.0.0.1:4389 node --experimental-strip-types smoke.ts
```
