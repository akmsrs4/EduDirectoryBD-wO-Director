import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import {
  autoMapHeaders,
  buildImportPreview,
  TEMPLATE_COLUMNS,
} from '../src/services/excel';
import { applyLocalFilters } from '../src/services/institutions';
import { filterOfficesLocally } from '../src/services/offices';
import { formatReportCell, getColumnHeader } from '../src/services/reports';
import { INSTITUTION_CATEGORIES } from '../src/types/institution';
import { toBanglaNumber } from '../src/utils/bangla';
import {
  mapSourceCsvRowsToInstitutions,
  parseCSVText,
} from '../src/utils/csvParser';
import {
  mapDistrictOfficesCsv,
  mapUpazilaOfficesCsv,
} from '../src/utils/officeParser';
import {
  isCategoryUnassigned,
  isCollegeType,
  isHeadNameMissing,
  normalizeBangladeshiPhone,
  normalizeMobileForStorage,
  sanitizeEmail,
  sanitizeEiin,
  sanitizeHeadName,
  sanitizeMpoCode,
  UNASSIGNED_HEAD_MESSAGE_BN,
} from '../src/utils/validators';

console.log('Running EduDirectory BD Automated Verification Suite...');

// 1. Parse real 4,414-row CSV
const csvText = fs.readFileSync(
  'public/assets/aistudio/working_rangpur_institute_csv_c574002b.csv',
  'utf8'
);
const rawRows = parseCSVText(csvText);
assert.equal(rawRows.length, 4415, 'CSV should have 1 header + 4414 data rows');

const institutions = mapSourceCsvRowsToInstitutions(rawRows);
assert.equal(institutions.length, 4414, 'All 4,414 institutions must map cleanly');

// 2. Verify College classification rule (no automatic splitting of colleges)
const colleges = institutions.filter((i) => isCollegeType(i.original_type));
assert.equal(colleges.length, 361, 'Should identify all 361 source colleges');
assert.ok(
  colleges.every((c) => c.refined_category === null),
  'All 361 colleges must initially retain unassigned refined_category'
);
assert.ok(
  colleges.every((c) => c.original_type === 'College - কলেজ'),
  'Original type must remain intact for colleges'
);

// 3. Verify Head Name placeholder rule
assert.ok(
  institutions.every((i) => i.head_name === null),
  'All placeholder "প্রতিষ্ঠান প্রধান" values must sanitize to null'
);
assert.equal(sanitizeHeadName('প্রতিষ্ঠান প্রধান'), null);
assert.equal(sanitizeHeadName('প্রতিষ্ঠান প্রধানের নাম'), null);
assert.equal(sanitizeHeadName('মোঃ আব্দুর রহমান'), 'মোঃ আব্দুর রহমান');
assert.equal(isHeadNameMissing(null), true);

// 4. Verify EIIN, MPO Code, Email, and Bangladeshi Phone Normalizers
assert.equal(sanitizeEiin('_'), null);
assert.equal(sanitizeEiin('120801'), '120801');
assert.equal(sanitizeEiin('১২০৮০১'), '120801');
assert.equal(sanitizeMpoCode('undefined, 202211995312,'), '202211995312');
assert.equal(sanitizeMpoCode('Not Applicable, Not Applicable,'), null);

assert.equal(sanitizeEmail('not@vailable.com'), null);
assert.equal(sanitizeEmail('0'), null);
assert.equal(sanitizeEmail('abc@gmail.com'), null);
assert.equal(sanitizeEmail('Head@School.EDU.BD'), 'head@school.edu.bd');

const p1 = normalizeBangladeshiPhone('1718863877');
assert.equal(p1.primaryNormalizedMobile, '01718863877');
assert.equal(p1.primaryTelHref, 'tel:+8801718863877');
assert.equal(p1.primaryWhatsAppHref, 'https://wa.me/8801718863877');

