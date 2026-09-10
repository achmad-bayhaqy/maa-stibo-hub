/**
 * STEPXML generator verification vs real STEP export samples.
 * Builds XML from synthetic mapped rows shaped like the NIKE/AIRWALK/ASTEC
 * sources and compares the structure against the user-provided references.
 */
import { buildStepxml, xmlFileName, blankSeasonClassificationIds } from "../src/lib/stepxml";
import type { MappedRow, WizardContext } from "../src/lib/mapping";

const ctx: WizardContext = {
  compCode: "0888", sbu: "SP", brandCode: "NIK", brandName: "NIKE",
  season: "SP2027", seasonYear: "2027", country: "ID",
  flow: "Line List", endpoint: "ARTICLE_PLANNING", actor: "admin@map.co.id",
};

function mkRow(values: Record<string, string>): MappedRow {
  return {
    rowNo: 1, values, statuses: [],
    mappedCount: 0, manualCount: 0, aiCount: 0, warnings: [], errors: [],
  };
}

const nikeRow = mkRow({
  AT_PrincipalStyleCode: "AA8154-101",
  AT_PrincipalStyleDescription: "Baby/Toddler Shoes",
  AT_PrincipalColorCode: "101",
  AT_PrincipalColorName: "PALE IVORY/BLACK-TAWNY-VOLT",
  AT_SAPStyleCode: "AA8154101",
  AT_InboundGenericCode: "NIKAA8154101",
  AT_Gender: "U", AT_BYGender: "U",
  AT_PrincipalGenderDescription: "Unisex",
  AT_SAPAge: "AD", AT_BYAge: "ADULT",
  AT_PrincipalAgeDescription: "Other",
  AT_Season: "SP", AT_SeasonYear: "2027",
  AT_CountryOrigin: "SG",
  AT_SAPArticleCategory: "1",
  AT_BYArticleType: "Inline",
  AT_BYIndicator: "Y", AT_SAPIndicator: "N",
  AT_UOM: "EA",
  AT_OriginalPrice: "989000", AT_CurrentPrice: "989000",
  AT_FOBCurrency: "IDR", AT_RetailPriceCurrency: "IDR",
  AT_Width: "REG",
  AT_SAPProductFlag: "5",
  AT_MaterialType: "ZHAW",
  AT_PrincipalMerchandiseHierarchyL1: "Footwear",
  AT_PrincipalMerchandiseHierarchyL2: "Young Athletes",
  AT_PrincipalMerchandiseHierarchyL3: "Ya Nsw Running",
  AT_PrincipalMerchandiseHierarchyL4: "Other",
  AT_PrincipalMerchandiseHierarchyL5: "Big Mouth",
  AT_Collection1: "Big Mouth",
  AT_Country: "ID",
  AT_BrandType: "NON-MAA BRAND",
  AT_BrandCategory: "ID - SP - TOP",
  AT_CountrySize: "US",
});

const xml = buildStepxml([nikeRow], ctx, "ARTICLE_PLANNING", "0888-SP-NIKE-LineList MAA Sport Inline-Multi-SP2027-ID-1.xlsx");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
}

