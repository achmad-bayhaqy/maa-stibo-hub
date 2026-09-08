// helpers.js — shared components for the MAP-Stibo system documentation
// English document, Profile A (formal): Times New Roman, body 12pt, line 1.3x
const {
  Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, PageBreak,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
} = require("docx");
const fs = require("fs");
const path = require("path");
const { imageSize } = require("image-size");

// ── Palette: DM-1 Deep Cyan (tech) — cover dark, body tables darkened accent ──
const PALETTE = {
  bg: "162235",
  accent: "37DCF2",              // cover accent only (dark bg)
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
  primary: "16324A",             // heading color on white pages
  body: "000000",                // Profile A: pure black body text
  secondary: "5B6B7D",
};

const FONT = { ascii: "Times New Roman", eastAsia: "Times New Roman" };
const MONO = { ascii: "Courier New", eastAsia: "Courier New" };

const allNoBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
};
const noBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
};

function safeText(v, ph) {
  if (v === undefined || v === null || v === "" || String(v) === "NaN" || String(v) === "undefined") {
    return ph || "[to be confirmed]";
  }
  return String(v);
}

// ── Headings ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: PALETTE.primary, font: FONT })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: PALETTE.primary, font: FONT })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, color: PALETTE.primary, font: FONT })],
  });
}

// ── Body paragraph; accepts string or array of run specs {t, b(old), i(talic), mono, color} ──
function p(content, opts = {}) {
  const runs = (Array.isArray(content) ? content : [{ t: content }]).map(r =>
    new TextRun({
      text: safeText(r.t),
      bold: !!r.b,
      italics: !!r.i,
      size: opts.size || 24,
      color: r.color || PALETTE.body,
      font: r.mono ? MONO : FONT,
    })
  );
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 312 },
    keepNext: !!opts.keepNext,
    children: runs,
  });
}

// ── Bullet item ──
function bullet(content, level = 0) {
  const runs = (Array.isArray(content) ? content : [{ t: content }]).map(r =>
    new TextRun({ text: safeText(r.t), bold: !!r.b, italics: !!r.i, size: 24, color: PALETTE.body, font: r.mono ? MONO : FONT })
  );
  return new Paragraph({
    bullet: { level },
    alignment: AlignmentType.LEFT,
    spacing: { after: 60, line: 312 },
    children: runs,
  });
}

// ── Numbered list item (unique reference per list) ──
function numbered(reference, content) {
  const runs = (Array.isArray(content) ? content : [{ t: content }]).map(r =>
    new TextRun({ text: safeText(r.t), bold: !!r.b, size: 24, color: PALETTE.body, font: r.mono ? MONO : FONT })
  );
  return new Paragraph({
    numbering: { reference, level: 0 },
    alignment: AlignmentType.LEFT,
    spacing: { after: 60, line: 312 },
    children: runs,
  });
}

// ── Table caption (keepNext keeps it glued to the table) ──
function tableCaption(text) {
  return new Paragraph({
    keepNext: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: PALETTE.primary, font: FONT })],
  });
}

// ── Business table (Horizontal-Only style, DM-1 table tokens) ──
// headers: string[]; rows: string[][]; widths: number[] (percent, sums ~100)
function bizTable(headers, rows, widths, opts = {}) {
  const cellMargins = { top: 60, bottom: 60, left: 120, right: 120 };
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((text, i) => new TableCell({
      children: [new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { line: 276 },
        children: [new TextRun({ text: safeText(text), bold: true, size: opts.fontSize || 20, color: PALETTE.table.headerText, font: FONT })],
      })],
      shading: { type: ShadingType.CLEAR, fill: PALETTE.table.headerBg },
      margins: cellMargins,
      width: { size: widths[i], type: WidthType.PERCENTAGE },
    })),
  });
  const dataRows = rows.map((cells, ri) => new TableRow({
    cantSplit: true,
    children: cells.map((cell, ci) => {
      const spec = typeof cell === "object" && cell !== null ? cell : { t: cell };
      return new TableCell({
        children: [new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { line: 276 },
          children: [new TextRun({
            text: safeText(spec.t), bold: !!spec.b, size: opts.fontSize || 20,
            color: spec.color || PALETTE.body, font: spec.mono ? MONO : FONT,
          })],
        })],
        shading: opts.zebra && ri % 2 === 0
          ? { type: ShadingType.CLEAR, fill: PALETTE.table.surface }
          : undefined,
        margins: cellMargins,
        width: { size: widths[ci], type: WidthType.PERCENTAGE },
      });
    }),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.table.accentLine },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: PALETTE.table.innerLine },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [headerRow, ...dataRows],
  });
}

// ── Figure embed: aspect-ratio preserved, centered, caption below ──
const DIAGRAM_DIR = "/home/z/my-project/analysis/diagrams";
function figure(fileName, caption, displayWidthPx) {
  const filePath = path.join(DIAGRAM_DIR, fileName);
  const buf = fs.readFileSync(filePath);
  const dims = imageSize(buf);
  const w = displayWidthPx;                 // docx-js transformation units ≈ px at 96dpi
  const h = Math.round(w * dims.height / dims.width);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 160, after: 60 },
      children: [new ImageRun({ data: buf, transformation: { width: w, height: h }, type: "png" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200, line: 276 },
      children: [new TextRun({ text: caption, italics: true, size: 20, color: PALETTE.secondary, font: FONT })],
    }),
  ];
}

// ── Code block: single-cell shaded table, Consolas 9pt ──
function codeBlock(lines, langLabel) {
  const paras = [];
  if (langLabel) {
    paras.push(new Paragraph({
      spacing: { after: 60, line: 240 },
      children: [new TextRun({ text: langLabel, bold: true, size: 16, color: PALETTE.secondary, font: MONO })],
    }));
  }
  for (const line of lines) {
    paras.push(new Paragraph({
      spacing: { after: 0, line: 240 },
      children: [new TextRun({ text: line.length ? line : " ", size: 17, color: "1F2937", font: MONO })],
    }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      left: { style: BorderStyle.SINGLE, size: 6, color: PALETTE.table.accentLine },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({
      cantSplit: false,
      children: [new TableCell({
        children: paras,
        shading: { type: ShadingType.CLEAR, fill: "F8FAFC" },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        width: { size: 100, type: WidthType.PERCENTAGE },
      })],
    })],
  });
}

// spacer after a table/code block so following text does not touch it
function spacer(afterTwips = 140) {
  return new Paragraph({ spacing: { after: afterTwips, line: 240 }, children: [new TextRun({ text: " ", size: 2 })] });
}

// ── Note / callout: left accent border ──
function note(content, kind = "info") {
  const colors = { info: PALETTE.table.accentLine, warn: "B45309", risk: "B91C1C" };
  const runs = (Array.isArray(content) ? content : [{ t: content }]).map(r =>
    new TextRun({ text: safeText(r.t), bold: !!r.b, italics: r.i !== false, size: 21, color: "334155", font: r.mono ? MONO : FONT })
  );
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 100, after: 160, line: 300 },
    indent: { left: 200 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: colors[kind] || colors.info, space: 12 } },
    children: runs,
  });
}

module.exports = {
  PALETTE, FONT, MONO, allNoBorders, noBorders, safeText,
  h1, h2, h3, p, bullet, numbered, tableCaption, bizTable, figure, codeBlock, spacer, note,
};
