// Line Match. Plain code, no model.
// A line of a customer's material list is ready to quote only when its words fit
// exactly one catalog item, its unit can be turned into the unit the item is sold
// in, and its price comes from a row that is still valid. Every step points at the
// words or the row it used. Anything else is held for a rep with the reason and
// the choices. Nothing is guessed.

export const DOC_NAMES = {
  mail: "Email", list: "Material list", cat: "Catalog",
  xref: "Part cross-reference", price: "Customer price sheet", zone: "Delivery zones",
};

export const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cents = (n) => Math.round(n * 100);
const num = (s) => Number(String(s).replace(/,/g, ""));

/** Cells of an "a | b | c" row, each with its place in the line. */
export function cells(text) {
  const out = [];
  let at = 0;
  for (const part of text.split(" | ")) {
    const lead = part.length - part.trimStart().length;
    const t = part.trim();
    out.push({ text: t, start: at + lead, end: at + lead + t.length });
    at += part.length + 3;
  }
  return out;
}

// Structural panels are sold by performance category: a "3/4" subfloor is 23/32.
const PANEL_ALIAS = { "3/4": "23/32", "1/2": "15/32", "5/8": "19/32" };
const STRUCTURAL = new Set(["osb", "subfloor"]);
const PANELS = new Set(["osb", "subfloor", "drywall"]);
const FILLER = new Set([
  "x", "in", "of", "the", "and", "a", "an", "for", "with", "lengths", "length", "long", "at",
  "box", "boxes", "ea", "each", "pcs", "pc", "pieces", "sheets", "sheet", "rolls", "roll", "our", "please",
]);
const REQUIRED = {
  lumber: ["nominal", "len"], stud: ["nominal", "len"], osb: ["thick"], subfloor: ["thick"],
  drywall: ["thick", "size"], lvl: ["section", "len"], wrap: ["size"], screw: ["flen", "pack"], nail: ["flen"],
};
export const ATTR_NAMES = {
  nominal: "size", len: "length", thick: "thickness", size: "sheet size", section: "section",
  edge: "edge", species: "species", grade: "grade", flen: "fastener length", pack: "box size", shank: "shank",
};
const KIND_NAMES = {
  lumber: "lumber", stud: "precut stud", osb: "OSB", subfloor: "subfloor", drywall: "drywall",
  lvl: "LVL", wrap: "house wrap", screw: "box of deck screws", nail: "box of framing nails",
};
// When nothing fits, the detail to name first: the one a reader thinks of as the variant.
const BLAME = ["len", "size", "pack", "thick", "flen", "shank", "edge", "grade", "species", "section", "nominal"];
const list = (a) => (a.length < 3 ? a.join(" and ") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`);
const say = (k, v) => (k === "len" && /^\d+$/.test(v) ? `${v} ft` : k === "flen" ? `${v} in.` : k === "species" ? v.toUpperCase() : v);

/**
 * Read the product words of a description. Each thing it understands is taken out
 * of the text, so nothing is read twice, and whatever is left over is reported.
 */
export function readWords(text, base = 0) {
  let work = text.toLowerCase().replace(/\u00d7/g, "x");
  const attrs = {};
  let kind = null;
  let kindRef = null;
  let part = null;
  const hit = (re, fn) => {
    const m = new RegExp(re.source, "d").exec(work);
    if (!m) return null;
    const [s, e] = m.indices[0];
    const at = (g) => ({ start: base + m.indices[g][0], end: base + m.indices[g][1] });
    if (fn) fn(m, at);
    work = work.slice(0, s) + " ".repeat(e - s) + work.slice(e);
    return m;
  };
  const set = (key, v, range, raw) => { attrs[key] = { v, ...range, ...(raw ? { raw } : {}) }; };

  hit(/\b(?:our |customer |cust )?part(?: no\.?| number)?\s*#?\s*(\d{3,6})\b/, (m, at) => { part = { v: m[1], ...at(1) }; });

  const kinds = [
    [/\blvl\b/, "lvl"], [/\bhouse ?wrap\b/, "wrap"], [/\bdeck screws?\b/, "screw"], [/\bframing nails?\b/, "nail"],
    [/\bdrywall\b|\bgypsum board\b/, "drywall"], [/\bsubfloor\b/, "subfloor"], [/\bosb\b/, "osb"],
    [/\bprecut studs?\b|\bprecuts?\b|\bstuds?\b/, "stud"],
  ];
  for (const [re, k] of kinds) {
    if (hit(re, (m, at) => { kind = k; kindRef = at(0); })) break;
  }
  if (kind === "subfloor") hit(/\bosb\b/);
  hit(/\bt&g\b|\btongue and groove\b/, (m, at) => set("edge", "T&G", at(0)));

  if (kind === "lvl") hit(/(\d-\d\/\d)\s*x\s*(\d{1,2}-\d\/\d)/, (m, at) => set("section", `${m[1]} x ${m[2]}`, at(0)));
  if (kind === "wrap") hit(/(\d{1,2})\s*(?:ft\.?|')?\s*x\s*(\d{2,3})\s*(?:ft\b\.?|')?/, (m, at) => set("size", `${m[1]} ft x ${m[2]} ft`, at(0)));
  hit(/92-5\/8/, (m, at) => set("len", "92-5/8 in.", at(0)));
  if (PANELS.has(kind)) {
    hit(/\b4\s*x\s*(8|9|10|12)\b/, (m, at) => set("size", `4x${m[1]}`, at(0)));
  } else if (kind === null || kind === "stud") {
    hit(/\b([246])\s*x\s*(\d{1,2})(?:\s*x\s*(\d{1,2})\b(?:\s*(?:ft\b\.?|foot\b|'))?)?/, (m, at) => {
      set("nominal", `${m[1]}x${m[2]}`, { start: at(1).start, end: at(2).end });
      if (m[3] && !attrs.len) set("len", m[3], at(3));
    });
  }
  if (kind === "screw" || kind === "nail") {
    hit(/\b(\d(?:-\d\/\d)?)\s*(?:in\b\.?|inch(?:es)?\b|")/, (m, at) => set("flen", m[1], at(1))) ||
      hit(/\b(\d-\d\/\d)(?![\d/])/, (m, at) => set("flen", m[1], at(1)));
    hit(/(?<![\d.])(\.\d{3})\b/, (m, at) => set("shank", m[1], at(1)));
    hit(/\b(\d{1,2})\s*lb\b/, (m, at) => set("pack", `${m[1]} lb`, at(0)));
    hit(/\b(\d{1,3}(?:,\d{3})*)\s*ct\b/, (m, at) => set("pack", `${m[1]} ct`, at(0)));
  }
  if (!attrs.len) hit(/\b(\d{1,2})\s*(?:ft\b\.?|foot\b|footers?\b|')(?:\s*lengths?\b)?/, (m, at) => set("len", m[1], at(1)));
  if (PANELS.has(kind)) {
    hit(/\b(\d{1,2}\/\d{1,2})\b/, (m, at) => {
      const alias = STRUCTURAL.has(kind) ? PANEL_ALIAS[m[1]] : null;
      set("thick", alias || m[1], at(1), alias ? m[1] : null);
    });
  }
  hit(/\b(spf|syp|df)\b/, (m, at) => set("species", m[1], at(1)));
  hit(/#\s?([123])\b/, (m, at) => set("grade", `#${m[1]}`, at(0)));
  if (!kind && attrs.nominal) kind = "lumber";

  const unread = [];
  for (const m of work.matchAll(/[^\s,;:()\u00b7]+/g)) {
    const w = m[0].replace(/^[.'"-]+|[.'"-]+$/g, "");
    if (!w || FILLER.has(w)) continue;
    unread.push({ text: text.slice(m.index, m.index + m[0].length), start: base + m.index, end: base + m.index + m[0].length });
  }
  return { kind, kindRef, attrs, part, unread };
}

const UNITS = {
  pc: "pcs", pcs: "pcs", pieces: "pcs", ea: "pcs", each: "pcs", sheet: "sheets", sheets: "sheets", sht: "sheets",
  roll: "rolls", rolls: "rolls", box: "boxes", boxes: "boxes", bx: "boxes", lf: "LF", sf: "SF",
};
const SOLD_AS = { pcs: ["EA", "SHT"], sheets: ["SHT"], rolls: ["ROLL"], boxes: ["BX"] };
const LINE_RE = /^\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(pcs?|pieces|ea|each|sheets?|sht|rolls?|boxes|box|bx|lf|sf)\b\.?\s+(\S.*)$/id;

/** The dealer's own tables, read once. */
export function readBook(src) {
  const table = (doc) => (src[doc] || []).slice(1).map((text, i) => ({ line: i + 1, c: cells(text), text }));
  const ref = (doc, row, i) => ({ doc, line: row.line, start: row.c[i].start, end: row.c[i].end });
  const cat = table("cat").filter((r) => r.c.length >= 4).map((r) => {
    const read = readWords(r.c[1].text, r.c[1].start);
    return {
      sku: r.c[0].text, desc: r.c[1].text, unit: r.c[2].text, list: num(r.c[3].text), line: r.line, read,
      skuRef: ref("cat", r, 0), descRef: ref("cat", r, 1), unitRef: ref("cat", r, 2), listRef: ref("cat", r, 3),
    };
  });
  const xref = table("xref").filter((r) => r.c.length >= 2).map((r) => ({ part: r.c[0].text, sku: r.c[1].text, partRef: ref("xref", r, 0), skuRef: ref("xref", r, 1) }));
  const price = table("price").filter((r) => r.c.length >= 3).map((r) => ({
    sku: r.c[0].text, amount: num(r.c[1].text), until: r.c[2].text,
    skuRef: ref("price", r, 0), amountRef: ref("price", r, 1), untilRef: ref("price", r, 2),
  }));
  const zone = table("zone").filter((r) => r.c.length >= 3).map((r) => {
    const m = /^(\d{5})-(\d{5})$/.exec(r.c[1].text);
    return { zone: r.c[0].text, from: m ? m[1] : null, to: m ? m[2] : null, charge: num(r.c[2].text), zoneRef: ref("zone", r, 0), zipRef: ref("zone", r, 1), chargeRef: ref("zone", r, 2) };
  });
  return { cat, xref, price, zone, quoteDate: src.quoteDate, bySku: new Map(cat.map((it) => [it.sku, it])) };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** 2026-10-31 as Oct 31, 2026. Anything else is shown as written. */
export const day = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m && MONTHS[Number(m[2]) - 1] ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : iso;
};

const lref = (doc, line, r) => ({ doc, line, start: r.start, end: r.end });
const attrRefs = (doc, line, read, keys) => {
  const out = [];
  if (read.kindRef) out.push(lref(doc, line, read.kindRef));
  for (const k of keys || Object.keys(read.attrs)) if (read.attrs[k]) out.push(lref(doc, line, read.attrs[k]));
  return out;
};
const fits = (it, read, skip) =>
  it.read.kind === read.kind && Object.keys(read.attrs).every((k) => k === skip || (it.read.attrs[k] && it.read.attrs[k].v === read.attrs[k].v));

/** Turn the unit the customer used into the unit the item is sold in. */
export function convert(qty, unit, item) {
  const a = item.read.attrs;
  if (SOLD_AS[unit]) {
    if (!SOLD_AS[unit].includes(item.unit)) return { ok: false, why: `Asked for in ${unit}; this item is sold by the ${item.unit}.` };
    if (!Number.isInteger(qty)) return { ok: false, why: `${qty} ${unit} is not a whole number.` };
    return { ok: true, qty, calc: null, rounded: false };
  }
  if (unit === "LF") {
    const len = a.len && /^\d+$/.test(a.len.v) ? Number(a.len.v) : null;
    if (!len || item.unit !== "EA") return { ok: false, why: `Asked for in linear feet; this item is sold by the ${item.unit} with no length in feet.` };
    const exact = qty / len;
    const q = Math.ceil(exact - 1e-9);
    const rounded = Math.abs(exact - q) > 1e-9;
    return { ok: true, qty: q, rounded, calc: `${fmtQty(qty)} LF / ${len} ft = ${rounded ? `${trim(exact)}, rounded up to ${q}` : q} ${item.unit}` };
  }
  if (unit === "SF") {
    const m = a.size && /^(\d+)x(\d+)$/.exec(a.size.v);
    if (a.edge) return { ok: false, why: `Asked for in square feet; a ${a.edge.v} sheet covers a little less than its ${a.size ? a.size.v : "nominal"} face, and this catalog row does not give the net width.` };
    if (!m || item.unit !== "SHT") return { ok: false, why: `Asked for in square feet; this item is sold by the ${item.unit} with no sheet size.` };
    const area = Number(m[1]) * Number(m[2]);
    const exact = qty / area;
    const q = Math.ceil(exact - 1e-9);
    const rounded = Math.abs(exact - q) > 1e-9;
    return { ok: true, qty: q, rounded, calc: `${fmtQty(qty)} SF / ${area} SF a sheet = ${rounded ? `${trim(exact)}, rounded up to ${q}` : q} ${item.unit}` };
  }
  return { ok: false, why: `Unit "${unit}" is not read.` };
}
const fmtQty = (n) => n.toLocaleString("en-US");
const trim = (n) => String(Math.round(n * 100) / 100);

/**
 * Check one line of the list. `picks` holds what a rep has already decided for
 * this line: { item: "SKU", price: "list" | "contract" }.
 */
export function checkLine(text, n, book, picks = {}, doc = "list") {
  const line = n - 1;
  const whole = { doc, line, start: 0, end: text.length };
  const base = { n, text, doc, state: "none", ready: false, options: [], refs: [], srcRefs: [], by: null };
  const hold = (state, short, why, extra = {}) => ({ ...base, state, short, why, ...extra });

  const m = LINE_RE.exec(text);
  if (!m) return hold("none", "Not read", `Not read: "${text.trim()}". A line needs a quantity, a unit and a description.`, { refs: [whole], kindOfHold: "unread" });
  const qtyAsked = num(m[1]);
  const unit = UNITS[m[2].toLowerCase()];
  const qRef = { doc, line, start: m.indices[1][0], end: m.indices[1][1] };
  const uRef = { doc, line, start: m.indices[2][0], end: m.indices[2][1] };
  const read = readWords(m[3], m.indices[3][0]);
  const asked = { qtyAsked, unit, qRef, uRef, read };
  if (!(qtyAsked > 0)) return hold("none", "Quantity is not above zero", `The quantity reads as ${m[1]}.`, { ...asked, refs: [qRef], kindOfHold: "unread" });
  if (read.unread.length) {
    const words = read.unread.map((u) => `"${u.text}"`).join(", ");
    return hold("none", `Not read: ${words}`, `Not read: ${words}. The rest of the line is not matched until every word is accounted for.`, { ...asked, refs: read.unread.map((u) => lref(doc, line, u)), kindOfHold: "unread" });
  }
  if (!read.kind) return hold("none", "No product in these words", "Not found: the description names no product this reader knows.", { ...asked, refs: [whole], kindOfHold: "notfound" });

  const wordRefs = attrRefs(doc, line, read);
  const cands = book.cat.filter((it) => fits(it, read));
  const missing = (REQUIRED[read.kind] || []).filter((k) => !read.attrs[k]);
  let viaPart = null;
  if (read.part) {
    const x = book.xref.find((r) => r.part === read.part.v);
    if (!x || !book.bySku.has(x.sku)) {
      return hold("none", `Part ${read.part.v} is not on the cross-reference`, `Not found: part ${read.part.v} is not on this customer's cross-reference.`, { ...asked, refs: [lref(doc, line, read.part)], kindOfHold: "notfound" });
    }
    viaPart = { x, item: book.bySku.get(x.sku) };
  }

  let item = null;
  let settled = null; // how the item was settled, for the reader
  const applies = (it) => {
    const r = book.price.find((p) => p.sku === it.sku);
    return r && r.until >= book.quoteDate ? `$${fmt(r.amount)} contract` : `$${fmt(it.list)} list`;
  };
  const opt = (it, label) => ({ kind: "item", sku: it.sku, label: label || it.desc, note: `${it.sku}, ${it.unit} at ${applies(it)}` });
  if (picks.item && book.bySku.has(picks.item)) {
    item = book.bySku.get(picks.item);
    settled = "rep";
  } else if (viaPart && cands.length === 1 && cands[0].sku !== viaPart.item.sku) {
    const other = viaPart.item;
    const diff = Object.keys(read.attrs).filter((k) => !other.read.attrs[k] || other.read.attrs[k].v !== read.attrs[k].v);
    const said = diff.map((k) => say(k, read.attrs[k].v)).join(", ");
    const is = diff.map((k) => (other.read.attrs[k] ? say(k, other.read.attrs[k].v) : "none")).join(", ");
    const alike = other.read.kind === read.kind && diff.length > 0 && diff.every((k) => other.read.attrs[k]);
    return hold("fail", alike ? `Part ${read.part.v} is the ${is}. The line says ${said}.` : `Part ${read.part.v} is ${other.desc}. The line says ${cands[0].desc}.`,
      `Part ${read.part.v} is ${other.desc} (${other.sku}) on the cross-reference. The words on the line ${alike ? `say ${said}, which is` : "are"} ${cands[0].desc} (${cands[0].sku}). One of the two is wrong.`,
      {
        ...asked, kindOfHold: "conflict",
        refs: [lref(doc, line, read.part), ...diff.map((k) => lref(doc, line, read.attrs[k]))],
        srcRefs: [viaPart.x.partRef, viaPart.x.skuRef, other.skuRef, ...attrRefs("cat", other.line, other.read, diff), cands[0].skuRef, ...attrRefs("cat", cands[0].line, cands[0].read, diff)],
        options: [opt(other, `${other.desc}, as part ${read.part.v}`), opt(cands[0], `${cands[0].desc}, as written`)],
      });
  } else if (viaPart && cands.some((c) => c.sku === viaPart.item.sku)) {
    item = viaPart.item;
    settled = "part";
  } else if (viaPart && cands.length === 0) {
    return hold("fail", `Part ${read.part.v} is ${viaPart.item.desc}. The words fit nothing.`,
      `Part ${read.part.v} is ${viaPart.item.desc} (${viaPart.item.sku}) on the cross-reference, but the words on the line fit no catalog item.`,
      { ...asked, kindOfHold: "conflict", refs: [lref(doc, line, read.part), ...wordRefs], srcRefs: [viaPart.x.partRef, viaPart.x.skuRef, viaPart.item.skuRef, viaPart.item.descRef], options: [opt(viaPart.item, `${viaPart.item.desc}, as part ${read.part.v}`)] });
  } else if (cands.length === 0) {
    // Say which word has no match, if dropping one word finds something.
    let why = `Not found: no ${KIND_NAMES[read.kind]} in the catalog fits these words.`;
    let short = "Not in the catalog";
    let near = [];
    let bad = [];
    for (const k of BLAME.filter((b) => read.attrs[b])) {
      const loose = book.cat.filter((it) => fits(it, read, k) && it.read.attrs[k]);
      if (!loose.length) continue;
      const has = [...new Set(loose.map((it) => say(k, it.read.attrs[k].v)))];
      const asked = read.attrs[k].raw ? `${read.attrs[k].raw} (${read.attrs[k].v})` : say(k, read.attrs[k].v);
      short = `Catalog has ${list(has)}, not ${asked}`;
      why = `Not found: the catalog has this in ${list(has)}, not ${asked}. Nothing is swapped in.`;
      near = loose;
      bad = [k];
      break;
    }
    return hold("none", short, why, {
      ...asked, kindOfHold: "notfound",
      refs: bad.length ? bad.map((k) => lref(doc, line, read.attrs[k])) : wordRefs,
      srcRefs: near.flatMap((it) => [it.skuRef, ...attrRefs("cat", it.line, it.read, bad)]),
    });
  } else if (cands.length > 1 || missing.length) {
    const differ = Object.keys(ATTR_NAMES).filter((k) => new Set(cands.map((c) => (c.read.attrs[k] ? c.read.attrs[k].v : ""))).size > 1);
    const key = missing[0] || differ[0];
    const has = [...new Set(cands.map((c) => (c.read.attrs[key] ? say(key, c.read.attrs[key].v) : null)).filter(Boolean))];
    const name = (key === "size" && read.kind === "wrap" ? "roll size" : ATTR_NAMES[key]) || "detail";
    return hold("none", `${name.charAt(0).toUpperCase() + name.slice(1)} not given`,
      `Not settled: the line does not give the ${name}. ${cands.length > 1 ? `${cands.length} catalog items fit: ${has.join(" and ")}.` : `The catalog has ${has.join(" and ") || "one item that may fit"}.`}`,
      {
        ...asked, kindOfHold: "ambiguous", refs: wordRefs,
        srcRefs: cands.flatMap((c) => [c.skuRef, ...(c.read.attrs[key] ? [lref("cat", c.line, c.read.attrs[key])] : [c.descRef])]),
        options: cands.map((c) => opt(c)),
      });
  } else {
    item = cands[0];
    settled = "words";
  }

  // The unit.
  const conv = convert(qtyAsked, unit, item);
  const itemRefs = [item.skuRef, ...(settled === "words" || settled === "part" ? attrRefs("cat", item.line, item.read, Object.keys(read.attrs)) : [item.descRef]), item.unitRef];
  if (!conv.ok) return hold("none", "Unit not settled", `Not settled: ${conv.why}`, { ...asked, item, settled, kindOfHold: "unit", refs: [qRef, uRef], srcRefs: [item.skuRef, item.unitRef] });

  // The price.
  const row = book.price.find((p) => p.sku === item.sku);
  let price; let priceKind; let priceRefs;
  if (row && row.until >= book.quoteDate) {
    price = row.amount; priceKind = "contract"; priceRefs = [row.skuRef, row.amountRef, row.untilRef];
  } else if (row && picks.price === "contract") {
    price = row.amount; priceKind = "contract price, ended, kept by a rep"; priceRefs = [row.skuRef, row.amountRef, row.untilRef];
  } else if (row && picks.price === "list") {
    price = item.list; priceKind = "list, picked by a rep"; priceRefs = [item.listRef];
  } else if (row) {
    return hold("none", `Contract price ended ${day(row.until)}`,
      `Not settled: this customer's contract price of $${fmt(row.amount)} ended on ${day(row.until)}, before the quote date, ${day(book.quoteDate)}. List is $${fmt(item.list)}.`,
      {
        ...asked, item, settled, kindOfHold: "price", refs: [...(settled === "rep" ? [] : wordRefs)],
        srcRefs: [item.skuRef, item.listRef, row.skuRef, row.amountRef, { ...row.untilRef, tone: "fail" }],
        options: [
          { kind: "price", price: "list", label: `List, $${fmt(item.list)}`, note: "Catalog list price" },
          { kind: "price", price: "contract", label: `Old contract price, $${fmt(row.amount)}`, note: `Ended ${day(row.until)}` },
        ],
      });
  } else {
    price = item.list; priceKind = "list, no contract price"; priceRefs = [item.listRef];
  }

  const amount = cents(conv.qty * price) / 100;
  const on = Object.keys(read.attrs).map((k) => (read.attrs[k].raw ? `${read.attrs[k].raw} (sold as ${read.attrs[k].v})` : say(k, read.attrs[k].v)));
  const reason = settled === "rep" ? "Item picked by a rep"
    : settled === "part" ? `Part ${read.part.v} on the cross-reference, and the words agree`
      : `The only ${KIND_NAMES[read.kind]} that fits: ${on.join(", ")}`;
  return {
    ...base, ...asked, state: "pass", ready: true, item, settled, reason,
    by: settled === "rep" || /rep/.test(priceKind) ? "rep" : null,
    qty: conv.qty, calc: conv.calc, rounded: conv.rounded, price, priceKind, amount,
    refs: [qRef, uRef, ...(settled === "rep" ? [] : wordRefs), ...(settled === "part" ? [lref(doc, line, read.part)] : [])],
    srcRefs: [...(settled === "part" ? [viaPart.x.partRef, viaPart.x.skuRef] : []), ...itemRefs, ...priceRefs],
    short: `${item.sku}, ${fmtQty(conv.qty)} ${item.unit} at $${fmt(price)}`,
  };
}

/** Delivery, only if the email asks for it and the ZIP is on the zone sheet. */
export function checkDelivery(mail, book) {
  const lines = mail || [];
  const i = lines.findIndex((t) => /\bdeliver/i.test(t));
  if (i < 0) return { asked: false, state: "pass", amount: 0, refs: [], srcRefs: [], short: "No delivery asked for" };
  const word = /\bdeliver\w*/id.exec(lines[i]);
  const askRef = { doc: "mail", line: i, start: word.indices[0][0], end: word.indices[0][1] };
  let zipRef = null; let zip = null;
  for (const j of [i, ...lines.keys()]) {
    const z = /\b(\d{5})\b/d.exec(lines[j]);
    if (z) { zip = z[1]; zipRef = { doc: "mail", line: j, start: z.indices[1][0], end: z.indices[1][1] }; break; }
  }
  if (!zip) return { asked: true, state: "none", ready: false, amount: 0, refs: [askRef], srcRefs: [], short: "Delivery asked for, no ZIP in the email", why: "Not found: the email asks for delivery but gives no ZIP code, so no charge is added and none is guessed." };
  const z = book.zone.find((r) => r.from && zip >= r.from && zip <= r.to);
  if (!z) return { asked: true, state: "none", ready: false, amount: 0, zip, refs: [askRef, zipRef], srcRefs: [], short: `ZIP ${zip} is not on the zone sheet`, why: `Not found: ZIP ${zip} is not on the delivery zone sheet. No charge is guessed.` };
  return {
    asked: true, state: "pass", ready: true, amount: z.charge, zip, zone: z.zone,
    refs: [askRef, zipRef], srcRefs: [z.zoneRef, z.zipRef, z.chargeRef],
    short: `Zone ${z.zone}, ZIP ${zip}, $${fmt(z.charge)}`,
  };
}

/** The whole request. `picks` is { [lineNumber]: { item, price } }. */
export function checkAll(src, picks = {}) {
  const book = readBook(src);
  const lines = (src.list || []).map((t, i) => checkLine(t, i + 1, book, picks[i + 1] || {}));
  const delivery = checkDelivery(src.mail, book);
  const ready = lines.filter((l) => l.ready);
  const held = lines.filter((l) => !l.ready);
  const linesTotal = cents(ready.reduce((t, l) => t + l.amount, 0)) / 100;
  return { book, lines, ready, held, delivery, linesTotal, total: cents(linesTotal + (delivery.ready ? delivery.amount : 0)) / 100 };
}

/** Pasted lines, one per row, checked against the same catalog. Blank rows are skipped and nothing else is. */
export function checkPasted(text, src) {
  const book = readBook(src);
  const rows = String(text || "").split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
  return rows.map((t, i) => checkLine(t, i + 1, book, {}, "paste"));
}

const q = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));

/** A generic quote import file: one row per ready line, then delivery. */
export function quoteCsv(result) {
  const rows = [["line", "customer_text", "sku", "description", "qty", "unit", "unit_price", "price_source", "amount", "settled_by"]];
  for (const l of result.ready) {
    rows.push([l.n, l.text, l.item.sku, l.item.desc, l.qty, l.item.unit, l.price.toFixed(2), l.priceKind, l.amount.toFixed(2), l.by === "rep" ? "rep" : "rules"]);
  }
  if (result.delivery.ready && result.delivery.asked) {
    rows.push(["", "Delivery", "DELIVERY", `Zone ${result.delivery.zone}, ZIP ${result.delivery.zip}`, 1, "EA", result.delivery.amount.toFixed(2), "zone sheet", result.delivery.amount.toFixed(2), "rules"]);
  }
  return rows.map((r) => r.map(q).join(",")).join("\n") + "\n";
}
