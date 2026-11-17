import { checkAll, checkPasted, quoteCsv, fmt, DOC_NAMES } from "./check.js?v=1";
import { sample, pasteExample } from "./samples.js?v=1";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const icon = (name) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
};
const glyph = { pass: "check", fail: "cross", none: "none" };
const wide = window.matchMedia("(min-width: 960px)");
const usd = (n) => `$${fmt(n)}`;
const statusWord = (l) => (l.state === "pass" ? "Ready" : l.kindOfHold === "notfound" ? "Not found" : l.kindOfHold === "unread" ? "Not read" : "Held");

let picks = {};
let approved = false;
let openId = null;
let firstRender = true;
let pasted = [];
let pastedOpen = null;

/** One source line with the referenced ranges underlined in place. */
function markedLine(text, ranges) {
  const frag = document.createDocumentFragment();
  let at = 0;
  for (const r of [...ranges].sort((a, b) => a.start - b.start)) {
    if (r.start < at) continue;
    frag.append(text.slice(at, r.start), el("span", `u ${r.tone}`, text.slice(r.start, r.end)));
    at = r.end;
  }
  frag.append(text.slice(at));
  return frag;
}

/** The lines a check looked at, grouped by source line, in a fixed order. */
function sources(docs, refs, tone) {
  const box = el("div", "srcs");
  const by = new Map();
  for (const r of refs) {
    if (!(r.end > r.start)) continue;
    const k = `${r.doc}:${r.line}`;
    if (!by.has(k)) by.set(k, { doc: r.doc, line: r.line, ranges: [] });
    by.get(k).ranges.push({ start: r.start, end: r.end, tone: r.tone || tone });
  }
  const order = ["mail", "list", "paste", "xref", "cat", "price", "zone"];
  for (const s of [...by.values()].sort((a, b) => order.indexOf(a.doc) - order.indexOf(b.doc) || a.line - b.line)) {
    const f = el("div", "src");
    const isTable = ["cat", "xref", "price", "zone"].includes(s.doc);
    f.append(el("p", "src-h", `${DOC_NAMES[s.doc] || "Your lines"}, ${isTable ? "row" : "line"} ${isTable ? s.line : s.line + 1}`));
    const p = el("p", "src-line");
    p.append(markedLine(docs[s.doc][s.line], s.ranges));
    f.append(p);
    box.append(f);
  }
  return box;
}

function draw(node) {
  requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add("drawn")));
}

function calcRows(pairs) {
  const dl = el("dl", "calc");
  for (const [l, v, strong] of pairs) {
    const r = el("div", `cl-row${strong ? " strong" : ""}`);
    r.append(el("dt", "cl-l", l), el("dd", "cl-v", v));
    dl.append(r);
  }
  return dl;
}

function detail(l, docs, { own = false } = {}) {
  const box = el("div", "evidence");
  const isDelivery = l.n === "delivery";
  box.append(el("p", "side-h", isDelivery ? "Delivery" : own ? `Your line ${l.n}` : `Material list, line ${l.n}`));
  box.append(el("p", `side-title st-${l.state}`, l.ready ? `Ready, ${usd(l.amount)}` : l.kindOfHold === "notfound" ? "Not found" : l.kindOfHold === "unread" ? "Not read" : "Held for a rep"));

  if (!l.ready) {
    const why = el("p", "reason");
    const g = icon(glyph[l.state]);
    g.style.color = `var(--${l.state})`;
    why.append(g, el("span", null, l.why));
    box.append(why);
  }

  box.append(el("p", "ev-h", isDelivery ? "What the email says" : "What the customer wrote"));
  const asked = sources(docs, l.refs, l.state);
  box.append(asked);

  if (l.ready && !isDelivery) {
    box.append(el("p", "ev-h", "The quote line"));
    box.append(calcRows([
      ["Item", `${l.item.sku}, ${l.item.desc}`],
      ["Why this item", l.reason],
      ["Quantity", l.calc || `${l.qty.toLocaleString("en-US")} ${l.item.unit}, as asked`],
      ["Unit price", `${usd(l.price)} (${l.priceKind})`],
      ["Amount", `${l.qty.toLocaleString("en-US")} x ${usd(l.price)} = ${usd(l.amount)}`, true],
    ]));
  }
  if (l.ready && isDelivery) {
    box.append(el("p", "ev-h", "The quote line"));
    box.append(calcRows([["Charge", `Zone ${l.zone}, ZIP ${l.zip}`], ["Amount", usd(l.amount), true]]));
  }

  if (l.srcRefs.length) {
    box.append(el("p", "ev-h", l.ready ? "The rows it used" : "The rows it looked at"));
    box.append(sources(docs, l.srcRefs, "pass"));
  }

  if (!l.ready && l.options.length && !own) {
    box.append(el("p", "ev-h", "A rep decides"));
    const ch = el("div", "choices");
    for (const o of l.options) {
      const b = el("button", "btn");
      b.type = "button";
      b.append(el("span", null, o.label), el("small", null, o.note));
      b.addEventListener("click", () => {
        picks[l.n] = { ...(picks[l.n] || {}), ...(o.kind === "item" ? { item: o.sku } : { price: o.price }) };
        approved = false;
        render({ keep: true });
      });
      ch.append(b);
    }
    box.append(ch);
  }
  if (!l.ready && l.kindOfHold === "notfound" && l.srcRefs.length && !own) {
    box.append(el("p", "tool-sub", "A rep would special-order this or offer what the catalog has. The page does neither."));
  }
  if (!l.ready && l.options.length && own) {
    box.append(el("p", "ev-h", "What a rep would choose from"));
    box.append(el("p", "tool-sub", l.options.map((o) => o.label).join(", or ")));
  }
  if (l.ready && l.by === "rep" && !own) {
    const p = el("p", "picked");
    p.append(icon("check"), "Settled by a rep");
    const undo = el("button", "btn text", "Undo");
    undo.type = "button";
    undo.addEventListener("click", () => {
      delete picks[l.n];
      approved = false;
      render({ keep: true });
    });
    box.append(p, undo);
  }
  draw(box);
  return box;
}

