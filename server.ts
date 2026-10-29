import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  fields,
  profile,
  createOpportunity,
  addDocument,
  extract,
  review,
  authorize,
  audit,
  setDecision,
  exportBrief,
  publicOpportunity,
} from "./domain.ts";
import { makePdf, fixturePages, fixtureFacts } from "./fixtures.ts";
const root = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(root, "data"), { recursive: true });
const db = new DatabaseSync(join(root, "data", "harbor.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS opportunities(id TEXT PRIMARY KEY,org TEXT NOT NULL,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);",
);
const save = (o: any) =>
  db
    .prepare(
      "INSERT INTO opportunities VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    )
    .run(o.id, o.org, JSON.stringify(o));
const get = (id: string, org = "demo") => {
  const row: any = db
    .prepare("SELECT data FROM opportunities WHERE id=? AND org=?")
    .get(id, org);
  return authorize(row ? JSON.parse(row.data) : null, org);
};
for (const k of Object.keys(fixtureFacts)) {
  const path = join(root, "samples", k + ".pdf");
  if (!existsSync(path)) writeFileSync(path, makePdf(k));
}
const bytes = (k: string) => readFileSync(join(root, "samples", k + ".pdf"));
function ingestFixture(o: any, k: string) {
  return addDocument(
    o,
    bytes(k),
    k + ".pdf",
    k === "amendment" ? "amendment" : "solicitation",
    fixturePages(k),
    k,
  );
}
function seed() {
  for (const k of ["base", "simple", "scan"]) {
    const o = createOpportunity(fixtureFacts[k].title, fixtureFacts[k].issuer);
    ingestFixture(o, k);
    extract(o);
    if (k === "base")
      review(
        o,
        "submission deadline",
        o.candidates["submission deadline"].value,
      );
    save(o);
  }
  db.prepare("INSERT OR REPLACE INTO meta VALUES(?,?)").run("seeded", "yes");
}
if (!db.prepare("SELECT value FROM meta WHERE key=?").get("seeded")) seed();
const storedProfile: any = db
  .prepare("SELECT value FROM meta WHERE key=?")
  .get("profile");
if (storedProfile) Object.assign(profile, JSON.parse(storedProfile.value));
const session = randomUUID();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  const send = (status: number, data: any, type = "application/json") => {
    res.writeHead(status, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src 'self'; object-src 'self'",
    });
    res.end(type === "application/json" ? JSON.stringify(data) : data);
  };
  try {
    if (
      url.pathname === "/" ||
      url.pathname === "/app.js" ||
      url.pathname === "/style.css"
    ) {
      if (url.pathname === "/")
        res.setHeader(
          "Set-Cookie",
          `harbor_session=${session}; HttpOnly; SameSite=Strict; Path=/`,
        );
      return send(
        200,
        readFileSync(
          join(
            root,
            "public",
            url.pathname === "/" ? "index.html" : url.pathname.slice(1),
          ),
        ),
        url.pathname === "/"
          ? "text/html"
          : url.pathname.endsWith(".js")
            ? "text/javascript"
            : "text/css",
      );
    }
    if (
      !req.headers.cookie
        ?.split(";")
        .some((x) => x.trim() === `harbor_session=${session}`)
    )
      return send(401, {
        error: "Local demo session required. Open the application first.",
      });
    if (
      req.method !== "GET" &&
      req.headers.origin &&
      req.headers.origin !== `http://${req.headers.host}`
    )
      return send(403, { error: "Cross-origin writes rejected" });
    const org = "demo"; // Local demo identity only; no client-selectable organization.
    if (url.pathname === "/api/state")
      return send(200, {
        fields,
        profile,
        opportunities: (
          db
            .prepare("SELECT data FROM opportunities WHERE org=?")
            .all(org) as any[]
        ).map((x) => publicOpportunity(JSON.parse(x.data))),
        mode: "Local synthetic demo — no connected OCR or model",
      });
    if (url.pathname.startsWith("/samples/")) {
      const k = url.pathname.split("/").pop()?.replace(".pdf", "") || "";
      if (!fixtureFacts[k]) throw Error("Unknown sample");
      return send(200, bytes(k), "application/pdf");
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[2];
    if (req.method === "GET" && parts[3] === "document") {
      const o = get(id, org);
      const d = o.documents.find((x: any) => x.id === parts[4]);
      if (!d) throw Error("Document not found");
      return send(200, Buffer.from(d.bytes, "base64"), "application/pdf");
    }
    if (req.method === "GET" && parts[3] === "export") {
      const o = get(id, org);
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="harbor-review.json"',
      );
      return send(200, exportBrief(o));
    }
    if (req.method !== "POST") return send(404, { error: "Not found" });
    let chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req) {
      total += chunk.length;
      if (total > 14 * 1024 * 1024) throw Error("Request too large");
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    if (url.pathname === "/api/create") {
      const o = createOpportunity(
        String(body.title || ""),
        String(body.funder || ""),
        String(body.url || ""),
      );
      audit(o, "Opportunity created");
      save(o);
      return send(200, { id: o.id });
    }
    if (url.pathname === "/api/profile") {
      const evidence = ["status", "geography", "credential"].map((key, i) => {
        const text = body.evidence?.[i]?.text;
        const source = body.evidence?.[i]?.source;
        if (
          typeof text !== "string" ||
          !text.trim() ||
          text.length > 5000 ||
          typeof source !== "string" ||
          !source.trim()
        )
          throw Error(
            "Each profile claim requires text and an evidence reference",
          );
        return { key, text, source: source.slice(0, 500) };
      });
      const previous = JSON.parse(JSON.stringify(profile));
      const next = {
        ...profile,
        id: "harbor-v" + (profile.version + 1),
        version: profile.version + 1,
        updated: new Date().toISOString(),
        evidence,
      };
      db.exec("BEGIN");
      try {
        db.prepare("INSERT OR REPLACE INTO meta VALUES(?,?)").run(
          previous.id,
          JSON.stringify(previous),
        );
        db.prepare("INSERT OR REPLACE INTO meta VALUES(?,?)").run(
          "profile",
          JSON.stringify(next),
        );
        Object.assign(profile, next);
        for (const row of db
          .prepare("SELECT data FROM opportunities WHERE org=?")
          .all(org) as any[]) {
          const existing = JSON.parse(row.data);
          existing.profileNeedsReview = true;
          audit(
            existing,
            "Operating profile changed; eligibility comparison needs re-review",
          );
          save(existing);
        }
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        Object.assign(profile, previous);
        throw e;
      }
      return send(200, { ok: true });
    }
    if (url.pathname === "/api/reset") {
      db.exec("DELETE FROM opportunities WHERE org='demo'");
      seed();
      return send(200, { ok: true });
    }
    const o = get(id, org);
    if (parts[3] === "amend") {
      ingestFixture(o, "amendment");
      extract(o);
    } else if (parts[3] === "extract") {
      extract(o);
      o.profileNeedsReview = false;
    } else if (parts[3] === "review") review(o, body.field, body.value);
    else if (parts[3] === "decision")
      setDecision(o, String(body.choice || ""), String(body.rationale || ""));
    else if (parts[3] === "upload") {
      if (typeof body.base64 !== "string") throw Error("Missing PDF");
      const b = Buffer.from(body.base64, "base64");
      const k = Object.keys(fixtureFacts).find(
        (k) =>
          createHash("sha256").update(bytes(k)).digest("hex") ===
          createHash("sha256").update(b).digest("hex"),
      );
      const result = addDocument(
        o,
        b,
        String(body.name || "upload.pdf"),
        body.classification,
        k ? fixturePages(k) : [],
        k || null,
      );
      if (!result.duplicate) extract(o);
      save(o);
      return send(200, {
        duplicate: result.duplicate,
        message: result.duplicate
          ? "Identical document already stored; reviews preserved."
          : k
            ? "Synthetic fixture recognized."
            : "PDF stored. Live OCR/extraction is not configured; no facts were invented.",
      });
    } else throw Error("Unknown action");
    save(o);
    send(200, { ok: true });
  } catch (e: any) {
    send(e.message.includes("not found") ? 404 : 400, {
      error: e.message || "Request failed",
    });
  }
});
server.listen(Number(process.env.PORT || 4317), "127.0.0.1", () =>
  console.log(
    "Harbor Intake: http://127.0.0.1:" + String(process.env.PORT || 4317),
  ),
);
