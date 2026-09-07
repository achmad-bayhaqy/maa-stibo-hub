// build.js — assembles the full documentation DOCX
const {
  Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber,
  AlignmentType, HeadingLevel, SectionType, NumberFormat, TableOfContents, PageBreak,
  BorderStyle,
} = require("docx");
const fs = require("fs");
const { PALETTE, FONT, h1, h2, p, tableCaption, bizTable, spacer, note } = require("./helpers");
const { buildCoverR1 } = require("./cover");
const c1 = require("./content1");
const c2 = require("./content2");
const c3 = require("./content3");
const c4 = require("./content4");

const OUT = "/home/z/my-project/download/MAP-Stibo_System_Documentation.docx";

const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

// ── Cover config (Recipe R1, DM-1 Deep Cyan) ──
const coverConfig = {
  title: "MAP-Stibo Master Data Integration Platform",
  subtitle: "Current-State Technical Documentation - Retail Master Data Inbound Pipeline",
  englishLabel: "SYSTEM DOCUMENTATION",
  metaLines: [
    "Prepared for: COE Team - Brand Teams - IT",
    "Version 1.0 (Initial Release)",
    "Date: 7 September 2026",
    "Classification: Internal Use Only",
  ],
  footerLeft: "PT. MAP Aktif Adiperkasa Tbk",
  footerRight: "Master Data Integration - September 2026",
  palette: { bg: PALETTE.bg, accent: PALETTE.accent, cover: PALETTE.cover },
};

// ── Footer builders ──
function pageNumFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: FONT })],
    })],
  });
}
function bodyHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1", space: 4 } },
      children: [new TextRun({
        text: "MAP-Stibo Master Data Integration Platform - System Documentation",
        size: 18, color: "888888", font: FONT,
      })],
    })],
  });
}

// ── Front matter: Document Control + TOC ──
function frontMatter() {
  const el = [];
  el.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360 },
    children: [new TextRun({ text: "Document Control", bold: true, size: 32, color: PALETTE.primary, font: FONT })],
  }));

  el.push(tableCaption("Document identification"));
  el.push(bizTable(
    ["Field", "Value"],
    [
      ["Document title", "MAP-Stibo Master Data Integration Platform - Current-State Technical Documentation"],
      ["Document ID", "MDM-DOC-001"],
      ["Version", "1.0 (initial release)"],
      ["Status", "Issued for review"],
      ["Date of issue", "7 September 2026"],
      ["Prepared by", "Integration engineering, with AI-assisted code and data analysis"],
      ["Owner", "[to be confirmed: integration engineering lead]"],
      ["Classification", "Internal use only"],
    ],
    [30, 70]
  ));
  el.push(spacer());

  el.push(tableCaption("Version history"));
  el.push(bizTable(
    ["Version", "Date", "Author", "Change description"],
    [
      ["0.1", "6 September 2026", "Integration engineering", "Initial draft from code and workbook analysis"],
      ["1.0", "7 September 2026", "Integration engineering", "Complete manual: 16 chapters, 6 appendices, 5 diagrams; issued for team review"],
      ["[next]", "[date]", "[author]", "[description of amendment]"],
    ],
    [12, 20, 26, 42]
  ));
  el.push(spacer());

  el.push(tableCaption("Review and approval"));
  el.push(bizTable(
    ["Role", "Name", "Signature", "Date"],
    [
      ["COE team representative", "[name]", "", ""],
      ["Brand team representative", "[name]", "", ""],
      ["IT / integration lead", "[name]", "", ""],
      ["STEP administrator", "[name]", "", ""],
    ],
    [34, 26, 22, 18]
  ));
  el.push(spacer());

  el.push(tableCaption("Distribution and related documents"));
  el.push(bizTable(
    ["Item", "Detail"],
    [
      ["Distribution", "COE team; Brand teams; IT and integration engineering; STEP administrator; management (chapters 2, 13, 16)"],
      ["Related artefacts", "NEW - Brand mapping files Template.xlsx; Master Data Dictionary (MAA).xlsx; Brand Input files & Naming convention.xlsx; Lambda deployment packages (see Appendix F)"],
      ["Maintenance rule", "This document must be updated whenever a brand handler, routing rule, reference workbook or environment contract changes; Appendix A and D are the fastest-changing parts"],
    ],
    [24, 76]
  ));

  // TOC title — must NOT use Heading style; pageBreakBefore replaces a standalone PageBreak paragraph
  el.push(new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360 },
    children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, color: PALETTE.primary, font: FONT })],
  }));
  el.push(new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }));
  el.push(new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({
      text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field.\"",
      italics: true, size: 18, color: "888888", font: FONT,
    })],
  }));
  return el;
}