function row(l, docs, { own = false, isOpen, onToggle }) {
  const item = el("div", "row-item");
  item.dataset.id = String(l.n);
  const b = el("button", "row");
  b.type = "button";
  b.setAttribute("aria-expanded", String(isOpen));
  const s = el("span", `status st-${l.state}`);
  s.append(icon(glyph[l.state]), el("span", null, statusWord(l)));
  const v = el("span", "val");
  v.append(el("b", null, l.n === "delivery" ? "Delivery" : l.text));
  v.append(el("span", `meta${l.ready ? "" : ` st-${l.state}`}`, l.ready ? `${l.short}${l.n === "delivery" ? "" : ` = ${usd(l.amount)}`}${l.by === "rep" ? ", settled by a rep" : ""}` : l.short));
  const chev = icon("chev");
  chev.classList.add("chev");
  b.append(s, v, chev);
  item.append(b);
  b.addEventListener("click", onToggle);
  if (isOpen && (own || !wide.matches)) {
    const d = detail(l, docs, { own });
    d.classList.add("enter");
    item.append(d);
  }
  return item;
}

function scrollTo(scope, id) {
  const n = scope.querySelector(`.row-item[data-id="${id}"]`);
  if (!n) return;
  const top = n.getBoundingClientRect().top;
  if (top < 0 || top > innerHeight * 0.6) n.scrollIntoView({ block: "start", behavior: "smooth" });
}

function render({ keep = false } = {}) {
  const r = checkAll(sample, picks);
  const d = { ...r.delivery, n: "delivery", options: [], ready: !!r.delivery.ready };
  const sum = $("summary");
  sum.replaceChildren(
    el("span", "sum-main", `${r.ready.length} of ${r.lines.length} lines ready`),
    el("span", "sum-side", `${usd(r.total)}${d.ready && d.asked ? " with delivery" : ""}`),
    el("span", "sum-side muted", r.held.length ? `${r.held.length} held for a rep` : "nothing held"),
  );
  const ready = [...r.ready, ...(d.asked && d.ready ? [d] : [])];
  const held = [...r.held, ...(d.asked && !d.ready ? [d] : [])];
  const all = [...held, ...ready];
  const groups = $("groups");
  groups.replaceChildren();
  for (const [title, list] of [["Held for a rep", held], ["Ready to quote", ready]]) {
    if (!list.length) continue;
    const withDelivery = list.some((l) => l.n === "delivery");
    const count = list.length - (withDelivery ? 1 : 0);
    groups.append(el("p", "group-h", `${title} (${count}${withDelivery ? ` line${count === 1 ? "" : "s"} and delivery` : ""})`));
    const rows = el("div", "rows");
    if (!firstRender && !keep) rows.classList.add("fresh");
    for (const l of list) {
      rows.append(row(l, sample, {
        isOpen: openId === l.n,
        onToggle: () => {
          openId = openId === l.n && !wide.matches ? null : l.n;
          render({ keep: true });
          if (!wide.matches && openId != null) scrollTo(groups, l.n);
        },
      }));
    }
    groups.append(rows);
  }
  const side = $("side");
  side.replaceChildren();
  if (wide.matches) {
    let l = all.find((x) => x.n === openId);
    if (!l) {
      l = all[0];
      openId = l.n;
      groups.querySelector(`.row-item[data-id="${l.n}"] .row`)?.setAttribute("aria-expanded", "true");
    }
    const box = detail(l, sample);
    box.classList.add("enter");
    side.append(box);
  }
  const n = r.ready.length;
  $("quote-sub").textContent = approved
    ? `Approved: ${n} line${n === 1 ? "" : "s"}${d.ready && d.asked ? " and delivery" : ""}, ${usd(r.total)} before tax. The file is a generic CSV. Nothing is sent from here.`
    : `${n} line${n === 1 ? "" : "s"}${d.ready && d.asked ? " and delivery" : ""}, ${usd(r.total)} before tax. ${r.held.length ? `${r.held.length} held line${r.held.length === 1 ? " stays" : "s stay"} off the quote until a rep settles ${r.held.length === 1 ? "it" : "them"}.` : "Nothing is held."}`;
  $("approve").disabled = approved || !n;
  $("approve").textContent = approved ? "Approved" : `Approve ${n} ready line${n === 1 ? "" : "s"}`;
  $("dl").disabled = !approved;
  firstRender = false;
}

