import * as XLSX from 'xlsx';
import { getSupabaseClient } from '../lib/supabase';
import {
  INSTITUTION_CATEGORIES,
  type ImportMode,
  type Institution,
} from '../types/institution';
import {
  deriveInitialRefinedCategory,
  parseCSVText,
} from '../utils/csvParser';
import {
  isCategoryUnassigned,
  normalizeMobileForStorage,
  sanitizeEiin,
  sanitizeHeadName,
  sanitizeMpoCode,
} from '../utils/validators';

export const TEMPLATE_COLUMNS = [
  'Record ID',
  'EIIN',
  'প্রতিষ্ঠানের নাম (বাংলায়)',
  'প্রতিষ্ঠানের নাম (ইংরেজিতে)',
  'প্রতিষ্ঠানের ধরন',
  'প্রতিষ্ঠানের ক্যাটাগরি',
  'ব্যবস্থাপনা',
  'অঞ্চল',
  'জেলা',
  'উপজেলা/থানা',
  'প্রতিষ্ঠান প্রধানের নাম',
  'প্রধানের পদবি',
  'প্রতিষ্ঠানের ফোন',
  'প্রতিষ্ঠানের মোবাইল',
  'প্রতিষ্ঠানের ইমেইল',
  'এমপিও কোড',
  'এমপিওভুক্ত কি না',
  'যাচাইয়ের অবস্থা',
  'Admin Notes',
] as const;

export type TemplateFieldKey =
  | 'id'
  | 'eiin'
  | 'name_bn'
  | 'name_en'
  | 'original_type'
  | 'refined_category'
  | 'management'
  | 'region'
  | 'district'
  | 'upazila'
  | 'head_name'
  | 'head_designation'
  | 'phone_raw'
  | 'mobile_raw'
  | 'email'
  | 'mpo_code'
  | 'mpo_status'
  | 'verification_status'
  | 'admin_notes';

export const FIELD_DEFINITIONS: Array<{
  key: TemplateFieldKey;
  labelBn: string;
  aliases: string[];
  required?: boolean;
}> = [
  { key: 'id', labelBn: 'Record ID (UUID)', aliases: ['record id', 'id', 'uuid'] },
  { key: 'eiin', labelBn: 'EIIN', aliases: ['eiin', 'ইআইআইএন'] },
  {
    key: 'name_bn',
    labelBn: 'প্রতিষ্ঠানের নাম (বাংলায়)',
    aliases: ['প্রতিষ্ঠানের নাম (বাংলায়)', 'প্রতিষ্ঠানের নাম (বাংলায়)', 'name_bn', 'bangla name'],
  },
  {
    key: 'name_en',
    labelBn: 'প্রতিষ্ঠানের নাম (ইংরেজিতে)',
    aliases: ['প্রতিষ্ঠানের নাম (ইংরেজিতে)', 'name_en', 'english name', 'institution name'],
    required: true,
  },
  {
    key: 'original_type',
    labelBn: 'প্রতিষ্ঠানের ধরন (মূল)',
    aliases: ['প্রতিষ্ঠানের ধরন', 'original_type', 'institution type', 'type'],
  },
  {
    key: 'refined_category',
    labelBn: 'প্রতিষ্ঠানের ক্যাটাগরি (পরিশোধিত)',
    aliases: ['প্রতিষ্ঠানের ক্যাটাগরি', 'refined_category', 'category'],
  },
  {
    key: 'management',
    labelBn: 'ব্যবস্থাপনা',
    aliases: ['ব্যবস্থাপনা', 'management'],
  },
  { key: 'region', labelBn: 'অঞ্চল', aliases: ['অঞ্চল', 'region'] },
  { key: 'district', labelBn: 'জেলা', aliases: ['জেলা', 'district'], required: true },
  {
    key: 'upazila',
    labelBn: 'উপজেলা/থানা',
    aliases: ['উপজেলা/থানা', 'উপজেলা', 'upazila', 'thana'],
    required: true,
  },
  {
    key: 'head_name',
    labelBn: 'প্রতিষ্ঠান প্রধানের নাম',
    aliases: ['প্রতিষ্ঠান প্রধানের নাম', 'head_name', 'principal', 'headmaster'],
  },
  {
    key: 'head_designation',
    labelBn: 'প্রধানের পদবি',
    aliases: ['প্রধানের পদবি', 'head_designation', 'designation'],
  },
  {
    key: 'phone_raw',
    labelBn: 'প্রতিষ্ঠানের ফোন',
    aliases: ['প্রতিষ্ঠানের ফোন', 'phone', 'phone_raw'],
  },
  {
    key: 'mobile_raw',
    labelBn: 'প্রতিষ্ঠানের মোবাইল',
    aliases: [
      'প্রতিষ্ঠানের মোবাইল',
      'প্রতিষ্ঠান প্রধানের মোবাইল',
      'মোবাইল',
      'mobile',
      'mobile_raw',
    ],
  },
  {
    key: 'email',
    labelBn: 'প্রতিষ্ঠানের ইমেইল',
    aliases: ['প্রতিষ্ঠানের ইমেইল', 'প্রতিষ্ঠানের ই-মেইল', 'ইমেইল', 'email'],
  },
  {
    key: 'mpo_code',
    labelBn: 'এমপিও কোড',
    aliases: ['এমপিও কোড', 'mpo_code', 'mpo code'],
  },
  {
    key: 'mpo_status',
    labelBn: 'এমপিওভুক্ত কি না',
    aliases: ['এমপিওভুক্ত কি না', 'প্রতিষ্ঠানটি কি এমপিওভুক্ত', 'mpo_status', 'mpo'],
  },
  {
    key: 'verification_status',
    labelBn: 'যাচাইয়ের অবস্থা',
    aliases: ['যাচাইয়ের অবস্থা', 'verification_status', 'status'],
  },
  {
    key: 'admin_notes',
    labelBn: 'Admin Notes',
    aliases: ['admin notes', 'admin_notes', 'notes'],
  },
];

