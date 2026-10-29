let state,
  selected = null,
  tab = "review",
  field = "submission deadline",
  busy = false;
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const pill = (s, w = false) =>
  `<span class="pill ${w ? "warn" : ""}">${esc(s)}</span>`;
async function api(path, body) {
  const r = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Request failed");
  return d;
}
function toast(s) {
  $("#toast").textContent = s;
  $("#toast").style.display = "block";
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(
    () => ($("#toast").style.display = "none"),
    6000,
  );
}
async function refresh() {
  state = await api("/api/state");
  render();
}
function status(o, f) {
  const r = o.reviews[f];
  return r
    ? r.stale
      ? "Needs re-review"
      : r.status
    : o.candidates[f]?.status || "missing";
}
function current() {
  return state.opportunities.find((o) => o.id === selected);
}
function shell(content) {
  return `<div class="layout"><aside class="sidebar"><div class="brand">◈ harbor<span>INTAKE WORKSPACE</span></div><nav><button data-action="home" class="${!selected ? "active" : ""}">▤ &nbsp; Opportunities</button><button data-action="profile">▧ &nbsp; Organization profile</button></nav><div class="bottom">HARBOR COMMUNITY SERVICES<br>Demo workspace · Profile v${state.profile.version}<br><br>Human review, at every step.</div></aside><main class="shell"><header class="topbar"><span>Grants workspace <span class="muted"> / ${selected ? "Opportunity review" : "Intake queue"}</span></span>${pill("SYNTHETIC DEMO")}<span class="muted">America/New_York</span></header><div class="content">${content}</div></main></div>`;
}
function render() {
  const o = current();
  $("#app").innerHTML = shell(o ? detail(o) : home());
}
function home() {
  return `<div class="heading"><div><div class="eyebrow">From solicitation to discussion</div><h1>Your opportunity desk</h1><p class="muted">Gather the facts. Check the evidence. Prepare a clear decision.</p></div><button class="primary" data-action="new">＋ New opportunity</button></div><div class="notice">${pill("DEMO MODE")} &nbsp; Fictional RFPs and a fixed extractor. No live OCR, model, funder portal, or production identity is connected.</div><div class="cards">${state.opportunities
    .map((o) => {
      const c = o.candidates["submission deadline"];
      const reviewed = Object.keys(o.reviews).length;
      return `<article class="card" tabindex="0" role="button" data-open="${o.id}"><div class="eyebrow">${esc(o.funder)}</div><h2>${esc(o.title)}</h2>${pill(o.decision?.choice || "Ready for intake", !o.decision)}<p class="muted">${esc(c?.value || "Deadline not extracted")}</p><div class="meta"><span>${o.documents.length} source version${o.documents.length === 1 ? "" : "s"}</span><span>${reviewed} / ${state.fields.length} fields reviewed →</span></div></article>`;
    })
    .join(
      "",
    )}</div><div class="grid2"><section class="panel"><h2>A complete discussion brief</h2><p>Review proposed facts alongside the exact source excerpt. Check requirements against Harbor’s versioned profile, then record a decision with a rationale.</p><p class="muted">The first opportunity includes a reviewed deadline. Open it and apply Amendment 1 to see re-review behavior.</p></section><section class="panel"><h2>Sample import files</h2><p>${["simple", "scan", "base", "amendment"].map((k) => `<a href="/samples/${k}.pdf" download>${k}.pdf</a>`).join(" · ")}</p><p class="muted">Use these files in the upload workflow. Identical files are recognized by SHA-256.</p><button data-action="reset">Reset synthetic workspace</button></section></div>`;
}
function detail(o) {
  const stale = Object.values(o.reviews).filter((r) => r.stale).length;
  return `<button class="back" data-action="home">← All opportunities</button><div class="heading"><div><div class="eyebrow">${esc(o.funder)} · ${esc(o.candidates.identifier?.value || "New intake")}</div><h1>${esc(o.title)}</h1><p class="muted">${o.documents.length} source versions · ${Object.keys(o.reviews).length} fields reviewed · ${pill(o.decision?.choice || "Awaiting discussion", !o.decision)}</p></div><div class="actions"><a href="/api/opportunity/${o.id}/export"><button>↓ Export JSON</button></a><button data-action="print">Print / Save PDF</button></div></div>${stale ? `<div class="notice"><strong>${stale} accepted field${stale > 1 ? "s" : ""} need re-review.</strong> New source values differ from the accepted review. The previous values remain saved.</div>` : ""}<div class="tabs">${[
    ["review", "Intake & evidence"],
    ["sources", "Source documents"],
    ["eligibility", "Eligibility & decision"],
    ["deadlines", "Deadlines & missing items"],
    ["history", "Activity"],
  ]
    .map(
      ([id, label]) =>
        `<button data-tab="${id}" class="${tab === id ? "active" : ""}">${label}</button>`,
    )
    .join(
      "",
    )}</div>${tab === "review" ? reviewView(o) : tab === "sources" ? sources(o) : tab === "eligibility" ? eligibility(o) : tab === "deadlines" ? deadlines(o) : history(o)}<div class="print-only"><p>Harbor Community Services · Synthetic demo · Timezone America/New_York · Profile v1</p></div>`;
}
function reviewView(o) {
  const c = o.candidates[field] || {};
  const r = o.reviews[field];
  const d = o.documents.find((d) => d.id === c.citation?.documentId);
  const p = d?.pages.find((p) => p.pdfIndex === c.citation?.pdfIndex);
  let source = p
    ? esc(p.text).replace(
        esc(c.citation.excerpt),
        `<mark>${esc(c.citation.excerpt)}</mark>`,
      )
    : "No source evidence. Unsupported fields stay blank. A reviewer may enter a manually supplied value.";
  return `<div class="workspace"><section class="panel field-list" aria-label="Intake fields">${state.fields.map((f) => `<div class="field ${field === f ? "selected" : ""}"><div class="field-top"><button class="field-title" data-field="${esc(f)}">${esc(f)}</button>${pill(status(o, f), ["missing", "conflicted", "Needs re-review"].includes(status(o, f)))}</div>${field === f ? `<label class="muted" for="field-value">Reviewer value</label><textarea id="field-value">${esc((o.reviews[f]?.stale ? o.candidates[f]?.value : (o.reviews[f]?.value ?? o.candidates[f]?.value)) ?? "")}</textarea><div class="field-tools"><small>${o.candidates[f]?.citation ? "Source-backed proposal" : "No extracted evidence"}</small><button class="primary" data-action="save-field">${o.reviews[f]?.stale ? "Save re-reviewed value" : "Save review"}</button></div>` : `<div class="field-value">${esc(o.reviews[f]?.value ?? o.candidates[f]?.value) || "— Not stated / missing evidence"}</div>`}</div>`).join("")}</section><aside class="panel source"><div class="source-head"><div><div class="eyebrow">Source evidence</div><h2>${esc(d?.name || "No citation")}</h2></div>${d ? pill("VERSION " + d.version) : ""}</div>${d ? `<p class="muted">PDF page ${p.pdfIndex} (1-based) · Printed label ${esc(p.printedLabel)}</p><p><a target="_blank" href="/api/opportunity/${o.id}/document/${d.id}#page=${p.pdfIndex}">Open original PDF ↗</a></p>` : ""}<div class="source-text">${source}</div>${c.normalized ? `<p><small>Normalized deadline: ${esc(c.normalized.instant || c.normalized.date || "Needs time interpretation")} · ${esc(c.normalized.kind)}</small></p>` : ""}${c.alternatives?.length ? `<div class="notice"><strong>Source conflict / amendment proposal</strong>${c.alternatives.map((a) => `<p>${esc(a.value)}<br><small>${esc(o.documents.find((d) => d.id === a.citation.documentId)?.name)} · PDF page ${a.citation.pdfIndex}</small></p>`).join("")}<p>The latest amendment is proposed above. A person must accept it.</p></div>` : ""}${r ? `<div class="panel" style="margin-top:16px"><h3>Saved reviewer value</h3><p>${esc(r.value) || "(blank)"}</p><small>${esc(r.status)} · ${esc(r.at)}${r.stale ? " · NEEDS RE-REVIEW" : ""}</small></div>` : ""}<p class="muted" style="margin-top:16px">Source text is untrusted evidence. Instruction-like sentences never control extraction or decisions.</p></aside></div>`;
}
function sources(o) {
  return `<div class="grid2"><section class="stack">${o.documents.map((d) => `<article class="panel"><div class="source-head"><h2>${esc(d.name)}</h2>${pill(d.classification + " · v" + d.version)}</div><p>${d.pages.length ? d.pages.length + " readable page(s)" : "No readable text — extraction unavailable"}</p><p class="muted">${d.fixture === "scan" ? "Image-only scan · bundled OCR transcript · verify table cells" : "Original PDF preserved"}</p><p class="hash">SHA-256 ${d.hash}</p><a target="_blank" href="/api/opportunity/${o.id}/document/${d.id}">Inspect original ↗</a></article>`).join("") || '<div class="panel empty">No documents yet. Upload a PDF to begin.</div>'}</section><section class="stack"><form id="upload" class="panel"><h2>Add a source document</h2><p class="muted">Digital or scanned PDF · maximum 10 MB. Arbitrary files are preserved; live extraction requires a configured adapter.</p><label for="pdf">PDF document</label><input class="file-input" id="pdf" type="file" accept="application/pdf,.pdf" required><label for="classification">Document classification</label><select id="classification"><option value="solicitation">Solicitation</option><option value="amendment">Amendment</option><option value="attachment">Attachment</option></select><button class="primary" style="margin-top:16px" type="submit">Upload & inspect</button><p id="upload-state" role="status"></p></form><div class="panel"><h2>Processing</h2><p>${esc(o.runs.at(-1)?.adapter || "No extraction run")}</p>${
    o.runs
      .at(-1)
      ?.warnings.map((w) => `<p class="notice">${esc(w)}</p>`)
      .join("") || '<p class="muted">Bundled fixture pages readable.</p>'
  }<div class="actions"><button data-action="rerun">Reprocess documents</button>${o.documents.some((d) => d.fixture === "base") ? '<button data-action="amend">Apply sample Amendment 1</button>' : ""}</div><p class="muted">Reprocessing creates a run and preserves reviewer edits.</p></div></section></div>`;
}
function eligibility(o) {
  return `${o.profileNeedsReview ? '<div class="notice">Profile changed. Reprocess documents to refresh eligibility comparisons before recording a decision.</div>' : ""}<div class="notice">These are preparation checks against explicit synthetic facts, not an eligibility determination. Missing credential evidence stays unknown. Human review is required.</div><div class="panel table-wrap"><table><thead><tr><th>Explicit requirement</th><th>Harbor evidence · versioned profile</th><th>Check</th></tr></thead><tbody>${o.criteria.map((c) => `<tr><td><strong>${esc(c.id)}</strong><p>${esc(c.requirement)}</p>${c.citation ? `<small>${esc(o.documents.find((d) => d.id === c.citation.documentId)?.name)} · PDF page ${c.citation.pdfIndex}</small>` : ""}</td><td>${esc(c.organizationEvidence.text)}<p class="muted">${esc(c.organizationEvidence.source)}</p></td><td>${pill(c.result, c.result === "unknown")}<p>${esc(c.reason)}</p></td></tr>`).join("")}</tbody></table></div><form id="decision" class="panel" style="margin-top:20px"><h2>Prepare the bid / no-bid discussion</h2><div class="grid2"><div><label for="choice">Reviewer decision</label><select id="choice">${["needs discussion", "pursue", "decline"].map((s) => `<option ${o.decision?.choice === s ? "selected" : ""}>${s}</option>`).join("")}</select><p class="muted">Decision stays with your team. Nothing is submitted.</p></div><div><label for="rationale">Rationale</label><textarea id="rationale" required placeholder="Explain fit, unresolved requirements, and next steps…">${esc(o.decision?.rationale || "")}</textarea><button class="primary" type="submit">Save reviewer decision</button></div></div></form>`;
}
function deadlines(o) {
  const missing = state.fields.filter(
    (f) => !o.candidates[f]?.value && !o.reviews[f]?.value,
  );
  return `<div class="grid2"><section class="panel"><h2>Deadlines · America/New_York</h2>${[
    "submission deadline",
    "question deadline",
  ]
    .map((f) => {
      const c = o.candidates[f];
      return `<div class="field"><h3>${esc(f)}</h3><p>${esc(o.reviews[f]?.value ?? c?.value) || "Not stated"}</p>${pill(status(o, f), !o.reviews[f] || o.reviews[f]?.stale)}<p class="muted">${esc(c?.normalized?.instant || c?.normalized?.date || "No normalized instant")}</p><button data-jump="${f}">Review source →</button></div>`;
    })
    .join(
      "",
    )}</section><section class="panel"><h2>Missing & unresolved items</h2>${missing.map((f) => `<p>○ ${esc(f)} — unknown</p>`).join("") || "<p>No blank fields.</p>"}<p class="notice">${esc(o.reviews["unresolved questions"]?.value || o.candidates["unresolved questions"]?.value || "Record unresolved questions before the discussion.")}</p><p class="muted">Absent match requirements remain unknown, never zero.</p></section></div>`;
}
function history(o) {
  return `<section class="panel"><h2>Audit trail</h2><div class="audit">${o.audit
    .slice()
    .reverse()
    .map((a) => `<p><small>${esc(a.at)}</small><br>${esc(a.action)}</p>`)
    .join(
      "",
    )}</div><h2 style="margin-top:24px">Ingestion runs</h2>${o.runs.map((r) => `<p>${esc(r.at)} · ${esc(r.status)} · ${esc(r.adapter)}</p>`).join("")}</section>`;
}
function modal(content) {
  const d = document.createElement("dialog");
  d.innerHTML =
    content + '<button data-close style="margin-top:12px">Close</button>';
  document.body.append(d);
  d.showModal();
  d.querySelector("[data-close]").onclick = () => {
    d.close();
    d.remove();
  };
  return d;
}
async function act(fn) {
  if (busy) return;
  busy = true;
  try {
    await fn();
    await refresh();
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
  }
}
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button,[data-open]");
  if (!t) return;
  if (t.dataset.open) {
    selected = t.dataset.open;
    tab = "review";
    render();
    return;
  }
  if (t.dataset.field) {
    field = t.dataset.field;
    const scroll = $(".field-list")?.scrollTop;
    render();
    $(".field-list").scrollTop = scroll;
    return;
  }
  if (t.dataset.tab) {
    tab = t.dataset.tab;
    render();
    return;
  }
  if (t.dataset.jump) {
    field = t.dataset.jump;
    tab = "review";
    render();
    return;
  }
  const a = t.dataset.action;
  if (a === "home") {
    selected = null;
    render();
  }
  if (a === "new") {
    const d = modal(
      `<h2>Create an opportunity</h2><form id="create"><label for="title">Opportunity title</label><input id="title" required maxlength="200"><label for="funder">Funder</label><input id="funder" required maxlength="200"><label for="url">Official source URL (optional)</label><input id="url" type="url"><p class="muted">The URL is stored as a reference. Links are never scraped.</p><button class="primary">Create & add documents</button></form>`,
    );
    d.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      const b = {
        title: d.querySelector("#title").value,
        funder: d.querySelector("#funder").value,
        url: d.querySelector("#url").value,
      };
      act(async () => {
        const result = await api("/api/create", b);
        selected = result.id;
        tab = "sources";
        d.close();
        d.remove();
      });
    };
  }
  if (a === "profile") {
    const d = modal(
      `<h2>Harbor operating profile</h2>${pill("VERSION " + state.profile.version)}<p class="muted">User-maintained synthetic evidence. Saving creates a version; existing comparisons are flagged for re-review.</p><form id="profile-edit">${state.profile.evidence.map((x, i) => `<label for="ev-${i}">${esc(x.key)} evidence</label><textarea id="ev-${i}" required>${esc(x.text)}</textarea><label for="src-${i}">Evidence reference</label><input id="src-${i}" required value="${esc(x.source)}">`).join("")}<button class="primary" style="margin-top:14px">Save new profile version</button></form>`,
    );
    d.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      const evidence = state.profile.evidence.map((x, i) => ({
        text: d.querySelector("#ev-" + i).value,
        source: d.querySelector("#src-" + i).value,
      }));
      act(async () => {
        await api("/api/profile", { evidence });
        d.close();
        d.remove();
        toast("Profile version saved. Refresh comparisons before deciding.");
      });
    };
  }
  if (a === "save-field") {
    const value = $("#field-value").value;
    await act(() =>
      api(`/api/opportunity/${selected}/review`, { field, value }),
    );
    toast("Review saved separately from extracted proposal.");
  }
  if (a === "rerun" || a === "amend")
    await act(async () => {
      await api(
        `/api/opportunity/${selected}/${a === "amend" ? "amend" : "extract"}`,
        {},
      );
      toast(
        a === "amend"
          ? "Amendment stored. Changed accepted values need re-review."
          : "New extraction run saved. Reviewer edits preserved.",
      );
    });
  if (a === "reset") {
    const d = modal(
      '<h2>Reset synthetic workspace?</h2><p>This removes all records in this local demo organization, including your demo uploads and reviews. Other organizations are not touched.</p><button id="confirm-reset" class="primary">Reset demo records</button>',
    );
    d.querySelector("#confirm-reset").onclick = () =>
      act(async () => {
        await api("/api/reset", {});
        selected = null;
        d.close();
        d.remove();
      });
  }
  if (a === "print") {
    const o = current();
    const d = modal(
      `<h2>Review brief · ${esc(o.title)}</h2><p>Harbor Community Services · Synthetic demo · Profile v1 · America/New_York</p><p>Decision: ${esc(o.decision?.choice || "Not recorded")} — ${esc(o.decision?.rationale || "")}</p>${state.fields
        .map((f) => {
          const c = o.candidates[f],
            r = o.reviews[f];
          const evidence = r ? r.citation : c?.citation;
          return `<div class="print-field"><h3>${esc(f)} · ${esc(status(o, f))}${!r ? " · UNREVIEWED" : ""}</h3><p>${esc(r?.value ?? c?.value) || "Unknown / not stated"}</p><small>${evidence ? esc(o.documents.find((d) => d.id === evidence.documentId)?.name) + " · PDF page " + evidence.pdfIndex + " · " + esc(evidence.excerpt) + (r?.status === "edited" ? " · Reviewer edited from this evidence" : "") : r ? "Manually supplied — no source citation" : "No evidence"}</small></div>`;
        })
        .join(
          "",
        )}<h3>Source versions</h3>${o.documents.map((d) => `<p>v${d.version} ${esc(d.name)} · ${esc(d.classification)}<br><span class="hash">${d.hash}</span></p>`).join("")}<h3>Eligibility preparation</h3>${o.criteria.map((c) => `<p>${esc(c.requirement)} — ${esc(c.result)} · ${esc(c.organizationEvidence.text)}</p>`).join("")}<button id="do-print" class="primary">Print / Save as PDF</button>`,
    );
    d.querySelector("#do-print").onclick = () => {
      document.body.classList.add("printing");
      window.print();
    };
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.dataset.open) e.target.click();
});
document.addEventListener("submit", async (e) => {
  if (e.target.id === "upload") {
    e.preventDefault();
    const file = $("#pdf").files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("PDF exceeds the 10 MB limit.");
      return;
    }
    const classification = $("#classification").value;
    $("#upload-state").textContent = "Reading and validating PDF…";
    const reader = new FileReader();
    reader.onerror = () =>
      toast("File read failed. Retry with the original PDF.");
    reader.onload = () =>
      act(async () => {
        const result = await api(`/api/opportunity/${selected}/upload`, {
          name: file.name,
          classification,
          base64: String(reader.result).split(",")[1],
        });
        toast(result.message);
      });
    reader.readAsDataURL(file);
  }
  if (e.target.id === "decision") {
    e.preventDefault();
    const choice = $("#choice").value,
      rationale = $("#rationale").value;
    await act(() =>
      api(`/api/opportunity/${selected}/decision`, { choice, rationale }),
    );
    toast("Reviewer decision saved.");
  }
});
refresh().catch((e) => {
  $("#app").innerHTML =
    '<div class="content"><h1>Workspace unavailable</h1><p>' +
    esc(e.message) +
    '</p><button onclick="location.reload()">Retry</button></div>';
});