const p2 = normalizeBangladeshiPhone('০১৩০৯১১৯৯৫৫');
assert.equal(p2.primaryNormalizedMobile, '01309119955');
assert.equal(p2.isValidForWhatsApp, true);

const pBad1 = normalizeBangladeshiPhone('174555644'); // 9-digit malformed
assert.equal(pBad1.isValidForWhatsApp, false);
assert.equal(pBad1.hasWarning, true);

const pBad2 = normalizeBangladeshiPhone('1714');
assert.equal(pBad2.isValidForCall, false);

// 5. Verify 8 categories & Bangla numbering
assert.equal(INSTITUTION_CATEGORIES.length, 8);
assert.equal(toBanglaNumber(4414), '4,414'.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]));

// 6. Verify Report Bilingual Formatting
const sampleCollege = colleges[0];
assert.equal(
  formatReportCell(sampleCollege, 0, 'head_name', 'bn'),
  UNASSIGNED_HEAD_MESSAGE_BN
);
assert.ok(
  getColumnHeader('eiin', 'both').includes('EIIN'),
  'Bilingual report header should render cleanly'
);

// 7. Verify Excel Column Auto-Mapping & Import Preview Protection Rules
const mappedTemplate = autoMapHeaders([...TEMPLATE_COLUMNS]);
assert.equal(mappedTemplate.id, 'Record ID');
assert.equal(mappedTemplate.mobile_raw, 'প্রতিষ্ঠানের মোবাইল');

// Also verify original CSV header mapping
const mappedSource = autoMapHeaders(rawRows[0]);
assert.equal(mappedSource.mobile_raw, 'প্রতিষ্ঠান প্রধানের মোবাইল');

// Simulate merging an updated college row with manual head_name protection
const existing = institutions.slice(0, 20).map((inst, idx) =>
  idx === 0
    ? {
        ...inst,
        head_name: 'প্রকৃত অধ্যক্ষ মহোদয়',
        refined_category: 'বেসরকারি ডিগ্রি কলেজ',
      }
    : inst
);

const incomingRows: Record<string, string>[] = [
  {
    'Record ID': existing[0].id,
    'EIIN': existing[0].eiin ?? '',
    'প্রতিষ্ঠানের নাম (ইংরেজিতে)': existing[0].name_en,
    'জেলা': existing[0].district,
    'উপজেলা/থানা': existing[0].upazila,
    'প্রতিষ্ঠান প্রধানের নাম': 'প্রতিষ্ঠান প্রধান', // placeholder must not overwrite!
    'প্রতিষ্ঠানের ক্যাটাগরি': 'বেসরকারি উচ্চ মাধ্যমিক কলেজ',
    'প্রতিষ্ঠানের মোবাইল': '01711223344',
  },
  {
    'Record ID': '',
    'EIIN': '199999',
    'প্রতিষ্ঠানের নাম (ইংরেজিতে)': 'NEW TEST MODEL SCHOOL',
    'প্রতিষ্ঠানের নাম (বাংলায়)': 'নতুন টেস্ট মডেল স্কুল',
    'জেলা': 'RANGPUR',
    'উপজেলা/থানা': 'RANGPUR SADAR',
    'প্রতিষ্ঠানের ক্যাটাগরি': 'বেসরকারি উচ্চ বিদ্যালয়',
  },
];

const preview = buildImportPreview(
  incomingRows,
  mappedTemplate,
  existing,
  'merge_update',
  false
);
assert.equal(preview.updateCount, 1);
assert.equal(preview.insertCount, 1);
assert.equal(preview.errorCount, 0);
assert.ok(
  preview.rows[0].reasons.some((r) => r.includes('সুরক্ষিত')),
  'Should protect existing refined_category when overwriteManual=false'
);
assert.equal(
  preview.rows[0].candidate.head_name,
  null,
  'Incoming placeholder head name must sanitize to null'
);

