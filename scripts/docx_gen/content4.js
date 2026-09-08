// content4.js — Appendices A–F
const { h1, h2, p, tableCaption, bizTable, spacer, note } = require("./helpers");

function build() {
  const el = [];

  // ── Appendix A ──
  el.push(h1("Appendix A. Brand, S3 Folder and Handler Matrix"));
  el.push(p("The authoritative mapping between the portal's brand folder names (principals), the Python packages and the router registry. The package column reflects Python identifier rules (no leading digits), which is why 2xu maps to twoxu and new-balance to new_balance."));
  el.push(tableCaption("Table A-1 - Router registry (BRAND_ROUTER, 27 entries)"));
  el.push(bizTable(
    ["S3 principal (folder)", "Handler package", "Router comment"],
    [
      ["adidas", "adidas.lambda_function", "linelist, backlog, tdd, dtb paths"],
      ["new-balance", "new_balance.lambda_function", "unified handler, 8 sub-flows"],
      ["smiggle", "smiggle.lambda_function", "linelist / packing / ecommerce"],
      ["aldo", "aldo.lambda_function", "handler partly commented (KI-04)"],
      ["diadora", "diadora.lambda_function", "pricelist only"],
      ["crocs", "crocs.lambda_function", "order forms, shipment, barcodes"],
      ["2xu", "twoxu.lambda_function", "folder named twoxu (identifier rule)"],
      ["lotto", "lotto.lambda_function", "order form / fob / recap / pricelist"],
      ["onr", "onr.lambda_function", "ON Running: taf, planet sport"],
      ["nike", "nike.lambda_function", "SP27 MAA linelist, 360, order confirm"],
      ["dr-martens", "dr_marten.lambda_function", "retail price master"],
      ["staccato", "staccato.lambda_function", "linelist"],
      ["birkenstock", "birkenstock.lambda_function", "OFS FC Mitra, mapping engine"],
      ["pazzion", "pazzion.lambda_function", "order form, barcode"],
      ["clarks", "clarks.lambda_function", "order forms, ean source"],
      ["steve-madden", "steve_madden.lambda_function", "footwear / handbag PO"],
      ["asics", "asics.lambda_function", "footwear, app/acc, ean"],
      ["ptp", "PTP.lambda_function", "folder upper case; fob order form"],
      ["implus", "implus.lambda_function", "multi-source linelist, ean update"],
      ["astec", "astec.lambda_function", "recap"],
      ["airwalk", "airwalk.lambda_function", "recap"],
      ["ellesse", "ellesse.lambda_function", "recap reference flow"],
      ["k-swiss", "k_swiss.lambda_function", "recap, global line order form"],
      ["reebok", "reebok.lambda_function", "article masters, ean, recap"],
      ["anta", "anta.lambda_function", "mapping-driven reference"],
      ["new-era", "new_era.lambda_function", "order forms, delivery schedule"],
      ["anta-1", "anta_1.lambda_function", "second ANTA registration"],
    ],
    [30, 34, 36],
    { fontSize: 18 }
  ));
  el.push(spacer());

  // ── Appendix B ──
  el.push(h1("Appendix B. File-Type Keyword Reference (Selected Brands)"));
  el.push(p("Keyword classification is case-insensitive substring matching where the first match wins, so detection order is part of the contract. The table lists the keyword sets that are stable in the code; treat it as representative rather than exhaustive, and always confirm against the brand package before relying on it. New keywords are behaviour changes (README, Section 11)."));
  el.push(tableCaption("Table B-1 - Selected keyword dictionaries"));
  el.push(bizTable(
    ["Brand", "Detected types and notable keywords"],
    [
      ["adidas", "linelist; backlog; tdd; dtb; mdd; attributes; naming; plus shared/licensed keyword extras"],
      ["new-balance", "Detection order: linelist_footwear, linelist_apparel, ecommerce_licensed, ecommerce_inline, ecommerce (generic), ordersheet_licensed, linelist_licensed, then shared support types (mdd, attributes, naming); separate ean_source handling"],
      ["smiggle", "linelist with extra keywords catalogue, catalog, mapi, wholesale, handover; packing; ecommerce"],
      ["diadora", "pricelist (keywords: pricelist, price list, price_list)"],
      ["onr", "taf_ss26; linelist_planet_sport; linelist_footwear_taf; packaging_list_planet_sport"],
      ["nike", "linelist variant chain (SP27 MAA linelist, 360 linelist, rookie), orderConfirmation, ean"],
      ["ellesse / recap family", "recap (matched by Recap Sample); the same engine is cloned for lotto, k_swiss, airwalk, astec"],
      ["birkenstock", "OFS_FC_Mitra_ss27 (matches ofs-fc-pt-mitra routing rule); separate ecom mappings"],
      ["2xu", "linelist; product bible; order confirmation"],
      ["crocs / implus / PTP", "order forms (multiple), shipment confirmation, order confirmation, barcode/ean outputs"],
    ],
    [22, 78],
    { fontSize: 18 }
  ));
  el.push(spacer());

  // ── Appendix C ──
  el.push(h1("Appendix C. LOV Catalogue Summary"));
  el.push(p("Complete sheet list of the Master Data Dictionary LOV section with measured row counts. Column conventions vary per sheet (Section 8.2); the loaders consume display/ID pairs from column A/B unless the sheet has its documented multi-column schema."));
  el.push(tableCaption("Table C-1 - LOV sheets (64 total, grouped; counts measured September 2026)"));
  el.push(bizTable(
    ["Group", "Sheets (rows)"],
    [
      ["Organisational", "Company Code LOV (45); SBU LOV (37); Company LOV (37); Brand LOV (38); Brand Group (301); Brand Type LOV (9); Brand Status LOV (9); Brand Category LOV (50)"],
      ["Commerce / channel", "Ecomm Concept LOV (46); Ecomm Sales Channel LOV (228); Channel Category LOV (8); Channel Allocation LOV (25); Pricing Distribution Channel LO (37); Price Range LOV (37); Retail Price Currency LOV (183); SAP Product Flag LOV (6)"],
      ["Product classification", "Gender LOV (9); Age LOV (9); Material LOV (104); Material-Upper LOV (104); Standardized Color LOV (104); Color Code LOV (222); PatternPrint LOV (33); Style Type LOV (12); Style LOV (83); Silhouette LOV (79); Fastening LOV (61); Heel Type LOV (20); Heel Height LOV (9); Width LOV (9); Fit LOV (9); Ocassion LOV (9); Fabric LOV (15); Content LOV (12); Article Category LOV (104); Sports Category LOV (104); SAP Article Type LOV (104); BY Article Type (104); Nature of Article LOV (104); Franchise LOV (1,918)"],
      ["Sizes and geography", "Size Code LOV (5,062); Country Size LOV (104); Country Origin LOV (239); Country LOV (9)"],
      ["SIS cross-reference", "SIS Gender & Age Mapping (113); SIS Brand Mapping (124); SIS CDS & CRC Group Size (124); SIS CDS & CRC Group Color Descr (124); SIS SM Class Code (390); SIS SM Color Description LOV (104)"],
      ["Assortment & vendor", "Vendor LOV (32,664); MB Assortment Code LOV (804); MB Components Qty (37); UOM LOV (37)"],
      ["Other", "Images Source LOV (104); Gender Size Chart LOV (104); E-com Ages Category LOV (104); Season LOV (9); Interest LOV (89); Golf Club Loft/Flex/Length (24/9/9); Simple LOVs (9)"],
    ],
    [22, 78],
    { fontSize: 18 }
  ));
  el.push(spacer());

  // ── Appendix D ──
  el.push(h1("Appendix D. Environment Variable Reference"));
  el.push(p("Complete configuration contract of both lambdas. Required variables fail fast when missing; the delivery lambda raises an EnvironmentError naming the variable, the transform lambda relies on the AWS execution environment plus explicit configuration."));
  el.push(tableCaption("Table D-1 - Environment variables"));
  el.push(bizTable(
    ["Variable", "Lambda", "Required", "Purpose / default"],
    [
      ["RAW_BUCKET", "transform", "Yes", "Source metadata bucket; also the audit-log sink"],
      ["PROCESSED_BUCKET", "transform", "Yes", "Destination bucket for generated STEPXML"],
      ["COMP_CODE", "transform", "No", "Company-code fallback in some brand flows"],
      ["LAMBDA_TMP_DIR", "transform (set at runtime)", "No", "Per-brand temp workspace root; must be set before ETL imports"],
      ["AWS_LAMBDA_FUNCTION_NAME", "both (AWS-provided)", "Auto", "Read by AuditLogger.flush for audit metadata"],
      ["STIBO_TOKEN_URL", "delivery", "Yes", "OIDC token endpoint URL"],
      ["STIBO_CLIENT_ID", "delivery", "Yes", "OIDC client ID"],
      ["STIBO_CLIENT_SECRET", "delivery", "Yes", "OIDC client secret - source from AWS Secrets Manager"],
      ["STIBO_GRANT_TYPE", "delivery", "No", "Default client_credentials"],
      ["STIBO_INBOUND_URL_ARTICLE_PLANNING", "delivery", "Yes", "IIEP_ArticlePlanning upload-direct URL"],
      ["STIBO_INBOUND_URL_EAN_UPDATE", "delivery", "Yes", "IIEP_EANUpdate upload-direct URL"],
      ["STIBO_INBOUND_URL_ARTICLE_MAINTENANCE", "delivery", "Yes", "IIEP_ArticleMaintenance upload-direct URL"],
      ["STIBO_CONTEXT", "delivery", "No", "Context query parameter; default Context1"],
      ["STIBO_WORKSPACE", "delivery", "No", "Workspace query parameter; default Main"],
      ["STIBO_MAX_RETRIES", "delivery", "No", "Upload retry attempts; default 3"],
      ["STIBO_RETRY_BACKOFF", "delivery", "No", "Backoff base seconds (exponential); default 2"],
      ["STIBO_TOKEN_LEEWAY", "delivery", "No", "Seconds before expiry to refresh the token; default 30"],
      ["STIBO_DRY_RUN", "delivery", "No", "1/true/yes: validate token and routing, skip the POST"],
    ],
    [34, 16, 12, 38],
    { fontSize: 18 }
  ));
  el.push(spacer());

  // ── Appendix E ──
  el.push(h1("Appendix E. Glossary"));
  el.push(p("Terms as used in this document and in the team's working material. Where a term has a brand-specific meaning in Stibo STEP, the Stibo meaning is given."));
  el.push(tableCaption("Table E-1 - Glossary"));
  el.push(bizTable(
    ["Term", "Definition"],
    [
      ["AT_ ID", "Stibo attribute identifier prefix (e.g. AT_Color) used in STEPXML Value elements"],
      ["bgId", "Background-process identifier returned by the IIEP upload; stored in receipt JSON"],
      ["BGP", "Background Process - STEP's asynchronous unit of work that imports an uploaded file"],
      ["BLANK_IDS", "Delivery option that empties CLH_ classification IDs so STEP matches by name"],
      ["Brand code", "Short code for a brand (e.g. ELL for Ellesse) used in codes and classifications"],
      ["BY", "Mapped retail brand family dimension (BY codes: MAA_CH/FF/SD/SP/PY/GO, FTL_SP/FF)"],
      ["CLH_", "Classification ID prefix in generated STEPXML (brand batches and season nodes)"],
      ["COE", "Center of Excellence - team curating mapping, MDD and naming conventions"],
      ["Company code (compcode)", "SAP legal-entity code; 0888 = PT. MAP Aktif Adiperkasa Tbk"],
      ["DC_Barcode", "STEP data-container type carrying barcode attributes on variants"],
      ["Direct from Principal", "Mapping type: value copied straight from a source column"],
      ["DTB", "Adidas detail file family (routed to Article Maintenance)"],
      ["EAN", "European Article Number; barcode delivered via EAN Update flows"],
      ["ETL", "Extract-Transform-Load; here the brand-specific Excel-to-STEPXML modules"],
      ["Fan-out", "Router behaviour re-running all brands when a global file changes"],
      ["Generic article", "Style/colour level product (PRD_GenericArticle) holding variants"],
      ["IIEP", "Inbound Integration End Point - STEP's configured inbound file receiver"],
      ["Inline / Licensed", "Business model of the brand assortment (own line vs licensed distribution)"],
      ["KeyValue / KEY_InboundArticle", "STEP unique-key mechanism carrying the inbound article identity"],
      ["Lambda", "AWS Lambda function; two exist: validate-transform and send-to-step"],
      ["LOV", "List of Values - validated value list in STEP (e.g. Brand, Season, Color Code)"],
      ["MAA", "The organisation's sports business unit family (e.g. MAA Sport, SBU code SP)"],
      ["MAP Portal", "Internal web application for controlled uploads with standardised naming"],
      ["MD mapping", "Value-translation table: raw source value to Stibo display value to LOV ID"],
      ["MDD", "Master Data Dictionary - attribute catalogue plus LOV workbook"],
      ["Mono / Multi", "Single-brand versus multi-brand batch indicator in file names"],
      ["OOR", "Open Order Report (Aldo) - routed to EAN Update"],
      ["PRD_GenericArticle / PRD_SingleArticle", "STEP product types used for style/colour level and single-level articles"],
      ["Principal", "Brand supplier; in code, the S3 folder name under raw/metadata/"],
      ["Recap Sample", "Business file type summarising style/colour per season (Article Planning)"],
      ["RNA", "Reference lookup sheet: country/company/SBU/brand master data"],
      ["SBU", "Strategic Business Unit (e.g. MAA Sport = SP)"],
      ["Season code", "Two-to-four letter season marker (SP, FW, SS27, SP2027...)"],
      ["SIS", "Legacy system cross-reference tables in the MDD (gender/age/brand/class codes)"],
      ["STEPXML", "Stibo STEP's native XML import/export format, conforming to PIM.XSD"],
      ["TAF", "ON Running test-and-feedback file family (routed to EAN Update)"],
      ["TDD", "Adidas top-down detail file family (routed to Article Maintenance)"],
      ["upload-direct", "IIEP REST Direct Receiver operation: POST file bytes with fileName/context/workspace"],
      ["Variant", "Size-level product (PRD_VariantArticle) nested under its generic article"],
      ["Workspace / Context", "STEP import targeting parameters (Main / Context1); required, no effect on this receiver"],
    ],
    [26, 74],
    { fontSize: 18 }
  ));
  el.push(spacer());

  // ── Appendix F ──
  el.push(h1("Appendix F. Source Artifacts Analysed"));
  el.push(p("All findings in this document derive from the artefacts below, analysed between 6 and 7 September 2026. Extraction scripts and intermediate analysis outputs are preserved alongside the artefacts so every number in this document can be reproduced."));
  el.push(tableCaption("Table F-1 - Analysed artefacts"));
  el.push(bizTable(
    ["Artefact", "Size / scope", "What was extracted"],
    [
      ["map-stibo-inbound-validate-transform-dev.zip", "121,836 lines of Python, 27 brand packages + router + audit + metadata helpers", "Routing logic, handler skeletons, ETL generations, loader duplication counts, validation behaviour, performance patterns, defect evidence (sys.exit, tmp collisions, dead audit calls)"],
      ["map-stibo-inbound-send-to-step-dev.zip", "599 lines, single module (v2.3)", "OIDC flow, upload-direct call, routing table, retry policy, receipts, blank_ids"],
      ["NEW - Brand mapping files Template.xlsx", "58 sheets; 29 brand tabs x 234 rows; 15 MD-mapping tabs; hidden MDD (167 attrs); RNA tab (2,364 rows)", "Column semantics, mapping-type taxonomy and variants, rule archetypes with verbatim text, applicability letters, value-pair counts, data gaps"],
      ["Master Data Dictionary (MAA).xlsx", "87 sheets; Core Attributes 401 rows x 40 cols; 64 LOV sheets (~43,352 entries)", "Attribute metadata schema, cardinality and type distributions, LOV inventory with counts, validation base types, business rules sheet"],
      ["Brand Input files & Naming convention.xlsx", "2 sheets (COE Question; Stibo 89x59)", "Naming proposal vs practice, brand/file-type matrix, open COE questions"],
      ["0888-SP-ELLESSE-Recap Sample MAA Sport Licensed-Multi-SP2027-ID-1.xlsx", "39.8 MB; 9 sheets (ELL, Mapping, MAPPING GEN ART, hidden data sheets)", "Real input layout: header conventions, 2nd-ingestion columns, granularity (row per style+colour), naming cross-check"],
      ["Vendor documentation (doc.stibosystems.com, release notes 2025.x-2026.x)", "~30 targeted retrievals", "IIEP REST Direct semantics, REST API v2 model endpoints (2026.1), monitoring APIs, BGP attachments, event OIEPs, SaaS/AI roadmap items cited in Chapters 10 and 16"],
      ["Team explanations (interview-style)", "MAP Portal description; user groups; Stibo access via environment variables", "Portal dropdown contract, upload workflow, role model - marked as assumptions where uncorroborated"],
    ],
    [26, 26, 48],
    { fontSize: 18 }
  ));

  return el;
}

module.exports = { build };
