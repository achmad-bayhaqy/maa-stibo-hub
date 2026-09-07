// content2.js — Chapters 6–10
const { h1, h2, h3, p, bullet, tableCaption, bizTable, figure, codeBlock, spacer, note } = require("./helpers");

function build() {
  const el = [];

  // ════════════════════════════════ CHAPTER 6 ════════════════════════════════
  el.push(h1("6. Inbound Validate and Transform Pipeline"));

  el.push(h2("6.1 Anatomy of a Brand Handler"));
  el.push(p("Every brand folder contains a lambda_function.py handler with the same twelve-step skeleton, followed by one or more ETL modules holding the actual transformation. The handler receives (event, context, auditor) from the router and performs: event parsing; file-type detection by keyword; required-file policy evaluation; listing of the brand's files plus the global files (latest version wins); early return when mandatory companions are missing; work-directory preparation; download; format conversion; ETL dispatch; and XML upload. The steps below use the Ellesse handler as the reference; deviations of other brands are noted in Chapter 7."));
  el.push(tableCaption("Table 6-1 - Brand handler skeleton (steps in execution order)"));
  el.push(bizTable(
    ["Step", "Action", "Failure behaviour"],
    [
      ["1. Parse event", "Extract bucket and key from the EventBridge payload; URL-decode", "Returns 400 on malformed event"],
      ["2. Classify file", "Match file name against FILE_TYPE_KEYWORDS; first match wins; order-sensitive", "Unknown type: skip with audit note"],
      ["3. Required policy", "Look up REQUIRED_TYPES for the trigger (e.g. recap requires recap + mdd + attributes)", "Missing type: return 200 waiting_for_mandatory_files"],
      ["4. List files", "List S3 under brand prefix and raw/metadata root; select latest sequence per type", "S3 errors recorded in audit"],
      ["5. Prepare workspace", "Create /tmp/stibo_workdir_{brand}/input/{type} and /output/xml", " OS errors fatal"],
      ["6. Download", "Fetch each required file into its type folder", "Per-file download status in audit"],
      ["7. Convert", "xlsb / csv to xlsx via pandas when needed", "Conversion errors recorded; flow may continue without optional files"],
      ["8. Defaults", "Derive metadata from file name: company code, SBU, brand code, season, country", "Silent defaults; no user feedback"],
      ["9. Dispatch ETL", "Call the ETL module mapped for the detected type", "Exceptions propagate to router (except sys.exit - see KI-01)"],
      ["10. Upload XML", "Put generated XML to processed/stepxml/{brand}/", "Uploaded keys recorded in audit"],
    ],
    [18, 52, 30]
  ));
  el.push(spacer());

  el.push(h2("6.2 Required Companion Files and the Resume Model"));
  el.push(p("Each trigger type declares a required set of companion files - the business file itself plus typically mdd (Master Data Dictionary), attributes (attributes list) and, for some brands, naming (naming convention workbook). Because the COE team and brand teams upload independently, the pipeline assumes that any of these may be missing at the moment a business file arrives. Instead of failing, the handler returns HTTP 200 with the marker waiting_for_mandatory_files; no ETL runs. The model is self-healing: when the missing file is eventually uploaded, its own ObjectCreated event re-invokes the handler, which now finds a complete set and processes both. The cost is operational subtlety - a silent gap between upload and processing can only be detected by reading audit logs, which is why the runbook (Section 15.1) makes this check a daily routine."));

  el.push(h2("6.3 Temporary Workspace Conventions"));
  el.push(p("Handlers work under /tmp/stibo_workdir_{brand} (for example /tmp/stibo_workdir_ellesse, /tmp/stibo_workdir_smiggle), with the input/{type} and output/xml sub-tree. The directory root is communicated to the ETL modules through the LAMBDA_TMP_DIR environment variable, which must be set before the ETL modules are imported because some of them read it at import time; at least one brand (ANTA) defensively re-asserts it at runtime. New Balance and Diadora share the same /tmp/stibo_workdir root; within a single warm container two flows could theoretically collide, which is recorded as issue KI-09. Lambda storage is ephemeral, so the workspace doubles as the safety net: nothing persists between invocations except what is explicitly uploaded to S3."));

  el.push(h2("6.4 Three Generations of ETL Implementation"));
  el.push(p("The code base contains three coexisting implementation styles. Understanding which generation a brand belongs to is essential before changing it, because the extension points differ fundamentally."));
  el.push(h3("6.4.1 Generation 1 - Hard-coded mapping (about two thirds of brands)"));
  el.push(p("The oldest style maps each attribute in a dedicated function with the source column read explicitly (row.get(\"Column Name\")) and value translation performed through roughly 270 hard-coded Python dictionaries named LOV_* spread across 39 files. Adidas is the largest example: its main module carries dual column aliases to survive principal-side renames between seasons and emits about fifty empty placeholder attributes so downstream systems see a stable shape. This style is robust (no external dependencies) but every mapping change is a code change and a deployment."));
  el.push(h3("6.4.2 Generation 2 - Mapping-driven engine (ANTA, Birkenstock, Clarks, New Era, Reebok)"));
  el.push(p("The newest brands load the brand tab of the brand mapping template workbook at runtime and drive the transformation from it. The AttributeMappingLoader reads, per attribute row: the Stibo attribute ID (column B), the validation base type (column C, where LOV means the LOV ID must be resolved and written), the mapping type (column G - Direct, Formula in System and Mapping-from-Principal are processed; Manual and AI types are excluded from the output), the source column (column J) and the embedded value map (column K, entries of the form raw : id - label). The ANTA implementation documents the intent in its own docstring: adding an attribute is a spreadsheet edit, not a code change. Birkenstock re-implements the same concept independently with a dataclass-based engine, which is evidence of the pattern's value but also of missing shared infrastructure (issue KI-08). Both engines keep escape hatches: special hard-coded attribute IDs and a value-transform hook for the few rules that the sheet cannot express."));
  el.push(h3("6.4.3 Generation 3 - Multi-file enrichment (Adidas)"));
  el.push(p("Adidas additionally merges several business files per article: the line list is enriched from the TDD (top-down data) and backlog files, with explicit precedence when the same attribute appears in several sources. No other brand currently implements joins of this kind, which makes Adidas the reference for any future multi-source onboarding."));

  el.push(h2("6.5 Shared Loaders and the True Cost of Copy-Paste"));
  el.push(p("Six loader responsibilities recur in every brand: MDD attributes and LOVs, attributes list, RNA lookup, brand mapping template, MD-mapping value translations, and naming workbook. In a healthy code base these would be six shared modules. Instead, the current code contains 64 separate copies of the MDD loader class and 37 copies of the RNA loader, and the recap ETL engine was cloned across five brands (Ellesse, Lotto, K-Swiss, Airwalk, Astec) with about ninety percent identical code - a measured diff of roughly 200 lines out of 1,913. The practical consequence is that a fix to one loader (for example a new LOV sheet schema) must be replicated in up to 64 places, and history shows some of these copies have already drifted. Consolidation is the single highest-leverage refactoring available and heads the recommendation list in Chapter 16."));

  el.push(h2("6.6 Validation Rules Implemented Today"));
  el.push(p("Validation exists in five categories. File level: required companion sets and keyword classification. Field level: mandatory check - an attribute whose MDD cardinality is mandatory must be non-empty; the current implementation only records a warning and still writes the article. Membership: values with LOV validation are looked up in the loaded LOV dictionaries; the behaviour on miss varies by brand - skip the attribute, fall back to the raw text, or substitute a default. Format and derivation: date reformatting, price regexes, size-to-SAP-code conversion, zero padding and stripping of illegal XML characters. Cross-file: the RNA join for organisational attributes, TDD/backlog precedence for Adidas, and header sniffing with fallback columns for principals that rename columns. Notably, the audit infrastructure for per-article warnings exists (auditor.add_validation_warnings) but no ETL module calls it - the warnings are computed and then discarded (issue KI-03), so Chapter 12 documents the schema but today's logs carry little article-level evidence."));

  el.push(h2("6.7 Performance Patterns"));
  el.push(p("Three patterns keep the largest files inside the Lambda ceiling. First, article-level parallelism: pass one maps and validates articles with a ThreadPoolExecutor capped at eight workers, sized for the available vCPUs rather than I/O concurrency. Second, streaming serialisation: pass two writes XML incrementally with a one-megabyte buffer instead of building a DOM, so memory stays flat in the number of articles. Third, deliberate release: intermediate dataframes and dictionaries are deleted as soon as a pass completes, handing memory back before the XML stage. These patterns should be treated as mandatory for any new ETL module; a naive pandas-to-string XML build on a large recap file will exceed the ceiling."));

  // ════════════════════════════════ CHAPTER 7 ════════════════════════════════
  el.push(h1("7. Brand ETL Catalog"));

  el.push(h2("7.1 Master Inventory"));
  el.push(p("Table 7-1 is the authoritative list of the 27 registered brand packages as of September 2026, with their S3 folder names (principals), their business file types and ETL modules, and the mapping generation from Section 6.4. The endpoint column shows the Stibo IIEP that the delivery lambda selects for each file type (see Table 4-2)."));
  el.push(tableCaption("Table 7-1 - Brand handler inventory (27 registrations)"));
  el.push(bizTable(
    ["S3 principal", "Package", "File types / ETL modules", "Generation", "Notes"],
    [
      ["adidas", "adidas/", "linelist; backlog; tdd; dtb (+ global mdd, attributes, naming)", "1 + 3", "Multi-file merge; ~50 placeholder attributes; dual column aliases"],
      ["new-balance", "new_balance/", "linelist_footwear; linelist_apparel; linelist_licensed; ecommerce_inline; ecommerce_licensed; ordersheet_licensed; ean_source", "1", "Eight sub-flows behind one handler; strict detection order"],
      ["smiggle", "smiggle/", "linelist (catalogue/mapi/wholesale/handover); packing; ecommerce", "1", "Trigger-aware required sets"],
      ["aldo", "aldo/", "linelist / trenzashop; oor; mcr; ecommerce", "1 (partly inactive)", "Handler code largely commented; router entry active - see KI-04"],
      ["diadora", "diadora/", "pricelist", "1", "Shares /tmp root with New Balance (KI-09)"],
      ["crocs", "crocs/", "linelist; order_form_fw; order_form_accs_bag; order_form_jbz_ean; shipment_confirmation; barcode outputs", "1", "Adds DC_Barcode data containers"],
      ["2xu", "twoxu/", "linelist; product_bible; order_confirmation", "1", "Price formula AT_FOB = MSRP x 0.74; largest single ETL module (1,818 lines)"],
      ["lotto", "lotto/", "order form; fob_order_info; recap; pricelist", "1", "Order-form routing special case (Table 4-2 rule 13)"],
      ["onr", "onr/", "taf_ss26; linelist_planet_sport; linelist_footwear_taf; packaging_list_planet_sport", "1", "ON Running; TAF routed to EAN Update"],
      ["nike", "nike/", "sp27_maa_linelist; nike_360_linelist; nike_360_ean; orderConfirmation; linelist_rookie", "1", "Long keyword-variant chain for line list detection"],
      ["dr-martens", "dr_marten/", "retail_price_master", "1", "Composite-key MD mapping (product group from gender + sub-division)"],
      ["staccato", "staccato/", "linelist", "1", "-"],
      ["birkenstock", "birkenstock/", "OFS_FC_Mitra_ss27 (+ ecom mappings)", "2", "Independent dataclass mapping engine; extra LOVs (heel type/height/occasion)"],
      ["pazzion", "pazzion/", "order_form; barcode", "1", "MD mappings for heel height and material"],
      ["clarks", "clarks/", "order_form_accs; order_form_footwear; ean_source", "2", "Mapping-driven; copy-paste copy of AttributeMappingLoader"],
      ["steve-madden", "steve_madden/", "footwear_po; handbag_po; ean_source", "1", "-"],
      ["asics", "asics/", "footwear; app_acc; ean", "1", "-"],
      ["ptp", "PTP/", "order_form_usd_fob; ean_source", "1", "Folder in upper case; barcode containers like Crocs"],
      ["implus", "implus/", "linelist (balega / harbinger / sofsole sources); ean_update", "1", "Barcode containers; per-source ETL variants"],
      ["astec", "astec/", "recap", "1", "Clone of the recap engine"],
      ["airwalk", "airwalk/", "recap", "1", "Clone of the recap engine"],
      ["ellesse", "ellesse/", "recap", "1", "Reference implementation of the recap flow; RNA 4-pass fuzzy join"],
      ["k-swiss", "k_swiss/", "recap; global_line_order_form; ean_source", "1", "Recap clone plus order form"],
      ["reebok", "reebok/", "article_master_apparel; article_master_footwear; ean; recap", "2", "Mapping-driven; MD mapping sheets have known unmapped rows"],
      ["anta", "anta/", "linelist; ean", "2", "Reference implementation of the mapping-driven engine"],
      ["new-era", "new_era/", "order_form_acc; order_form_app; order_form_hw; delivery_schedule_ean", "2", "Mapping-driven"],
      ["anta-1", "anta_1/", "linelist; ean", "2", "Second ANTA registration (parallel config; folder documented as anta)"],
    ],
    [13, 12, 37, 10, 28],
    { fontSize: 16 }
  ));
  el.push(spacer());

  el.push(h2("7.2 Representative Brand Profiles"));
  el.push(h3("7.2.1 Ellesse - the recap reference flow"));
  el.push(p("The Ellesse handler implements the flow documented end-to-end in Section 11.1 and is the reference for the five recap-clone brands. Distinctive elements: it derives all organisational context from the file name (0888, SP, ELL, SP2027, ID); it resolves gender and age through a two-stage chain (raw value to MD-mapping display value to MDD LOV ID); and it joins the RNA sheet with a four-pass fuzzy strategy so that brand-name variations (Ellesse, ELLESSE Sport, ELL) still resolve to the right SBU and company code. Colour attributes follow a documented miss policy: when SAP Color cannot be resolved, the attribute is omitted entirely rather than written with raw text."));
  el.push(h3("7.2.2 Adidas - the multi-file merge"));
  el.push(p("Adidas receives three file families per season and merges them: the line list provides the article base, the TDD overrides detail attributes, and the backlog contributes EAN information, with documented precedence per attribute. The module also demonstrates two defensive habits worth copying: dual column aliases so a principal-side header rename does not break ingestion, and a fixed set of about fifty placeholder attributes written empty so the XML shape stays stable for downstream consumers."));
  el.push(h3("7.2.3 ANTA and Birkenstock - the mapping-driven engines"));
  el.push(p("These two brands are the live proof that the workbook can act as configuration: their attribute sets, source columns and value mappings come from the brand tabs of the mapping template at runtime. They differ in engine maturity (ANTA's loader is inline; Birkenstock's is a separate dataclass module with a typed transform hook) but agree on the core semantics, which makes them the natural starting point for the generic engine proposed in Chapter 16."));
  el.push(h3("7.2.4 Crocs, implus and PTP - barcode containers"));
  el.push(p("These brands extend the common XML shape with DataContainers of type DC_Barcode carrying barcode attributes (AT_Barcode, barcode type P, and a MainEANIndicator set to Y for the primary EAN). Any new brand that must deliver barcodes should reuse this pattern rather than invent a new container layout."));

  el.push(h2("7.3 Adding a New Brand or File Type Today"));
  el.push(p("Onboarding a brand is currently a code task. The steps are: create a package with the handler skeleton and ETL module (in practice by cloning the closest existing brand); register keyword dictionaries and required-type policies; add the handler import and BRAND_ROUTER entry; add endpoint routing patterns in the delivery Lambda if the file type is new; and update the portal dropdown lists. Estimated effort is days for a clone of an existing flow and weeks for a genuinely new business file type, dominated by mapping-template curation by the COE team and by test iterations against real principal files. The main risks are the triple-registration burden of Section 4.3 and the temptation to clone rather than consolidate, which is how the code base reached its current duplication level. The runbook (Section 15.4) gives the step-by-step checklist."));

  // ════════════════════════════════ CHAPTER 8 ════════════════════════════════
  el.push(h1("8. Reference Data and Mapping Framework"));

  el.push(h2("8.1 Master Data Dictionary (MAA).xlsx"));
  el.push(p("The Master Data Dictionary is the single source of truth for what a Stibo attribute is. Its Core Attributes sheet carries 401 attribute rows with 380 distinct AT_ identifiers across 40 metadata columns, including PIM name and ID, validation base type, minimum and maximum lengths, precision, multi-valued flag, cardinality, business rule text, default value, LOV name and display sequence. Cardinality distribution: 173 mandatory, 215 optional, 3 conditional (plus two rows whose value Optional Mandatory is ambiguous - a small but real data-quality defect). Validation base types follow the 15-type Stibo definitions documented on the Validation Base Type Definition sheet (integer, number, number range, fraction, date, ISO date, text, numeric text, LOV, regular expression, URL and variants). The type distribution across attributes is 150 text, 137 LOV, 44 number, 6 date and 64 blank - the blank ones being attributes whose validation is defined only in STEP."));
  el.push(p("The workbook also carries the Instructions sheet (Stibo's own attribute-worksheet specification), a Version History sheet, one Business Rules sheet that contains exactly one rule (BCI is mandatory for SPORTS and GOLF), and the LOV catalogue itself. Assumption: the workbook is maintained by the COE team and manually kept in sync with the STEP data model; Chapter 16 proposes replacing this manual sync with the STEP REST API v2 model endpoints, which since release 2026.1 expose attribute validators and LOVs programmatically."));

  el.push(h2("8.2 List of Values (LOV) Catalogue"));
  el.push(p("The dictionary contains 64 LOV and reference sheets with approximately 43,352 entries in total. Most LOV sheets follow a two-column display-value / ID convention (column A the human label, column B the Stibo ID), but the schemas are not uniform: the vendor sheet has three columns (company code, vendor ID, vendor name), the size-code sheet has seven, and several sheets are single-column. Table 8-1 lists the largest sheets to give a sense of scale. Schema drift is handled by the loader copies per brand - one more reason consolidation is urgent (issue KI-08)."));
  el.push(tableCaption("Table 8-1 - Largest LOV sheets (by row count)"));
  el.push(bizTable(
    ["LOV sheet", "Rows", "Notes"],
    [
      ["Vendor LOV", "32,663", "3 columns: company code + vendor ID + vendor name; per-company namespaces"],
      ["Size Code LOV", "5,061", "7 columns; SAP size codes"],
      ["Franchise LOV", "1,917", "Single column"],
      ["Retail Price Currency LOV", "183", "Currency per country"],
      ["Country Origin LOV", "239", "Country of origin values"],
      ["Color Code LOV", "222", "SAP colour codes"],
      ["Brand Group / Brand Category", "301 / 50", "Brand hierarchy attributes"],
      ["Season LOV", "9", "SP, SM, FL, WN, CO, SS, FW, AL"],
      ["All remaining 55 sheets", "approx. 2,900 combined", "Two-column display/ID convention"],
    ],
    [34, 18, 48]
  ));
  el.push(spacer());

  el.push(h2("8.3 RNA Master Lookup"));
  el.push(p("The sheet Source Mapping related RNA (2,364 rows by 15 columns, also embedded as a tab inside the mapping workbook) is the organisational spine of every ETL: it maps country to company code (7 countries, 23 company codes; 0888 = PT. MAP Aktif Adiperkasa Tbk), to SBU grouping, SBU (43 values), brand group, brand category, brand type, brand name, brand code, reporting brand code and name, brand status and BY codes (8 values such as MAA_CH, MAA_FF, MAA_SD, MAA_SP, MAA_PY, MAA_GO, FTL_SP, FTL_FF). The loaders perform a fuzzy, multi-pass join - brand name first, then reporting code, then looser matches - so the RNA is the fallback that lets even hard-coded brands resolve SBU and company attributes consistently. Any change to the organisational structure (new SBU, renamed brand) is made here and propagates to all brands on the next fan-out."));

  el.push(h2("8.4 Brand Mapping Template Workbook"));
  el.push(p("The NEW - Brand mapping files Template workbook is the negotiation table between COE and the brands: 29 brand tabs, each with an identical 2-row header and 234 attribute rows (about 6,786 mapping rows in total). Its hidden MDD tab (167 attributes) resolves attribute names to IDs by VLOOKUP. Table 8-2 decodes the column semantics; Figure 8-1 shows how the three reference workbooks flow into the ETL loaders and out into the STEPXML values."));
  el.push(tableCaption("Table 8-2 - Column semantics of a brand mapping tab (header row 2)"));
  el.push(bizTable(
    ["Col", "Meaning", "Example"],
    [
      ["A", "Stibo attribute display name", "SAP Color"],
      ["B", "Stibo attribute ID (VLOOKUP into hidden MDD tab)", "AT_Color"],
      ["C", "Validation base type (VLOOKUP): LOV, text, regexp, number, legacyisodatetime, url, date", "LOV"],
      ["D", "Cluster (Basic, Commercial, Price, Cost, MC, Hierarchy, Online, Translation, Image, System indicator)", "Basic"],
      ["E", "Grouping (Color, Gender, Sizing, Barcode, Images, Description)", "Color"],
      ["F", "Free-text description: lengths, co-dependencies, composition rules", "Max 18 digits: generic code + 3-digit colour + 3-digit size"],
      ["G", "Field mapping type: Direct from Principal / Formula in System / Mapping-from-Principal / Manual Input in Portal / AI Images Analysis / AI Translation / Not Available", "Mapping-from-Principal"],
      ["H / I / J", "Source: brand file name and link / sheet name / field name in the brand file", "Example RECAP SAMPLE.xlsx / LOT / 1st Ingestion: Color Code"],
      ["K / L", "Mapping logic (free text or embedded value map raw : id - label) + optional additional mapping file (SharePoint link)", "M : M - Male / W : F - Female / U : U - Unisex"],
      ["M+", "Per-product-type applicability letters under Inline/Licensed x Footwear/Apparel/Accessories/Equipment headers", "A = direct, B = mapping+formula, C = AI image, D = manual, E = not available, F = system formula"],
    ],
    [8, 56, 36]
  ));
  el.push(spacer());
  el.push(...figure("fig4_reference_data.png", "Figure 8-1 - Reference data framework: sources, loaders and consumers", 565));

  el.push(h2("8.5 The Ten Mapping Rule Archetypes"));
  el.push(p("Across all brand tabs, the free-text mapping logic (columns G/K and the applicability letters) resolves to ten recurring rule shapes. They are listed here because any future portal or engine must support exactly these shapes as first-class configuration - and because four of them (manual, AI image, AI translation, stage-conditional) are precisely the ones the current pipeline cannot execute, which is the gap the portal initiative targets."));
  el.push(tableCaption("Table 8-3 - Mapping rule archetypes with verbatim examples"));
  el.push(bizTable(
    ["#", "Archetype", "Verbatim example from the workbook"],
    [
      ["1", "Direct copy", "Direct from Principal (column G) with source field in J"],
      ["2", "Constant default", "Country of Origin: Default : China; SAP Age: Default : Adults"],
      ["3", "Country/derived default", "Retail Price Currency: Default by currency per country e.g Indonesia (IDR), Philiphine (PHP)"],
      ["4", "First-entry rule", "Main Vendor Identification: 1st entry always be as main vendor"],
      ["5", "Substring / transform", "Principal Color Code: Line List : Column 'Colorway Code' (put the last 3 digits)"],
      ["6", "Code concatenation", "Variant code: 3 Digits Brand Code + Max 9 Digits Principal Style Code + 3 Digits Size (generic-code Types A-E per brand)"],
      ["7", "LOV lookup", "SAP Gender: M : M - Male / W : F - Female / U : U - Unisex"],
      ["8", "AI image analysis", "SAP Color / Size: AI Images Analysist (letter C) - currently excluded from output"],
      ["9", "AI translation", "AI translation entries for description attributes - currently excluded from output"],
      ["10", "Ingestion-stage conditional", "Original Price: 1st ingestion : keep as blank / 2nd ingestion : proposed_retail_price"],
    ],
    [5, 24, 71],
    { fontSize: 18 }
  ));
  el.push(spacer());

  el.push(h2("8.6 MD-Mapping Value-Translation Sheets"));
  el.push(p("Fifteen MD Mappings tabs (about 1,700 value pairs in total) translate raw principal values into Stibo display values and then into LOV IDs. Their header block names the source file and column, the division and the target attribute, followed by the raw-to-Stibo pairs. Translations are frequently one-to-many: Lotto's JUNIOR maps simultaneously to SAP Gender = Unisex, SAP Age = Children and BY Gender/Age pairs. Some sheets use composite keys (Dr. Martens derives SAP Product Group from Gender plus Sub-Division). Known gaps: the Reebok silhouette sheet carries 38 raw values with no target on 22 of them, and the copy-paste duplication of these sheets across brand workbooks has produced at least one confirmed defect (a Crocs row maps Principal Size Code to the wrong attribute ID - issue KI-12)."));

  el.push(h2("8.7 Data-Quality Gaps in the Reference Framework"));
  el.push(p("Five gaps limit full automation today and are tracked in Chapter 13: 80 of the 234 template attributes have no AT_ identifier (the Images 1-50 block, BY hierarchy attributes, packaging dimensions, Valid From/To, MC structure attributes and the VN/TH translation attributes); column G contains 55 spelling variants of the six intended mapping types, so letter-to-type correlation is only about 85 percent reliable; the naming convention is unratified (Section 4.4); the Business Rules sheet holds a single rule while the real rule inventory lives informally in free-text descriptions; and several brand tabs still carry open TODO notes (the Summary Missing Requirements sheet lists them, including remarks in Indonesian). None of these gaps blocks the current pipeline - it simply routes around them - but each one becomes a hard blocker for a fully configuration-driven engine, which is why Chapter 16 places data clean-up in Phase 0."));

  // ════════════════════════════════ CHAPTER 9 ════════════════════════════════
  el.push(h1("9. STEPXML Output Specification"));

  el.push(h2("9.1 Document Root and Namespaces"));
  el.push(p("All 82 ETL output modules produce the same STEPXML document format, conforming to Stibo's PIM.XSD. The root element STEP-ProductInformation binds the default namespace http://www.stibosystems.com/step and carries the export context: ExportTime, ExportContext and ContextID set to Context1, WorkspaceID set to Main, and UseContextLocale set to false. Adidas additionally sets update=true on the root, requesting an update-import rather than insert-only semantics; no other brand does. The delivery lambda counts xmlns and ns0: occurrences as a structural sanity check before upload, which catches the most common serialisation accidents."));

  el.push(h2("9.2 Classification Hierarchy"));
  el.push(p("Each file creates a season classification subtree used for batching inbound articles. Under the brand batches root CLH_{Brand}Batches (for example CLH_ELLBatches), the ETL creates a season node CLH_{BRANDCODE}_{SS|FW}{YYYY} - for example CLH_ELL_SP2027 - of classification type CLS_Season, with confirmed and unconfirmed leaves (...CA and ...UA) beneath. Articles are then referenced into this subtree plus two further classification references (the brand articles root CLH_{Brand}Articles with target CPL_Merchandiser, and the season unconfirmed node with target CPL_UnConfirmedForSeason). The delivery lambda can optionally blank the classification IDs: the blank_ids option rewrites ID=\"CLH_...\" to ID=\"\" on Classification elements only, forcing STEP to resolve or create the nodes by name - used when the target classification IDs may already exist with different IDs."));

  el.push(h2("9.3 Product and Variant Structure"));
  el.push(p("Products are written as Product elements of UserTypeID PRD_GenericArticle (style/colour level) or PRD_SingleArticle, with ParentID pointing at a temporary subcategory (PPH_{F|A|E|Q|T}-TempSubCat by product family). Identity is carried by a KeyValue element with KeyID KEY_InboundArticle (the generic article code), not by the product ID - the Product elements intentionally carry no ID attribute. Each product carries a Name, its classification references, and a Values block. Variants are nested PRD_VariantArticle elements inside their generic article, identified by KEY_InboundVariant; the variant code composition follows the per-brand generic-code Types A-E documented in the mapping workbook (brand code + principal style + colour + size, with per-brand digit layouts)."));
  el.push(codeBlock([
    "<STEP-ProductInformation xmlns=\"http://www.stibosystems.com/step\"",
    "    ExportTime=\"2026-09-07T03:12:44Z\" ExportContext=\"Context1\" ContextID=\"Context1\"",
    "    WorkspaceID=\"Main\" UseContextLocale=\"false\">",
    "  <Classifications>",
    "    <Classification ID=\"CLH_ELLBatches\" UserTypeID=\"CLH_Batches\">",
    "      <Name>ELLESSE Batches</Name>",
    "      <Classification ID=\"CLH_ELL_SP2027\" UserTypeID=\"CLS_Season\">",
    "        <Name>ELLESSE SP2027</Name>",
    "        <Classification ID=\"CLH_ELL_SP2027_UA\" UserTypeID=\"CLS_UnConfirmedForSeason\"/>",
    "      </Classification>",
    "    </Classification>",
    "  </Classifications>",
    "  <Products>",
    "    <Product UserTypeID=\"PRD_GenericArticle\" ParentID=\"PPH_F-TempSubCat\">",
    "      <KeyValue KeyID=\"KEY_InboundArticle\" Value=\"ELL6RT123MB\"/>",
    "      <Name>ELLESSE Run Top - Navy</Name>",
    "      <ClassificationReference ClassificationID=\"CLH_ELLArticles\" Target=\"CPL_Merchandiser\"/>",
    "      <ClassificationReference ClassificationID=\"CLH_ELL_SP2027_UA\" Target=\"CPL_UnConfirmedForSeason\"/>",
    "      <Values>",
    "        <Value AttributeID=\"AT_Brand\" ID=\"ELL\">ELLESSE</Value>",
    "        <Value AttributeID=\"AT_Color\" ID=\"581\">Navy</Value>",
    "        <MultiValue AttributeID=\"AT_SBU\"><Value ID=\"MAA_SP\"/></MultiValue>",
    "        <MultiValue AttributeID=\"AT_CompanyCode\"><Value ID=\"0888\"/></MultiValue>",
    "        <Product UserTypeID=\"PRD_VariantArticle\">",
    "          <KeyValue KeyID=\"KEY_InboundVariant\" Value=\"ELL6RT123MB58139\"/>",
    "          <Values>",
    "            <Value AttributeID=\"AT_SizeCode\" ID=\"039\">39</Value>",
    "          </Values>",
    "        </Product>",
    "      </Values>",
    "    </Product>",
    "  </Products>",
    "</STEP-ProductInformation>",
  ], "Illustrative STEPXML skeleton (structure reconstructed from the ETL builder code; attribute IDs shortened for readability)"));
  el.push(spacer());

  el.push(h2("9.4 Attribute Values and Multi-Values"));
  el.push(p("Simple attributes are written as Value elements with AttributeID and the display text as element content; when the attribute is LOV-validated and the LOV ID was resolved, the ID attribute carries the LOV identifier, which tells STEP to link the value rather than store free text. Organisational attributes AT_SBU and AT_CompanyCode are always written as MultiValue blocks even for single values, reflecting their Stibo multi-valued definition. Brands with barcode requirements (Crocs, implus, PTP) additionally attach DataContainers of type DC_Barcode under the variant, holding AT_Barcode, barcode type P and a MainEANIndicator of Y on the primary EAN. Illegal XML control characters are stripped during serialisation, and empty mandatory attributes are emitted as empty elements (or skipped, per brand) as described in Section 6.6."));

  el.push(h2("9.5 ID Blank-Out Option"));
  el.push(p("The delivery lambda's blank_ids flag (enabled by default in its direct-invocation examples) applies the regex replacement ID=\"CLH_[^\"]*\" to ID=\"\" on Classification tags only, leaving Product tags untouched because products carry no ID by design. The operational meaning: classification nodes are matched by name in STEP rather than asserted by ID, which avoids duplicate-season conflicts when a re-run generates a fresh subtree for a season that already exists. Teams should treat blank_ids as the default posture for season classifications and disable it only for specific remediation cases agreed with the STEP administrator."));

  // ════════════════════════════════ CHAPTER 10 ════════════════════════════════
  el.push(h1("10. Stibo STEP Integration Layer"));

  el.push(h2("10.1 Authentication - OIDC Client Credentials"));
  el.push(p("The delivery lambda authenticates against Stibo's OAuth 2.0 / OpenID Connect token endpoint using the client-credentials grant: POST with grant_type, client_id and client_secret as form fields, receiving an access token whose expiry (expires_in, default assumption 300 seconds if the response omits it) is cached in module scope with a 30-second safety leeway. Secrets are sourced from environment variables; STIBO_CLIENT_SECRET should be provided through AWS Secrets Manager rather than plain environment configuration. The token is sent as a Bearer Authorization header on every upload. This is exactly the mechanism Stibo documents for SaaS STEP (client credentials created via the Stibo Service Portal and mapped to a service-account user), so the integration is forward-compatible with a SaaS migration."));

  el.push(h2("10.2 The IIEP REST Direct Receiver"));
  el.push(p("Uploads are performed against three Inbound Integration End Points configured with the REST Direct Receiver. The call is POST {endpoint}/upload-direct?fileName={name}&context={context}&workspace={workspace} with the raw XML bytes as the body and Content-Type application/octet-stream. Per Stibo's current documentation (2026.x) the context and workspace parameters are required but without significance for this receiver, and the transactional setting of the endpoint is forced to none - each file is processed as a whole by the STEP importer in a background process (BGP). The endpoint returns a JSON body with an id - the background process identifier (bgId) - which the lambda captures. A disabled endpoint or a full BGP queue rejects the call; the filename must not contain characters forbidden by STEP."));

  el.push(h2("10.3 Endpoint Routing"));
  el.push(p("Routing from file name to endpoint is the ordered regex table already reproduced in Table 4-2; the delivery lambda compiles it once per container and evaluates first-match-wins. An explicit endpoint_type override in the invocation payload bypasses filename matching - useful for manual re-sends. If no rule matches, the file is rejected with a 400 response and never silently dropped: the failure is visible in CloudWatch and (since the XML remains in processed/stepxml/) re-drivable by direct invocation."));

  el.push(h2("10.4 Retry and Error Policy"));
  el.push(tableCaption("Table 10-1 - Delivery error handling matrix"));
  el.push(bizTable(
    ["Condition", "Behaviour"],
    [
      ["HTTP 2xx from upload-direct", "Success: bgId parsed from JSON body; receipt written to processed/stepxml/bgid/{brand}/{file}.json"],
      ["HTTP 4xx except 429", "No retry: client errors (auth, disabled endpoint, bad name) are deterministic; lambda returns 502 after first failure"],
      ["HTTP 429 / 5xx / network errors", "Retried up to STIBO_MAX_RETRIES (default 3) with exponential backoff (2s, 4s, 8s - STIBO_RETRY_BACKOFF base)"],
      ["Token fetch failure", "Raises immediately; no upload attempt; visible as OIDC error in CloudWatch"],
      ["No routing rule matched", "Immediate 400; nothing uploaded"],
      ["STIBO_DRY_RUN enabled", "Token is fetched (validating auth) but no POST is made; intended for connectivity tests"],
    ],
    [34, 66]
  ));
  el.push(spacer());

  el.push(h2("10.5 Delivery Receipts (bgId)"));
  el.push(p("Every successful upload writes a receipt JSON next to the XML receipts tree: { filename, s3_key, bg_id, endpoint, uploaded_at }. The receipts are the join key between the AWS pipeline and STEP's own background-process monitoring, and they are the natural anchor for the feedback loop recommended in Chapter 16 (poll the endpoint's background-process list for the bgId, read the execution report, and surface per-row errors back to the portal). Until that loop exists, receipts are the fastest way for IT to answer the question: did file X reach STEP, and under which background process?"));

  el.push(h2("10.6 STEP-Side Monitoring and Feedback Surface"));
  el.push(p("Stibo provides a monitoring surface that the pipeline does not yet consume but should (Section 16.4). Monitoring sensors are auto-created per IIEP and expose traffic-light status plus Nagios-format and XML detail without authentication. The authenticated REST surface offers GET /restapi/integrationendpoints (overview), /{id} (statistics), /{id}/log (execution reports), /{id}/errorexcerpts and /{id}/backgroundprocesses (the BGP list where bgIds resolve to outcomes). Since release 2026.1, original input files are attached to import BGPs and retrievable via the attachments endpoints, and event-based OIEPs or Kafka delivery can push completion or rejection notifications out of STEP - the building blocks for closing the loop described above. The current pipeline's gap is simply that nothing reads these surfaces automatically yet."));

  return el;
}

module.exports = { build };
