import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAll, checkLine, checkPasted, checkDelivery, readBook, readWords, convert, quoteCsv, cells } from "./check.js";
import { sample, pasteExample } from "./samples.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const book = readBook(sample);
const one = (text, picks) => checkLine(text, 1, book, picks || {}, "paste");

test("sample: 8 of 12 lines ready, 4 held, $8,544.05 with delivery", () => {
  const r = checkAll(sample);
  assert.equal(r.lines.length, 12);
  assert.deepEqual(r.ready.map((l) => l.n), [1, 2, 3, 5, 6, 7, 10, 12]);
  assert.deepEqual(r.held.map((l) => [l.n, l.kindOfHold]), [[4, "conflict"], [8, "notfound"], [9, "price"], [11, "ambiguous"]]);
  assert.equal(r.linesTotal, 8449.05);
  assert.equal(r.delivery.amount, 95);
  assert.equal(r.total, 8544.05);
});

test("every ready line: quantity times price is the amount, and the price is on a row", () => {
  for (const l of checkAll(sample).ready) {
    assert.equal(Math.round(l.qty * l.price * 100), Math.round(l.amount * 100), `line ${l.n}`);
    assert.ok(l.srcRefs.some((r) => r.doc === "price" || r.doc === "cat"), `line ${l.n} has a price source`);
  }
});

test("the catalog reads cleanly: every row has a product and no leftover words", () => {
  for (const it of book.cat) {
    assert.ok(it.read.kind, it.desc);
    assert.deepEqual(it.read.unread, [], it.desc);
  }
  assert.equal(book.cat.length, 17);
});

test("linear feet become pieces by the item's length", () => {
  const l = checkAll(sample).lines[1];
  assert.equal(l.item.sku, "L-2612");
  assert.equal(l.qty, 100);
  assert.equal(l.rounded, false);
  assert.match(l.calc, /1,200 LF \/ 12 ft = 100 EA/);
  const up = one("500 LF 2x4 SPF #2, 8 ft");
  assert.equal(up.qty, 63);
  assert.equal(up.rounded, true);
  assert.match(up.calc, /62\.5, rounded up to 63/);
});

test("square feet become sheets, rounded up, with the working shown", () => {
  const l = checkAll(sample).lines[6];
  assert.equal(l.item.sku, "P-2332T");
  assert.equal(l.qty, 63);
  assert.equal(l.amount, 1811.25);
  assert.match(l.calc, /2,000 SF \/ 32 SF a sheet = 62\.5, rounded up to 63 SHT/);
});

test("a 3/4 subfloor is the 23/32 item, and the line says so", () => {
  const l = checkAll(sample).lines[6];
  assert.match(l.reason, /3\/4 \(sold as 23\/32\)/);
  assert.equal(one("10 sheets 1/2 drywall 4x8").item.sku, "G-1208"); // drywall keeps its true thickness
});

test("part number and words disagree: held, both choices offered, nothing picked", () => {
  const l = checkAll(sample).lines[3];
  assert.equal(l.state, "fail");
  assert.equal(l.short, "Part 4471 is the 10 ft. The line says 12 ft.");
  assert.deepEqual(l.options.map((o) => o.sku), ["L-21010", "L-21012"]);
  assert.equal(l.amount, undefined);
});

test("a rep's pick settles a held line and is recorded", () => {
  const r = checkAll(sample, { 4: { item: "L-21012" }, 11: { item: "F-D305" }, 9: { price: "list" } });
  const [l4, l9, l11] = [r.lines[3], r.lines[8], r.lines[10]];
  assert.equal(l4.ready, true);
  assert.equal(l4.amount, 3096);
  assert.equal(l4.by, "rep");
  assert.equal(l11.amount, 385);
  assert.equal(l9.price, 15.4);
  assert.equal(l9.amount, 616);
  assert.equal(l9.by, "rep");
  assert.equal(r.ready.length, 11);
  assert.equal(r.total, 12641.05);
});

