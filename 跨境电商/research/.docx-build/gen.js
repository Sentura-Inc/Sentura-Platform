/* Generator: server-location-llm-decision-report.md  ->  .docx
 * Purpose-built markdown subset renderer tuned for a dense bilingual (zh) compliance report.
 * Handles: h1-h4, GFM tables (proportional widths, zebra, repeating headers, landscape for the
 * 8-col decision matrix), blockquote callout boxes, ordered (manual-number) + bullet lists,
 * inline **bold** / `code` / [text](url) / bare URLs -> real hyperlinks.
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, ExternalHyperlink, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak, TabStopType,
  TabStopPosition, Bookmark, InternalHyperlink,
} = require("docx");

const SRC = process.argv[2];
const OUT = process.argv[3];

// ---------- palette / fonts ----------
const EA = "Hiragino Sans GB";          // Simplified-Chinese sans (present in Word-mac + fontconfig)
const LATIN = "Arial";
const MONO = "Menlo";
const C = {
  ink: "1A1A1A", navy: "1F3864", blue: "2E5C8A", slate: "44546A",
  headFill: "2E5C8A", zebra: "EEF3F9", callout: "F2F6FB", border: "BFC9D9",
  rule: "C9D3E0", codeBg: "EEEEEE", link: "1155CC", muted: "6B7280", white: "FFFFFF",
};
const FONT = { ascii: LATIN, hAnsi: LATIN, eastAsia: EA, cs: LATIN };
const MONOFONT = { ascii: MONO, hAnsi: MONO, eastAsia: EA, cs: MONO };

// sizes (half-points)
const SZ = { body: 21, h1: 44, h2: 30, h3: 24, h4: 22, tbl: 18, small: 16, callout: 20, cover: 56, sub: 26 };

const MARGIN_X = 1080, MARGIN_Y = 1440;
const CW_PORTRAIT = 12240 - 2 * MARGIN_X;     // 10080
const CW_LANDSCAPE = 15840 - 2 * MARGIN_X;    // 13680

// ---------- script-aware run splitting ----------
// LibreOffice (and some viewers) mis-assign fonts when emoji + CJK + Latin share ONE run,
// rendering the Latin segment as tofu. Splitting each maximal Latin run into its own TextRun
// (pure Arial) renders correctly everywhere; appearance in Word is unchanged.
function scriptGroup(cp) {
  if (cp >= 0x1f000) return "h";                 // emoji planes
  if (cp >= 0x2460 && cp <= 0x27bf) return "h";  // circled numbers ①, dingbats ✅❌, ⚠
  if (cp === 0xfe0f || cp === 0x20e3) return "h"; // variation selector / keycap
  if (cp >= 0x2e80 && cp <= 0x9fff) return "h";  // CJK + radicals + kana + punctuation
  if (cp >= 0x3000 && cp <= 0x303f) return "h";  // CJK symbols & punctuation
  if (cp >= 0xf900 && cp <= 0xfaff) return "h";  // CJK compat ideographs
  if (cp >= 0xff00 && cp <= 0xffef) return "h";  // fullwidth forms
  return "l";                                     // latin / digits / ascii punctuation
}
function pushSplit(out, text, o) {
  let cur = "", curg = null;
  for (const ch of text) {
    const g = scriptGroup(ch.codePointAt(0));
    if (curg === null) { cur = ch; curg = g; }
    else if (g === curg) { cur += ch; }
    else { out.push(mkRun(cur, o)); cur = ch; curg = g; }
  }
  if (cur) out.push(mkRun(cur, o));
}

// ---------- inline tokenizer ----------
function mkRun(text, o = {}) {
  return new TextRun({
    text,
    font: o.code ? MONOFONT : FONT,
    size: o.size || SZ.body,
    bold: !!o.bold,
    italics: !!o.italics,
    color: o.color || C.ink,
    shading: o.code ? { type: ShadingType.CLEAR, fill: C.codeBg, color: "auto" } : undefined,
  });
}
function mkLink(text, url, o = {}) {
  return new ExternalHyperlink({
    link: url,
    children: [new TextRun({
      text, font: FONT, size: o.size || SZ.body, bold: !!o.bold,
      color: C.link, underline: { type: "single", color: C.link },
    })],
  });
}
// returns array of TextRun|ExternalHyperlink
function parseInline(text, o = {}) {
  const out = [];
  let buf = "", bold = !!o.bold, i = 0;
  const size = o.size || SZ.body;
  const baseColor = o.color || C.ink;
  const flush = () => { if (buf) { pushSplit(out, buf, { bold, size, color: baseColor, italics: o.italics }); buf = ""; } };
  const linkRe = /^\[([^\]]+)\]\(([^)]+)\)/;
  const urlRe = /^https?:\/\/[^\s]+/;
  while (i < text.length) {
    if (text.startsWith("**", i)) { flush(); bold = !bold; i += 2; continue; }
    if (text[i] === "`") {
      const close = text.indexOf("`", i + 1);
      if (close > -1) { flush(); out.push(mkRun(text.slice(i + 1, close), { code: true, size: size - 1, color: baseColor })); i = close + 1; continue; }
    }
    if (text[i] === "[") {
      const m = text.slice(i).match(linkRe);
      if (m) { flush(); out.push(mkLink(m[1], m[2], { bold, size })); i += m[0].length; continue; }
    }
    if (text[i] === "h") {
      const m = text.slice(i).match(urlRe);
      if (m) {
        let url = m[0];
        // trim trailing punctuation that is clearly not part of the URL
        url = url.replace(/[)\]，。、；·]+$/u, "");
        flush(); out.push(mkLink(url, url, { bold, size })); i += url.length; continue;
      }
    }
    buf += text[i]; i++;
  }
  flush();
  return out;
}
function stripMd(s) {
  return s.replace(/\*\*/g, "").replace(/`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}
function dispWidth(s) {
  let w = 0;
  for (const ch of stripMd(s)) w += /[⺀-鿿＀-￯　-〿]/.test(ch) ? 2 : 1;
  return w;
}

// ---------- block parser ----------
function parseBlocks(md) {
  const lines = md.split("\n");
  // drop everything before the first H1 (removes the repo "on-demand" banner)
  let start = lines.findIndex((l) => /^#\s/.test(l));
  if (start < 0) start = 0;
  const ls = lines.slice(start);
  const blocks = [];
  let i = 0;
  const isTable = (l) => l.trim().startsWith("|");
  const isSep = (l) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes("-");
  while (i < ls.length) {
    let line = ls[i];
    if (line.trim() === "") { i++; continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      blocks.push({ type: "h" + m[1].length, text: m[2].trim() }); i++; continue;
    }
    if (/^---+\s*$/.test(line.trim())) { blocks.push({ type: "hr" }); i++; continue; }
    if (isTable(line)) {
      const tlines = [];
      while (i < ls.length && isTable(ls[i])) { tlines.push(ls[i]); i++; }
      const rows = tlines.map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
      let sepIdx = tlines.findIndex((l) => isSep(l));
      if (sepIdx < 0) sepIdx = 1;
      const header = rows[sepIdx - 1];
      const body = rows.filter((_, idx) => idx !== sepIdx && idx < sepIdx ? false : idx > sepIdx).map((r) => r);
      blocks.push({ type: "table", header, rows: body });
      continue;
    }
    if (line.trim().startsWith(">")) {
      const q = [];
      while (i < ls.length && (ls[i].trim().startsWith(">") || (ls[i].trim() === "" && i + 1 < ls.length && ls[i + 1].trim().startsWith(">")))) {
        q.push(ls[i].replace(/^\s*>\s?/, "")); i++;
      }
      blocks.push({ type: "quote", lines: q });
      continue;
    }
    if ((m = line.match(/^(\s*)(\d+)\.\s+(.*)$/))) {
      const items = [];
      while (i < ls.length && (/^(\s*)\d+\.\s+/.test(ls[i]) || /^\s{2,}\S/.test(ls[i]))) {
        const mm = ls[i].match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (mm) items.push({ num: mm[2], text: mm[3], cont: false });
        else items.push({ text: ls[i].trim(), cont: true });
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    if ((m = line.match(/^(\s*)-\s+(.*)$/))) {
      const items = [];
      while (i < ls.length && /^(\s*)-\s+/.test(ls[i])) {
        const mm = ls[i].match(/^(\s*)-\s+(.*)$/);
        items.push({ level: Math.min(1, Math.floor(mm[1].length / 2)), text: mm[2] });
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    blocks.push({ type: "p", text: line.trim() });
    i++;
  }
  return blocks;
}

// ---------- table widths ----------
function colWidths(header, rows, contentWidth) {
  const n = header.length;
  const w = new Array(n).fill(1);
  for (let c = 0; c < n; c++) {
    let mx = dispWidth(header[c] || "");
    for (const r of rows) mx = Math.max(mx, dispWidth((r[c] || "")));
    // damp the spread (^0.62) so very-wide columns don't starve short ones into vertical stacking
    w[c] = Math.pow(Math.max(6, mx), 0.62);
  }
  const sum = w.reduce((a, b) => a + b, 0);
  const minCol = Math.floor(contentWidth / (n * 2.4));
  let widths = w.map((x) => Math.max(minCol, Math.round((x / sum) * contentWidth)));
  // normalise so total == contentWidth
  let diff = contentWidth - widths.reduce((a, b) => a + b, 0);
  widths[widths.length - 1] += diff;
  return widths;
}

// ---------- renderers ----------
const thinBorder = { style: BorderStyle.SINGLE, size: 2, color: C.border };
const cellBorders = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

function renderTable(block) {
  const isMatrix = stripMd(block.header[0]) === "候选地";
  const cw = isMatrix ? CW_LANDSCAPE : CW_PORTRAIT;
  const widths = colWidths(block.header, block.rows, cw);

  const headRow = new TableRow({
    tableHeader: true,
    children: block.header.map((h, c) => new TableCell({
      width: { size: widths[c], type: WidthType.DXA },
      borders: cellBorders,
      shading: { type: ShadingType.CLEAR, fill: C.headFill, color: "auto" },
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: 240 },
        children: parseInline(h, { bold: true, size: SZ.tbl, color: C.white }),
      })],
    })),
  });

  const bodyRows = block.rows.map((r, ri) => new TableRow({
    cantSplit: false,
    children: block.header.map((_, c) => new TableCell({
      width: { size: widths[c], type: WidthType.DXA },
      borders: cellBorders,
      shading: ri % 2 === 1 ? { type: ShadingType.CLEAR, fill: C.zebra, color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: c === 0 ? AlignmentType.LEFT : AlignmentType.LEFT,
        spacing: { before: 0, after: 0, line: 240 },
        children: parseInline(r[c] || "", { size: SZ.tbl, bold: c === 0, color: C.ink }),
      })],
    })),
  }));

  const table = new Table({
    width: { size: cw, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headRow, ...bodyRows],
  });
  return { orientation: isMatrix ? "landscape" : "portrait", els: [table, new Paragraph({ spacing: { after: 120 }, children: [] })] };
}

function renderQuote(block) {
  // classify inner lines; render as a single-cell shaded box with a left accent bar
  const inner = [];
  for (const raw of block.lines) {
    if (raw.trim() === "") { inner.push({ kind: "blank" }); continue; }
    let m;
    if ((m = raw.match(/^(\s*)-\s+(.*)$/))) inner.push({ kind: "bullet", level: Math.min(1, Math.floor(m[1].length / 2)), text: m[2] });
    else if ((m = raw.match(/^\s*>\s+(.*)$/))) inner.push({ kind: "nest", text: m[1] });
    else inner.push({ kind: "p", text: raw.trim() });
  }
  const items = inner.filter((x) => x.kind !== "blank");
  const innerParas = items.map((it, idx) => {
    const last = idx === items.length - 1;
    let children, indent;
    if (it.kind === "bullet") {
      indent = { left: 300 + it.level * 320, hanging: 260 };
      children = [mkRun("•  ", { bold: true, size: SZ.callout, color: C.blue }), ...parseInline(it.text, { size: SZ.callout })];
    } else if (it.kind === "nest") {
      indent = { left: 300 };
      children = parseInline(it.text, { size: SZ.callout });
    } else {
      indent = { left: 0 };
      children = parseInline(it.text, { size: SZ.callout });
    }
    return new Paragraph({ indent, spacing: { before: idx === 0 ? 0 : 20, after: last ? 0 : 40, line: 252 }, children });
  });

  const accent = { style: BorderStyle.SINGLE, size: 18, color: C.blue };
  const hair = { style: BorderStyle.SINGLE, size: 2, color: C.border };
  const box = new Table({
    width: { size: CW_PORTRAIT, type: WidthType.DXA },
    columnWidths: [CW_PORTRAIT],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: CW_PORTRAIT, type: WidthType.DXA },
        borders: { top: hair, left: accent, bottom: hair, right: hair },
        shading: { type: ShadingType.CLEAR, fill: C.callout, color: "auto" },
        margins: { top: 110, bottom: 110, left: 180, right: 150 },
        children: innerParas,
      })],
    })],
  });
  return { orientation: "portrait", els: [box, new Paragraph({ spacing: { after: 90 }, children: [] })] };
}

function renderList(block) {
  const els = [];
  if (block.type === "ol") {
    for (const it of block.items) {
      if (it.cont) {
        els.push(new Paragraph({ indent: { left: 620 }, spacing: { before: 0, after: 60, line: 264 }, children: parseInline(it.text) }));
      } else {
        const hang = it.num.length >= 2 ? 440 : 380;
        els.push(new Paragraph({
          indent: { left: 620, hanging: hang },
          spacing: { before: 0, after: 70, line: 264 },
          children: [mkRun(it.num + ".  ", { bold: true, color: C.blue }), ...parseInline(it.text)],
        }));
      }
    }
  } else {
    for (const it of block.items) {
      els.push(new Paragraph({
        numbering: { reference: "ul", level: it.level },
        spacing: { before: 0, after: 60, line: 264 },
        children: parseInline(it.text),
      }));
    }
  }
  return { orientation: "portrait", els };
}

function renderBlock(block, peekNext) {
  switch (block.type) {
    case "h1": return { orientation: "portrait", els: [new Paragraph({ heading: HeadingLevel.HEADING_1, children: parseInline(block.text) })] };
    case "h2": return { orientation: "portrait", els: [new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new Bookmark({ id: block._anchor, children: parseInline(block.text) })] })] };
    case "h3": return { orientation: "portrait", els: [new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new Bookmark({ id: block._anchor, children: parseInline(block.text) })] })] };
    case "h4": return { orientation: "portrait", els: [new Paragraph({ heading: HeadingLevel.HEADING_4, children: parseInline(block.text) })] };
    case "hr": {
      if (peekNext && peekNext.type && peekNext.type.startsWith("h")) return { orientation: "portrait", els: [] };
      return { orientation: "portrait", els: [new Paragraph({ spacing: { before: 60, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.rule, space: 1 } }, children: [] })] };
    }
    case "table": return renderTable(block);
    case "quote": return renderQuote(block);
    case "ol":
    case "ul": return renderList(block);
    case "p": default:
      return { orientation: "portrait", els: [new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 130, line: 276 }, children: parseInline(block.text) })] };
  }
}

// ---------- header / footer ----------
function makeHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.rule, space: 4 } },
      children: [mkRun("cbe 跨境电商 · 服务器选址 + 大模型路线 决策报告", { size: SZ.small, color: C.muted })],
    })],
  });
}
function makeFooter() {
  return new Footer({
    children: [new Paragraph({
      spacing: { before: 60 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.rule, space: 4 } },
      tabStops: [
        { type: TabStopType.CENTER, position: Math.floor(CW_PORTRAIT / 2) },
        { type: TabStopType.RIGHT, position: CW_PORTRAIT },
      ],
      children: [
        mkRun("编制日期 2026-06-15", { size: SZ.small, color: C.muted }),
        mkRun("\t", { size: SZ.small }),
        mkRun("第 ", { size: SZ.small, color: C.muted }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SZ.small, color: C.muted }),
        mkRun(" 页", { size: SZ.small, color: C.muted }),
        mkRun("\t", { size: SZ.small }),
        mkRun("保密 · 需法务最终确认", { size: SZ.small, color: C.muted }),
      ],
    })],
  });
}

// ---------- build ----------
const md = fs.readFileSync(SRC, "utf8");
const blocks = parseBlocks(md);

// pull title + metadata paragraph for cover
let title = "服务器选址 + 大模型路线 决策报告";
let metaPara = null;
const rest = [];
let gotTitle = false, gotMeta = false;
for (const b of blocks) {
  if (!gotTitle && b.type === "h1") { title = b.text; gotTitle = true; continue; }
  if (gotTitle && !gotMeta && b.type === "p") { metaPara = b; gotMeta = true; continue; }
  rest.push(b);
}

// cover page
const coverEls = [
  new Paragraph({ spacing: { before: 2200 }, children: [] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [mkRun("跨境电商 cbe 平台", { size: SZ.sub, bold: true, color: C.blue })] }),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.navy, space: 10 } },
    children: [mkRun("服务器选址 + 大模型路线", { size: SZ.cover, bold: true, color: C.navy })],
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 40 }, children: [mkRun("决 策 报 告", { size: SZ.cover - 8, bold: true, color: C.navy })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 40 }, children: [mkRun("可决策 · 带引用的合规与云架构顾问报告", { size: SZ.sub - 4, color: C.slate })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [mkRun("经三轮多智能体对抗式复核 + 一手官方原文裁决", { size: SZ.body, color: C.muted })] }),
];
if (metaPara) {
  coverEls.push(new Paragraph({ spacing: { before: 900 }, children: [] }));
  coverEls.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { line: 300 },
    indent: { left: 600, right: 600 },
    children: parseInline(metaPara.text, { size: SZ.small + 2, color: C.slate }),
  }));
}
coverEls.push(new Paragraph({ children: [new PageBreak()] }));

// static clickable table of contents (prescan H2/H3 -> bookmarks)
let hc = 0;
const tocEntries = [];
for (const b of rest) {
  if (b.type === "h2" || b.type === "h3") {
    b._anchor = "nav" + (hc++);
    tocEntries.push({ anchor: b._anchor, title: b.text, level: b.type === "h2" ? 2 : 3 });
  }
}
coverEls.push(new Paragraph({
  spacing: { after: 200 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: C.blue, space: 6 } },
  children: [mkRun("目　录", { size: SZ.h2, bold: true, color: C.navy })],
}));
for (const e of tocEntries) {
  const isH2 = e.level === 2;
  coverEls.push(new Paragraph({
    indent: isH2 ? { left: 0 } : { left: 480 },
    spacing: { before: isH2 ? 90 : 10, after: isH2 ? 10 : 10, line: 264 },
    children: [new InternalHyperlink({
      anchor: e.anchor,
      children: [new TextRun({ text: e.title, font: FONT, size: isH2 ? SZ.body + 1 : SZ.body, bold: isH2, color: isH2 ? C.blue : C.slate })],
    })],
  }));
}
coverEls.push(new Paragraph({ children: [new PageBreak()] }));

// group rest into orientation sections
const sectionsData = [];
let cur = { orientation: "portrait", children: [...coverEls] };
function pushEls(orientation, els) {
  if (!els.length) return;
  if (orientation !== cur.orientation) { sectionsData.push(cur); cur = { orientation, children: [] }; }
  cur.children.push(...els);
}
for (let k = 0; k < rest.length; k++) {
  const { orientation, els } = renderBlock(rest[k], rest[k + 1]);
  pushEls(orientation, els);
}
sectionsData.push(cur);

const sections = sectionsData.map((s, idx) => {
  const isFirst = idx === 0;
  const properties = {
    page: {
      size: s.orientation === "landscape"
        ? { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE }
        : { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
      margin: { top: MARGIN_Y, bottom: MARGIN_Y, left: MARGIN_X, right: MARGIN_X, header: 600, footer: 600 },
    },
  };
  const headers = { default: makeHeader() };
  const footers = { default: makeFooter() };
  if (isFirst) {
    properties.titlePage = true; // first page (cover) gets a clean, empty header/footer
    headers.first = new Header({ children: [new Paragraph({ children: [] })] });
    footers.first = new Footer({ children: [new Paragraph({ children: [] })] });
  }
  return { properties, headers, footers, children: s.children };
});

const doc = new Document({
  creator: "Claude",
  title: title,
  styles: {
    default: { document: { run: { font: FONT, size: SZ.body, color: C.ink }, paragraph: { spacing: { line: 276 } } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: SZ.h1, bold: true, color: C.navy, font: FONT },
        paragraph: { spacing: { before: 240, after: 200 }, outlineLevel: 0, alignment: AlignmentType.CENTER } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: SZ.h2, bold: true, color: C.blue, font: FONT },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 1,
          border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: C.blue, space: 6 } } } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: SZ.h3, bold: true, color: C.blue, font: FONT },
        paragraph: { spacing: { before: 260, after: 120 }, outlineLevel: 2 } },
      { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: SZ.h4, bold: true, color: C.slate, font: FONT },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 3 } },
    ],
  },
  numbering: {
    config: [
      { reference: "ul", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { run: { color: C.blue }, paragraph: { indent: { left: 460, hanging: 260 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { run: { color: C.blue }, paragraph: { indent: { left: 880, hanging: 280 } } } },
      ] },
    ],
  },
  sections,
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("wrote", OUT, buf.length, "bytes;", sections.length, "sections,", blocks.length, "blocks"); });