// ── Executive summary (body, unnumbered) ──
function executiveSummary() {
  const el = [];
  el.push(h1("Executive Summary"));
  el.push(p("MAP operates a fully event-driven master data pipeline that carries product information from dozens of brand principals into Stibo STEP, the company's master data management platform of record. Brand teams upload Excel files through the internal MAP Portal, which stores them in an S3 raw bucket under a standardised, dropdown-derived name. Every upload triggers an AWS Lambda that identifies the brand, classifies the business file type, validates that the required reference files are present, and executes a brand-specific transformation that maps the data onto the Stibo attribute model using the Master Data Dictionary, the brand mapping workbook and the RNA organisational lookup. The resulting STEPXML is written to a processed bucket, from which a second Lambda authenticates to Stibo STEP with OAuth 2.0 client credentials and delivers the file to one of three Inbound Integration End Points (Article Planning, EAN Update, Article Maintenance). Every step writes structured audit evidence to S3."));
  el.push(p("This document is the first complete description of that landscape, produced by direct analysis of the two Lambda code bases (122,435 lines in total), the four governing Excel workbooks (58-sheet mapping template, 87-sheet data dictionary with about 43,000 list-of-values entries, the naming workbook, and a real 39.8 MB input sample), current Stibo STEP 2025-2026 platform documentation, and the owning team's explanations. Twenty-seven brands are registered and profiled; the naming convention and its unratified replacement are decoded; the STEPXML output format, the delivery contract, the audit schema and the operational runbook are specified in full."));
  el.push(p("The analysis also surfaced fourteen documented issues, of which two require immediate action: a sys.exit defect that can silently abort global reference-data refreshes mid-way, and database credentials discovered travelling inside an uploaded business file. The structural finding is that roughly three quarters of the transformation code is duplicated boilerplate, while the newest brands already demonstrate a configuration-driven alternative. The closing chapter turns this into a ten-item recommendation register and a five-phase roadmap - stabilise, gain visibility, consolidate the engine, bring validation and auto-mapping into the portal, and synchronise reference data directly from STEP's 2026 REST APIs."));
  el.push(p("Readers new to the system should start with Chapter 2; operators should keep Chapter 15 at hand; anyone planning the portal's auto-mapping evolution should read Chapters 8, 10 and 16 together. The appendices carry the complete brand matrix, environment contract, LOV inventory and glossary."));
  return el;
}

// ── Assemble document ──
const doc = new Document({
  creator: "Integration Engineering",
  title: "MAP-Stibo Master Data Integration Platform - System Documentation",
  description: "Current-state technical documentation of the MAP Portal, AWS integration pipeline and Stibo STEP inbound integration",
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "Times New Roman" }, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Times New Roman", eastAsia: "Times New Roman" }, size: 32, bold: true, color: PALETTE.primary },
        paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: { ascii: "Times New Roman", eastAsia: "Times New Roman" }, size: 28, bold: true, color: PALETTE.primary },
        paragraph: { spacing: { before: 260, after: 120, line: 312 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: { ascii: "Times New Roman", eastAsia: "Times New Roman" }, size: 24, bold: true, color: PALETTE.primary },
        paragraph: { spacing: { before: 200, after: 100, line: 312 }, outlineLevel: 2 },
      },
    },
  },
  sections: [
    { // Section 1: Cover — margin 0, no footer, no page number
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1(coverConfig),
    },
    { // Section 2: Front matter — Roman numerals
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageNumFooter() },
      children: frontMatter(),
    },
    { // Section 3: Body — Arabic, restart at 1
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: bodyHeader() },
      footers: { default: pageNumFooter() },
      children: [
        ...executiveSummary(),
        ...c1.build(),
        ...c2.build(),
        ...c3.build(),
        ...c4.build(),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE", OUT, (buf.length / 1024).toFixed(0) + " KB");
}).catch((e) => { console.error("BUILD FAILED:", e); process.exit(1); });
