// content3.js — Chapters 11–16
const { h1, h2, h3, p, bullet, tableCaption, bizTable, figure, codeBlock, spacer, note } = require("./helpers");

function build() {
  const el = [];

  // ════════════════════════════════ CHAPTER 11 ════════════════════════════════
  el.push(h1("11. End-to-End Flow Walkthroughs"));

  el.push(h2("11.1 Walkthrough A - Brand-Specific Upload (Ellesse Recap, SP2027)"));
  el.push(p("This is the canonical happy path, traced step by step from the portal click to the STEP background process. The worked file is the supplied sample 0888-SP-ELLESSE-Recap Sample MAA Sport Licensed-Multi-SP2027-ID-1.xlsx; Figure 11-1 shows the same flow graphically."));
  el.push(bullet([{ t: "1. Upload. ", b: true }, { t: "The user selects Company Code 0888, Season Spring - SP, Brand ELLESSE, File Type Recap Sample, SBU MAA Sport (SP), License, Multi, Country Indonesia - ID in the MAP Portal and drops the Excel file. The portal writes it to raw/metadata/ellesse/ under the standardised name." }]));
  el.push(bullet([{ t: "2. Trigger. ", b: true }, { t: "S3 emits ObjectCreated; EventBridge invokes router.lambda_handler with bucket and key." }]));
  el.push(bullet([{ t: "3. Routing. ", b: true }, { t: "The router extracts principal ellesse from path segment 2, finds the handler in BRAND_ROUTER, and creates an AuditLogger with trigger_type brand_specific." }]));
  el.push(bullet([{ t: "4. Classification. ", b: true }, { t: "The handler matches Recap Sample against its keyword dictionary and selects type recap, mapped by ETL_DISPATCHER to recap_main." }]));
  el.push(bullet([{ t: "5. Required-file check. ", b: true }, { t: "REQUIRED_TYPES = {recap, mdd, attributes}. The handler lists the brand prefix and the raw/metadata root, picks the latest sequence per type, and verifies the set. If incomplete it returns waiting_for_mandatory_files and the flow ends here (audit-only)." }]));
  el.push(bullet([{ t: "6. Preparation. ", b: true }, { t: "Files download into /tmp/stibo_workdir_ellesse/input/{type}; xlsb/csv inputs are converted to xlsx." }]));
  el.push(bullet([{ t: "7. Context defaults. ", b: true }, { t: "From the file name the ETL derives company code 0888, SBU SP, brand code ELL, season SP2027, country ID." }]));
  el.push(bullet([{ t: "8. Reference load. ", b: true }, { t: "MDDLoader reads Core Attributes + LOV sheets; AttributesListLoader reads the Ellesse tab; the MD-mapping loader reads the gender/age translations; RNALoader joins the RNA sheet with a four-pass fuzzy strategy." }]));
  el.push(bullet([{ t: "9. Transform pass 1. ", b: true }, { t: "Each article row is mapped on a worker thread (max 8): source columns are read, substrings and concatenations applied, gender/age resolved raw to display to LOV ID, defaults applied, mandatory and LOV-membership validation evaluated." }]));
  el.push(bullet([{ t: "10. Transform pass 2. ", b: true }, { t: "The classification subtree (CLH_ELLBatches, CLH_ELL_SP2027 with UA leaf) and the Product/Variant XML are streamed to output/xml with a 1 MB buffer." }]));
  el.push(bullet([{ t: "11. XML upload. ", b: true }, { t: "The XML lands at processed/stepxml/ellesse/0888-SP-ELLESSE-Recap Sample MAA Sport Licensed-Multi-SP2027-ID-1.xml; the audit records the uploaded keys." }]));
  el.push(bullet([{ t: "12. Delivery trigger. ", b: true }, { t: "The processed-bucket notification invokes the delivery lambda, which matches recap\\s*sample and resolves endpoint IIEP_ArticlePlanning." }]));
  el.push(bullet([{ t: "13. Upload to STEP. ", b: true }, { t: "OIDC token fetched (or reused), POST upload-direct?fileName=...&context=Context1&workspace=Main with the XML bytes; 2xx returns the bgId; the receipt JSON is written; non-retryable 4xx abort immediately, 5xx/429 retry up to three times with backoff." }]));
  el.push(bullet([{ t: "14. Audit flush. ", b: true }, { t: "Back in the router's finally block, the audit JSON is written to raw/logs/ellesse/{timestamp}.json. STEP processes the file in its BGP queue; today the outcome is visible only in STEP monitoring (Section 10.6)." }]));
  el.push(...figure("fig5_walkthrough.png", "Figure 11-1 - End-to-end walkthrough of a brand-specific upload (six phases, 16 steps)", 520));

  el.push(h2("11.2 Walkthrough B - Global File Fan-Out"));
  el.push(p("When the COE team uploads a new Master Data Dictionary to raw/metadata/ (no brand folder), the router's global-file branch fires. It iterates all 27 BRAND_ROUTER entries; for each brand it creates a fresh auditor, builds the synthetic event key raw/metadata/{brand}/.__global_trigger__ (a name that matches no keyword, so the handler classifies nothing and simply refreshes), and invokes the handler. Each brand re-lists its inputs, re-runs its ETL against the new dictionary, and rewrites its XML - which in turn re-delivers everything to STEP. Failures are isolated per brand and reported in the composite response. The design guarantees that every brand's next output is consistent with the newest reference data, at the cost of a full pipeline wave per global upload: today this is acceptable, but the sequential loop inside a single invocation is the first thing that will hit the 15-minute ceiling as brand count grows (KI-02)."));

  el.push(h2("11.3 Walkthrough C - Incomplete Upload and Resume"));
  el.push(p("Assume the Ellesse recap arrives while the brand's attributes list is missing. Step 5 above finds the gap and the invocation ends with waiting_for_mandatory_files - deliberately HTTP 200 so EventBridge does not retry. Hours later the COE team uploads the attributes list; that upload's own event re-invokes the same handler, which now finds recap + mdd + attributes and proceeds with the full flow. The model trades immediacy for robustness: no orchestrator is needed, but the delay between partial and complete states is invisible to users. Operationally this means a missing-file condition is only discoverable through the audit logs or through the symptom that no XML appeared - hence the daily check in the runbook (Section 15.1)."));

  el.push(h2("11.4 Walkthrough D - Delivery Lambda Mechanics"));
  el.push(p("The delivery invocation starts from the XML object event. Parsing validates the processed/stepxml/{principal}/ prefix; filename routing resolves the endpoint (or honours an explicit endpoint_type override in direct invocations); configuration is loaded from environment with hard failures for missing STIBO_* variables; the XML is read into memory; the blank_ids transformation optionally blanks CLH_ classification IDs; structural counters (xmlns, ns0:, Value counts) are logged; and the upload proceeds per the retry matrix of Table 10-1. Success writes the bgId receipt; exhaustion returns 502 with the file still in place in S3, so recovery is a direct re-invocation rather than a re-run of the whole ETL."));

  // ════════════════════════════════ CHAPTER 12 ════════════════════════════════
  el.push(h1("12. Observability, Logging and Traceability"));

  el.push(h2("12.1 The Audit Document"));
  el.push(p("Every invocation of the transform lambda produces one structured JSON document, flushed by the router (never by the brand handlers) to raw/logs/{brand}/{YYYYMMDD_HHMMSS}.json. The schema has five sections plus runtime metadata: router (trigger type, original key, detected brand, routing decision), lambda_function (file classification, missing required types, per-file download outcomes, conversions, parsed metadata, diffs, uploaded XML keys, status and error), etl (loader statuses, article and variant counts, warning counts, XML file name and size, status and error), articles (per-article status written/skipped/failed with warnings) and validation_warnings (full warning strings). The document closes with request id, start and end timestamps, duration and the raw input event."));
  el.push(codeBlock([
    "{",
    "  \"schema\": \"1.0\",",
    "  \"router\": {",
    "    \"trigger_type\": \"brand_specific\",",
    "    \"original_key\": \"raw/metadata/ellesse/0888-SP-ELLESSE-...-ID-1.xlsx\",",
    "    \"detected_brand\": \"ellesse\",",
    "    \"routing_decision\": \"brand-specific file upload; routing to 'ellesse' handler\"",
    "  },",
    "  \"lambda_function\": {",
    "    \"file_classification\": { \"trigger\": \"recap\", \"etl\": \"recap_main\" },",
    "    \"missing_required_types\": [],",
    "    \"downloads\": [ { \"type\": \"recap\", \"key\": \"...\", \"status\": \"ok\" }, ... ],",
    "    \"uploaded_xml\": [ \"processed/stepxml/ellesse/0888-SP-ELLESSE-....xml\" ],",
    "    \"status\": \"success\"",
    "  },",
    "  \"etl\": { \"articles\": 3, \"variants\": 57, \"validation_warnings\": 0, \"status\": \"success\" },",
    "  \"articles\": [],",
    "  \"validation_warnings\": [],",
    "  \"runtime\": { \"request_id\": \"...\", \"duration_seconds\": 41.8 }",
    "}",
  ], "Audit document structure (illustrative; field set per audit_logger.py v1.0)"));
  el.push(spacer());

  el.push(h2("12.2 Log Surfaces"));
  el.push(p("Three surfaces exist. The S3 audit documents are the primary evidence - immutable, per-invocation, and queryable by prefix and timestamp. CloudWatch carries the Python logging output of both lambdas, including the delivery lambda's routing decisions, XML head/tail debug dumps and Stibo HTTP responses; it is the first place to look for delivery-side failures. The bgId receipts (Section 10.5) are the smallest but most operationally valuable surface, because they answer whether a specific file reached STEP. Retention policies on all three surfaces are not documented in the code and should be confirmed with IT (recorded in Chapter 13 as part of KI-13)."));

  el.push(h2("12.3 Traceability Chain"));
  el.push(p("A single upload can be traced end to end today through three identifiers: the S3 object key (input), the audit document in raw/logs (transformation evidence, including every download, conversion, article count and uploaded XML key), and the bgId receipt (delivery evidence). What is missing is the fourth link: the STEP background process outcome. The bgId is captured but never resolved against STEP's monitoring API, so rejection inside STEP (schema violations, failed business conditions) is invisible to the pipeline and surfaces only when someone opens the STEP Workbench. Closing this loop is recommendation R-03."));

  el.push(h2("12.4 Known Observability Gaps"));
  el.push(p("Four gaps limit current diagnosability. First, the per-article evidence fields exist in the schema but no ETL writes them (auditor.add_validation_warnings is never called), so article-level issues must be reproduced locally rather than read from logs (KI-03). Second, there are no correlation IDs beyond the Lambda request id - tracing one business file across transform, delivery and STEP requires manual key matching. Third, the waiting_for_mandatory_files state is logged but not alerted on, so partial uploads can sit unnoticed (Section 11.3). Fourth, no metric or dashboard aggregates audit outcomes; operations is grep-based today. All four are addressed by the observability recommendations in Chapter 16."));

  // ════════════════════════════════ CHAPTER 13 ════════════════════════════════
  el.push(h1("13. Known Issues and Technical Debt Register"));

  el.push(p("This chapter consolidates every defect, gap and debt item found during the documentation effort, with severity, evidence and suggested direction. Severity meanings: Critical - can silently corrupt or stop production data flows; High - causes operational burden or wrong results under realistic conditions; Medium - maintainability or observability burden; Low - hygiene. The register should be treated as living: IT should own it in the team's tracker, with this table as the baseline import."));

  el.push(tableCaption("Table 13-1 - Known issues and technical debt register"));
  el.push(bizTable(
    ["ID", "Sev.", "Area", "Description and evidence", "Direction"],
    [
      ["KI-01", "Critical", "ETL runtime", "Several ETL modules call sys.exit(1). SystemExit derives from BaseException, not Exception, so the router's try/except cannot catch it: during global fan-out one failing brand terminates the whole invocation and the remaining brands never run.", "Replace with raised exceptions; add a regression test that fan-out survives a failing brand."],
      ["KI-02", "High", "Router", "Global file fan-out executes all 27 brands sequentially inside one invocation (router.py lines 148-192). Ingestion volume growth makes the 15-minute Lambda ceiling a realistic failure.", "Fan out via per-brand Lambda invokes or SQS; keep per-brand isolation."],
      ["KI-03", "High", "Observability", "audit_logger.add_validation_warnings and the per-article record API are never called by any ETL (verified by search). Article-level failures are invisible in production logs.", "Wire warning/report calls into every ETL; backfill for the recap clone family first."],
      ["KI-04", "High", "Config consistency", "The Aldo handler is largely commented out while its router entry remains active; the README states Aldo is inactive. Traffic to raw/metadata/aldo/ produces undefined behaviour.", "Either restore the handler or remove the router entry; align README."],
      ["KI-05", "Critical", "Security", "An uploaded Aldo .xlsm business file carries a database connection string and username in its PARAMS sheet (aldo/lambda_function.py lines 16-20). Credentials travel inside business files on S3.", "Purge the file; forbid credentials in business files; add upload scanning; rotate the exposed credential."],
      ["KI-06", "High", "Data governance", "80 of 234 mapping-template attributes have no AT_ identifier (hidden-MDD VLOOKUP returns #N/A): Images 1-50, BY hierarchy, packaging dimensions, Valid From/To, MC structure, VN/TH translations.", "Assign IDs with the STEP administrator or mark the attributes not-in-scope."],
      ["KI-07", "High", "Data governance", "Mapping-type column G contains 55 spelling variants of six intended values; letter-to-type agreement is about 85 percent. Any config-driven consumer will mis-classify rows.", "Normalise the column once, add validation to the workbook."],
      ["KI-08", "Medium", "Maintainability", "64 copies of the MDD loader and 37 of the RNA loader; the recap engine cloned across five brands (~90 percent identical). Fixes do not propagate.", "Consolidate into shared modules with per-brand config (see R-01)."],
      ["KI-09", "Medium", "Runtime", "New Balance and Diadora share the /tmp/stibo_workdir root; warm-container reuse could interleave files. LAMBDA_TMP_DIR must be set before ETL imports (import-order dependency), re-asserted defensively only in ANTA.", "Give every brand a unique tmp root; pass the path as a parameter."],
      ["KI-10", "Medium", "Deployability", "No requirements.txt or dependency pins for the transform lambda; layer contents are tribal knowledge.", "Publish a pinned requirements file; add CI lint and package build."],
      ["KI-11", "Medium", "Naming", "The de-facto filename convention differs from the unratified COE proposal (Section 4.4); classification must tolerate both. New file types require triple registration (portal, transform, delivery).", "Ratify one convention; generate the three registrations from one source of truth."],
      ["KI-12", "Medium", "Reference data", "Confirmed mapping-sheet defect: Crocs Principal Size Code row targets AT_PrincipalStyleCode. Reebok MD-mapping silhouettes: 22 of 38 raw values unmapped. Business Rules sheet holds one rule.", "Quarterly reference-data review; add workbook linting."],
      ["KI-13", "Low", "Operations", "Retention of audit logs, receipts and processed XML is undefined; no dashboards or alerts over audit outcomes.", "Define retention; build a small audit-dashboard (see R-06)."],
      ["KI-14", "Low", "Documentation", "README drift: claims aldo is commented (contradicted by router), lists 5 brands while 27 are registered; adidas module contains a stale debug-break comment.", "Regenerate docs from code; this document is the new baseline."],
    ],
    [8, 9, 14, 47, 22],
    { fontSize: 16 }
  ));
  el.push(spacer());
  el.push(note([{ t: "Reading the register: ", b: true }, { t: "KI-01 and KI-05 are the two items that should be actioned immediately - one protects the integrity of every global refresh, the other removes live credentials from the data platform. Both are small, isolated changes." }], "warn"));

  // ════════════════════════════════ CHAPTER 14 ════════════════════════════════
  el.push(h1("14. Security Assessment"));

  el.push(h2("14.1 Posture Today"));
  el.push(p("The pipeline's security posture rests on four pillars, all conventional and correctly applied in the code reviewed: secrets live in environment variables with the client secret recommended from AWS Secrets Manager; transport is HTTPS with Bearer-token authentication against the OIDC endpoint; S3 access is scoped through Lambda execution roles (the delivery lambda documents its required s3:GetObject/s3:PutObject and secretsmanager:GetSecretValue permissions); and no hard-coded credentials were found anywhere in the 121k-line transform code base or the delivery lambda. The token cache never persists tokens to disk, and dry-run mode allows connectivity tests without data movement."));

  el.push(h2("14.2 Findings"));
  el.push(tableCaption("Table 14-1 - Security findings"));
  el.push(bizTable(
    ["ID", "Severity", "Finding", "Recommendation"],
    [
      ["F-01", "Critical", "Database connection string and username found inside an uploaded business file (Aldo PARAMS sheet, KI-05). Credentials in business files bypass all secret management and are readable by everyone with S3 read access.", "Rotate the credential immediately; purge the file; add a scanning rule on upload; instruct principals never to embed connection data."],
      ["F-02", "Medium", "STEP monitoring sensors are unauthenticated by design; anyone with network access to the STEP host can read endpoint health. Informational - the pipeline does not expose them further.", "Network-restrict the monitoring surface; note for the future feedback loop to prefer the authenticated REST API."],
      ["F-03", "Medium", "Transform handlers list brand prefixes with broad listing patterns; a misplaced upload anywhere under raw/metadata/{brand}/ is ingested by that brand's flow.", "Tighten prefix validation where feasible; rely on portal contract plus audit review as compensating control."],
      ["F-04", "Low", "No explicit encryption or KMS statements in code; S3 encryption defaults are assumed.", "Confirm bucket default encryption (SSE-KMS) and lifecycle policies with IT."],
      ["F-05", "Low", "Delivery lambda logs XML head/tail (first 1,000 / last 300 characters) at INFO level; product data fragments land in CloudWatch.", "Reduce to debug level or sample, in line with data-classification policy."],
    ],
    [8, 11, 47, 34]
  ));
  el.push(spacer());

  el.push(h2("14.3 Recommendations"));
  el.push(p("Beyond the per-finding actions: adopt a written secret-rotation procedure for STIBO_CLIENT_SECRET (quarterly is a reasonable default); add a per-upload access review so portal permissions match the brand ownership matrix; and when the portal gains auto-mapping features (Chapter 16), place its new API surface behind the corporate identity provider with role-based access per brand - the user groups (COE, Brand, IT, selected users) already imply an RBAC model that today exists only informally."));

  // ════════════════════════════════ CHAPTER 15 ════════════════════════════════
  el.push(h1("15. Operational Runbook"));

  el.push(h2("15.1 Daily Operations Checklist"));
  el.push(bullet("Check raw/logs/ for new audit documents with status error or with waiting_for_mandatory_files in the response; each waiting entry means a brand file is parked incomplete."));
  el.push(bullet("Reconcile: for every XML written to processed/stepxml/ in the last 24 hours, confirm a bgId receipt exists in processed/stepxml/bgid/. A missing receipt means delivery failed - inspect CloudWatch for the delivery lambda."));
  el.push(bullet("Spot-check one audit document per active brand per week against the article counts the brand team expects (the audit contains article and variant counts)."));
  el.push(bullet("Review STEP-side health: monitoring sensor status for the three IIEPs (traffic light) and, after large uploads, the endpoint's background-process list for completed-with-errors outcomes."));
  el.push(bullet("Confirm the global reference files (MDD, attributes list) have the expected latest-version timestamps in raw/metadata/; an old dictionary silently degrades every brand's output."));

  el.push(h2("15.2 Troubleshooting Matrix"));
  el.push(tableCaption("Table 15-1 - Symptom, likely cause, resolution"));
  el.push(bizTable(
    ["Symptom", "Likely cause", "Resolution"],
    [
      ["No audit document for an upload", "EventBridge rule disabled, or key outside raw/metadata/", "Check EventBridge metrics; verify the S3 key prefix and the router's ignore response in CloudWatch"],
      ["Audit says waiting_for_mandatory_files", "A companion file (mdd/attributes/naming) is missing or misnamed", "Identify the missing type in the audit's missing_required_types; upload it via the portal; processing resumes automatically"],
      ["Audit shows classification succeeded but no XML", "ETL failed mid-run (see etl.status/error in the audit), or sys.exit path (KI-01)", "Read the audit etl section; reproduce locally; check for the sys.exit defect in that brand"],
      ["XML exists in processed/stepxml but no bgId receipt", "Delivery failed: routing miss (400) or Stibo 4xx/5xx after retries", "CloudWatch for the delivery lambda: look for 'No routing rule matched' or the Stibo HTTP status; fix name/endpoint or re-invoke directly with endpoint_type override"],
      ["Stibo returns 4xx on upload", "Disabled IIEP, full BGP queue, forbidden characters in file name, or expired/incorrect credentials", "Verify endpoint enabled in STEP; check queue depth; sanitise file name; rotate/verify OIDC credentials"],
      ["Transform timeout (no completed audit)", "Oversized brand file, or fan-out duration growth (KI-02)", "Re-run the single brand upload; schedule global uploads off-peak; prioritise KI-02 fix"],
      ["Values missing from STEP that exist in Excel", "LOV miss with skip policy; mapping type excluded (Manual/AI); attribute without AT_ ID (KI-06)", "Check the mapping tab column G and the LOV sheet; resolve the ID or accept documented skip"],
      ["All brands re-processed unexpectedly", "A global file was uploaded to raw/metadata/ root (fan-out)", "Expected behaviour; verify fan-out results map in the router response and watch for KI-01/KI-02 symptoms"],
      ["Duplicate season classifications in STEP", "blank_ids disabled on a re-delivery", "Re-send with blank_ids enabled (default) so STEP matches classifications by name"],
    ],
    [26, 34, 40],
    { fontSize: 18 }
  ));
  el.push(spacer());

  el.push(h2("15.3 Deploying a New Lambda Version"));
  el.push(p("Both lambdas deploy as zipped packages. For the transform lambda: update the brand package(s) inside the deployment zip, keep router.py imports consistent (import failures fail the whole function), update the layer if pandas/openpyxl/pyxlsb versions change (no pins exist - KI-10), set environment variables (RAW_BUCKET, PROCESSED_BUCKET) and deploy. Smoke-test with a harmless upload to one brand folder and verify the audit document. For the delivery lambda: replace lambda_function.py, keep the STIBO_* environment contract, and first deploy with STIBO_DRY_RUN=true to validate token fetch and routing without posting data; then disable dry-run and re-drive one failed XML (if any) as the live test. Always keep the previous zip for rollback."));

  el.push(h2("15.4 Onboarding a New Brand or File Type"));
  el.push(p("Execute in this order: (1) agree the mapping with the COE team and complete the brand tab in the mapping template, including AT_ IDs via the hidden MDD tab; (2) create the brand package - clone the closest existing generation (prefer a mapping-driven brand) and implement the handler skeleton of Table 6-1; (3) register keyword dictionaries, required-type policy and ETL dispatcher inside the package; (4) add the import and BRAND_ROUTER entry in router.py; (5) if the file type is new, add the ordered routing pattern in the delivery lambda and the dropdown option in the portal; (6) create the brand's S3 folder implicitly by uploading the first file; (7) test end to end in dev with a real principal file, verifying the audit document, the XML, the receipt and the STEP BGP outcome; (8) update Appendix A of this document."));

  el.push(h2("15.5 Refreshing Global Reference Data"));
  el.push(p("When the COE team updates the Master Data Dictionary or attributes list: upload the new version to raw/metadata/ root via the portal - this triggers the full fan-out described in Section 11.2. Schedule it off-peak; expect a full wave of XML regeneration and re-delivery for all 27 brands; verify the fan-out results map (per-brand statuses) in the router response and watch the first two or three audits for errors. Remember the two fan-out risks: sequential duration (KI-02) and any brand with the sys.exit defect aborting the remaining brands (KI-01) - if the results map is truncated, that is the signature."));

  el.push(h2("15.6 Ownership and Escalation"));
  el.push(tableCaption("Table 15-2 - Ownership matrix (to be confirmed and kept current by IT)"));
  el.push(bizTable(
    ["Area", "Owner", "Escalation path"],
    [
      ["MAP Portal availability and permissions", "IT", "[to be confirmed]"],
      ["Mapping template and MDD content", "COE team", "[to be confirmed]"],
      ["Brand file content and upload correctness", "Brand teams", "[to be confirmed]"],
      ["AWS pipeline (lambdas, S3, EventBridge)", "IT / integration engineering", "[to be confirmed]"],
      ["Stibo STEP endpoints, BGP errors, data model", "STEP administrator", "[to be confirmed]"],
    ],
    [40, 28, 32]
  ));
  el.push(spacer());

  // ════════════════════════════════ CHAPTER 16 ════════════════════════════════
  el.push(h1("16. Improvement Recommendations and Future Direction"));

  el.push(h2("16.1 Summary of Improvement Areas"));
  el.push(p("The documentation surfaced one structural insight and a set of concrete defects. The structural insight: roughly seventy to eighty percent of the transform code base is duplicated boilerplate around one canonical XML writer, and the newest brands already demonstrate the alternative - configuration-driven engines that read the mapping workbook at runtime. The defects are catalogued in Chapter 13. The recommendations below are ordered so that each phase de-risks the next; the roadmap in Section 16.5 turns them into a sequence."));

  el.push(tableCaption("Table 16-1 - Recommendation register"));
  el.push(bizTable(
    ["ID", "Recommendation", "Addresses", "Horizon"],
    [
      ["R-01", "Consolidate the loader layer: one shared MDDLoader, RNALoader, AttributesListLoader and mapping engine, configured per brand instead of copied per brand", "KI-08, KI-12", "Near term"],
      ["R-02", "Fix KI-01 (sys.exit) and KI-02 (sequential fan-out) as standalone, low-risk patches", "KI-01, KI-02", "Immediate"],
      ["R-03", "Close the feedback loop: resolve bgIds against STEP monitoring APIs and surface per-row errors back to the pipeline and, later, the portal", "Chapter 10.6, 12.3", "Near term"],
      ["R-04", "Wire the per-article audit evidence (KI-03): every ETL records warnings and article statuses", "KI-03", "Near term"],
      ["R-05", "Ratify the naming convention and generate portal, transform and delivery registrations from one source of truth", "KI-11", "Near term"],
      ["R-06", "Build a small audit dashboard over raw/logs (statuses, waiting files, delivery failures) with alerts", "KI-13, 12.4", "Mid term"],
      ["R-07", "Clean the mapping template: resolve 80 missing AT_ IDs, normalise column G, complete Reebok/Crocs gaps", "KI-06, KI-07, KI-12", "Mid term"],
      ["R-08", "Generalise the mapping-driven engine into a single generic ETL with a typed transform DSL for the ten rule archetypes of Table 8-3", "6.4, 16.2", "Mid term"],
      ["R-09", "Portal evolution: in-portal validation and auto-mapping preview before upload (see 16.3)", "16.3", "Long term"],
      ["R-10", "Adopt STEP REST API v2 for model sync (attributes, LOVs, validators) and evaluate AI mapping capabilities", "16.4", "Long term"],
    ],
    [8, 52, 20, 20]
  ));
  el.push(spacer());

  el.push(h2("16.2 The Config-Driven Engine"));
  el.push(p("The target architecture for the transform layer is a single generic engine whose behaviour is fully described by per-brand configuration compiled from the mapping template. The configuration schema needs to capture: an input profile (sheet names, header rows, column aliases, fallbacks); attribute rules (source column, archetype from Table 8-3, transform parameters, LOV reference, miss policy per the three existing behaviours); key and variant formulas (the per-brand generic-code Types A-E); classification references and defaults; and the validation policy. The two mapping-driven brands prove feasibility; the ten archetypes bound the transform DSL; the honest hard parts are the derivation formulas and the multi-file joins, which today live only in code for a few brands and should migrate into the DSL incrementally rather than big-bang."));

  el.push(h2("16.3 Portal Evolution - Auto-Mapping and Auto-Fill"));
  el.push(p("The business goal is a portal where the user uploads, the system applies the mapping and auto-fills everything that rules and LOVs can determine, and the final XML is produced and sent to Stibo. Mapped onto the current landscape, the natural evolution keeps the proven pipeline and moves intelligence upstream: the portal (or a service behind it) performs pre-validation at the point of entry - required fields per the MDD cardinality, LOV membership, format checks - giving the user a row-and-cell error report before anything reaches S3; it applies the rule archetypes to show which cells will be auto-filled (direct, default, derived) and which need manual input or AI assistance; and it implements the 1st/2nd ingestion staging that several mapping rules already assume. The four mapping types that today are excluded from output (Manual Input in Portal, AI Images Analysis, AI Translation, and stage-conditionals) become exactly the fields the portal asks the user to complete or confirms - closing the gap the mapping workbook has anticipated since it was designed."));

  el.push(h2("16.4 Stibo STEP 2026 Capabilities Worth Adopting"));
  el.push(p("Three current platform capabilities align directly with this roadmap. First, REST API v2 (since 2026.1) exposes the data model - attributes with validators, LOVs with validators and data-type groups, contexts, unique keys - enabling the pipeline to sync reference data from STEP instead of maintaining the MDD workbook by hand (R-10), eliminating an entire class of drift. Second, the monitoring and attachment APIs (Section 10.6) make R-03 a configuration exercise rather than a reverse-engineering project. Third, the platform's AI direction (attribute-mapping automation reported by the vendor, intelligent assistants, and the MCP server for agent access) suggests that mapping-as-data (R-08) is also the safest long-term posture: when mapping lives in structured configuration, external AI capabilities can consume it without code changes. The IIEP/STEPXML inbound contract itself is stable across 2025-2026 releases and needs no change."));

  el.push(h2("16.5 Phased Roadmap"));
  el.push(tableCaption("Table 16-2 - Suggested phase plan"));
  el.push(bizTable(
    ["Phase", "Content", "Outcome"],
    [
      ["0. Foundations (2-3 weeks)", "R-02 fixes; KI-04/05 clean-up; reference-data clean-up plan (R-07); naming ratification (R-05); this document reviewed and corrected by the team", "Stabilised baseline; verified documentation"],
      ["1. Visibility (4-6 weeks)", "R-04 audit evidence; R-03 feedback loop; R-06 dashboard", "Failures visible within minutes; STEP rejections traceable"],
      ["2. Consolidation (6-10 weeks)", "R-01 shared loaders; migrate the five recap clones; R-08 engine core with the ten archetypes", "Code base shrinks substantially; new brands become configuration"],
      ["3. Portal intelligence (8-12 weeks)", "Pre-validation service; auto-mapping preview; manual/AI input flows; RBAC", "Users see errors before upload; mapping types Manual/AI become executable"],
      ["4. Platform sync (ongoing)", "R-10 model/LOV sync from STEP; evaluate AI mapping adoption; retire manual MDD maintenance where possible", "Reference data self-maintaining; drift class eliminated"],
    ],
    [22, 48, 30]
  ));
  el.push(spacer());
  el.push(p("Sequencing principle: visibility before consolidation, consolidation before intelligence. Each phase leaves the pipeline in a deployable state, and none requires a freeze of business-as-usual uploads. The phase estimates assume the current team's availability and should be re-planned after Phase 0, when the corrected documentation and the cleaned register provide firmer sizing."));

  return el;
}

module.exports = { build };