test("a part number that agrees with the words passes, and settles a line the words leave open", () => {
  const ok = one("30 pcs 2x12x16 SPF #2, part 4480");
  assert.equal(ok.ready, true);
  assert.equal(ok.settled, "part");
  const unknown = one("30 pcs 2x12x16 SPF #2, part 9999");
  assert.equal(unknown.ready, false);
  assert.match(unknown.why, /^Not found: part 9999/);
});

test("box size not given: two items fit, held", () => {
  const l = checkAll(sample).lines[10];
  assert.equal(l.short, "Box size not given");
  assert.deepEqual(l.options.map((o) => o.sku), ["F-D301", "F-D305"]);
  assert.equal(one("6 boxes 3 in. deck screws 5 lb").item.sku, "F-D305");
});

test("a length the catalog does not stock is not found, and nothing is swapped in", () => {
  const l = checkAll(sample).lines[7];
  assert.equal(l.state, "none");
  assert.equal(l.short, "No 20 ft in the catalog");
  assert.match(l.why, /16 ft and 24 ft, not 20 ft/);
  assert.deepEqual(l.options, []);
});

test("a contract price past its date is held; a live one is used; no row means list", () => {
  const l = checkAll(sample).lines[8];
  assert.equal(l.kindOfHold, "price");
  assert.match(l.why, /\$13\.85 ended on Oct 31, 2026, before the quote date, Nov 17, 2026/);
  assert.equal(l.short, "Contract price ended Oct 31, 2026");
  assert.equal(checkAll(sample).lines[0].priceKind, "contract");
  const list = one("40 pcs 2x6x16 SPF #2");
  assert.equal(list.priceKind, "list, no contract price");
  assert.equal(list.amount, 536);
  const later = clone(sample);
  later.quoteDate = "2026-12-01"; // the OSB price ends 30 Nov
  assert.equal(checkAll(later).lines[5].kindOfHold, "price");
});

test("pasted lines: each comes out ready, held or not read, and none is dropped", () => {
  const out = checkPasted(pasteExample, sample);
  assert.equal(out.length, 5);
  assert.deepEqual(out.map((l) => l.ready), [true, true, false, true, false]);
  assert.equal(out[2].short, "Sheet size not given");
  assert.equal(out[4].short, "No 2x8 in the catalog");
  const junk = checkPasted("hello there\n\n40 pcs 2x6x16 SPF #2\n40 pcs 2x6x16 SPF #2\n0 pcs 2x4x8 SPF #2\n-5 pcs 2x4x8 SPF #2\n2.5 pcs 2x4x8 SPF #2", sample);
  assert.equal(junk.length, 6);
  assert.equal(junk[0].short, "Not read");
  assert.equal(junk[1].ready && junk[2].ready, true); // the same item twice is two lines, as on a real list
  assert.equal(junk[3].ready, false);
  assert.equal(junk[4].ready, false);
  assert.equal(junk[5].ready, false);
  assert.match(junk[5].why, /not a whole number/);
});

test("a word it does not know holds the line, even when the rest would match", () => {
  const l = one("40 pcs 2x6x16 SPF #2 kiln dried");
  assert.equal(l.ready, false);
  assert.equal(l.short, 'Not read: "kiln", "dried"');
  const t = one("40 pcs 2x6x16 treated");
  assert.equal(t.ready, false);
});

test("a different species, a wrong unit and a line with no product are all held", () => {
  assert.equal(one("40 pcs 2x6x16 SYP #2").short, "No SYP in the catalog");
  assert.equal(one("40 sheets 2x4x8 SPF #2").short, "Unit not settled");
  assert.equal(one("100 LF 7/16 OSB 4x8").short, "Unit not settled");
  assert.equal(one("10 rolls 2x4x8 SPF #2").short, "Unit not settled");
  assert.equal(one("12 pcs #2").short, "No product in these words");
  assert.equal(one("12 pcs 2x4 SPF #2").short, "Length not given");
});