function formatTextWorksheetColumns(ws: XLSX.WorkSheet, textColIndices: number[]) {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (const C of textColIndices) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell) {
        cell.t = 's';
        cell.z = '@';
        cell.v = String(cell.v ?? '');
      }
    }
  }
}

export function downloadExcelImportTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Institution Data
  const sampleRow: Record<string, string> = {
    'Record ID': '',
    'EIIN': '120801',
    'প্রতিষ্ঠানের নাম (বাংলায়)': 'উদাহরণ উচ্চ বিদ্যালয় (নমুনা — মুছে নিজের তথ্য দিন)',
    'প্রতিষ্ঠানের নাম (ইংরেজিতে)': 'EXAMPLE HIGH SCHOOL',
    'প্রতিষ্ঠানের ধরন': 'School - স্কুল',
    'প্রতিষ্ঠানের ক্যাটাগরি': 'বেসরকারি উচ্চ বিদ্যালয়',
    'ব্যবস্থাপনা': 'Non-Govt.',
    'অঞ্চল': 'RANGPUR',
    'জেলা': 'DINAJPUR',
    'উপজেলা/থানা': 'BIRGANJ',
    'প্রতিষ্ঠান প্রধানের নাম': 'মোঃ আব্দুর রহমান',
    'প্রধানের পদবি': 'প্রধান শিক্ষক',
    'প্রতিষ্ঠানের ফোন': '053100000',
    'প্রতিষ্ঠানের মোবাইল': '01711000000',
    'প্রতিষ্ঠানের ইমেইল': 'example@school.edu.bd',
    'এমপিও কোড': '7801011301',
    'এমপিওভুক্ত কি না': 'Yes - হ্যাঁ',
    'যাচাইয়ের অবস্থা': 'verified',
    'Admin Notes': 'নমুনা সারি — ইম্পোর্টের আগে এটি পরিবর্তন বা মুছে ফেলুন',
  };

  const wsData = XLSX.utils.json_to_sheet([sampleRow], {
    header: [...TEMPLATE_COLUMNS],
  });

  wsData['!cols'] = [
    { wch: 38 }, // Record ID
    { wch: 12 }, // EIIN
    { wch: 36 }, // Name BN
    { wch: 36 }, // Name EN
    { wch: 24 }, // Original Type
    { wch: 30 }, // Refined Category
    { wch: 14 }, // Management
    { wch: 12 }, // Region
    { wch: 16 }, // District
    { wch: 18 }, // Upazila
    { wch: 26 }, // Head Name
    { wch: 18 }, // Head Designation
    { wch: 18 }, // Phone
    { wch: 18 }, // Mobile
    { wch: 28 }, // Email
    { wch: 18 }, // MPO Code
    { wch: 18 }, // MPO Status
    { wch: 16 }, // Verification Status
    { wch: 32 }, // Admin Notes
  ];

  // Force Text cell type on ID, EIIN, Phone, Mobile, MPO Code (indices 0, 1, 12, 13, 15)
  formatTextWorksheetColumns(wsData, [0, 1, 12, 13, 15]);

  // Attach Excel Data Validation dropdown metadata
  (wsData as Record<string, unknown>)['!dataValidation'] = [
    {
      sqref: 'F2:F5000',
      type: 'list',
      allowBlank: true,
      formula1: `"${INSTITUTION_CATEGORIES.join(',')}"`,
    },
    {
      sqref: 'G2:G5000',
      type: 'list',
      allowBlank: true,
      formula1: '"Govt.,Non-Govt.,Autonomous,Local Govt.,Others"',
    },
    {
      sqref: 'Q2:Q5000',
      type: 'list',
      allowBlank: true,
      formula1: '"Yes - হ্যাঁ,No - না,N/A - প্রযোজ্য নয়"',
    },
    {
      sqref: 'R2:R5000',
      type: 'list',
      allowBlank: true,
      formula1: '"verified,pending,needs_review"',
    },
  ];

  XLSX.utils.book_append_sheet(wb, wsData, 'Institution Data');

  // Sheet 2: Instructions
  const instructionsRows = [
    ['EduDirectory BD — Excel Import Template নির্দেশিকা (Instructions)'],
    [''],
    ['১. বাধ্যতামূলক এবং ঐচ্ছিক কলাম (Mandatory vs Optional Fields)'],
    ['কলামের নাম', 'বাধ্যতামূলক?', 'বিবরণ ও নিয়ম'],
    ['Record ID', 'না (সিস্টেম জেনারেটেড)', 'আগে থেকে এক্সপোর্ট করা ফাইলে UUID থাকে। এটি থাকলে সরাসরি সেই রেকর্ড আপডেট হবে। নতুন প্রতিষ্ঠানের জন্য খালি রাখুন।'],
    ['EIIN', 'ঐচ্ছিক (সুপারিশকৃত)', '৫-৮ সংখ্যার EIIN নম্বর। জানা না থাকলে খালি রাখুন ("_" বা ভুয়া সংখ্যা লিখবেন না)।'],
    ['প্রতিষ্ঠানের নাম (ইংরেজিতে)', 'হ্যাঁ (বাধ্যতামূলক)', 'ইংরেজিতে প্রতিষ্ঠানের সঠিক নাম।'],
    ['প্রতিষ্ঠানের নাম (বাংলায়)', 'সুপারিশকৃত', 'বাংলায় প্রতিষ্ঠানের পূর্ণাঙ্গ নাম।'],
    ['জেলা ও উপজেলা/থানা', 'হ্যাঁ (বাধ্যতামূলক)', 'সঠিক জেলা ও উপজেলার নাম।'],
    ['প্রতিষ্ঠানের ধরন', 'ঐচ্ছিক', 'মূল উৎস ধরন (যেমন: School - স্কুল, College - কলেজ)। এটি কখনো স্বয়ংক্রিয়ভাবে মুছে যাবে না।'],
    ['প্রতিষ্ঠানের ক্যাটাগরি', 'ঐচ্ছিক', '৮টি অনুমোদিত ক্যাটাগরির যেকোনো একটি নির্বাচন করুন। খালি রাখলে পূর্বের যাচাইকৃত ক্যাটাগরি সুরক্ষিত থাকবে।'],
    ['প্রতিষ্ঠান প্রধানের নাম', 'ঐচ্ছিক', '"প্রতিষ্ঠান প্রধান" বা "প্রতিষ্ঠান প্রধানের নাম" ধরনের প্লেসহোল্ডার লিখবেন না — এগুলো খালি হিসেবে গণ্য হবে।'],
    ['ফোন ও মোবাইল নম্বর', 'ঐচ্ছিক', 'শুরুতে শূন্য (0) ঠিক রাখতে সেল ফরম্যাট Text রাখুন অথবা শুরুতে \' দিন (যেমন \'01711000000)।'],
    [''],
    ['২. অনুমোদিত ৮টি ক্যাটাগরি তালিকা (Allowed Institution Categories)'],
    ...INSTITUTION_CATEGORIES.map((c, idx) => [`${idx + 1}. ${c}`]),
    [''],
    ['৩. অনুমোদিত ব্যবস্থাপনা (Management) ও যাচাই অবস্থা (Verification Status)'],
    ['ব্যবস্থাপনা মানসমূহ:', 'Govt. | Non-Govt. | Autonomous | Local Govt. | Others'],
    ['এমপিও অবস্থা:', 'Yes - হ্যাঁ | No - না | N/A - প্রযোজ্য নয়'],
    ['যাচাইয়ের অবস্থা:', 'verified | pending | needs_review'],
    [''],
    ['৪. ডুপ্লিকেট এড়ানো এবং নিরাপদ আপডেটের নিয়ম (Matching & Merge Rules)'],
    ['ধাপ ১:', 'Record ID (UUID) থাকলে সরাসরি ওই প্রতিষ্ঠানের তথ্য আপডেট হবে।'],
    ['ধাপ ২:', 'Record ID না থাকলে বৈধ EIIN দিয়ে প্রতিষ্ঠান খোঁজা হবে।'],
    ['ধাপ ৩:', 'EIIN না থাকলে (প্রতিষ্ঠানের ইংরেজি নাম + জেলা + উপজেলা) মিলিয়ে দেখা হবে। একাধিক মিল পাওয়া গেলে ডুপ্লিকেট সতর্কতা দেখানো হবে।'],
    ['সুরক্ষা নীতি:', 'এক্সেলের খালি সেল কখনো ডাটাবেসের বিদ্যমান তথ্য মুছবে না এবং পূর্বে যুক্ত করা প্রতিষ্ঠান প্রধানের নাম বা পরিশোধিত ক্যাটাগরি সুরক্ষিত থাকবে।'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsRows);
  wsInstructions['!cols'] = [{ wch: 30 }, { wch: 24 }, { wch: 82 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  XLSX.writeFile(wb, 'EduDirectory_BD_Import_Template.xlsx');
}

export interface ParsedWorkbookData {
  filename: string;
  sheetNames: string[];
  selectedSheet: string;
  headers: string[];
  rawRows: Record<string, string>[];
  columnMapping: Partial<Record<TemplateFieldKey, string>>;
}

export function autoMapHeaders(headers: string[]): Partial<Record<TemplateFieldKey, string>> {
  const mapping: Partial<Record<TemplateFieldKey, string>> = {};
  const lowerHeaders = headers.map((h) => ({ raw: h, norm: h.trim().toLowerCase() }));

  for (const field of FIELD_DEFINITIONS) {
    const matched = lowerHeaders.find((h) =>
      field.aliases.some((alias) => h.norm === alias.toLowerCase())
    );
    if (matched) {
      mapping[field.key] = matched.raw;
      continue;
    }
    const partial = lowerHeaders.find((h) =>
      field.aliases.some((alias) => h.norm.includes(alias.toLowerCase()))
    );
    if (partial) {
      mapping[field.key] = partial.raw;
    }
  }
  return mapping;
}

export async function parseImportFile(file: File): Promise<ParsedWorkbookData> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    const text = await file.text();
    const matrix = parseCSVText(text);
    if (matrix.length < 2) {
      throw new Error('CSV ফাইলে কোনো ডাটা সারি পাওয়া যায়নি।');
    }
    const headers = matrix[0].map((h) => h.trim());
    const rawRows: Record<string, string>[] = [];
    for (let i = 1; i < matrix.length; i++) {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = (matrix[i][idx] ?? '').trim();
      });
      rawRows.push(obj);
    }
    return {
      filename: file.name,
      sheetNames: ['CSV'],
      selectedSheet: 'CSV',
      headers,
      rawRows,
      columnMapping: autoMapHeaders(headers),
    };
  }

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellText: true, raw: false });
  const preferredSheet =
    wb.SheetNames.find((n) => n.toLowerCase().includes('institution')) ?? wb.SheetNames[0];
  if (!preferredSheet) {
    throw new Error('Excel ফাইলে কোনো ওয়ার্কশিট পাওয়া যায়নি।');
  }

  const ws = wb.Sheets[preferredSheet];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false });
  if (aoa.length < 2) {
    throw new Error('নির্বাচিত শিটে কোনো তথ্য সারি পাওয়া যায়নি।');
  }

  const headers = (aoa[0] as unknown[]).map((h) => String(h ?? '').trim()).filter(Boolean);
  const rawRows: Record<string, string>[] = [];

  for (let i = 1; i < aoa.length; i++) {
    const arr = aoa[i] as unknown[];
    if (!arr || arr.every((v) => String(v ?? '').trim() === '')) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = String(arr[idx] ?? '').trim();
    });
    rawRows.push(obj);
  }

  return {
    filename: file.name,
    sheetNames: wb.SheetNames,
    selectedSheet: preferredSheet,
    headers,
    rawRows,
    columnMapping: autoMapHeaders(headers),
  };
}

