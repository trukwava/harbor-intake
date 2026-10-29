# Harbor Intake

A local, working RFP intake and bid/no-bid preparation demo for the fictional Harbor Community Services. Original implementation; no third-party code, branding, private documents, or customer data is included.

## Run

Requires Node.js 24 or newer. No dependency installation or paid account is required.

```sh
npm test
PORT=4389 npm start
```

Open http://127.0.0.1:4389. If the default system Node is broken on this Mac, use the working runtime directly:

```sh
PORT=4389 /opt/homebrew/opt/node@24/bin/node --experimental-strip-types server.ts
```

The default port without PORT is 4317. `.env.example` documents configuration; the server reads environment variables directly and does not automatically load a .env file.

## Operator guide

1. Open Community Resilience Initiative. Its original November 20, 2027 deadline is already reviewed.
2. In Source documents, apply sample Amendment 1. Both originals remain available. The December 3, 2027 deadline is proposed and the saved November value is marked for re-review.
3. In Intake & evidence, select a field, inspect the excerpt and original PDF page, edit if needed, and save your review. A re-review opens the new proposal while preserving the earlier accepted value in the evidence panel until you save.
4. In Eligibility & decision, compare explicit requirements to profile evidence. The required credential has no evidence and remains unknown. Record pursue, decline, or needs discussion with your rationale.
5. Check deadlines and missing items. Download the structured JSON brief or use Print / Save PDF. Unreviewed and stale values are marked. JSON is the editable export format; no DOCX is generated.
6. To create a new opportunity, enter title/funder and optionally an official URL, then upload a classified PDF. Download sample files from the queue. Re-uploading an identical source does not duplicate it within the opportunity. Reprocessing preserves reviews.
7. Organization profile opens a user-maintained form. Saving creates a version and flags existing comparisons for refresh. Use Reprocess documents to compare with the latest profile evidence.
8. Reset synthetic workspace replaces only records belonging to the demo organization. It removes local demo uploads/reviews; the confirmation describes this. It does not touch any other organization.

## Demo versus connected behavior

- Three fictional packages: searchable housing RFP, image-only workforce scan containing a table, and a base solicitation plus deadline amendment. Four sample PDFs are bundled under `samples/`.
- The fixed extractor recognizes bundled file hashes and uses bundled page transcripts. The scan transcript is a fixture, not a live OCR result. Every populated machine candidate is checked against its transcript excerpt.
- Unknown uploaded PDFs are preserved with an explicit unavailable extraction state. Header/end-marker and size checks are bounded first-line validation, not a complete PDF security parser. Original PDFs open in the browser viewer. No arbitrary document links are fetched.
- `adapters.ts` defines OCR and structured extraction interfaces, unconfigured implementations, and a strict schema/reference validator. No model credentials, calls, confidence scores, automatic approvals, or production integrations exist.
- Exact-instant normalization covers supplied fixture wordings; other wording stays unresolved. Date-only deadlines retain their date without a fabricated time. Original text and numeric ranges are retained.
- Eligibility pass is a narrow exact comparison for synthetic nonprofit status and geography. Other cases remain unknown. This is preparation support, not legal interpretation or an automatic eligibility determination.
- Local demo identity uses a server-generated, HttpOnly, SameSite cookie and a fixed server-owned demo organization. Organization-scoped access is checked at reads and writes. This is **not production authentication** and must not be exposed as a public service or used for private production records.

## Storage, retention, and recovery

SQLite (`data/harbor.sqlite`) persists opportunity aggregates, original PDF bytes, source page labels, ingestion runs, separate candidate/review values, comparisons, decisions and audit events. `schema.sql` is the idempotent initial migration. Profile versions are kept in the meta table. All mutation timestamps use UTC. PDF page references are 1-based physical page indices; printed page labels are separate.

Records remain locally until reset. No automatic retention policy or compliance certification is claimed. Stop the server and back up the full `data/` directory before resetting. Restore that directory with the server stopped to recover a backup. Data files, uploads and local reviews are excluded from Git. A production version needs identity, per-document retention/deletion policy, malware isolation, robust PDF parsing, resource quotas, backup/restore controls and a normalized migration strategy.

## Validation and status

Run `npm test`. Tests cover amendment proposals and stale reviews, UTC/date-only normalization, malformed/oversized files, missing credential/match evidence, unsupported citations, duplicate ingestion, preserved edits, organization access rejection, SQLite serialization and export, unknown uploads, and input validation.

Implemented: persistent intake, 22-field schema, evidence workspace, immutable source versions, duplicate hashes, reprocessing, eligibility preparation, human decision, deadlines/missing items, editable JSON and print views, profile versions, audit, samples, reset, adapter interfaces.

Limitations: no live OCR/model; no general PDF text extraction; no production login; no DOCX export; no async worker/cancellation (local fixture extraction is synchronous); no proposal generation, CRM, funder discovery or submission. Responsive CSS is included; device-size browser verification is recorded separately in `VERIFICATION.md`.

See `PRODUCT.md` for acceptance scenarios, the state model, P0/parking lot, five discovery questions and a ten-RFP/two-reviewer shadow pilot plan. Buyer, price, demand and time savings are unvalidated hypotheses.

## Reference

This is an original implementation of an RFP intake and bid/no-bid preparation workflow using synthetic data. No external performance/adoption claims are reproduced. All funders, opportunities and organization facts here are synthetic.