// Verify SheetJS workbook buffer creation roundtrip
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(incomingRows);
XLSX.utils.book_append_sheet(wb, ws, 'Institution Data');
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
assert.ok(buf.length > 1000, 'Generated XLSX workbook buffer must be valid');

// 8. Verify Public Default "All (সকল)" + Category & Management Filters
const allDefault = applyLocalFilters(institutions, { refined_category: '', management: '' });
assert.equal(allDefault.total, 4414, 'Default সকল filters must return all 4,414 institutions');

const collegeTotal = applyLocalFilters(institutions, { refined_category: 'কলেজ' });
assert.equal(collegeTotal.total, 361, 'কলেজ filter must match all 361 colleges');

const nonGovtCollege = applyLocalFilters(institutions, {
  refined_category: 'কলেজ',
  management: 'Non-Govt.',
});
assert.equal(nonGovtCollege.total, 300, 'Default Non-Govt. Colleges filter should match 300 non-govt colleges');

const govtCollege = applyLocalFilters(institutions, {
  refined_category: 'কলেজ',
  management: 'Govt.',
});
assert.equal(govtCollege.total, 59, 'Govt. Colleges filter should match 59 govt colleges');

const schoolCollege = applyLocalFilters(institutions, { refined_category: 'স্কুল এন্ড কলেজ' });
assert.equal(schoolCollege.total, 147, 'স্কুল এন্ড কলেজ filter must match all 147 school & colleges');

const schoolTotal = applyLocalFilters(institutions, { refined_category: 'স্কুল' });
assert.equal(schoolTotal.total, 2530, 'স্কুল filter must match all 2530 schools');

// Verify Bangla-only original_type (e.g. "কলেজ", "স্কুল এন্ড কলেজ", "স্কুল") when refined_category is null
const banglaTypeSamples = [
  { ...institutions[0], id: 'bn-1', original_type: 'কলেজ', refined_category: null, management: 'Non-Govt.' },
  { ...institutions[0], id: 'bn-2', original_type: 'স্কুল এন্ড কলেজ', refined_category: null, management: 'বেসরকারি' },
  { ...institutions[0], id: 'bn-3', original_type: 'স্কুল', refined_category: null, management: 'সরকারি' },
];
assert.equal(isCollegeType('কলেজ'), true);
assert.equal(isCollegeType('স্কুল এন্ড কলেজ'), false);
assert.equal(applyLocalFilters(banglaTypeSamples, { refined_category: 'কলেজ' }).total, 1);
assert.equal(applyLocalFilters(banglaTypeSamples, { refined_category: 'স্কুল এন্ড কলেজ' }).total, 1);
assert.equal(applyLocalFilters(banglaTypeSamples, { refined_category: 'স্কুল' }).total, 1);
assert.equal(applyLocalFilters(banglaTypeSamples, { management: 'Non-Govt.' }).total, 2);
assert.equal(applyLocalFilters(banglaTypeSamples, { management: 'Govt.' }).total, 1);

// 9. Verify Auto-Prepend Leading '0' Mobile Storage Normalizer
assert.equal(normalizeMobileForStorage('1717850780'), '01717850780');
assert.equal(normalizeMobileForStorage('১৭১৭৮৫০৭৮০'), '01717850780');
assert.equal(normalizeMobileForStorage('8801717850780, 1811223344'), '01717850780, 01811223344');
assert.equal(normalizeMobileForStorage(''), null);

// 10. Verify EIIN-First Repeat Partial Upsert (Latest Update Wins) & Duplicate EIIN in Same File
const targetInst = existing.find((item) => Boolean(item.eiin));
assert.ok(targetInst && targetInst.eiin, 'Sample institution must have a valid EIIN');