export interface NormalizedImportCandidate {
  rowNumber: number;
  id: string | null;
  eiin: string | null;
  name_en: string;
  name_bn: string | null;
  original_type: string | null;
  refined_category: string | null;
  management: string | null;
  region: string;
  district: string;
  upazila: string;
  head_name: string | null;
  head_designation: string | null;
  phone_raw: string | null;
  mobile_raw: string | null;
  email: string | null;
  mpo_code: string | null;
  mpo_status: string | null;
  verification_status: Institution['verification_status'];
  admin_notes: string | null;
}

export interface ImportRowValidation {
  rowNumber: number;
  status: 'insert' | 'update' | 'skip' | 'error' | 'warning';
  matchMethod?: 'record_id' | 'eiin' | 'name_district_upazila' | 'new';
  matchedId?: string;
  reasons: string[];
  changes: Array<{ field: string; from: string; to: string }>;
  candidate: NormalizedImportCandidate;
}

export interface ImportPreviewReport {
  totalRows: number;
  insertCount: number;
  updateCount: number;
  skipCount: number;
  warningCount: number;
  errorCount: number;
  rows: ImportRowValidation[];
}

export function buildImportPreview(
  rawRows: Record<string, string>[],
  mapping: Partial<Record<TemplateFieldKey, string>>,
  existingInstitutions: Institution[],
  mode: ImportMode,
  overwriteManual: boolean
): ImportPreviewReport {
  const byId = new Map<string, Institution>();
  const byEiin = new Map<string, Institution[]>();
  const byComposite = new Map<string, Institution[]>();

  for (const inst of existingInstitutions) {
    byId.set(inst.id, inst);
    const cleanEiin = sanitizeEiin(inst.eiin);
    if (cleanEiin) {
      byEiin.set(cleanEiin, [...(byEiin.get(cleanEiin) ?? []), inst]);
    }
    const compKey = `${inst.name_en.trim().toUpperCase()}|${inst.district.trim().toUpperCase()}|${inst.upazila.trim().toUpperCase()}`;
    byComposite.set(compKey, [...(byComposite.get(compKey) ?? []), inst]);
  }

  // Track last row index for each EIIN inside the uploaded file so latest row always wins
  const lastIndexByEiin = new Map<string, number>();
  rawRows.forEach((raw, idx) => {
    const col = mapping.eiin;
    const cleanEiin = sanitizeEiin(col ? raw[col] : '');
    if (cleanEiin) {
      lastIndexByEiin.set(cleanEiin, idx);
    }
  });

  const seenCompInFile = new Map<string, number>();

  const rows: ImportRowValidation[] = [];
  let insertCount = 0;
  let updateCount = 0;
  let skipCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const get = (k: TemplateFieldKey): string => {
      const col = mapping[k];
      return col ? (raw[col] ?? '').trim() : '';
    };

    const rawId = get('id');
    const uuidValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
    const id = uuidValid ? rawId : null;
    const eiin = sanitizeEiin(get('eiin'));
    const nameEn = get('name_en');
    const nameBn = get('name_bn') || null;
    const district = get('district');
    const upazila = get('upazila');
    const originalType = get('original_type') || null;
    const management = get('management') || null;
    const rawCat = get('refined_category');

    // Validate category if provided
    let refinedCategory: string | null = null;
    const reasons: string[] = [];
    if (rawCat) {
      if ((INSTITUTION_CATEGORIES as readonly string[]).includes(rawCat)) {
        refinedCategory = rawCat;
      } else {
        reasons.push(`অচেনা ক্যাটাগরি "${rawCat}" — অনুগ্রহ করে ৮টি অনুমোদিত ক্যাটাগরি থেকে দিন`);
      }
    } else if (mode === 'seed_csv') {
      refinedCategory = deriveInitialRefinedCategory(originalType, management);
    }

    const rawVerif = get('verification_status').toLowerCase();
    const hasExplicitVerif =
      rawVerif === 'verified' || rawVerif === 'pending' || rawVerif === 'needs_review';
    const verificationStatus: Institution['verification_status'] = hasExplicitVerif
      ? (rawVerif as Institution['verification_status'])
      : 'pending';
    const rawRegion = get('region');

    const candidate: NormalizedImportCandidate = {
      rowNumber,
      id,
      eiin,
      name_en: nameEn,
      name_bn: nameBn,
      original_type: originalType,
      refined_category: refinedCategory,
      management,
      region: rawRegion,
      district,
      upazila,
      head_name: sanitizeHeadName(get('head_name')),
      head_designation: get('head_designation') || null,
      phone_raw: normalizeMobileForStorage(get('phone_raw')),
      mobile_raw: normalizeMobileForStorage(get('mobile_raw')),
      email: get('email') || null,
      mpo_code: sanitizeMpoCode(get('mpo_code')),
      mpo_status: get('mpo_status') || null,
      verification_status: verificationStatus,
      admin_notes: get('admin_notes') || null,
    };

    // If same EIIN repeats inside the same file, supersede earlier rows so the latest update wins
    if (eiin && lastIndexByEiin.get(eiin) !== idx) {
      skipCount++;
      reasons.push(`একই ফাইলে EIIN (${eiin}) পরবর্তীতে আবার থাকায় সর্বশেষ সারিটি গ্রহণ করা হয়েছে`);
      rows.push({
        rowNumber,
        status: 'skip',
        reasons,
        changes: [],
        candidate,
      });
      return;
    }

    const compKey = `${nameEn.toUpperCase()}|${district.toUpperCase()}|${upazila.toUpperCase()}`;
    if (nameEn && district && upazila) {
      const prevComp = seenCompInFile.get(compKey);
      if (prevComp && !eiin && !id) {
        warningCount++;
        reasons.push(`ফাইলের ভেতরে নাম+জেলা+উপজেলা মিলেছে (সারি #${prevComp})`);
      }
      seenCompInFile.set(compKey, rowNumber);
    }

    // 3-Tier Matching Priority: EIIN first -> Record ID -> Normalized Name+District+Upazila
    let matched: Institution | null = null;
    let matchMethod: ImportRowValidation['matchMethod'] = 'new';

    if (eiin && byEiin.has(eiin)) {
      const matches = byEiin.get(eiin)!;
      if (matches.length === 1) {
        matched = matches[0];
        matchMethod = 'eiin';
      } else {
        warningCount++;
        skipCount++;
        reasons.push(`ডাটাবেসে EIIN (${eiin}) একাধিক প্রতিষ্ঠানে রয়েছে — নিরাপদ মার্জের জন্য ম্যানুয়াল যাচাই প্রয়োজন`);
        rows.push({ rowNumber, status: 'warning', reasons, changes: [], candidate });
        return;
      }
    } else if (id && byId.has(id)) {
      matched = byId.get(id)!;
      matchMethod = 'record_id';
    } else if (nameEn && district && upazila && byComposite.has(compKey)) {
      const matches = byComposite.get(compKey)!;
      if (matches.length === 1) {
        matched = matches[0];
        matchMethod = 'name_district_upazila';
      } else {
        warningCount++;
        skipCount++;
        reasons.push('একই জেলা ও উপজেলায় একই নামের একাধিক প্রতিষ্ঠান রয়েছে; Record ID বা EIIN দিয়ে শনাক্ত করুন');
        rows.push({ rowNumber, status: 'warning', reasons, changes: [], candidate });
        return;
      }
    }

    // Require Name + District + Upazila only when inserting a brand new record
    if (!matched && (!nameEn || !district || !upazila)) {
      errorCount++;
      reasons.push('নতুন প্রতিষ্ঠানের জন্য ইংরেজি নাম, জেলা এবং উপজেলা বাধ্যতামূলক (অথবা বিদ্যমান EIIN দিন)');
      rows.push({
        rowNumber,
        status: 'error',
        reasons,
        changes: [],
        candidate,
      });
      return;
    }

    if (matched) {
      if (mode === 'add_new_only') {
        skipCount++;
        rows.push({
          rowNumber,
          status: 'skip',
          matchMethod,
          matchedId: matched.id,
          reasons: ['বিদ্যমান প্রতিষ্ঠান ("শুধু নতুন যোগ" মোডে স্কিপ করা হয়েছে)'],
          changes: [],
          candidate,
        });
        return;
      }

      const changes: Array<{ field: string; from: string; to: string }> = [];
      const checkChange = (label: string, oldVal: string | null | undefined, newVal: string | null | undefined) => {
        if (!newVal) return;
        if ((oldVal ?? '') !== newVal) {
          changes.push({ field: label, from: oldVal || '—', to: newVal });
        }
      };

      checkChange('নাম (বাংলা)', matched.name_bn, candidate.name_bn);
      checkChange('নাম (ইংরেজি)', matched.name_en, candidate.name_en);
      checkChange('EIIN', matched.eiin, candidate.eiin);
      checkChange('মোবাইল', matched.mobile_raw, candidate.mobile_raw);
      checkChange('ফোন', matched.phone_raw, candidate.phone_raw);
      checkChange('ইমেইল', matched.email, candidate.email);
      checkChange('এমপিও কোড', matched.mpo_code, candidate.mpo_code);
      checkChange('এমপিও অবস্থা', matched.mpo_status, candidate.mpo_status);

      // Protect manually entered head_name & refined_category
      if (candidate.head_name) {
        if (overwriteManual || !matched.head_name) {
          checkChange('প্রতিষ্ঠান প্রধান', matched.head_name, candidate.head_name);
        } else if (matched.head_name !== candidate.head_name) {
          reasons.push('পূর্বের প্রতিষ্ঠান প্রধানের নাম সুরক্ষিত রাখা হয়েছে (ওভাররাইট বন্ধ)');
        }
      }

      if (candidate.refined_category) {
        const existingPending = isCategoryUnassigned(matched.refined_category);
        if (overwriteManual || existingPending) {
          checkChange('ক্যাটাগরি', matched.refined_category, candidate.refined_category);
        } else if (matched.refined_category !== candidate.refined_category) {
          reasons.push('পূর্বের যাচাইকৃত ক্যাটাগরি সুরক্ষিত রাখা হয়েছে');
        }
      }

      if (reasons.length > 0) warningCount++;
      updateCount++;
      rows.push({
        rowNumber,
        status: 'update',
        matchMethod,
        matchedId: matched.id,
        reasons,
        changes,
        candidate: {
          ...candidate,
          // Preserve existing verification_status unless explicitly specified in the uploaded file
          verification_status: hasExplicitVerif ? verificationStatus : ('' as Institution['verification_status']),
        },
      });
    } else {
      insertCount++;
      rows.push({
        rowNumber,
        status: 'insert',
        matchMethod: 'new',
        reasons,
        changes: [],
        candidate: {
          ...candidate,
          region: rawRegion || 'RANGPUR',
        },
      });
    }
  });

  return {
    totalRows: rawRows.length,
    insertCount,
    updateCount,
    skipCount,
    warningCount,
    errorCount,
    rows,
  };
}

