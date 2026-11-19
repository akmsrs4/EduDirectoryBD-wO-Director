import type { Institution, VerificationStatus } from '../types/institution';
import {
  isCollegeType,
  normalizeMobileForStorage,
  sanitizeEiin,
  sanitizeHeadName,
  sanitizeMpoCode,
} from './validators';

/**
 * RFC-4180 compliant CSV parser handling UTF-8 BOM, quoted fields, and embedded commas/newlines.
 */
export function parseCSVText(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let val = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        val += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        val += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(val);
        val = '';
      } else if (c === '\r' && next === '\n') {
        row.push(val);
        rows.push(row);
        row = [];
        val = '';
        i++;
      } else if (c === '\n') {
        row.push(val);
        rows.push(row);
        row = [];
        val = '';
      } else {
        val += c;
      }
    }
  }

  if (val.length > 0 || row.length > 0) {
    row.push(val);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Derives initial refined_category strictly following project rules:
 * - Colleges ALWAYS remain unassigned (null) initially for future admin classification.
 * - Empty/other types (Madrasah/Technical) remain unassigned (null).
 * - Clear Govt/Non-Govt Schools and School & Colleges map safely without touching original_type.
 */
export function deriveInitialRefinedCategory(
  originalType: string | null,
  management: string | null
): string | null {
  const t = (originalType ?? '').trim();
  const m = (management ?? '').trim();

  if (!t || isCollegeType(t)) {
    return null;
  }

  if (t.includes('School and College')) {
    if (m === 'Govt.') return 'সরকারি স্কুল অ্যান্ড কলেজ';
    if (m === 'Non-Govt.') return 'বেসরকারি স্কুল অ্যান্ড কলেজ';
    return null;
  }

  if (t.includes('School')) {
    if (m === 'Govt.') return 'সরকারি উচ্চ বিদ্যালয়';
    if (m === 'Non-Govt.') return 'বেসরকারি উচ্চ বিদ্যালয়';
    return null;
  }

  return null;
}

/**
 * Deterministic UUID v4-like string from row index + content so local CSV preview IDs remain stable across reloads.
 */
function deterministicLocalId(serial: number, eiin: string | null, nameEn: string): string {
  const seed = `${serial}-${eiin ?? 'noeiin'}-${nameEn}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x01000193);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const serHex = Math.max(0, serial).toString(16).padStart(12, '0').slice(-12);
  return `${hex1}-${hex2.slice(0, 4)}-4${hex2.slice(5, 8)}-8${hex1.slice(1, 4)}-${serHex}`;
}

export function mapSourceCsvRowsToInstitutions(rows: string[][]): Institution[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim());

  const findCol = (candidates: string[], fallbackIdx: number): number => {
    const idx = header.findIndex((h) => candidates.some((c) => h.includes(c)));
    return idx >= 0 ? idx : fallbackIdx;
  };

  const idxSerial = findCol(['ক্র.নং'], 0);
  const idxNameEn = findCol(['ইংরেজিতে'], 1);
  const idxNameBn = findCol(['বাংলায়', 'বাংলায়'], 2);
  const idxEiin = findCol(['ইআইআইএন', 'EIIN'], 3);
  const idxMpoCode = findCol(['এমপিও কোড'], 4);
  const idxType = findCol(['প্রতিষ্ঠানের ধরন'], 5);
  const idxMgmt = findCol(['ব্যবস্থাপনা'], 6);
  const idxRegion = findCol(['অঞ্চল'], 7);
  const idxDistrict = findCol(['জেলা'], 8);
  const idxUpazila = findCol(['উপজেলা'], 9);
  const idxHead = findCol(['প্রতিষ্ঠান প্রধানের নাম'], 10);
  const idxPhone = findCol(['প্রতিষ্ঠানের ফোন'], 11);
  const idxMobile = findCol(['মোবাইল'], 12);
  const idxEmail = findCol(['ই-মেইল', 'ইমেইল'], 13);
  const idxMpoStatus = findCol(['এমপিওভুক্ত'], 14);

  const results: Institution[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const nameEn = (r[idxNameEn] ?? '').trim();
    const nameBn = (r[idxNameBn] ?? '').trim() || null;
    if (!nameEn && !nameBn) continue;

    const serialParsed = Number.parseInt((r[idxSerial] ?? '').trim(), 10);
    const serialNo = Number.isFinite(serialParsed) ? serialParsed : i;
    const eiin = sanitizeEiin(r[idxEiin]);
    const originalType = (r[idxType] ?? '').trim() || null;
    const management = (r[idxMgmt] ?? '').trim() || null;
    const refinedCategory = deriveInitialRefinedCategory(originalType, management);
    const headName = sanitizeHeadName(r[idxHead]);
    const verificationStatus: VerificationStatus =
      eiin && refinedCategory && headName ? 'verified' : 'pending';

    results.push({
      id: deterministicLocalId(serialNo, eiin, nameEn || nameBn || String(i)),
      serial_no: serialNo,
      eiin,
      mpo_code: sanitizeMpoCode(r[idxMpoCode]),
      name_en: nameEn || nameBn || `Institution ${serialNo}`,
      name_bn: nameBn,
      original_type: originalType,
      refined_category: refinedCategory,
      management,
      region: (r[idxRegion] ?? '').trim() || 'RANGPUR',
      district: (r[idxDistrict] ?? '').trim() || 'UNKNOWN',
      upazila: (r[idxUpazila] ?? '').trim() || 'UNKNOWN',
      head_name: headName,
      head_designation: null,
      phone_raw: normalizeMobileForStorage(r[idxPhone]),
      mobile_raw: normalizeMobileForStorage(r[idxMobile]),
      email: (r[idxEmail] ?? '').trim() || null,
      mpo_status: (r[idxMpoStatus] ?? '').trim() || null,
      verification_status: verificationStatus,
      is_active: true,
      admin_notes: null,
    });
  }

  return results;
}
