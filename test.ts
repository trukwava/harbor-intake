import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  createOpportunity,
  addDocument,
  extract,
  review,
  deadline,
  authorize,
  validCandidate,
  exportBrief,
  validatePdf,
  setDecision,
} from "./domain.ts";
import { makePdf, fixturePages } from "./fixtures.ts";
function example() {
  const o: any = createOpportunity("Test", "Test Fund");
  addDocument(
    o,
    makePdf("base"),
    "base.pdf",
    "solicitation",
    fixturePages("base"),
    "base",
  );
  extract(o);
  return o;
}
test("amendment proposes newer deadline, flags accepted review and preserves original", () => {
  const o = example();
  review(o, "submission deadline", o.candidates["submission deadline"].value);
  addDocument(
    o,
    makePdf("amendment"),
    "amend.pdf",
    "amendment",
    fixturePages("amendment"),
    "amendment",
  );
  extract(o);
  assert.equal(o.documents.length, 2);
  assert.equal(o.reviews["submission deadline"].stale, true);
  assert.match(o.reviews["submission deadline"].value, /November 20/);
  assert.match(o.candidates["submission deadline"].value, /December 3/);
  assert.equal(o.candidates["submission deadline"].status, "conflicted");
  assert.equal(
    o.candidates["submission deadline"].citation.documentId,
    o.documents[1].id,
  );
});
test("date normalization preserves wording and distinguishes date-only", () => {
  assert.equal(
    deadline("November 20, 2027 at 5 p.m. America/New_York").instant,
    "2027-11-20T22:00:00.000Z",
  );
  assert.equal(
    deadline("December 3, 2027 at 3 p.m. America/New_York").instant,
    "2027-12-03T20:00:00.000Z",
  );
  assert.equal(deadline("2027-11-01").kind, "date-only");
  assert.equal(deadline("2027-11-01").instant, undefined);
  assert.equal(deadline("ambiguous date").kind, "unresolved");
});
test("malformed and oversized files rejected", () => {
  assert.throws(() => validatePdf(Buffer.from("not a pdf")));
  assert.throws(() => validatePdf(Buffer.alloc(11 * 1024 * 1024)));
});
test("missing evidence stays unknown; instruction-like source cannot approve", () => {
  const o = example();
  assert.equal(o.candidates["match requirement"].value, "");
  assert.equal(
    o.criteria.find((c: any) => c.id === "required registrations").result,
    "unknown",
  );
  assert.equal(o.decision, null);
  assert.equal(
    validCandidate(o, {
      value: "invented",
      citation: {
        documentId: o.documents[0].id,
        pdfIndex: 1,
        excerpt: "invented",
      },
    }),
    false,
  );
});
test("duplicate upload and reprocess retain edits", () => {
  const o = example();
  review(o, "title", "Human edited title");
  const d = addDocument(o, makePdf("base"), "renamed.pdf", "solicitation");
  assert.equal(d.duplicate, true);
  extract(o);
  assert.equal(o.documents.length, 1);
  assert.equal(o.reviews.title.value, "Human edited title");
  assert.equal(o.reviews.title.stale, false);
  assert.equal(o.runs.length, 2);
});
test("organization boundary rejects foreign opportunity", () => {
  const o = example();
  assert.throws(() => authorize(o, "other"));
  assert.throws(() => authorize(null, "demo"));
  assert.equal(authorize(o, "demo"), o);
});
test("SQLite reload and export retain reviewed values and uncertainty", () => {
  const o = example();
  review(o, "title", "Reviewed title");
  setDecision(o, "needs discussion", "Credential evidence is missing.");
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE opportunities(id TEXT PRIMARY KEY, org TEXT NOT NULL, data TEXT NOT NULL)",
  );
  db.prepare("INSERT INTO opportunities VALUES(?,?,?)").run(
    o.id,
    o.org,
    JSON.stringify(o),
  );
  const loaded = JSON.parse(
    (
      db
        .prepare("SELECT data FROM opportunities WHERE id=? AND org=?")
        .get(o.id, "demo") as any
    ).data,
  );
  const out = exportBrief(loaded);
  assert.equal(
    out.fields.find((f) => f.field === "title")?.value,
    "Reviewed title",
  );
  assert.equal(
    out.fields.find((f) => f.field === "match requirement")?.warning,
    "UNREVIEWED",
  );
  assert.equal(out.opportunity.decision.choice, "needs discussion");
  assert.equal("bytes" in out.opportunity.documents[0], false);
  db.close();
});
test("unknown PDF never acquires fixture facts", () => {
  const o: any = createOpportunity("Unknown", "Funder");
  addDocument(
    o,
    Buffer.from("%PDF-1.4\nUnknown\n%%EOF"),
    "unknown.pdf",
    "solicitation",
  );
  const run = extract(o);
  assert.equal(run.status, "partial");
  assert.ok(Object.values(o.candidates).every((c: any) => c.value === ""));
});
test("review and decision input validation", () => {
  const o = example();
  assert.throws(() => review(o, "unknown", "x"));
  assert.throws(() => setDecision(o, "pursue", ""));
});
import { validateModelOutput } from "./adapters.ts";
test("model boundary rejects malformed, duplicate, and unsupported citations", () => {
  const p = [{ pdfIndex: 1, printedLabel: "i", text: "Award is $50 USD." }];
  assert.throws(() => validateModelOutput({}, p, ["award"]));
  assert.throws(() =>
    validateModelOutput(
      [{ field: "award", value: "$90", excerpt: "$90", pdfIndex: 1 }],
      p,
      ["award"],
    ),
  );
  assert.equal(
    validateModelOutput(
      [
        {
          field: "award",
          value: "$50 USD",
          excerpt: "Award is $50 USD.",
          pdfIndex: 1,
        },
      ],
      p,
      ["award"],
    ).length,
    1,
  );
});