export async function executeBatchImportToSupabase(params: {
  filename: string;
  mode: ImportMode;
  overwriteManual: boolean;
  validRows: ImportRowValidation[];
  onProgress?: (completed: number, total: number) => void;
}): Promise<{
  batchId: string;
  inserted: number;
  updated: number;
  skipped: number;
  warnings: number;
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase সংযুক্ত নয়। ডাটাবেসে ইম্পোর্ট করতে প্রথমে Supabase সংযোগ কনফিগার করুন।');
  }

  const { data: userData } = await supabase.auth.getUser();
  const batchPayload = {
    filename: params.filename,
    import_mode: params.mode,
    total_rows: params.validRows.length,
    imported_by: userData.user?.id ?? null,
    imported_by_email: userData.user?.email ?? null,
  };

  const { data: batchRow, error: batchErr } = await supabase
    .from('import_batches')
    .insert(batchPayload)
    .select('id')
    .single();
  if (batchErr) throw batchErr;

  const batchId = batchRow.id as string;
  const chunkSize = 200;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let warnings = 0;

  const actionable = params.validRows.filter(
    (r) => r.status === 'insert' || r.status === 'update'
  );

  for (let i = 0; i < actionable.length; i += chunkSize) {
    const chunk = actionable.slice(i, i + chunkSize).map((r) => ({
      id: r.matchedId ?? r.candidate.id,
      serial_no: r.candidate.rowNumber,
      eiin: r.candidate.eiin,
      mpo_code: r.candidate.mpo_code,
      name_en: r.candidate.name_en,
      name_bn: r.candidate.name_bn,
      original_type: r.candidate.original_type,
      refined_category: r.candidate.refined_category,
      management: r.candidate.management,
      region: r.candidate.region || null,
      district: r.candidate.district,
      upazila: r.candidate.upazila,
      head_name: r.candidate.head_name,
      head_designation: r.candidate.head_designation,
      phone_raw: r.candidate.phone_raw,
      mobile_raw: r.candidate.mobile_raw,
      email: r.candidate.email,
      mpo_status: r.candidate.mpo_status,
      verification_status: r.candidate.verification_status || null,
      admin_notes: r.candidate.admin_notes,
    }));

    const { data: res, error } = await supabase.rpc('admin_batch_upsert_institutions', {
      p_rows: chunk,
      p_mode: params.mode,
      p_overwrite_manual: params.overwriteManual,
      p_batch_id: batchId,
    });
    if (error) throw error;

    const stats = res as {
      inserted?: number;
      updated?: number;
      skipped?: number;
      warnings?: unknown[];
    };
    inserted += stats.inserted ?? 0;
    updated += stats.updated ?? 0;
    skipped += stats.skipped ?? 0;
    warnings += (stats.warnings ?? []).length;

    params.onProgress?.(Math.min(i + chunk.length, actionable.length), actionable.length);
  }

  if (params.mode === 'full_replace') {
    const { error: deactErr } = await supabase.rpc('admin_deactivate_not_in_batch', {
      p_batch_id: batchId,
    });
    if (deactErr) throw deactErr;
  }

  await supabase
    .from('import_batches')
    .update({
      inserted_count: inserted,
      updated_count: updated,
      skipped_count: skipped,
      warning_count: warnings,
    })
    .eq('id', batchId);

  return { batchId, inserted, updated, skipped, warnings };
}