console.log("== Structure vs NIKE reference ==");
check("XML declaration", xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
check("root has ExportTime", /<STEP-ProductInformation [^>]*ExportTime="\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}"/.test(xml));
check("root has ExportContext/UseContextLocale", /ExportContext="Context1"[^>]*UseContextLocale="false"/.test(xml));
check("root has NO GenerateDescriptions", !xml.includes("GenerateDescriptions"));
check("root has no update attr for ARTICLE_PLANNING", !/<STEP-ProductInformation [^>]*update=/.test(xml));
check("Classifications block present", /<Classifications><Classification ID="CLH_NIK_SP2027" UserTypeID="CLS_Season" ParentID="CLH_NikeBatches"><Name>Nike Spring 2027<\/Name>/.test(xml));
check("CA child", /<Classification ID="CLH_NIK_SP2027CA" UserTypeID="CLS_ConfirmedArticles"><Name>SP 2027 Confirmed Articles<\/Name>/.test(xml));
check("UA child", /<Classification ID="CLH_NIK_SP2027UA" UserTypeID="CLS_UnconfirmedArticles"><Name>SP 2027 Unconfirmed Articles<\/Name>/.test(xml));
check("Product PRD_GenericArticle + PPH_F-TempSubCat", /<Product UserTypeID="PRD_GenericArticle" ParentID="PPH_F-TempSubCat">/.test(xml));
check("NO Product ID attribute", !/<Product\b[^>]*\sID="/.test(xml));
check("KeyValue text form", /<KeyValue KeyID="KEY_InboundArticle">NIKAA8154101<\/KeyValue>/.test(xml));
check("KeyValue BEFORE Name", xml.indexOf("KEY_InboundArticle") < xml.indexOf("<Name>Baby"));
check("Merchandiser ref with Type", /<ClassificationReference ClassificationID="CLH_NikeArticles" Type="CPL_Merchandiser" \/>/.test(xml));
check("UnConfirmed ref with Type", /<ClassificationReference ClassificationID="CLH_NIK_SP2027UA" Type="CPL_UnConfirmedForSeason" \/>/.test(xml));
check("MultiValue AT_SBU", /<MultiValue AttributeID="AT_SBU"><Value ID="SP" \/><\/MultiValue>/.test(xml));
check("MultiValue AT_CompanyCode", /<MultiValue AttributeID="AT_CompanyCode"><Value ID="0888" \/><\/MultiValue>/.test(xml));
check("AT_Brand as ID ref", /<Value AttributeID="AT_Brand" ID="NIK" \/>/.test(xml));
check("AT_BrandGroup as ID ref", /<Value AttributeID="AT_BrandGroup" ID="NIKE" \/>/.test(xml));
check("AT_Gender as ID ref", /<Value AttributeID="AT_Gender" ID="U" \/>/.test(xml));
check("AT_PrincipalStyleCode as text", /<Value AttributeID="AT_PrincipalStyleCode">AA8154-101<\/Value>/.test(xml));
check("no SKU nesting for ARTICLE_PLANNING", !xml.includes("UserTypeID=\"SKU\""));

console.log("== Filename ==");
check("stem preserved", xmlFileName("0888-SP-NIKE-LineList MAA Sport Inline-Multi-SP2027-ID-1.xlsx", "ARTICLE_PLANNING") === "0888-SP-NIKE-LineList MAA Sport Inline-Multi-SP2027-ID-1.xml");

console.log("== AIRWALK recap-style row (Licensed, EU size, BCI) ==");
const aiwCtx: WizardContext = { ...ctx, brandCode: "AIW", brandName: "AIRWALK", season: "SP26", seasonYear: "2026" };
const aiwRow = mkRow({
  AT_PrincipalStyleCode: "F602", AT_PrincipalColorName: "Black", AT_PrincipalColorCode: "B",
  AT_PrincipalSize: "39-44", AT_InboundGenericCode: "AIWR7RF602MB", AT_Generic: "AIWR7RF602MB",
  AT_Gender: "M", AT_BYGender: "M", AT_PrincipalGenderDescription: "Male", AT_PrincipalGenderCode: "M",
  AT_SAPAge: "AD", AT_BYAge: "ADULT", AT_Season: "SP", AT_SeasonYear: "2026",
  AT_SAPArticleCategory: "1", AT_BYArticleType: "License", AT_BCI: "COMMERCIAL",
  AT_SAPProductFlag: "A", AT_RetailPriceCurrency: "IDR", AT_MainVendorIdentification: "1",
  AT_MaterialType: "ZINA", AT_PricingDistributionChannel: "01", AT_Country: "ID",
  AT_BrandType: "MAA BRAND", AT_CountrySize: "EU", AT_UOM: "EA",
});
const aiwXml = buildStepxml([aiwRow], aiwCtx, "ARTICLE_PLANNING", "0888-SP-AIRWALK-Recap Sample 2nd Ingestion MAA Sport Licensed-Multi-SP26-ID-1.xlsx");
check("AIRWALK season node", /<Classification ID="CLH_AIW_SP2026" UserTypeID="CLS_Season" ParentID="CLH_airwalkBatches"><Name>airwalk Spring 2026<\/Name>/.test(aiwXml), aiwXml.match(/<Classifications>[^<]*<[^>]+>/)?.[0]);
check("AT_BCI ID ref", /<Value AttributeID="AT_BCI" ID="COMMERCIAL" \/>/.test(aiwXml));
check("AT_PricingDistributionChannel ID 01", /<Value AttributeID="AT_PricingDistributionChannel" ID="01" \/>/.test(aiwXml));
check("AT_MainVendorIdentification text 1", /<Value AttributeID="AT_MainVendorIdentification">1<\/Value>/.test(aiwXml));
check("AT_CountrySize ID EU", /<Value AttributeID="AT_CountrySize" ID="EU" \/>/.test(aiwXml));
check("AT_Generic emitted", /<Value AttributeID="AT_Generic">AIWR7RF602MB<\/Value>/.test(aiwXml));

console.log("== EAN_UPDATE with variants ==");
const eanCtx: WizardContext = { ...ctx, endpoint: "EAN_UPDATE" };
const eanRows = [
  mkRow({ ...nikeRow.values, AT_Size: "EU 42", AT_PrincipalBarcode: "8801234567890" }),
  mkRow({ ...nikeRow.values, AT_Size: "EU 43", AT_PrincipalBarcode: "8801234567891" }),
];
const eanXml = buildStepxml(eanRows, eanCtx, "EAN_UPDATE", "test.xlsx");
check("root update=true", /<STEP-ProductInformation [^>]*update="true"/.test(eanXml));
check("variant children PRD_VariantArticle", /<Product UserTypeID="PRD_VariantArticle" update="true">/.test(eanXml));
check("KEY_Variant text form", /<KeyValue KeyID="KEY_Variant">NIKAA8154101EU42<\/KeyValue>/.test(eanXml));
check("variant size Name", /<Name>Size 1<\/Name>/.test(eanXml));
check("AT_Size ID+text", /<Value AttributeID="AT_Size" ID="EU42">EU 42<\/Value>/.test(eanXml));
check("AT_PrincipalBarcode emitted", /<Value AttributeID="AT_PrincipalBarcode">8801234567890<\/Value>/.test(eanXml));

console.log("== blankSeasonClassificationIds ==");
const blanked = blankSeasonClassificationIds(xml);
check("season ID blanked", blanked.includes('<Classification ID="" UserTypeID="CLS_Season"'));
check("CA/UA IDs blanked", /<Classification ID="" UserTypeID="CLS_ConfirmedArticles">/.test(blanked) && /<Classification ID="" UserTypeID="CLS_UnconfirmedArticles">/.test(blanked));
check("ParentID preserved", blanked.includes('ParentID="CLH_NikeBatches"'));
check("ClassificationID refs preserved", blanked.includes('ClassificationID="CLH_NikeArticles"'));
check("Product KeyValue untouched", blanked.includes('<KeyValue KeyID="KEY_InboundArticle">NIKAA8154101</KeyValue>'));

console.log("== XML well-formedness ==");
for (const [label, doc] of [["NIKE", xml], ["AIRWALK", aiwXml], ["EAN", eanXml]] as const) {
  const open = (doc.match(/<Product\b/g) || []).length;
  const close = (doc.match(/<\/Product>/g) || []).length;
  check(`${label}: balanced Product tags (${open})`, open === close);
  const vOpen = (doc.match(/<Value\b[^>]*(?<!\/)>/g) || []).length;
  const vClose = (doc.match(/<\/Value>/g) || []).length;
  check(`${label}: balanced Value tags (${vOpen}/${vClose})`, vOpen === vClose, `open=${vOpen} close=${vClose}`);
}

console.log("\n" + (failures === 0 ? "ALL CHECKS PASSED ✅" : `${failures} CHECK(S) FAILED ❌`));
console.log("\n===== SAMPLE OUTPUT (NIKE) =====\n");
console.log(xml);
process.exit(failures === 0 ? 0 : 1);