test("delivery: added only from the email and the zone sheet", () => {
  const d = checkAll(sample).delivery;
  assert.equal(d.zone, "2");
  assert.equal(sample.mail[d.refs[1].line].slice(d.refs[1].start, d.refs[1].end), "68516");
  const pickup = clone(sample);
  pickup.mail[3] = "We will pick it up Thursday.";
  assert.equal(checkAll(pickup).delivery.asked, false);
  assert.equal(checkAll(pickup).total, 8449.05);
  const noZip = clone(sample);
  noZip.mail[3] = "Deliver to the jobsite Thursday.";
  assert.equal(checkAll(noZip).delivery.state, "none");
  assert.equal(checkAll(noZip).total, 8449.05);
  const far = clone(sample);
  far.mail[3] = "Deliver to the jobsite, ZIP 68901.";
  assert.match(checkAll(far).delivery.why, /ZIP 68901 is not on the delivery zone sheet/);
});

test("every reference points at the exact text it claims", () => {
  const r = checkAll(sample, { 4: { item: "L-21012" } });
  const all = [...r.lines, r.delivery, ...checkAll(sample).lines];
  let count = 0;
  for (const l of all) {
    for (const ref of [...l.refs, ...l.srcRefs]) {
      const text = sample[ref.doc][ref.line];
      assert.ok(text !== undefined, `line ${l.n}: ${ref.doc} ${ref.line}`);
      assert.ok(ref.start >= 0 && ref.end <= text.length && ref.end > ref.start, `line ${l.n}: range in ${ref.doc}`);
      count++;
    }
  }
  assert.ok(count > 80);
  const l1 = r.lines[0];
  assert.deepEqual(l1.refs.map((x) => sample.list[0].slice(x.start, x.end)), ["320", "pcs", "2x4", "8", "SPF", "#2"]);
  const price = l1.srcRefs.filter((x) => x.doc === "price").map((x) => sample.price[x.line].slice(x.start, x.end));
  assert.deepEqual(price, ["L-2408", "3.62", "2026-12-31"]);
  const l4 = checkAll(sample).lines[3];
  assert.deepEqual(l4.refs.map((x) => sample.list[3].slice(x.start, x.end)), ["4471", "12"]);
});

test("the export has one row per ready line, then delivery, and its amounts add up to the total", () => {
  const r = checkAll(sample);
  const rows = quoteCsv(r).trim().split("\n");
  assert.equal(rows.length, 1 + 8 + 1);
  assert.equal(rows[0], "line,customer_text,sku,description,qty,unit,unit_price,price_source,amount,settled_by");
  assert.equal(rows[1], "1,320 pcs 2x4x8 SPF #2,L-2408,2x4x8 SPF #2,320,EA,3.62,contract,1158.40,rules");
  const sum = rows.slice(1).reduce((t, row) => t + Number(row.split(",").at(-2)), 0);
  assert.equal(Math.round(sum * 100), 854405);
  assert.ok(!quoteCsv(r).includes("4471"));
});

test("cells: positions of each cell in a row", () => {
  const c = cells("L-2408 | 2x4x8 SPF #2 | EA | 3.98");
  assert.deepEqual(c.map((x) => "L-2408 | 2x4x8 SPF #2 | EA | 3.98".slice(x.start, x.end)), ["L-2408", "2x4x8 SPF #2", "EA", "3.98"]);
});

test("words: what the reader takes from a description", () => {
  const r = readWords("LVL 1-3/4 x 11-7/8 x 20 ft");
  assert.equal(r.kind, "lvl");
  assert.equal(r.attrs.section.v, "1-3/4 x 11-7/8");
  assert.equal(r.attrs.len.v, "20");
  assert.equal(readWords("3-1/4 in. x .131 framing nails, 2,500 ct").attrs.shank.v, ".131");
  assert.equal(convert(96, "sheets", book.bySku.get("P-0716")).qty, 96);
});