function mapInstitutionToTemplateRow(inst: Institution): Record<string, string> {
  return {
    'Record ID': inst.id,
    'EIIN': inst.eiin ?? '',
    'প্রতিষ্ঠানের নাম (বাংলায়)': inst.name_bn ?? '',
    'প্রতিষ্ঠানের নাম (ইংরেজিতে)': inst.name_en,
    'প্রতিষ্ঠানের ধরন': inst.original_type ?? '',
    'প্রতিষ্ঠানের ক্যাটাগরি': inst.refined_category ?? '',
    'ব্যবস্থাপনা': inst.management ?? '',
    'অঞ্চল': inst.region ?? '',
    'জেলা': inst.district ?? '',
    'উপজেলা/থানা': inst.upazila ?? '',
    'প্রতিষ্ঠান প্রধানের নাম': inst.head_name ?? '',
    'প্রধানের পদবি': inst.head_designation ?? '',
    'প্রতিষ্ঠানের ফোন': inst.phone_raw ?? '',
    'প্রতিষ্ঠানের মোবাইল': inst.mobile_raw ?? '',
    'প্রতিষ্ঠানের ইমেইল': inst.email ?? '',
    'এমপিও কোড': inst.mpo_code ?? '',
    'এমপিওভুক্ত কি না': inst.mpo_status ?? '',
    'যাচাইয়ের অবস্থা': inst.verification_status ?? 'pending',
    'Admin Notes': inst.admin_notes ?? '',
  };
}

