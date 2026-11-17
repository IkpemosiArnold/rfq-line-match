// Sample data. A made-up building materials dealer (Quillback Lumber), a made-up
// customer (Larkfoot Framing) and a made-up request. SKUs, part numbers, prices
// and delivery zones are invented. Every source is kept as lines of text, the way
// a reader would pull them out of an email, a spreadsheet or an ERP export.
// Table rows use " | " between cells.

export const QUOTE_DATE = "2026-11-17";

export const sample = {
  quoteDate: QUOTE_DATE,
  mail: [
    "From: Marit, Larkfoot Framing",
    "Subject: Lot 14 framing package, need pricing",
    "Morning. Can you price the attached list for Lot 14?",
    "Deliver to the jobsite, ZIP 68516, Thursday if the truck is free.",
    "Thanks, Marit",
    "Attachment: Lot 14 material list.xlsx",
  ],
  list: [
    "320 pcs 2x4x8 SPF #2",
    "1,200 LF 2x6 SPF #2, 12 ft lengths",
    "140 pcs 2x4 precut studs 92-5/8",
    "180 pcs 2x10x12 SPF #2, our part 4471",
    "30 pcs 2x12x16 SPF #2",
    "3,050 SF 7/16 OSB 4x8",
    "63 sheets 3/4 T&G subfloor 4x8",
    "12 pcs LVL 1-3/4 x 11-7/8 x 20 ft",
    "80 sheets 1/2 OSB 4x8",
    "12 rolls house wrap 9 ft x 100 ft",
    "10 boxes 3 in. deck screws",
    "8 boxes 3-1/4 framing nails",
  ],
  cat: [
    "SKU | Description | Unit | List price",
    "L-2408 | 2x4x8 SPF #2 | EA | 3.98",
    "L-2492 | 2x4x92-5/8 SPF stud | EA | 3.78",
    "L-2612 | 2x6x12 SPF #2 | EA | 9.85",
    "L-2616 | 2x6x16 SPF #2 | EA | 13.40",
    "L-21010 | 2x10x10 SPF #2 | EA | 15.60",
    "L-21012 | 2x10x12 SPF #2 | EA | 18.90",
    "L-21216 | 2x12x16 SPF #2 | EA | 33.50",
    "P-0716 | 7/16 OSB 4x8 | SHT | 13.25",
    "P-1532 | 15/32 OSB 4x8 | SHT | 15.10",
    "P-2332T | 23/32 OSB T&G subfloor 4x8 | SHT | 31.80",
    "G-1208 | 1/2 drywall 4x8 | SHT | 14.20",
    "G-1212 | 1/2 drywall 4x12 | SHT | 21.30",
    "E-1116 | LVL 1-3/4 x 11-7/8 x 16 ft | EA | 118.00",
    "E-1124 | LVL 1-3/4 x 11-7/8 x 24 ft | EA | 177.00",
    "W-9100 | House wrap 9 ft x 100 ft | ROLL | 149.00",
    "F-D301 | 3 in. deck screws, 1 lb | BX | 9.80",
    "F-D305 | 3 in. deck screws, 5 lb | BX | 38.50",
    "F-N314 | 3-1/4 in. x .131 framing nails, 2,000 ct | BX | 58.00",
  ],
  xref: [
    "Customer part | SKU",
    "4471 | L-21010",
    "4480 | L-21216",
    "4502 | P-0716",
  ],
  price: [
    "SKU | Contract price | Valid through",
    "L-2408 | 3.62 | 2026-12-31",
    "L-2492 | 3.45 | 2026-12-31",
    "L-2612 | 8.94 | 2026-12-31",
    "L-21010 | 14.20 | 2026-12-31",
    "L-21012 | 17.20 | 2026-12-31",
    "L-21216 | 30.40 | 2026-12-31",
    "P-0716 | 11.90 | 2026-11-30",
    "P-2332T | 28.75 | 2026-11-30",
    "P-1532 | 13.60 | 2026-10-31",
    "W-9100 | 136.00 | 2026-12-31",
    "F-N314 | 52.00 | 2026-12-31",
  ],
  zone: [
    "Zone | ZIP codes | Charge",
    "1 | 68501-68512 | 60.00",
    "2 | 68516-68528 | 95.00",
    "3 | 68401-68467 | 140.00",
  ],
};

export const pasteExample = [
  "40 pcs 2x6x16 SPF #2",
  "500 LF 2x4 SPF #2, 8 ft",
  "24 sheets 1/2 drywall",
  "6 boxes 3 in. deck screws 5 lb",
  "15 pcs 2x8x12 SPF #2",
].join("\n");