const partialUpdateRows: Record<string, string>[] = [
  {
    'EIIN': targetInst.eiin!,
    'প্রতিষ্ঠানের মোবাইল': '1717850780', // missing leading 0
    'প্রতিষ্ঠান প্রধানের নাম': 'পুরোনো নাম (একই ফাইলে আগের সারি)',
  },
  {
    'EIIN': targetInst.eiin!,
    'প্রতিষ্ঠানের মোবাইল': '১৭১৭৮৫০৭৮০', // Bangla digits without leading 0
    'প্রতিষ্ঠান প্রধানের নাম': 'সর্বশেষ আপডেটেড অধ্যক্ষ',
    'প্রতিষ্ঠানের ক্যাটাগরি': 'বেসরকারি ডিগ্রি কলেজ',
  },
];

const partialPreview = buildImportPreview(
  partialUpdateRows,
  mappedTemplate,
  existing,
  'merge_update',
  true
);
assert.equal(partialPreview.errorCount, 0, 'Partial EIIN-only update must not require name/district/upazila');
assert.equal(partialPreview.skipCount, 1, 'Earlier duplicate EIIN row in same file must be superseded');
assert.equal(partialPreview.updateCount, 1, 'Latest EIIN row in file must become the single update');
assert.equal(partialPreview.rows[1].status, 'update');
assert.equal(partialPreview.rows[1].matchMethod, 'eiin');
assert.equal(partialPreview.rows[1].candidate.mobile_raw, '01717850780');
assert.equal(partialPreview.rows[1].candidate.head_name, 'সর্বশেষ আপডেটেড অধ্যক্ষ');
assert.equal(
  partialPreview.rows[1].candidate.verification_status,
  '',
  'Omitted verification_status on partial update must remain empty so DB keeps existing status'
);

// 11. Verify Education Offices Module (8 District + 58 Upazila Offices + Verified Portals + Cascading Filter)
const book1Csv = fs.readFileSync('public/assets/aistudio/Book1_26c72781.csv', 'utf8');
const book2Csv = fs.readFileSync('public/assets/aistudio/Book2_52e85d2c.csv', 'utf8');

const districtOffices = mapDistrictOfficesCsv(book1Csv);
const upazilaOffices = mapUpazilaOfficesCsv(book2Csv);
assert.equal(districtOffices.length, 8, 'Book1 must parse all 8 District Education Offices');
assert.equal(upazilaOffices.length, 58, 'Book2 must parse all 58 Upazila Secondary Education Offices');

assert.ok(
  districtOffices.every(
    (o) =>
      o.office_type === 'district' &&
      Boolean(o.officer_name) &&
      Boolean(o.mobile_raw) &&
      Boolean(o.portal_url?.startsWith('https://')) &&
      Boolean(o.officers_url?.endsWith('/pages/officers'))
  ),
  'All 8 DEOs must include officer_name, normalized mobile_raw, https portal_url, and /pages/officers URL'
);

assert.ok(
  upazilaOffices.every(
    (o) =>
      o.office_type === 'upazila' &&
      o.officer_name === null &&
      o.officer_designation === null &&
      o.mobile_raw === null &&
      Boolean(o.portal_url?.startsWith('https://')) &&
      Boolean(o.portal_url?.includes('.gov.bd')) &&
      Boolean(o.officers_url?.endsWith('/pages/officers'))
  ),
  'All 58 Upazila offices must omit individual officer names and contain verified .gov.bd + /pages/officers links'
);

const allOffices = [...districtOffices, ...upazilaOffices];
const rangpurOffices = filterOfficesLocally(allOffices, { district: 'রংপুর' });
assert.equal(rangpurOffices.length, 9, 'Rangpur district filter must return 1 DEO + 8 Upazila offices');
assert.equal(rangpurOffices[0].office_type, 'district', 'DEO must sort before Upazila offices');

const mithapukurOnly = filterOfficesLocally(allOffices, {
  district: 'রংপুর',
  upazila: 'মিঠাপুকুর',
});
assert.equal(mithapukurOnly.length, 1);
assert.equal(mithapukurOnly[0].portal_url, 'https://dshe.mithapukur.rangpur.gov.bd');

console.log(
  'ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (4,414 institutions + 66 education offices + validators + Excel + Filters).'
);