function renderPasted() {
  const out = $("own-out");
  out.replaceChildren();
  if (!pasted.length) return;
  const docs = { ...sample, paste: pasted.map((l) => l.text) };
  const ok = pasted.filter((l) => l.ready);
  out.append(el("p", "group-h", `${ok.length} of ${pasted.length} ready${ok.length ? `, ${usd(ok.reduce((t, l) => t + Math.round(l.amount * 100), 0) / 100)}` : ""}. Tap a line for its source.`));
  const rows = el("div", "rows");
  for (const l of pasted) {
    rows.append(row(l, docs, {
      own: true,
      isOpen: pastedOpen === l.n,
      onToggle: () => {
        pastedOpen = pastedOpen === l.n ? null : l.n;
        renderPasted();
      },
    }));
  }
  out.append(rows);
}

function renderSources() {
  const out = $("src-out");
  out.replaceChildren();
  const box = el("div", "docs");
  for (const d of ["mail", "list", "cat", "xref", "price", "zone"]) {
    const doc = el("div", "doc");
    doc.append(el("p", "doc-h", DOC_NAMES[d]));
    const body = el("div", "doc-body");
    const isTable = ["cat", "xref", "price", "zone"].includes(d);
    sample[d].forEach((text, i) => {
      const p = el("p");
      p.append(el("span", "ln", isTable ? (i === 0 ? "" : String(i)) : String(i + 1)), el("span", null, text));
      body.append(p);
    });
    doc.append(body);
    box.append(doc);
  }
  out.append(box);
}

$("why-btn").addEventListener("click", () => {
  const c = $("chain");
  c.hidden = !c.hidden;
  $("why-btn").setAttribute("aria-expanded", String(!c.hidden));
});

$("approve").addEventListener("click", () => {
  approved = true;
  render({ keep: true });
});

$("dl").addEventListener("click", () => {
  const csv = quoteCsv(checkAll(sample, picks));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "quote-import-sample.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

$("reset").addEventListener("click", () => {
  picks = {};
  approved = false;
  openId = null;
  render();
});

$("own-sample").addEventListener("click", () => {
  $("own-in").value = pasteExample;
  $("own-check").click();
});

$("own-check").addEventListener("click", () => {
  const err = $("own-error");
  err.hidden = true;
  const text = $("own-in").value;
  if (!text.trim()) {
    pasted = [];
    renderPasted();
    err.textContent = "Nothing to check yet. Paste a line such as: 40 pcs 2x6x16 SPF #2";
    err.hidden = false;
    return;
  }
  pasted = checkPasted(text, sample);
  pastedOpen = (pasted.find((l) => !l.ready) || pasted[0]).n;
  renderPasted();
});

$("src-btn").addEventListener("click", () => {
  const out = $("src-out");
  out.hidden = !out.hidden;
  $("src-btn").setAttribute("aria-expanded", String(!out.hidden));
  $("src-btn").textContent = out.hidden ? "Show them" : "Hide them";
  if (!out.hidden && !out.childElementCount) renderSources();
});

wide.addEventListener("change", () => render({ keep: true }));
render();
