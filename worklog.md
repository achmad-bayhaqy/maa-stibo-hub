# Worklog — Stibo MDM Web Portal Initiative

## Context (from user)
- Company uses Stibo STEP for retail master data management + AWS (S3/Lambda) for integration across many brands.
- Current flow: user uploads standardized-named xlsx (e.g. `0888-SP-ELLESSE-Recap Sample MAA Sport Licensed-Multi-SP2027-ID-1.xlsx`) to S3 `raw/metadata/{brand}/` → Lambda `map-stibo-inbound-validate-transform-dev` (router.py + 25+ brand folders) validates/transforms per brand → STEPXML written to `processed/stepxml/{brand}/` → Lambda `map-stibo-inbound-send-to-step-dev` POSTs XML to Stibo IIEP inbound endpoints (OIDC client credentials, 3 endpoints: ARTICLE_PLANNING / EAN_UPDATE / ARTICLE_MAINTENANCE).
- Global files (Master Data Dictionary / Attributes) uploaded at `raw/metadata/` root trigger fan-out to all brands.
- GOAL: build a web portal where users upload directly, auto-mapping + auto-fill based on rules & LOVs, final output XML sent to Stibo.
- Uploaded files in /home/z/my-project/upload/:
  - `0888-SP-ELLESSE-Recap Sample MAA Sport Licensed-Multi-SP2027-ID-1.xlsx` (sample input, 39MB)
  - `NEW - Brand mapping files Template.xlsx` (58 sheets, per-brand mapping + MD mappings + rules)
  - `Master Data Dictionary (MAA).xlsx` (87 sheets, Core Attributes + ~60 LOV sheets)
  - `Brand Input files & Naming convention.xlsx` (2 sheets: COE Question, Stibo)
  - `map-stibo-inbound-send-to-step-dev.zip` → extracted to /home/z/my-project/analysis/lambda-send-to-step/
  - `map-stibo-inbound-validate-transform-dev.zip` → extracted to /home/z/my-project/analysis/lambda-validate-transform/

## Main agent findings so far
- router.py: EventBridge S3 event → extract principal (brand folder) → BRAND_ROUTER dict (27 entries) → brand lambda_handler(event, context, auditor). Global file fan-out mode re-runs all brands with synthetic events. AuditLogger per brand, flush to raw/logs/{brand}/{timestamp}.json.
- README.md: pipeline = validate required files → normalize (xlsb/csv→xlsx) → brand ETL → STEPXML to processed bucket. Env: RAW_BUCKET, PROCESSED_BUCKET.
- send-to-step lambda_function.py (v2.3): OIDC client_credentials token w/ cache, POST binary XML to `{IIEP_URL}?fileName=...&context=Context1&workspace=Main`, Content-Type application/octet-stream. Filename regex routing → 3 endpoints. blank_ids option blanks CLH_ Classification IDs. Saves bgId receipt JSON to processed/stepxml/bgid/{brand}/{file}.json. Retry 3x exponential backoff.
- Codebase size: ~121,836 lines Python in validate-transform lambda across 25+ brand folders.
- Excel inventory:
  - Brand mapping Template: 58 sheets (per-brand mapping e.g. Ellesse(Licensed), ANTA, Crocs(Inline), Adidas-API; MD Mappings sheets for value transformations; MDD sheet; Source Mapping related RNA 2365 rows; Summary Missing Requirements).
  - MDD: Core Attributes 422x40, LOVs (Vendor 32k rows, Size Code 5k, Color Code, Material, Season, Brand...), Validation Base Type Definition, Business Rules.
  - Naming convention: Stibo sheet 89x59.

## Tasks
- Task 1 (main): extract & inventory — DONE
- Task 2/3 (Agent A): deep-dive lambda code patterns
- Task 4/5 (Agent B): deep-dive Excel structures
- Task 6 (Agent C): web research Stibo STEP features 2025-2026 — DONE
- Task 7 (main): synthesis + proposal

---
Task ID: 6
Agent: Agent C
Task: Web research on Stibo STEP (2024-2026) capabilities relevant to the data-onboarding web portal (inbound integrations, OOTB onboarding UX, model/LOV APIs, feedback loops, product direction, best practices)

Work Log:
- Ran ~30 web searches via z-ai web_search + fetched ~12 primary source pages (doc.stibosystems.com 2026.x docs, service.stibosystems.com release notes, Stibo press releases, PRNewswire, Microsoft Marketplace).
- Verified current delivery mechanism: REST Direct Receiver IIEP = `POST {Host}/restapiv2/inbound-integration-endpoints/{EndpointID}/upload-direct?context=&workspace=Main&fileName=`, octet-stream, Basic auth or OIDC client-credentials on SaaS; transactional setting force-set to None. Matches existing send-to-step Lambda exactly.
- Catalogued IIEP receivers (REST Direct, REST/hotfolder, Hotfolder(+metadata), Dynamic JMS, Kafka Streaming) and processing engines (STEP Importer w/ full Map-Data transforms, STEP Streaming Importer, Business Rule Based Message Processor); XSLT 2.0 pre-processor available on IIEP for XML→STEPXML transformation.
- Catalogued REST API V2 (v1 deprecated since 9.2): 2026.1 adds GET /attributes/{id} (validator, validForObjectTypes), GET /list-of-values/{id} (validator, dataTypeGroups), /contexts, /object-types(+children), /data-type-groups/{id}/attributes, /unique-keys, POST /batch/execute, GET /background-processes/{id}/attachments(.{id}./content) for original input/output files.
- Catalogued monitoring/feedback: Monitoring Sensors (unauthenticated /admin/monitoring/InboundIntegrationEndpointStatus-{ID}/status|nagios|xml) and REST /restapi/integrationendpoints[/log|/errorexcerpts|/backgroundprocesses]; BGP states succeeded/completedwitherrors/failed/aborted/waiting/running; IIEP Error Reporters; failed-BGP re-run.
- Import Manager: 'Select Business Rules' step with per-condition severity (Reject+Error / Import+Warning / Reject+Info), execution report; limits (no nested STEPXML w/ rules, references always "changed", auto-approve disabled w/ actions). Excel Smartsheet format = in-Excel signed-macro pre-validation + Supplier Web UI round-trip, but license-gated and not for large data volumes; known LOV limitations.
- OOTB onboarding: Supplier Web UI (license-gated), PDX drag-drop Import Data + automated vendor portal (2025.3), Automotive "Data Onboarding & Standardized Mapping" solution enablement (mapper configs, rules run in workflows on approval; Industry Standard Mapper since 2023.4), configurable STEP Web UI screens.
- Product direction: quarterly updates to 2026.3; SaaS "STEP Trailblazer" on Azure + Self-Service UI; 2025.3 SaaS-only Modular Service Platform (new Integration API, JS extensions); New UI multi-tenant microservice; AI: Jul-2025 AI rollout (SIA assistant, AI attribute mapping ~75% in PXDC, ML matching), ProductGen AI (Sep-2025), AI accelerator preview (2025.3), MCP Server (Jun-2026), MasterFabric/DaaS Microsoft Fabric integration (preview). "STEP Next" does NOT exist as a product (no evidence).
- Appended synthesis below; full report returned to main agent.

