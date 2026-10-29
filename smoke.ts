import assert from "node:assert/strict";
const base = process.env.DEMO_URL || "http://127.0.0.1:4389";
const page = await fetch(base);
assert.equal(page.status, 200);
const cookie = page.headers.get("set-cookie")!.split(";")[0];
const unauthorized = await fetch(base + "/api/state");
assert.equal(unauthorized.status, 401);
const headers = { Cookie: cookie, "Content-Type": "application/json" };
const state = (await (
  await fetch(base + "/api/state", { headers })
).json()) as any;
assert.ok(state.opportunities.length >= 3);
const foreign = await fetch(
  base + "/api/opportunity/another-organization-id/export",
  { headers },
);
assert.equal(foreign.status, 404);
const bad = await fetch(base + "/api/create", {
  method: "POST",
  headers,
  body: JSON.stringify({ title: "", funder: "" }),
});
assert.equal(bad.status, 400);
const id = state.opportunities[0].id;
const result = await fetch(base + "/api/opportunity/" + id + "/export", {
  headers,
});
assert.equal(result.status, 200);
const brief: any = await result.json();
assert.equal(brief.fields.length, 22);
assert.ok(brief.opportunity.documents.every((d: any) => !("bytes" in d)));
assert.ok(
  brief.fields.every((f: any) => !f.machine?.value || f.machine?.citation),
);
const cross = await fetch(base + "/api/create", {
  method: "POST",
  headers: { ...headers, Origin: "https://untrusted.example" },
  body: "{}",
});
assert.equal(cross.status, 403);
console.log(
  "HTTP smoke passed: page, session required, foreign ID denied, invalid input rejected, 22-field export and citation coverage, cross-origin write denied.",
);