export function exportInstitutionsToExcel(
  institutions: Institution[],
  filename = 'EduDirectory_BD_Export.xlsx'
): void {
  const wb = XLSX.utils.book_new();
  const rows = institutions.map(mapInstitutionToTemplateRow);
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...TEMPLATE_COLUMNS] });
  ws['!cols'] = [
    { wch: 38 },
    { wch: 12 },
    { wch: 36 },
    { wch: 36 },
    { wch: 24 },
    { wch: 30 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 30 },
  ];
  formatTextWorksheetColumns(ws, [0, 1, 12, 13, 15]);
  XLSX.utils.book_append_sheet(wb, ws, 'Institution Data');
  XLSX.writeFile(wb, filename);
}

export function exportInstitutionsToCsv(
  institutions: Institution[],
  filename = 'EduDirectory_BD_Backup.csv'
): void {
  const headers = [...TEMPLATE_COLUMNS];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(',')];

  for (const inst of institutions) {
    const rowObj = mapInstitutionToTemplateRow(inst);
    lines.push(headers.map((h) => escape(rowObj[h] ?? '')).join(','));
  }

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerBlobDownload(blob, filename);
}

export function exportInstitutionsToJsonBackup(
  institutions: Institution[],
  filename = 'EduDirectory_BD_Full_Backup.json'
): void {
  const payload = {
    app: 'EduDirectory BD',
    exported_at: new Date().toISOString(),
    total_records: institutions.length,
    institutions,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  triggerBlobDownload(blob, filename);
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