Stage Summary (key findings):
- A: Three inbound write paths: (1) IIEP+STEPXML (current) = best for bulk, references, contexts/workspaces, config changes; validation via in-STEP rules/processors; (2) Import Manager = manual/scheduled w/ interactive rule selection + execution report, Excel/CSV/XML formats, Smartsheet pre-validation; (3) REST V2 object writes (+new batch endpoint) = per-object CRUD, good for small increments, not bulk loads. Portal should keep IIEP/STEPXML as the write channel and optionally use REST V2 for EAN-style small updates.
- B: Stibo OOTB onboarding exists (Supplier Web UI, Smartsheets, PDX, Data Onboarding automotive solution) but is license-gated, sized for smaller volumes, and template-rigid → will not absorb 25-brand/39MB Excel variance; custom portal still justified; consider Stibo Web UI components or PDX for partial coverage.
- C: REST V2 now exposes attributes (with validator refs), LOVs (with validator + dataTypeGroups), contexts, object-types, unique keys → portal can sync rules/LOVs directly from STEP; docs live at {system}/sdk; alternative: STEPXML export of setup objects.
- D: Feedback loop: bgId on upload → GET /background-processes/{id}/attachments (original + output files), /restapi/integrationendpoints/{id}/log + /backgroundprocesses + /errorexcerpts for execution reports; unauthenticated Monitoring Sensors for health; push-side options: event-based OIEPs (REST callback/Kafka/JMS) + Event Processors for "import done/rejected" notifications.
- E: Direction = SaaS-first (Trailblazer/Azure, SSUI), API modernization (REST V2 client, batching, Modular Service Platform/JS), embedded AI (auto attribute mapping, SIA, MCP server) → build portal with mapping rules as data, sync model via API, don't hand-code what Stibo AI/mappers are automating.
- F: Best-practice pattern for this build: portal-side pre-validation against STEP-synced LOVs/validators → staged approval workflow → STEPXML via IIEP → bgId capture → poll execution report → surface errors per row in portal; keep STEP as authoritative validator (duplicate only cheap checks client-side); see migravion (SAP MDG), ewsolutions, pimcore guidance.

---
## Task ID: 2-3 | Agent: Agent A | Deep-dive Lambda ETL code (RESEARCH ONLY)

Files read fully/largely: router.py, metadata_s3.py, audit_logger.py, README.md, ellesse/lambda_function.py + recap_main.py (full), anta/lambda_function.py + linelist_main.py (full), adidas/lambda_function.py + main.py (core), nike/lambda_function.py + sp27_maa_linelist_main.py (loaders), birkenstock/OFS_FC_Mitra_ss27.py (engine), 2xu/product_bible_main.py (header), crocs/order_form_fw_main.py (XML builder), aldo/lambda_function.py. Plus cross-brand greps (KeyID, LOV_, MDDLoader, RNALoader, ThreadPoolExecutor, sys.exit, TEST MODE, AI/LLM, secrets).

