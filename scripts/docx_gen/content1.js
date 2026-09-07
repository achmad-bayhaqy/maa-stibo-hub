// content1.js — Chapters 1–5
const { h1, h2, h3, p, bullet, tableCaption, bizTable, figure, codeBlock, spacer, note } = require("./helpers");

function build() {
  const el = [];

  // ════════════════════════════════ CHAPTER 1 ════════════════════════════════
  el.push(h1("1. Introduction"));

  el.push(h2("1.1 Purpose of This Document"));
  el.push(p("This document is the first consolidated technical documentation of the MAP\u2013Stibo master data integration landscape. It describes the system exactly as it exists today (September 2026): how product master data files are uploaded through the MAP Portal, how they are named and stored in Amazon Web Services (AWS), how two AWS Lambda functions validate, transform and route the data, and how the resulting STEPXML files are delivered into Stibo STEP through Inbound Integration End Points (IIEPs). Until now this knowledge has existed only inside source code, spreadsheet conventions and the memory of individual team members; this manual turns it into a shared, reviewable reference."));
  el.push(p("The document serves three goals. First, it enables onboarding: a new member of the COE, Brand or IT team should be able to understand the end-to-end flow without reading the source code. Second, it establishes an operational baseline: the runbook chapters give operations staff a systematic way to diagnose failures and to execute recurring procedures such as onboarding a brand or refreshing the Master Data Dictionary. Third, it records risks and technical debt openly - including defects, dead code and governance gaps - so that improvement work can be prioritised on facts rather than recollection."));

  el.push(h2("1.2 Scope"));
  el.push(p("The documentation covers the inbound product master data pipeline in its entirety: the MAP Portal as the user entry point, the standardised naming convention, the S3 storage layout, the EventBridge trigger, the map-stibo-inbound-validate-transform Lambda (router, 27 brand handlers and their ETL modules), the reference data workbooks (Master Data Dictionary, brand mapping template, RNA lookup, naming convention), the STEPXML output format, the map-stibo-inbound-send-to-step Lambda, and the Stibo STEP IIEP integration including authentication, routing and receipts. Observability (audit logs, CloudWatch, STEP-side monitoring), security observations, known issues and an operational runbook are documented in dedicated chapters."));
  el.push(p("Out of scope are the internal configuration of Stibo STEP itself (data model setup, workflows and business rules inside the STEP Workbench), the MAP Portal implementation internals (which are documented here only from the outside, based on observed behaviour and the team's description), outbound integrations that consume data from STEP, and commercial or licensing matters. Wherever this document relies on information that could not be verified from code or files, the statement is explicitly marked as an assumption."));

  el.push(h2("1.3 Intended Audience and Reading Paths"));
  el.push(p("The primary audience is the internal team that owns and operates the pipeline: the COE team that curates mapping and reference data, the Brand teams that prepare and upload principal files, and the IT team that operates AWS and the integration code. Executive and management readers are served by Chapter 2 (System Overview) and Chapter 16 (Recommendations), which can be read standalone. The table below suggests reading paths per role."));
  el.push(tableCaption("Table 1-1 - Reading paths per role"));
  el.push(bizTable(
    ["Role", "Essential chapters", "Purpose"],
    [
      ["Management / sponsor", "2, 13, 16", "Understand the system, its risks and the improvement roadmap"],
      ["COE team (mapping & data)", "3, 4, 8, 9, 15", "Understand how reference workbooks and naming drive the pipeline"],
      ["Brand team (uploaders)", "3, 4, 11", "Learn the upload workflow, naming rules and what happens after upload"],
      ["IT / DevOps", "5, 6, 7, 10, 12, 13, 14, 15", "Operate, troubleshoot and evolve the AWS and integration layers"],
      ["New engineer onboarding", "All chapters, in order", "Full understanding before touching the code"],
    ],
    [24, 30, 46]
  ));
  el.push(spacer());

  el.push(h2("1.4 Document Conventions"));
  el.push(p("The document uses British-neutral English and follows standard technical-manual conventions. Key terms are defined in the Glossary (Appendix E) and are written with their full name followed by the abbreviation on first use, for example Inbound Integration End Point (IIEP). Code artefacts - file names, functions, environment variables, S3 keys and XML elements - are set in a monospaced font, for example router.lambda_handler or STIBO_TOKEN_URL. Literal file-name examples are shown as they appear in the system, including spaces, because spaces are genuinely part of the current naming convention."));
  el.push(p("Statements that could not be verified against source code or analysed files are prefixed with the word Assumption and are listed per chapter. Cross-references use chapter and section numbers (for example see Section 10.3). Warnings that describe live defects use a caution note. All quantitative statements - row counts, sheet counts, line counts - were measured directly on the analysed artefacts in September 2026 and are reproducible with the scripts listed in Appendix F."));

  el.push(h2("1.5 Source Materials and Documentation Method"));
  el.push(p("This documentation was produced by systematic reverse-engineering of the artefacts listed in Appendix F. The two Lambda code bases were extracted and reviewed: map-stibo-inbound-validate-transform-dev (121,836 lines of Python across 27 brand folders, a shared router, an audit logger and S3 metadata helpers) and map-stibo-inbound-send-to-step-dev (599 lines, a single Python module). The four reference workbooks - NEW - Brand mapping files Template.xlsx (58 sheets), Master Data Dictionary (MAA).xlsx (87 sheets), Brand Input files & Naming convention.xlsx and one real input sample (0888-SP-ELLESSE-Recap Sample MAA Sport Licensed-Multi-SP2027-ID-1.xlsx) - were analysed sheet by sheet with scripted extraction."));
  el.push(p("Current Stibo STEP capabilities were verified against the vendor's online documentation for releases 2025.x-2026.x so that Chapter 10 and Chapter 16 reflect the platform as it exists today, not folklore. The MAP Portal itself is described from the owning team's explanation and from its observable output (the standardised file names); this is the only component documented without direct access to its implementation, and Section 3.5 lists the resulting open questions. No production data was accessed beyond the supplied sample file; all examples in this document come from that sample or from the code."));

  el.push(h2("1.6 Business and System Context"));
  el.push(p("The organisation (PT. MAP Aktif Adiperkasa Tbk, company code 0888, referred to here as MAP) is a multi-brand sports and lifestyle retailer operating in Indonesia. It distributes dozens of international brands - among them adidas, Nike, New Balance, Crocs, Asics, Birkenstock, Clarks, Ellesse and roughly twenty more - each of which supplies product information in its own Excel dialect, its own season calendar and its own naming habits. Stibo STEP is the master data management (MDM) platform of record: it holds the unified product master that feeds downstream retail, e-commerce and ERP processes."));
  el.push(p("Because every brand principal sends data differently, the company built an AWS-based integration layer that absorbs the heterogeneity: one web portal for controlled uploads, one validation-transformation Lambda that contains per-brand ETL logic, and one delivery Lambda that speaks the Stibo API. The pipeline is entirely event-driven and file-based: Excel in, STEPXML out. Understanding this design intent - centralised ingestion, brand-isolated transformation, single delivery channel - is the key to every chapter that follows."));

  // ════════════════════════════════ CHAPTER 2 ════════════════════════════════
  el.push(h1("2. System Overview"));

  el.push(h2("2.1 The Solution in One Paragraph"));
  el.push(p("A user uploads a brand Excel file through the MAP Portal, which stores it in an S3 raw bucket under a standardised name such as 0888-SP-ELLESSE-Recap Sample MAA Sport Licensed-Multi-SP2027-ID-1.xlsx. The upload event triggers a validation-transformation Lambda that identifies the brand from the S3 folder, classifies the business file type from the file name, validates that all required companion files are present, and runs a brand-specific extract-transform-load (ETL) module that maps the Excel content onto the Stibo data model using the reference workbooks (Master Data Dictionary, brand mapping template, RNA lookup). The output is a STEPXML file written to a processed bucket, whose arrival triggers a second Lambda that authenticates against Stibo STEP with OAuth 2.0 client credentials and POSTs the XML to one of three Inbound Integration End Points. Every step leaves an audit trail in S3 and CloudWatch."));

  el.push(h2("2.2 Component Inventory"));
  el.push(p("The landscape consists of nine cooperating components. Table 2-1 lists each component with its technology and its role in the pipeline; Figure 2-1 shows how they connect."));
  el.push(tableCaption("Table 2-1 - Component inventory"));
  el.push(bizTable(
    ["Component", "Technology", "Role"],
    [
      ["MAP Portal", "Web application (internal)", "Controlled upload UI; builds the standardised file name from dropdown selections and writes to S3"],
      ["S3 raw bucket", "AWS S3", "Landing zone: raw/metadata/{brand}/ for brand files; raw/metadata/ root for global reference files; raw/logs/ for audit JSON"],
      ["EventBridge", "AWS EventBridge", "Emits S3 ObjectCreated events that trigger the transform Lambda"],
      ["Validate-transform Lambda", "Python 3.12, pandas/openpyxl/pyxlsb", "Router + 27 brand handlers + ETL modules; converts Excel to STEPXML"],
      ["Reference workbooks", "Excel on S3", "Master Data Dictionary (attributes + LOVs), brand mapping template, attributes list, RNA lookup, naming convention"],
      ["S3 processed bucket", "AWS S3", "processed/stepxml/{brand}/*.xml plus bgid/ receipts"],
      ["Send-to-step Lambda", "Python 3.12, stdlib + boto3", "Filename-based endpoint routing, OIDC authentication, XML upload with retries, bgId receipts"],
      ["Stibo STEP IIEPs", "REST Direct Receiver", "Three inbound endpoints (Article Planning, EAN Update, Article Maintenance) feeding STEP background processing"],
      ["Observability", "S3 JSON + CloudWatch", "Per-invocation audit logs, Lambda logs, STEP monitoring APIs"],
    ],
    [22, 24, 54]
  ));
  el.push(spacer());

  el.push(h2("2.3 End-to-End Architecture"));
  el.push(p("Figure 2-1 shows the five layers of the landscape, from the human entry point down to Stibo STEP. Two design decisions stand out. First, the pipeline is fully event-driven: there are no schedulers and no polling loops; every S3 object creation is the trigger for exactly one unit of work. Second, transformation and delivery are deliberately separated into two Lambda functions coupled only by an S3 folder, which allows each to fail, retry and evolve independently."));
  el.push(...figure("fig1_architecture.png", "Figure 2-1 - End-to-end system architecture of the MAP-Stibo inbound pipeline", 560));

  el.push(h2("2.4 Design Principles Observed in the Current System"));
  el.push(p("Five recurring principles explain most of the implementation choices and are worth naming explicitly, because any future change should preserve or consciously revise them."));
  el.push(bullet([{ t: "Event-driven, file-based integration. ", b: true }, { t: "Every upload is a self-contained unit of work; state lives in S3 objects, not in databases. This keeps the system simple and replayable, at the price of file-name conventions becoming a de-facto API." }]));
  el.push(bullet([{ t: "Brand isolation. ", b: true }, { t: "Each brand has its own S3 folder, its own handler package and its own ETL modules, so a defect in one brand's transformation cannot corrupt another brand's output - but it also produced large amounts of duplicated code (Chapter 6)." }]));
  el.push(bullet([{ t: "Configuration lives in Excel. ", b: true }, { t: "The mapping rules, list-of-values (LOV) dictionaries and organisational lookups are maintained by the COE team in workbooks, not in code. The newest brand implementations already read these workbooks at runtime as configuration." }]));
  el.push(bullet([{ t: "Resume-on-incomplete. ", b: true }, { t: "Because a brand may upload its file before its companion files, the pipeline tolerates missing inputs by exiting gracefully and retrying on the next upload event instead of failing loudly (Section 6.2)." }]));
  el.push(bullet([{ t: "Audit-first observability. ", b: true }, { t: "Every invocation writes a structured JSON audit document covering routing, classification, downloads, conversions, ETL statistics and uploaded XML keys (Chapter 12), giving full traceability from S3 event to delivered XML." }]));

  // ════════════════════════════════ CHAPTER 3 ════════════════════════════════
  el.push(h1("3. MAP Portal (User Entry Point)"));

  el.push(h2("3.1 Role in the Landscape and User Groups"));
  el.push(p("The MAP Portal is the single sanctioned way for humans to put brand files into the pipeline. It is a web application that abstracts the S3 naming and folder rules into a guided form: the user never types a file name and never chooses a folder. Its user base spans four groups with different responsibilities: the COE team, which curates the reference data and typically uploads global files such as the Master Data Dictionary; the Brand teams, which upload principal files (line lists, recaps, order forms) each season; the IT team, which operates the portal and the pipeline behind it; and a set of selected business users with upload rights."));
  el.push(note([{ t: "Assumption: ", b: true }, { t: "the portal's internal implementation, authentication mechanism and user administration are not documented here because the source was not available for analysis. This chapter describes observed behaviour: the dropdown contract, the generated file names and the S3 write target. Section 3.5 lists what should be captured to close this gap." }]));

  el.push(h2("3.2 Upload Workflow"));
  el.push(p("An upload session consists of two steps. First, the user classifies the file by selecting eight values from dropdown lists; every value has a display label and a code, and only the code reaches the file name. Second, the user drops the Excel file, and the portal uploads it to the S3 raw bucket under the folder of the selected brand, with the standardised name composed from the dropdown codes."));
  el.push(tableCaption("Table 3-1 - Dropdown contract of the MAP Portal (display label - code used in file name)"));
  el.push(bizTable(
    ["Dropdown", "Example selection", "Code in file name"],
    [
      ["Company Code", "PT. MAP Aktif Adiperkasa Tbk", "0888"],
      ["Season", "Spring", "SP"],
      ["Brand Name / Principal", "ELLESSE", "ELLESSE"],
      ["File Type", "Recap Sample", "Recap Sample"],
      ["SBU", "MAA Sport (SP)", "MAA Sport (SP)"],
      ["License / Inline", "License", "Licensed"],
      ["Multi / Mono", "Multi", "Multi"],
      ["Country", "Indonesia", "ID"],
    ],
    [22, 40, 38]
  ));
  el.push(spacer());
  el.push(p("The SBU and License selections are appended to the file-type segment, so the file-type part of the name carries three facts at once. In the worked example the file type segment becomes Recap Sample MAA Sport Licensed. The Multi/Mono indicator records whether the file covers a single brand or several, and the country code identifies the market for which the data is destined."));

  el.push(h2("3.3 Automated File Naming"));
  el.push(p("The generated name concatenates the dropdown codes with hyphens, appends a sequence number and the original extension. Figure 3-1 decodes every segment of the real sample name. The sequence number (the trailing -1) increments on repeated uploads of the same classification, which gives natural versioning: the ETL lists the brand folder and takes the latest file of each classified type."));
  el.push(...figure("fig2_naming.png", "Figure 3-1 - Segment decoder for the standardised input file name (worked example from the supplied sample)", 565));

  el.push(h2("3.4 Write Target and Downstream Effect"));
  el.push(p("The portal writes the object to s3://{RAW_BUCKET}/raw/metadata/{brand-folder}/, where the brand folder is the lower-case principal used by the router (for example ellesse). Global reference files - the Master Data Dictionary, the attributes list and the naming workbook - are uploaded by the COE team to the raw/metadata/ root without a brand folder, which the router recognises as a global event and fans out to every brand (Section 5.5). From the moment the object lands, the pipeline is fully automatic: the portal's responsibility ends at the S3 write, and the user's confirmation is the S3 upload success message rather than a transformation result. Consequences of this design are discussed in Chapter 16 (the user currently learns about validation problems only indirectly, through the COE team or the audit logs)."));

  el.push(h2("3.5 Documented Assumptions and Open Questions"));
  el.push(p("Four aspects of the portal should be captured formally, because the pipeline contract depends on them. First, the exact mapping from dropdown selection to brand folder code (for example ELLESSE to ellesse, DR MARTENS to dr-martens) - currently inferred from the router registry. Second, the authentication model and the user-permission matrix (who may upload for which brand). Third, the portal-side validation, if any, of file extension and size. Fourth, whether the portal enforces or merely encourages the sequence-number convention. These gaps are reflected as items in the Known Issues register (Chapter 13) and in the recommendation to formalise the naming convention (Section 4.4)."));

  // ════════════════════════════════ CHAPTER 4 ════════════════════════════════
  el.push(h1("4. Naming Convention and File Classification"));

  el.push(h2("4.1 Why the File Name Is an Interface"));
  el.push(p("In the current architecture the file name is the primary machine-readable metadata carrier. The transform Lambda uses it three times: to classify the business file type (which ETL module to run), to extract season, SBU and country context, and - in the delivery stage - to choose the Stibo IIEP endpoint. Changing the naming scheme is therefore not cosmetic: any change is a breaking change to at least three consumers. This chapter documents the de-facto convention as implemented, and contrasts it with the proposal that the COE team has recorded but not yet ratified."));

  el.push(h2("4.2 Filename Segment Decoder"));
  el.push(tableCaption("Table 4-1 - Filename segments and their consumers"));
  el.push(bizTable(
    ["Segment", "Example", "Meaning", "Primary consumers"],
    [
      ["Company code", "0888", "SAP company code of the legal entity (0888 = PT. MAP Aktif Adiperkasa Tbk)", "ETL defaults (AT_CompanyCode)"],
      ["SBU code", "SP", "Strategic business unit (SP = MAA Sport)", "ETL defaults (AT_SBU), audit metadata"],
      ["Brand name", "ELLESSE", "Principal brand name as displayed in the portal dropdown", "Human readers; brand itself is taken from the S3 folder, not the name"],
      ["File type block", "Recap Sample MAA Sport Licensed", "Business file type plus embedded SBU and License qualifiers", "File-type classification, ETL dispatch, endpoint routing"],
      ["Multi / Mono", "Multi", "Multi-brand or mono-brand batch", "Classification context"],
      ["Season + year", "SP2027", "Season code with full year (SP, FW, and variants)", "Season classification, classification hierarchy naming"],
      ["Country", "ID", "Destination market (ID = Indonesia)", "Country defaults, currency resolution"],
      ["Sequence", "1", "Upload counter per classification; increments on re-upload", "Latest-wins file selection in the ETL"],
    ],
    [16, 22, 34, 28]
  ));
  el.push(spacer());

  el.push(h2("4.3 File Type Taxonomy and Endpoint Mapping"));
  el.push(p("The delivery Lambda routes every XML by case-insensitive regular expressions over the file name. The rules are evaluated in order and the first match wins, so more specific patterns are deliberately placed before broader ones - for example, TDD must be matched before Price List, because a file named TDD and Price List contains the latter phrase. Table 4-2 reproduces the complete, ordered rule set from the send-to-step function; it is effectively the contract between the transform layer and Stibo."));
  el.push(tableCaption("Table 4-2 - Filename routing rules to Stibo endpoints (ordered, first match wins)"));
  el.push(bizTable(
    ["#", "Pattern (regex, case-insensitive)", "Endpoint", "Typical files"],
    [
      ["1", "\\btdd\\b", "Article Maintenance", "Adidas TDD files"],
      ["2", "\\bdtb\\b", "Article Maintenance", "Adidas DTB files"],
      ["3", "ecommerce|eommerce", "Article Maintenance", "E-commerce content files (incl. common misspelling)"],
      ["4", "line\\s*list", "Article Planning", "Line lists (all spellings: Line List, Linelist, LineList)"],
      ["5", "linesheet", "Article Planning", "Linesheets"],
      ["6", "recap\\s*sample", "Article Planning", "Recap sample files (e.g. the Ellesse SP2027 sample)"],
      ["7", "price\\s*list", "Article Planning", "Price lists"],
      ["8", "price\\s*master", "Article Planning", "Price master (Dr. Martens)"],
      ["9", "product\\s*bible", "Article Planning", "2XU product bible"],
      ["10", "\\binline\\b", "Article Planning", "Inline catalogues"],
      ["11", "receive.*linelist; 1st\\s*revise.*linelist; 2nd\\s*revise.*linelist", "Article Planning", "Revised line list rounds"],
      ["12", "ofs[-\\s]*fc[-\\s]*pt[-\\s]*mitra", "Article Planning", "Birkenstock OFS FC PT Mitra"],
      ["13", "fob.*(order\\s*form|orderform); order-form-with-lotto combinations", "Article Planning", "FOB and Lotto order forms"],
      ["14", "backlog", "EAN Update", "Backlog files"],
      ["15", "ean\\s*source", "EAN Update", "EAN source files (many brands)"],
      ["16", "order\\s*sheet", "EAN Update", "Order sheets"],
      ["17", "packing\\s*list; packaging\\s*list", "EAN Update", "Packing / packaging lists"],
      ["18", "\\boor\\b", "EAN Update", "Open order reports (Aldo)"],
      ["19", "order\\s*confirmation", "EAN Update", "Order confirmations (2XU, Nike, Crocs)"],
      ["20", "open\\s*shipment; shipment\\s*confirmation", "EAN Update", "Shipment documents (Crocs)"],
      ["21", "order\\s*form", "EAN Update", "Generic order forms (fallback after the FOB/Lotto-specific rules)"],
      ["22", "\\btaf\\b; planet\\s*sport", "EAN Update", "ON Running TAF and Planet Sport files"],
      ["23", "fob\\s*order(?!\\s*form|form)", "EAN Update", "FOB order documents that are not order forms"],
    ],
    [6, 34, 20, 40],
    { fontSize: 18 }
  ));
  el.push(spacer());
  el.push(note([{ t: "Consequence: ", b: true }, { t: "a new business file type must be registered in three places at once - the brand handler's keyword dictionary (transform), the routing table above (delivery) and the naming dropdown in the MAP Portal. Missing any one produces files that are transformed but never delivered, or delivered to the wrong endpoint. This triple-registration is a known maintenance burden (Chapter 13)." }]));

  el.push(h2("4.4 Current Practice versus the COE Naming Proposal"));
  el.push(p("The naming workbook contains a proposal that has not been implemented: [compcode]-[SBU Code]-[Brand Code]-[Season Code + YY]-[Inline/Licensed]-[Source File Type]-[Multi/Mono]-[Sequence Number]. The real sample deviates from it in three ways: it uses the brand name instead of the brand code (ELLESSE instead of ELL), it embeds SBU and License inside the file-type segment, and it uses the full year (SP2027) instead of the two-digit year (SP27). Table 4-3 summarises the differences. Until the convention is ratified and the portal updated, the pipeline must keep tolerating both variants; the ETL classification is therefore keyword-based rather than position-based."));
  el.push(tableCaption("Table 4-3 - Current naming practice vs. the unratified COE proposal"));
  el.push(bizTable(
    ["Aspect", "Current practice (observed)", "COE proposal (not yet live)"],
    [
      ["Segment order", "compcode-SBU-brandname-filetype(+SBU+License)-multimono-seasonFY-country-seq", "compcode-SBU-brandcode-seasonYY-licensetype-filetype-multimono-seq"],
      ["Brand identifier", "Brand name (ELLESSE)", "Brand code (ELL)"],
      ["Year form", "Full year (SP2027)", "Two-digit year (SP27)"],
      ["SBU / License", "Embedded in file-type block", "Separate dedicated segments"],
      ["Country", "Present (ID)", "Not in the proposal"],
    ],
    [20, 42, 38]
  ));
  el.push(spacer());

  el.push(h2("4.5 Supported Input Formats and Conversion"));
  el.push(p("The pipeline accepts .xlsx natively, and the brand handlers convert two further formats before parsing: .xlsb (binary Excel, used by some principals for large files) and .csv. Conversions use pandas with the pyxlsb engine and write a temporary .xlsx into the brand's work directory; conversion outcomes are recorded in the audit document. Some brand flows also tolerate .xlsm. Because conversion changes timestamps and may lose sheet-level quirks, the documentation of each brand's ETL in Chapter 7 notes whether its principals actually send non-xlsx files. Files with macros other than xlsm, password-protected workbooks and non-Excel formats are not supported and will fail classification."));

  // ════════════════════════════════ CHAPTER 5 ════════════════════════════════
  el.push(h1("5. AWS Infrastructure and Routing Layer"));

  el.push(h2("5.1 S3 Storage Layout"));
  el.push(p("Two buckets carry all persistent state (their names are injected via the RAW_BUCKET and PROCESSED_BUCKET environment variables). The raw bucket is both the landing zone for inputs and the archive for audit evidence; the processed bucket holds the generated STEPXML and the delivery receipts. Table 5-1 lists every prefix with its producer and consumer."));
  el.push(tableCaption("Table 5-1 - S3 prefix layout"));
  el.push(bizTable(
    ["Prefix", "Written by", "Read by", "Content"],
    [
      ["raw/metadata/{brand}/", "MAP Portal", "Transform Lambda (brand files)", "Standardised brand Excel files"],
      ["raw/metadata/ (root)", "COE via MAP Portal", "Transform Lambda (all brands)", "Global Master Data Dictionary, Attributes List, Naming workbook"],
      ["raw/logs/{brand}/", "Transform Lambda", "Operations", "Audit JSON, one per invocation: raw/logs/{brand}/{YYYYMMDD_HHMMSS}.json"],
      ["processed/stepxml/{brand}/", "Transform Lambda", "Send-to-step Lambda", "Generated STEPXML files"],
      ["processed/stepxml/bgid/{brand}/", "Send-to-step Lambda", "Operations, future feedback loop", "Delivery receipts: file name, bgId, endpoint, timestamp"],
    ],
    [26, 22, 24, 28]
  ));
  el.push(spacer());

  el.push(h2("5.2 EventBridge Trigger"));
  el.push(p("An EventBridge rule with event pattern s3:ObjectCreated:* on the raw bucket invokes the transform Lambda for every new object. The event payload carries only the bucket name and object key; everything else - brand, file type, season - is derived from the key. Two behavioural consequences follow. First, re-uploading a file with an incremented sequence number is the mechanism for correction: nothing edits previous objects, the new file simply wins the latest-wins selection. Second, because every object triggers an invocation, accidental uploads to the wrong folder are harmless but noisy: the router returns an ignore or a no-processor response and writes an audit record."));

  el.push(h2("5.3 Lambda Function Inventory"));
  el.push(tableCaption("Table 5-2 - Lambda functions of the landscape"));
  el.push(bizTable(
    ["Function", "Runtime", "Trigger", "Handler", "Core dependencies"],
    [
      ["map-stibo-inbound-validate-transform-dev", "Python 3.12", "EventBridge (raw bucket ObjectCreated)", "router.lambda_handler", "boto3, pandas, openpyxl, pyxlsb (via layer; no pinned requirements file)"],
      ["map-stibo-inbound-send-to-step-dev", "Python 3.12", "S3 notification (processed bucket, prefix processed/stepxml/, suffix .xml)", "lambda_function.lambda_handler", "boto3 only (stdlib urllib for HTTP)"],
    ],
    [30, 12, 26, 14, 18]
  ));
  el.push(spacer());
  el.push(p("The transform Lambda is a single deployment unit containing the router and all 27 brand packages; a defect in one brand still requires redeploying the whole function. The delivery Lambda intentionally uses only the standard library for HTTP so that it has no layer dependencies and can be redeployed in isolation. Memory and timeout settings are not recorded in the code; the ETL code shows clear signs of being tuned for the 15-minute Lambda ceiling (worker pools capped at eight threads, streaming XML writing, explicit deletion of intermediate objects), which suggests a high-memory configuration."));

  el.push(h2("5.4 Router Behaviour"));
  el.push(p("The router is the single entry point and executes the decision flow of Figure 5-1: parse the event, gate on the raw/metadata/ prefix, distinguish brand-specific uploads from global files, look up the brand handler in the BRAND_ROUTER registry (27 entries), execute the handler inside an isolated try/except, and always flush the audit log. The registry maps the folder name (the principal) to a Python module: for example new-balance to new_balance.lambda_function (folder names cannot start with a digit, hence the underscore) and 2xu to twoxu.lambda_function. The full matrix is Appendix A."));
  el.push(...figure("fig3_router.png", "Figure 5-1 - Router decision flow including the global-file fan-out branch", 540));

  el.push(h2("5.5 Global File Fan-Out"));
  el.push(p("A file uploaded directly under raw/metadata/ (path depth three) or matching the global-name heuristics (mdd, master data, attribute in the file name) is treated as a global refresh. The router then loops over all 27 registered brands and, for each, builds a synthetic event with the key raw/metadata/{brand}/.__global_trigger__ - a placeholder name that deliberately matches no file-type keyword - and invokes the handler with a fresh auditor. Each brand re-runs its ETL against the newest global files and re-generates its XML outputs. Failures are isolated: one brand's exception is logged and does not stop the loop. Two properties of this design deserve attention: the fan-out runs all brands sequentially inside one invocation, which makes it the prime candidate for the 15-minute timeout as brand count grows (recorded as issue KI-02 in Chapter 13); and every fan-out rewrites every brand's XML, which multiplies S3 traffic and downstream STEP uploads by design."));

  el.push(h2("5.6 Environment Variables"));
  el.push(p("Configuration is exclusively environment-based. The transform Lambda needs RAW_BUCKET and PROCESSED_BUCKET, optional COMP_CODE fallback, and sets a per-brand temporary directory root. The delivery Lambda requires the three STIBO_INBOUND_URL_* endpoint URLs and the OIDC triple STIBO_TOKEN_URL, STIBO_CLIENT_ID and STIBO_CLIENT_SECRET (recommended from Secrets Manager), and tunes behaviour through STIBO_CONTEXT, STIBO_WORKSPACE, STIBO_MAX_RETRIES, STIBO_RETRY_BACKOFF, STIBO_TOKEN_LEEWAY and STIBO_DRY_RUN. Appendix D documents every variable with its function and default."));

  el.push(h2("5.7 Dependencies and Runtime Characteristics"));
  el.push(p("The transform Lambda depends on pandas, openpyxl and pyxlsb in addition to boto3; the repository contains no requirements.txt or version pins, which means the runtime layer contents must be documented and locked manually (issue KI-10). The delivery Lambda deliberately uses urllib instead of a requests library, keeping it dependency-free. Both functions run on Python 3.12. Observed performance patterns inside the ETL code - thread pools capped at eight workers, streaming XML with a one-megabyte buffer, deliberate garbage collection of intermediates - indicate that the real constraint is the Lambda timeout rather than memory, and that the largest brand files today run close to but within the ceiling. The supplied sample file (39.8 MB, nine sheets, 39 MB of which is one hidden data sheet) illustrates the volume class the pipeline must digest."));

  return el;
}

module.exports = { build };
