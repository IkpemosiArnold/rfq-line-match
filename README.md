# Line Match

A contractor emails a building materials dealer a material list and asks for pricing. This page turns that list into quote lines, and every line points at the customer's words and at the dealer's own rows: the catalog item, the price, the delivery zone. What it cannot settle is held for a rep with the reason and the choices.

It is plain code. There is no model in it. The sample is made up.

## What it does

One request: an email and a twelve-line material list. Four tables stand in for the dealer's system: a catalog, a customer part cross-reference, the customer's price sheet and a delivery zone sheet.

A line is ready to quote only when all of these hold:

1. **It reads.** The line has a quantity, a unit and a description, and every word of the description is accounted for. A word the reader does not know holds the line, even when the rest would match.
2. **One item fits.** The words fit exactly one catalog item. If two fit, the line is held and both are offered. If none fits, the line says which word has no match and what the catalog does have. Nothing is swapped in.
3. **A part number agrees.** If the customer gives their own part number, the cross-reference has to point at the same item as the words. If they disagree, the line is held and a rep picks.
4. **The unit converts.** Pieces, sheets, rolls and boxes must match the unit the item is sold in. Linear feet become pieces by the item's length. Square feet become sheets by the sheet size. Both round up, and the sum is shown. Square feet of a tongue-and-groove panel are held: the tongue sits inside the next sheet, so a T&G sheet covers a little less than its face (47-1/2 in. is a common net width), and the catalog row does not say how much.
5. **The price is in date.** The customer's contract price is used while its valid-through date is on or after the quote date. If it has ended, the line is held with both the old price and list. If there is no contract row, list is used and labelled as list.

Delivery is added only when the email asks for it and its ZIP code is on the zone sheet.

The sample: 8 of 12 lines are ready, $8,544.05 with delivery. Four are held:

- **Line 4:** the customer's part 4471 is the 10 ft board on the cross-reference; the words on the line say 12 ft.
- **Line 8:** a 20 ft LVL. The catalog has 16 ft and 24 ft.
- **Line 9:** the customer's contract price for 1/2 OSB roof sheathing ended on Oct 31, 2026.
- **Line 11:** deck screws by the box, with no box size. The catalog has 1 lb and 5 lb.

A rep can settle a held line by picking one of the choices. The pick is recorded on the line and in the export. Ready lines are approved together and download as a generic quote import CSV. Nothing is sent from the page.

Paste your own lines into "Try your own lines". Each one comes back ready, held with the reason, or not read. No line is dropped.

## Where a model would go

Real requests arrive as emails, PDFs, spreadsheets, photos and phone calls, in every customer's own shorthand. A model would read those and propose, for each line, an item, a quantity and a unit. Here a small fixed vocabulary stands in for that step: sizes, lengths, thicknesses, species, grades and about ten product words.

The proposal would then pass through the same checks, so a rep only approves lines whose item, quantity and price already point at a source. The checks are the part that is tested: `node --test`.

## Limits

- The vocabulary is small. It reads framing lumber, precut studs, OSB, subfloor, drywall, LVL, house wrap, deck screws and framing nails, and nothing else.
- Structural panels: the trade's 3/4, 5/8 and 1/2 are read as the 23/32, 19/32 and 15/32 panels this catalog stocks. That is a rule for this catalog. A dealer who also stocks a true 3/4 panel would hold those lines instead.
- Lumber and panels are priced each. Many yards price framing lumber per thousand board feet and panels per thousand square feet. That conversion is not modelled.
- No waste factor is added. Rounding up to a whole sheet or piece is the only change to a quantity.
- There is no stock check, no lead time, no substitutions and no margin rule. A line the catalog does not have is held, not special-ordered.
- A customer part number is looked up on one cross-reference sheet. A customer quoting the dealer's own SKU from an old order is not read.
- Delivery is one flat charge by ZIP range. There is no minimum order, no free-delivery threshold and no boom truck fee.
- Tax is not worked out. Totals are before tax.
- The export is a generic CSV. It is not any ERP's import format.
- The prices are made up. The lumber, OSB, LVL, drywall and nail prices were compared with published mill and retail prices on 17 Nov 2026 and sit in a plausible range. House wrap, deck screws and the delivery charges were not checked.

## Run the tests

```
node --test
```

Needs Node 20 or later. No dependencies. 26 tests cover the sample result, the arithmetic on every ready line, both unit conversions and their rounding, square feet of a T&G panel, the panel thickness rule, the part number conflict (and a part number for a different kind of item), a rep's picks and the price shown on each choice, a stud with no length, sizes written with spaces and "ft", a missing box size, a length the catalog does not stock, a contract price past its date, pasted lines (junk, a repeat, zero, a negative, a fraction of a piece), an unknown word, a wrong species and a wrong unit, delivery, the export, and that every reference points at the exact text it claims.

## Open the page locally

```
python3 -m http.server 8781
```

Then open http://localhost:8781. The page makes no network calls beyond its own files.

## Design

The result comes first, rows are split by hairlines, and an underline draws under the exact words each figure came from. Red marks two things that disagree, amber marks what is not settled, green marks the rows a line was checked against. Geist for the tool, Newsreader for anything quoted from a source, and one navy accent.

Fonts: Geist and Newsreader (SIL Open Font License), in `fonts/`.

## Provenance

Built on 17 Nov 2026 with AI coding agents, directed by Arnold Ikpemosi Adeyemi. The dealer (Quillback Lumber), the customer (Larkfoot Framing), the SKUs, part numbers, prices and delivery zones are made up. A web search for both names on 17 Nov 2026 found no business by either name. The ZIP codes are real ones in Nebraska and stand for nothing.

## Licence

MIT. See `LICENSE`.