### 1. End-to-end flow (Ellesse recap, every function)
EventBridge S3 event → `router.lambda_handler` (router.py:132) → `_is_global_file`? no → `extract_principal` (parts[2]) → `BRAND_ROUTER["ellesse"]` (router.py:123) → `AuditLogger(event,context)` → `ellesse.lambda_function.lambda_handler(event,context,auditor)` (ellesse/lambda_function.py:365): `_parse_event` → `unquote_plus` → `_extract_principal` → `_detect_triggered_file_type` (FILE_TYPE_KEYWORDS, first-match: "recap" matches "recap|recap sample|licensed recap|sample development") → `ETL_DISPATCHER["recap"]→recap_main`; `REQUIRED_TYPES_BY_TRIGGER["recap"]={recap,mdd,attributes}` → `_list_principal_files` (brand prefix scan + raw/metadata/ globals + `metadata_s3.add_root_metadata_files` bucket-root scan, latest-wins by LastModified; V6_BRANDS vs NEW-mapping pattern split in metadata_s3.py:28-48) → missing check → `waiting_for_mandatory_files` early-return → `_prepare_tmp_dirs` (/tmp/stibo_workdir_ellesse/input/{recap,mdd,attributes,orderform,fob_order_info,pricelist}, output/xml) → `_download_files` → `_convert_xlsb_to_xlsx`/`_convert_csv_to_xlsx` (openpyxl write_only streaming, `_clean_cell` strips illegal XML chars) → `_ellesse_default_metadata` (comp_code 0888, sbu SP, brand ellesse/ELL, season+country parsed from filename, article_type="License") → `args=types.SimpleNamespace(...)` → `recap_main.run(args, auditor)` (recap_main.py:1654): MDDLoader (Core Attributes sheet hdr row 2, attr id col 8 + all "*LOV*" sheets + Age/Gender LOV special loaders) + AttributesListLoader ("Ellesse(Inline + Licensed)" tab) + EllesseMDMappingLoader ("Ellesse MD Mapping" tab, col G source → H/I/J/K = SAP Age/Gender/BY Age/BY Gender) + RNALoader ("Source Mapping related RNA" tab, key=(country,comp,sbu,brand) → brand_type/brand_category, 4-pass fuzzy) → per file: EllesseRecapLoader (dynamic header-row sniff first 10 rows, filter blank Supp Art #) → Pass 1 ThreadPoolExecutor(≤8 workers) `_process_article` → `map_article_ellesse` (hardcoded column-name mapping + generic_code formula ELL+type+yr+cat+last4+gender+color=12ch) + MD-mapping/LOV gender/age resolution + `validate()` → Pass 2 streaming write: `build_classifications` + `build_product_xml` per article → `run()` writes validation_{ts}.txt → back in handler: `_upload_xml_outputs` → s3 processed/stepxml/ellesse/{stem}.xml → router `auditor.flush(brand)` → raw/logs/ellesse/{ts}.json.

### 2. STEPXML output structure (identical across all 82 ETL files; verified via KeyID grep + diff)
Root (built as a raw f-string; fragments via ElementTree, xmlns stripped with regex `_XMLNS_RE`):
`<STEP-ProductInformation xmlns="http://www.stibosystems.com/step" xmlns:xsi=... xsi:schemaLocation="http://www.stibosystems.com/step PIM.xsd" ExportTime=... ExportContext="Context1" ContextID="Context1" WorkspaceID="Main" UseContextLocale="false" [update="true" — adidas only]>`
- `<Classifications>` → `Classification ID="CLH_{BRANDCODE}_{SS|FW}YYYY" UserTypeID="CLS_Season" ParentID="CLH_{Brand}Batches"` with `<Name>`, nested `...CA` CLS_ConfirmedArticles + `...UA` CLS_UnconfirmedArticles. (adidas also passes articles but emits the same 3-tier block.)
- `<Products>` → `Product UserTypeID="PRD_GenericArticle" (or PRD_SingleArticle adidas) ParentID="PPH_{F|A|E|Q|T}-TempSubCat"` → `KeyValue KeyID="KEY_InboundArticle"` (=brand+style or 12-char code) → `Name` → `ClassificationReference ClassificationID="CLH_{Brand}Articles" Type="CPL_Merchandiser"` + `ClassificationID="{season_id}UA" Type="CPL_UnConfirmedForSeason"` → `Values` → `Value AttributeID="AT_xxx" [ID="LOV_ID"]text` and `MultiValue AttributeID=...`→`Value ID=...` (AT_SBU, AT_CompanyCode are MultiValue everywhere). Nested `Product UserTypeID="PRD_VariantArticle"` + `KeyValue KeyID="KEY_Variant"` for EAN/size flows. Example in code: implus/ean_update_source_sofsole.py:364-376. Crocs/implus/PTP also emit `DataContainers/MultiDataContainer Type="DC_Barcode"` (AT_Barcode, AT_BarcodeType ID="P", AT_MainEANIndicator ID="Y").
Only two key types exist repo-wide: KEY_InboundArticle, KEY_InboundVariant. Attribute IDs are shared vocabulary (AT_PrincipalStyleCode, AT_Gender, AT_SAPAge, AT_BYAge, AT_Brand, AT_BrandType/Status/Group, AT_Season/Year, AT_FOB, AT_RetailPriceCurrency, AT_MaterialType=ZINA, AT_SAPProductFlag=A, AT_UOM=EA, AT_PricingDistributionChannel=01, AT_SAPArticleCategory=1/01, AT_CountrySize, AT_SportsCategoryEN, AT_CountryOrigin...) but per-brand emission sets differ (adidas also emits ~50 empty placeholder AT_ attrs: GENERIC_ATTR_PLACEHOLDERS adidas/main.py:966).

### 3. How mappings are implemented — 3 generations coexist
(a) HARDCODED (majority, ~2/3 of files): map_article functions with `ll_row.get("Column Name")` per attribute + hardcoded LOV dicts. E.g. adidas/main.py:709-872 (v3.2 column aliases incl. new SS27 names), ellesse/recap_main.py:981-1192; ~270 `LOV_*` dict literals across 39 files; adidas/main.py:966 GENERIC_ATTR_PLACEHOLDERS list of ~50 AT ids.
(b) EXCEL-MAPPING-DRIVEN (newest, "no per-attribute Python code"): anta/linelist_main.py:598-744 `AttributeRule`/`AttributeMappingLoader` reads the brand tab of NEW - Brand mapping files Template.xlsx (ANTA tab): col B=AT id, col C=Stibo Validation ("LOV"→write ID attr vs text), col G=Field Mapping Type (Direct from Principal / Formula in System* / Mapping from Principal Data → include; Manual Input/N/A/AI Translation/AI Image Analysis → exclude), col J=source column in input sheet, col K=Mapping Logic parsed as "src : id - label" lines. anta/lambda_function.py:36 comment "mapping-driven ETL". Same engine re-implemented in birkenstock/OFS_FC_Mitra_ss27.py:353-500 (dataclass MappingRule + DynamicMappingLoader, sheet "Birken(Inline)", adds default-value regex parsing + is_rna_lookup + formula_type) and clarks/order_form_footwear_main.py, new_era/*, reebok/article_master_*.py (per their docstrings). BUT all still keep SPECIAL_ATTRIBUTE_IDS / _transform_value / _apply_formulas hardcode escapes (anta:132-154, birkenstock:1618-1687 ~400-line _apply_formulas).
(c) Multi-file enrichment (adidas only): linelist + TDD (sizes/EAN/meta) + Backlog (qty/windows) loaders merged per article in map_article (tdd.get_meta/get_sizes, backlog.get).

### 4. LOV/MDD consumption
MDD workbook (raw/metadata/ root, "Master Data Dictionary (MAA).xlsx"): "Core Attributes" sheet (422 rows × 40 cols; header row index 1; id in col 8; attributes dict: PIM Attribute Name, Cardinality, Validation Base Type, LOV name, Max Characters) + any sheet containing "LOV" (display col A → id col B) + special Age/Gender LOV sheets (multi-col, incl. BY Age col F/G) + "Retail Price Currency LOV" + Country LOV. 64 separate MDDLoader class copies (one per ETL module). Lookups are display→LOV-ID; unresolved LOV values are either skipped silently (mapping-driven brands), downgraded to raw text (BrandType/Status/Group fallback anta/linelist_main.py:1056-1075), or never sent (AT_Color ellesse recap_main.py:1323-1329 commented out). MD Mapping tabs ("{Brand} MD Mapping" col G→H/I/J/K) translate raw gender→SAP/BY age+gender display values, then MDD LOV → id (ellesse/recap_main.py:438-503,1613-1645). RNA tab → AT_BrandType/BrandCategory(/Status/Group) keyed by (country, comp_code, sbu, brand_code) with .0-strip normalization and 4-pass fallback (37 RNALoader copies). Naming-convention workbook only used for output filenames; Nike NamingConventionLoader loads rules then build_filename() ignores them (nike/sp27_maa_linelist_main.py:586-612 — dead code).

### 5. Common vs brand-specific split
Copy-paste ≈ 70-80% of the codebase: (1) 27 lambda_function.py handlers are one ~475-750-line template (identical helper names `_parse_event/_detect_file_type/_list_principal_files/_prepare_tmp_dirs/_download_files/_upload_xml_outputs`); ellesse's docstring still says "Airwalk (LOT)" (ellesse/lambda_function.py:2). (2) Shared infra duplicated into ETL: 64 MDDLoader + 37 RNALoader copies. (3) recap_main.py cloned across lotto/k_swiss/airwalk/astec/ellesse with ~200 diff lines of 1913 ≈ 90% identical (verified by diff); reebok recap diverged (~2246 lines). Genuinely brand-specific: input sheet name/header row + column names; which AT_ attributes are emitted & their value transforms; generic/variant code formulas (12-char ELL formula vs brand+style vs +3-char colour+size tokens); variant generation (adidas=none from linelist, NB=disabled v1.13, EAN flows=variant per EAN); extra LOVs (Birkenstock heel type/height/occasion); price formulas (2xu AT_FOB = MSRP USD × 0.74, twoxu/product_bible_main.py:43); business defaults; multi-file join logic (adidas TDD/Backlog); filename metadata parsing dialects (ellesse vs anta vs adidas regexes).

### 6. Validation rules found (categorized)
- FILE-LEVEL: required companion types per trigger (`REQUIRED_TYPES_BY_TRIGGER`, e.g. recap needs recap+mdd+attributes; anta linelist needs linelist+attributes+mdd) → "waiting_for_mandatory_files" 200-return, resume-on-next-upload model. File-type keyword classification (first-match-wins; nike needs LINELIST_VARIANTS tuple ordering nike/lambda_function.py:121-135).
- FIELD-LEVEL mandatory: validate() checks 4 fields (article_no→AT_PrincipalStyleCode, gender_code→AT_Gender, age_code→AT_SAPAge, brand_code→AT_Brand) ONLY IF MDD Cardinality says "mandatory" — warnings only, article still written (adidas/main.py:879-894, ellesse/recap_main.py:1199-1215).
- LOV-MEMBERSHIP: value must resolve in MDD LOV else attribute skipped / raw-text fallback / warning logged (birkenstock AT_BrandType pops attr + warning OFS:1546-1569; anta no-guess skip linelist_main.py:644-659).
- FORMAT/DERIVATION: date reformats (DD-MM-YYYY, DD-Mon-YYYY anta:200-250), price numeric extraction regex, size→SAP 3-char codes (zfill/lookup, ellesse:935-950), season parse (SS26→SS+2026), ID zero-padding (SportsCategoryEN "2"→"02", color zfill(3)), XML-illegal char cleaning (_clean_cell).
- CROSS-FILE: RNA join; TDD/Backlog enrichment fallbacks (tdd value else linelist value adidas:782-795); country→currency derivation; header-row sniffing fallbacks; header-mismatch fallback columns (anta COLUMN_FALLBACKS:132).
- WARNINGS go to local log files + (count only) audit; auditor.add_validation_warnings/record_article exist but are NEVER called by any ETL module (grep confirms) → per-article evidence is not actually collected.

### 7. Infra
Runtime Python 3.12 (pycache); libs boto3, pandas, openpyxl, pyxlsb — no requirements.txt, no version pins anywhere. No memory/timeout settings in repo; perf pattern = ThreadPoolExecutor(max 8) map+validate pass + streaming XML write with 1MB buffer + del of intermediates (built for ~15-min Lambda & big files); xlsb/csv→xlsx conversion in /tmp (per-brand workdirs to avoid warm-container collision; anta re-asserts LAMBDA_TMP_DIR before run because module import order clobbers it — anta/lambda_function.py:441-444). Audit JSON schema v1.0 (audit_logger.py:203-238): input_event, router, lambda_function (files_classified/missing, downloads, conversions, metadata_parsed, xml_uploads, status), etl (loaders, counts, xml size), articles[], validation_warnings[], totals. Router isolates per-brand failures in fan-out; AuditLogger.flush only from router.

### 8. Expert assessment — config-driven generic engine for the portal
FEASIBLE: yes — the hard part is already proven in-repo. The anta/birkenstock/clarks/new_era/reebok modules are literally a config-driven engine whose config is the brand mapping tab (cols A-K), and the 27 handlers + 64 loaders are boilerplate around one canonical XML writer. ~80% of the codebase collapses into: (1) generic file-classification, (2) generic Excel reader with header sniffing, (3) rule engine (direct / mapped / default / formula / RNA / LOV-lookup), (4) STEPXML writer, (5) validation-as-warnings. The NEW - Brand mapping files Template.xlsx (58 sheets) IS the desired config schema in embryo — the portal should surface it as UI, not re-invent it.
TOP 5 BLOCKERS/RISKS:
1. Formula/derivation escapes: generic_code & variant_code formulas (12-char ELL code, brand+style+colour+size, BCK+9char, EAN zfill), price math (MSRP×0.74), date reformats, division→PPH_ parent routing — all still hand-coded per brand (birkenstock _apply_formulas ~400 lines; anta SPECIAL_ATTRIBUTE_IDS). Config must add a typed "transform DSL" (concat/slice/zfill/lookup/math/date-format) or these stay Python.
2. Structure semantics not in mapping sheets: grouping key (style vs style+colour), variant generation & KEY_InboundVariant composition, Generic vs Single UserTypeID, DataContainer barcodes, CA/UA classification refs, update="true" — must become explicit config per brand/file-type.
3. Input-file heterogeneity: header row position, sheet names/aliases, merged multi-tab inputs (adidas 3 files; 2xu catalogue tab; aldo PARAMS sheet), xlsb/csv, column-name drift between seasons (adidas v3.2 old+new names) — config needs per-file-type sheet/header profiles + alias lists.
4. LOV governance: hardcoded LOV dicts (~270) vs MDD-driven lookups disagree; failure semantics differ per brand (skip vs raw-text fallback vs default). Portal must unify on MDD-as-source-of-truth with explicit fallback policy, else XMLs silently diverge.
5. Ops/quality debt: sys.exit(1) inside ETL run() (SystemExit bypasses router's `except Exception` → kills whole fan-out invocation); AuditLogger ETL evidence unused; copy-paste means fixes don't propagate (ellesse docstring says Airwalk; README says aldo commented but it's active); test-mode comments; LAMBDA_TMP_DIR import-order race; no tests/pinning.
CONFIG SCHEMA (per brand × file-type): {input: {sheet, header_row|sniff, column_aliases}, attributes: [{stibo_attr_id, validation(base type/LOV), source: column|default|formula|RNA|lov_lookup|md_mapping, transform: {type,params}, required?, on_miss: skip|raw|default|warn}], key: {generic_formula, variant_formula, grouping: [cols], user_type}, classification: {brand_batches, season_id_pattern, merch_ref, refs[]}, defaults: {comp_code, sbu, brand_code, country, uom, material_type, product_flag, dist_channel, article_category}, naming: {xml_filename_pattern}, validation: {mandatory_from_mdd: true, lov_policy}}.
### 9. Surprises / risks / valuables
- No AI/LLM code anywhere; but mapping sheets already carry "AI Translation"/"AI Image Analysis"/"AI Images Analyst" as Field Mapping Type values for SAP Color/Size (anta:28,63; reebok article_master:45-63) — the business already plans AI auto-fill for exactly the fields that can't be mapped (SAP 3-digit color/size codes); these rows are currently EXCLUDED from emission. Perfect insertion point for portal AI features.
- aldо PARAMS sheet inside uploaded .xlsm contains DB connection string + username rows (aldo/lambda_function.py:16-20) — credentials-via-Excel smell (not used to connect, but they travel through S3).
- adidas/lambda_function.py:43-46 documents a debug break in main.py "remove before production" (stale comment; current loop is fine) — sign of weak review discipline.
- Root STEP-ProductInformation has ContextID="Context1" hardcoded in string form while anta omits ContextID attr; adidas adds update="true" — send-to-step's blank_ids/context handling depends on these.
- 5 identical recap engines means a bug fix (e.g. the "888.0" comp-code strip in RNA _norm_comp_code, ellesse:582) must be re-applied 37+ times.
- Global MDD/attributes upload fans out to ALL 27 brands sequentially in ONE Lambda invocation (router.py:148-192) — with 27 brands × big workbooks this is the most likely 15-min timeout victim.
- NamingConventionLoader rules never used (nike/sp27:611 hardcoded format instead).

---
## Task ID: 4-5 | Agent: Agent B | Deep-dive Excel workbook structures — DONE
Scripts: /home/z/my-project/scripts/{inventory,analyze_mapping,analyze_mapping2,analyze_mdd,analyze_naming,analyze_sample}.py
Dumps: /home/z/my-project/analysis/excel_dumps/ + analysis/{mdd_report,sample_report,naming_report}.txt

### 1. Brand mapping Template workbook (58 sheets) — semantics fully decoded
- 29 sheets are "brand mapping sheets" (A2='Stibo Attribute'), each 234 mapping rows (rows 3-236) = 6,786 mapping-row instances. Same 234-row attribute skeleton in every brand sheet; per-brand columns differ.
- Common columns (row 2 = header; row 1 = section version tags e.g. G1='Linelist V6', J1='API', M1='V6', N1='V6'):
  A=Stibo Attribute (display name), B=Stibo Attribute ID (AT_*, filled by =VLOOKUP(A,MDD!A:B,2,0) into hidden MDD sheet), C=Stibo Validation (=VLOOKUP(A,MDD!A:C,3,0) → LOV/text/number/regexp/date/legacyisodatetime/url), D=Cluster (Basic|Commercial|Price|Cost|MC|Hierarchy|Online|Translation (Online)|Image (BY)|Image (Online)|System indicator), E=Grouping (Description|Color|Gender|Age|Sizing|Barcode|Images), F=Attributes Description (free text: semantics, max lengths, co-dependency), G=Field Mapping Type, H=Brand File Name & Link, I=Brand File Sheet Name, J=Field Name in the Brand File, K=Mapping Logic, L=Mapping file for additional Brand specific mapping.
- Per-product-type block (M..R varies per sheet): first col(s) = "mapping logic" (verbatim copy of K) + applicability cols with header Inline/Licensed, Footwear, Apparel, Accessories, Sport Equipment (labels vary per brand; Ellesse: Licensed/Footwear/Accessories). Cell values are ONE-LETTER INGESTION-METHOD CODES: A=Direct/Mapping from principal file, B=mapping+formula from principal, C=AI image analysis, D=Manual input in portal, E=Not available, F=Formula in system (letter↔G-text correlation is fuzzy, ~85% consistent; G itself is very messy: 55 distinct spellings incl. 'AI translation', 'Source: email attachment from principal…', '0'/'1' junk).
- Hidden 'MDD' sheet (403x3): 167 attrs with AT_ IDs + Validation Base Type (text 69, LOV 64, regexp 17, number 14, legacyisodatetime 1, url 1, date 1). Template col B has 80 #N/A rows = attributes NOT in STEP dictionary yet (Images 1-50, BY hierarchy 6, packaging L/W/H/weight, Valid From/To x3, MC Structure + SAP Product Division/Group/Category, NOA, Article Type, Franchise, Thumbnail, Ecom Long Desc VN/TH, Certificate No).
- 15 MD/value-mapping sheets: per-attribute lookup tables, pattern = header block (Source: <file+column>, Division: scope, Attribute: target attr(s)) then raw→Stibo value pairs; often ONE source value → MANY targets (Lotto: JUNIOR → SAP Gender=Unisex + SAP Age=Children + BY Gender=Unisex + BY Age=Kids). Known gaps (Reebok sheet1 V16:V53 raw Silhouettes with no Stibo target). Birken-MD: PPG→Division/Category, Model→Silhouette (Arizona*=Sandal), Upper Material→Material (Birko-Flor→PU, Leder→Leather); Birken Ecom: Model→Ecom Short/Long Desc EN; Pazzion Material: free-text→BY attribute w/ rule "majority composition wins"; DR.Martens: composite keys (SAP Product Group = mapping from Gender+Sub Div; need image to pick SAP Product Category).
- 'Source Mapping related RNA' (2,364 rows x 15): master company/brand lookup — COUNTRY, COMPCODE, SBU GROUPING, SUB_SBU, SBU, BRANDGROUP, BRANDCATEGORY, BRANDTYPE_DETAIL, BRANDNAME, BRANDCODE, REPORTING BRAND CODE MAPPED, REPORTING BRAND NAME MAPPED, BRAND STATUS, BY CODE, REMARK. 7 countries (ID 1900), 23 compcodes (888=PT. Map Aktif Adiperkasa), 9 SBU groupings, 43 SBU codes, BRANDTYPE MAA/NON-MAA/SD BRAND, STATUS ACTIVE/DISCONTINUED, BY CODE 8 vals (MAA_CH/FF/SD/SP/PY/GO, FTL_SP, FTL_FF). This is the lookup behind "Mapping from RNA" rules for Brand Group/Type/Category/Status.
- 'Summary Missing Requirements' (hidden): working notes per brand (SVM, STACCATO, PAZZION, DR.MARTENS, BIRKENSTOCK) of attributes present in V6 mapping but missing from source files; contains informal Indonesian notes ("aku dan mba sulis bingung… perlu di double check") = unresolved data-quality flags.
- Adidas-API extras: cols U/V = second table "Fields/Attributes MAA Needs" ↔ "Fields/Columns" (DTB API field mapping: Principal style code→Article No., Principal Merch Hierarchy L1→B2B Product Division, Ecom Short Desc→B2C Copy Short…) + image criteria per slot (View/Category/Background).
- Data-quality bug found: Crocs(Inline) r22 'Principal Size Code' → AT_PrincipalStyleCode (should be AT_PrincipalSize).

### 2. Master Data Dictionary (MAA).xlsx (87 sheets)
- Instructions sheet = Stibo attribute worksheet spec (40 Core-Attribute fields + 5 LOV fields: Source Application Name, PIM Attribute Name/ID, Validation Base Type, Min/Max Value, Max Characters, Precision, Multi Valued, Calculated, Cardinality, Business Rule, Default Value, Name of LOV, UOM, Externally Maintained, Display Sequence, Completeness Score, etc.).
- Core Attributes: header row 2, 401 data rows, 380 distinct AT_ IDs. Columns: 1 Major Product Grouping (COE Offline/COE Online/BY/DAM…), 2 Variant Attribute?, 3 Source Application Name (SAP/BY Tools/DAM/Line list…), 4 Version No., 5 Source Attribute Name, 6 PIM Attribute Name, 8 PIM Attribute ID, 9 PIM Attribute Group, 10 Validation Base Type, 11-14 Min/Max/MaxChars/Precision, 15 Multi Valued, 16 Calculated, 17 Category-specific Display Rules, 18 Cardinality, 19-20 Business Rule, 21-22 Description/Help Text, 23-25 UOM, 26 Default Value, 27 Name of LOV, 28 Input Mask, 30 Externally Maintained, 31 Specification/Description, 35 Display Sequence, 40 Remarks.
- Counts: Validation = Text 150, List Of Values 137, blank 64, Number 44, Date 6. Cardinality = Optional 215, Mandatory 173, Conditional 3, ambiguous 'Optional Mandatory'/'Mandatory Conditional' 1 each. LOV name populated = 127. Rules in col 20 are free-text (e.g. CompanyCode: "company code should be relevant to the country…"; GenericDescription: forbidden special chars ' " = - & : ? # > ; , ^ < * . ™ …").
- Validation Base Type Definition sheet: 15 types in 4 groups (Numerical: Integer/Number/Number Range/Fraction/Embedded Number; Date: Date/ISO Date/ISO Date+Time; Texts: Text/Numeric Text/Text (exclude tags); Misc: LOV/Regular Expression/URL).
- 64 LOV/reference sheets, ~43,352 entries (Vendor LOV 32,663 [Company Code|Vendor ID|Vendor Name], Size Code 5,061 [3 code/desc pairs side by side], Franchise 1,917, Brand Group 300, MB Assortment Code 803, SIS SM Class Code 389, Country Origin 238, Color Code 221 [Code|Description], Ecomm Sales Channel 227, Retail Price Currency 182, Material 93, Silhouette 78, Interest 88, SBU 36, Brand 37, Company Code 20 [+Country col], Season 8 [SP/SM/FL/WN/CO/SS/FW/AL], Gender 9 (7 cols incl. SAP code + BY values), UOM 7, SAP Product Flag 5, Business Rules 1 row (BCI mandatory for SPORTS/GOLF)). Header names vary per sheet (Value ID of LOV / Code / Color Code …) and value/ID column order flips between sheets.
- Version History: v0.1→0.4 by Dhruve Besoya, Feb 2026.

### 3. Brand Input files & Naming convention.xlsx
- 'Stibo' sheet (88 rows x 7): Brand | Inline/Licensed? | File Type | Triggers? | Stibo Endpoint | Comment | Sample Input File Link. ~24 brands; brand cell merged per block. File Type families: Article Planning (Line List/Linelist/Product Bible/Price List/Order Form/Recap Sample + 'Recap Sample 2nd Ingestion'/Linesheet/Retail Price Master/OFS) → endpoint 'Article Planning'; SAP Article Creation (EAN Source, Order/Order Confirmation, OOR, Packing/Packaging List, Barcode, FOB Order, Shipment Confirmation, Delivery Performance, FW26 UPC) → 'EAN Update'; Ecommerce Enrichment (Ecommerce File, DTB) → 'Article Maintenance'. Matches the 3 IIEP endpoints.
- 'COE Question' (4 open questions): ① naming proposal Adidas: [compcode]-[SBU Code]-[Brand Code]-[Season Code + YY]-[Inline/Licensed]-[Source File Type]-[Multi/Mono]-[Sequence Number]; New Balance variant: …-[Source File Type]-[Footwear/Apparel Accessories]-[Sequence Number]. ② one brand desc → multiple brand codes (Adidas SP/FL/CH/GO/SD; Birkenstock BCK vs BCX per compcode/model). ③ multi vs mono vs division differentiation? ④ multi-sheet single file (Crocs FW+Charms) or separate files?
- Sample filename parse: 0888-SP-ELLESSE-Recap Sample MAA Sport Licensed-Multi-SP2027-ID-1.xlsx → compcode=0888, SBU=SP, Brand=ELLESSE (name, not 3-letter code), FileType='Recap Sample MAA Sport Licensed' (note 'Licensed' absorbed here, order differs from proposal), Multi, Season=SP2027 (proposal says +YY → SP27), ID=country Indonesia?, Seq=1. Ambiguities confirmed vs COE Q1-Q4.

### 4. Sample file 0888-SP-ELLESSE-…xlsx (9 sheets; 39.8MB)
- Visible: 'ELL' (4x69) = header row 1 + 3 article rows (ELLESSE SS27 supplier FJB, art A240 Brown/FW, A215 Pink/ACC, A216 Purple/APP). 'Mapping' (89x6) = the mapping spec: MD Tools (BY Buyingplan) | 1st Ingestion Line List (Recap Sample) | Stibo attr | Rules | 2nd Ingestion Line List (Generated from BY Plan) | Question. 'MAPPING GEN ART' (50x21) = Generic-Article code matrices (ArtType License=R SSE=X Wholesale=W Sample=S; Category Casual=C Running=R …; Gender F/M/B/G/U; Color A-Z; Age Adult/Kids/Infant/Preschool/Grade School; composition example DIAR6RT123MB = Brand+ArtType+Year+Category+SupplierCode(4)+Gender+Color).
- Hidden: 'Sheet1' (504x31) = raw LOTTO recap data (header row 3, ~501 rows, style-color per row, sizes as range string '39-44', #VALUE! error present); 'Database Stibo' (74x37) = code lookup blocks incl. brand initials per supplier; 'Sheet5' = MD-Tools→source mapping; 'Sheet2' = pivots; 'Sheet3' = column list; 'Sheet4' empty.
- ELL 69-col header = superset of 1st-ingestion linelist cols (No…ETA DATE, OUTSOLE CODE, Status) + 2nd-ingestion snake_case cols (ProductSize, suggested_retail_price, proposed_retail_price, landed_cost — EXACTLY the names referenced in Ellesse(Licensed) J48/J53/J60 '2nd ingestion : proposed_retail_price') + MD enrichment cols (Price Range, BCI, NOA, Color Group, Standardized Color, Silhouette, Width, Material - Upper, Fastening, Franchise, Content, Fabric, Pattern/Print, Fit, Style, Material, Pack Details, Brand Category, Vendor Code, Product Flag, Merchandise Hierarchy, Ecom Indicator, BY Indicator, 'Principal Style Decription' [typo in source]).
- Granularity: one row per style+colorway (article planning level), NOT per size variant; size range is a string; images referenced but embedded in file (hence 39MB).

### 5. Feasibility of config-driven auto-mapping engine
HIGH for structure extraction (headers, VLOOKUP-resolved values, lookup tables, RNA matrix, LOVs → JSON/DB all parseable). MEDIUM for rule execution: ~10 recurring rule archetypes (direct copy, constant default, country-derived default, first-entry, substring (last 3 digits), concatenation Generic/Variant codes w/ per-brand 'Type A-F' variants, LOV lookup, AI image analysis, AI translation, ingestion-stage-conditional 1st vs 2nd) — but they are expressed as free text in K/M + letter codes, so each brand's rules need human confirmation or NLP-assisted normalization before becoming executable specs.
Top risks: ① rules are prose, not formulas (only VLOOKUPs are formulas); ② letter-code taxonomy not 100% aligned with G text; ③ 55 spelling variants of mapping types; ④ sheet-specific column shifts (Ellesse M/N vs Adidas M/N meanings differ; applicability header labels differ); ⑤ inconsistent LOV sheet schemas + value/ID order flips; ⑥ #N/A attrs (80) have no STEP ID; ⑦ known gaps (Reebok unmapped silhouettes, Summary Missing Requirements open items, Indonesian TODO notes); ⑧ filename convention not yet standardized (4 open COE questions); ⑨ copy-paste bugs (Crocs r22); ⑩ 2nd ingestion semantics per brand (blank vs principal column) must be encoded per stage.

### 6. Estimated counts
- Distinct Stibo attributes: 380 in MDD Core Attributes (401 rows); 167 in mapping-workbook hidden MDD; 150 distinct AT_ IDs actually referenced across the 29 brand sheets; 234-row template of which 154 have IDs.
- Mapping rules: 6,786 brand-sheet rows (~5,099 with explicit mapping-type, ~2,890 with product-type letter codes); ~1,700 value-lookup pairs in 15 MD-mapping sheets; 2,364 RNA brand/company rows; 1 Business Rule.
- LOV entries: ~43,352 across 64 sheets.

---
Task ID: 7
Agent: Main agent
Task: Synthesis of all agent findings into final response for user

Work Log:
- Collected reports from Agent A (lambda ETL deep-dive), Agent B (Excel structures), Agent C (Stibo STEP web research 2026)
- Key synthesis: goal of web portal with auto-mapping/auto-fill is strongly supported by evidence; mapping-driven ETL generation (anta/birkenstock pattern) is the prototype of the generic engine; mapping sheets already contain "Manual Input in Portal" and "AI" mapping types (currently excluded from output) — the portal fills this designed gap
- Stibo 2026: REST API V2 v1.4 can sync attributes/LOVs/validators from STEP; IIEP upload-direct contract stable; monitoring APIs enable closed-loop error feedback; OOTB Smartsheet/Supplier UI license-gated and volume-limited → custom portal justified
- Final response delivered in chat (Indonesian)

Stage Summary:
- Deliverable of this phase: comprehensive assessment + proposed architecture + roadmap + open questions, delivered in conversation
- All analysis artifacts: /home/z/my-project/analysis/, /home/z/my-project/scripts/, worklog sections by agents A/B/C

---
Task ID: 8
Agent: Main agent
Task: Create comprehensive English DOCX system documentation of current MAP-Stibo integration

Work Log:
- User clarified: MAP Portal exists (web upload + dropdown-based auto naming), "Manual Input in Portal" = entering in MAP Portal, users = COE/Brand/IT, Stibo credentials in env vars
- AskUserQuestion answered: DOCX, English, all teams audience, full manual 50-80p, all 6 modules, full diagrams, full known issues, MAP Portal from description (assumptions marked)
- Loaded docx skill (create route, docx-js-core, design-system R1+DM-1, common-rules, toc.md, report scene) + charts skill (playwright-css Layout C, _rules iron laws)
- Outline set: 18 sections (front matter + 16 chapters + appendices A-F)
- Next: 5 diagrams via Playwright+CSS, then docx build

Stage Summary:
- Deliverable: /home/z/my-project/download/MAP-Stibo_System_Documentation.docx

---
Task ID: 8 (completion)
Agent: Main agent
Task: Deliver MAP-Stibo System Documentation DOCX

Work Log:
- Rendered 5 diagrams (Playwright+CSS, charts-skill compliant): fig1 architecture, fig2 naming decoder, fig3 router flow, fig4 reference data framework, fig5 E2E walkthrough -> /home/z/my-project/analysis/diagrams/
- Built DOCX via docx-js: cover R1/DM-1, Document Control (Roman numerals), TOC field + 107 placeholder entries, Executive Summary, 16 chapters, appendices A-F; Times New Roman Profile A; 24 tables; 5 embedded figures; code blocks for STEPXML + audit JSON
- Post-processing: add_toc_placeholders.py (exit 0), footer instrText patched (ROMAN/arabic), empty pgNumType removed
- postcheck.py: 0 errors (1 acceptable warning: table-cell line spacing 276 vs body 312, by design)
- Visual verification via LibreOffice PDF render: cover, doc control, TOC, body, tables (cross-page header repeat OK), figures OK
- Final: 61 pages A4, 2.1 MB

Stage Summary:
- DELIVERABLE: /home/z/my-project/download/MAP-Stibo_System_Documentation.docx (61 pages, English, v1.0)
- Generator scripts preserved: /home/z/my-project/scripts/docx_gen/ (editable for revisions)
- Diagram sources: /home/z/my-project/analysis/diagrams/*.html (editable HTML -> re-render via scripts/render_diagrams.py)
