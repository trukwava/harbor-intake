import { createHash, randomUUID } from "node:crypto";
export const fields = [
  "title",
  "issuer",
  "identifier",
  "program purpose",
  "eligible applicants",
  "geography",
  "populations served",
  "award minimum/maximum",
  "estimated awards",
  "match requirement",
  "project period",
  "submission deadline",
  "question deadline",
  "submission method",
  "required registrations",
  "mandatory attachments",
  "mandatory activities",
  "deliverables",
  "evaluation criteria",
  "restrictions",
  "contact details",
  "unresolved questions",
];
export const profile = {
  id: "harbor-v1",
  organization: "demo",
  version: 1,
  updated: "2026-10-29",
  name: "Harbor Community Services",
  evidence: [
    {
      key: "status",
      text: "Registered nonprofit 501(c)(3).",
      source: "Operating profile v1 §1",
    },
    {
      key: "geography",
      text: "Housing stability and workforce programs in New York City.",
      source: "Operating profile v1 §2",
    },
    {
      key: "credential",
      text: "No credential evidence supplied.",
      source: "Operating profile v1 §3",
    },
  ],
};
export function deadline(text: string) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  if (dateOnly)
    return {
      original: text,
      kind: "date-only",
      date: text,
      zone: "America/New_York",
    };
  const known: Record<string, string> = {
    "November 20, 2027 at 5 p.m. America/New_York": "2027-11-20T22:00:00.000Z",
    "December 3, 2027 at 3 p.m. America/New_York": "2027-12-03T20:00:00.000Z",
    "October 15, 2027 at 5 p.m. America/New_York": "2027-10-15T21:00:00.000Z",
  };
  return {
    original: text,
    kind: known[text] ? "instant" : "unresolved",
    instant: known[text] || null,
    zone: "America/New_York",
  };
}
export function validatePdf(b: Buffer) {
  if (b.length > 10 * 1024 * 1024) throw Error("PDF exceeds the 10 MB limit");
  if (
    !b.subarray(0, 8).toString().startsWith("%PDF-") ||
    !b.subarray(-1024).toString().includes("%%EOF")
  )
    throw Error("Malformed PDF: header or end marker missing");
}
export function authorize(o: any, org: string) {
  if (!o || o.org !== org)
    throw Error("Opportunity not found for this organization");
  return o;
}
export function audit(o: any, action: string) {
  o.audit.push({ id: randomUUID(), at: new Date().toISOString(), action });
}
export function createOpportunity(title: string, funder: string, url = "") {
  if (!title.trim() || !funder.trim())
    throw Error("Title and funder are required");
  if (title.length > 200 || funder.length > 200)
    throw Error("Title or funder too long");
  if (url && !/^https?:\/\//.test(url))
    throw Error("Source URL must use http or https");
  return {
    id: randomUUID(),
    org: "demo",
    title,
    funder,
    url,
    documents: [],
    runs: [],
    candidates: {},
    reviews: {},
    criteria: [],
    decision: null,
    audit: [],
  };
}
export function addDocument(
  o: any,
  bytes: Buffer,
  name: string,
  classification: string,
  pages: any[] = [],
  fixture: string | null = null,
) {
  validatePdf(bytes);
  if (!["solicitation", "amendment", "attachment"].includes(classification))
    throw Error("Invalid document classification");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const existing = o.documents.find((d: any) => d.hash === hash);
  if (existing) return { document: existing, duplicate: true };
  const d = {
    id: randomUUID(),
    hash,
    name: name.slice(0, 200),
    classification,
    version: o.documents.length + 1,
    createdAt: new Date().toISOString(),
    pages,
    fixture,
    bytes: bytes.toString("base64"),
  };
  o.documents.push(d);
  audit(o, `Added ${classification}: ${d.name}`);
  return { document: d, duplicate: false };
}
export function validCandidate(o: any, c: any) {
  const d = o.documents.find((x: any) => x.id === c.citation?.documentId);
  const p = d?.pages.find((x: any) => x.pdfIndex === c.citation?.pdfIndex);
  return !!(
    p &&
    c.citation.excerpt &&
    p.text.includes(c.citation.excerpt) &&
    c.value === c.citation.excerpt
  );
}
export function extract(o: any) {
  const run = {
    id: randomUUID(),
    at: new Date().toISOString(),
    adapter: "Deterministic synthetic fixtures v1",
    status: "complete",
    warnings: [] as string[],
  };
  o.runs.push(run);
  for (const f of fields) {
    const options: any[] = [];
    for (const d of o.documents) {
      for (const p of d.pages) {
        const value = p.facts?.[f];
        if (value) {
          const c = {
            value,
            citation: {
              documentId: d.id,
              pdfIndex: p.pdfIndex,
              excerpt: value,
            },
            runId: run.id,
            status: "proposed",
            normalized: f.includes("deadline") ? deadline(value) : null,
          };
          if (!validCandidate(o, c))
            throw Error("Unsupported citation rejected");
          options.push(c);
        }
      }
    }
    if (!options.length) {
      o.candidates[f] = { value: "", status: "missing", runId: run.id };
      continue;
    }
    const amendments = options.filter(
      (c) =>
        o.documents.find((d: any) => d.id === c.citation.documentId)
          .classification === "amendment",
    );
    const selected = amendments.at(-1) || options.at(-1);
    selected.alternatives = options.slice(0, -1);
    if (new Set(options.map((x) => x.value)).size > 1)
      selected.status = "conflicted";
    o.candidates[f] = selected;
    const review = o.reviews[f];
    if (review && review.basis !== selected.value) review.stale = true;
  }
  if (o.documents.some((d: any) => !d.pages.length)) {
    run.status = "partial";
    run.warnings.push(
      "An uploaded document has no readable pages. OCR/extractor is not configured. Enter a manually supplied value or use bundled sample files.",
    );
  }
  if (o.documents.some((d: any) => d.fixture === "scan"))
    run.warnings.push(
      "Scan: bundled OCR transcript used. Verify table values against original PDF; live OCR is not configured.",
    );
  o.criteria = buildCriteria(o);
  audit(o, "Extraction run completed; existing reviews preserved");
  return run;
}
export function review(o: any, f: string, value: string) {
  if (!fields.includes(f) || typeof value !== "string" || value.length > 10000)
    throw Error("Invalid field");
  const c = o.candidates[f];
  o.reviews[f] = {
    value,
    status: !c?.value
      ? "manually supplied"
      : value === c.value
        ? "confirmed"
        : "edited",
    basis: c?.value || "",
    citation: c?.citation || null,
    at: new Date().toISOString(),
    stale: false,
  };
  audit(o, `Reviewed ${f}`);
}
export function buildCriteria(o: any) {
  return ["eligible applicants", "geography", "required registrations"].map(
    (f) => {
      const c = o.candidates[f];
      const ev =
        f === "eligible applicants"
          ? profile.evidence[0]
          : f === "geography"
            ? profile.evidence[1]
            : profile.evidence[2];
      return {
        id: f,
        requirement: c?.value || "No explicit requirement extracted",
        citation: c?.citation || null,
        profileVersion: profile.id,
        organizationEvidence: { ...ev },
        result:
          c?.value &&
          ((f === "eligible applicants" && c.value === ev.text) ||
            (f === "geography" &&
              c.value === "New York City." &&
              ev.text ===
                "Housing stability and workforce programs in New York City."))
            ? "pass"
            : "unknown",
        reason:
          f === "required registrations"
            ? "Required credential has no supporting profile evidence."
            : "Compare explicit synthetic requirement with operating profile v1.",
      };
    },
  );
}
export function setDecision(o: any, choice: string, rationale: string) {
  if (
    !["pursue", "decline", "needs discussion"].includes(choice) ||
    !rationale.trim()
  )
    throw Error("Choose a decision and provide a rationale");
  o.decision = {
    choice,
    rationale: rationale.slice(0, 5000),
    profileVersion: profile.id,
    at: new Date().toISOString(),
  };
  audit(o, `Reviewer recorded ${choice}`);
}
export function publicOpportunity(o: any) {
  return { ...o, documents: o.documents.map(({ bytes, ...d }: any) => d) };
}
export function exportBrief(o: any) {
  return {
    format: "Harbor review brief v1",
    exportedAt: new Date().toISOString(),
    demo: true,
    timezone: "America/New_York",
    profile,
    opportunity: publicOpportunity(o),
    fields: fields.map((f) => ({
      field: f,
      value: o.reviews[f]?.value ?? o.candidates[f]?.value ?? "",
      review: o.reviews[f] || null,
      machine: o.candidates[f] || null,
      warning: !o.reviews[f]
        ? "UNREVIEWED"
        : o.reviews[f].stale
          ? "NEEDS RE-REVIEW"
          : null,
    })),
  };
}
