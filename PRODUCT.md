# Harbor Intake — product and acceptance contract

Primary user: a grants analyst preparing a director's bid/no-bid meeting. Promise: turn source documents into an evidence-linked, editable discussion brief.

P0: opportunity creation, bounded PDF upload, versioned source pages and ingestion runs, 22 fixed schema fields, evidence review, explicit eligibility comparisons, deadlines, decisions, JSON and printable export, audit, persistence, resettable demo. Parking lot: proposal writing, discovery, CRM, submission, production identity, live OCR/model integration.

Data: OrganizationProfileVersion(id, organization, version, evidence); Opportunity(id, org, title, funder, url); SourceDocumentVersion(id, opportunity, hash, classification, original bytes, pages); SourcePage(pdfIndex, printedLabel, text); IngestionRun(id, timestamp, adapter, warnings); ExtractedFieldCandidate(field, originalText, normalized, citation, run); Citation(documentId, pdfIndex, excerpt); EligibilityCriterion(requirement, organizationEvidence, result); ReviewDecision(choice, rationale); Deadline(original, kind, normalized, zone); AuditEvent(time, action). Stored as a versioned domain aggregate in SQLite; document hashes unique per opportunity. All mutations validate organization ownership and persist atomically.

States: ingestion queued → readable / needs OCR / unavailable. Candidate proposed / missing / conflicted; reviewer acceptance stored separately (confirmed / edited / manually supplied). Accepted values survive extraction. A changed cited source marks accepted values needs re-review. Decisions require human rationale. Unknown never implies pass. Dates retain wording and America/New_York display context, exact instants stored UTC; date-only values have no fabricated time.

Acceptance scenarios defined before implementation:

1. November 20 2027 5 p.m. ET accepted; amendment proposes December 3 2027 3 p.m. ET, flags review, preserves both documents.
2. Exact deadline normalizes to UTC; date-only keeps date-only kind.
3. Malformed or oversized upload rejected; a valid unknown PDF is stored with extraction unavailable, never fixture-derived facts.
4. Absent match blank; missing credential unknown; unsupported citation rejected.
5. Duplicate hash and rerun preserve document count and accepted edits.
6. Unauthorized organization cannot read or change an opportunity.
7. Review survives database reopen; exports include sources, runs, reviews, unresolved fields and decision.

Pilot: ten sanitized historical RFPs, two reviewers. Five questions: Which mandatory requirements are most often missed? Who owns corrections? What evidence proves credentials? Which deadline wording causes ambiguity? What must a director see before a decision? Baseline both reviewers' full manual preparation and correction time, field error categories and mandatory omissions. Shadow mode: compare this brief to independently prepared manual briefs; never use it as application authority. Success hypothesis: lower median total preparation plus correction time with no increase in critical errors and complete citation coverage. Any unsupported critical requirement or missed deadline stops use pending investigation and regression test. Decide on OCR/model integration only after measuring scan frequency and correction burden; buyer, price and demand remain untested hypotheses.
