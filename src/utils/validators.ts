import { banglaToAsciiDigits } from './bangla';
import type { Institution } from '../types/institution';

export const UNASSIGNED_HEAD_MESSAGE_BN = 'প্রতিষ্ঠান প্রধানের নাম এখনো যুক্ত করা হয়নি।';
export const UNASSIGNED_HEAD_MESSAGE_EN = 'Institution head name has not been added yet.';
export const UNASSIGNED_CATEGORY_MESSAGE_BN = 'শ্রেণিবিভাগ এখনো যাচাই করা হয়নি';
export const UNASSIGNED_CATEGORY_MESSAGE_EN = 'Category pending verification';

const PLACEHOLDER_HEADS = new Set([
  'প্রতিষ্ঠান প্রধান',
  'প্রতিষ্ঠান প্রধানের নাম',
  'প্রধান শিক্ষক',
  'অধ্যক্ষ',
  '-',
  '--',
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
  'নাই',
  '0',
]);

const FAKE_OR_PLACEHOLDER_EMAILS = new Set([
  '0',
  '-',
  'na',
  'n/a',
  'none',
  'not@vailable.com',
  'not@available.com',
  'no@email.com',
  'abc@gmail.com',
  'test@gmail.com',
  'na@gmail.com',
  'nil@gmail.com',
]);

export function sanitizeHeadName(raw: string | null | undefined): string | null {
  const cleaned = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  if (PLACEHOLDER_HEADS.has(cleaned.toLowerCase()) || PLACEHOLDER_HEADS.has(cleaned)) {
    return null;
  }
  return cleaned;
}

export function isHeadNameMissing(headName: string | null | undefined): boolean {
  return sanitizeHeadName(headName) === null;
}

export function sanitizeEiin(raw: string | null | undefined): string | null {
  const ascii = banglaToAsciiDigits((raw ?? '').trim()).replace(/[^\d]/g, '');
  if (!/^\d{5,8}$/.test(ascii)) return null;
  // Reject all-zero EIINs
  if (/^0+$/.test(ascii)) return null;
  return ascii;
}

export function sanitizeMpoCode(raw: string | null | undefined): string | null {
  const parts = (raw ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^undefined$/i.test(p) && !/^not applicable$/i.test(p) && p !== '-' && !/^0+$/.test(p));
  if (parts.length === 0) return null;
  return parts.join(', ');
}

export function sanitizeEmail(raw: string | null | undefined): string | null {
  const cleaned = (raw ?? '').trim();
  if (!cleaned) return null;
  if (FAKE_OR_PLACEHOLDER_EMAILS.has(cleaned.toLowerCase())) return null;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
  if (!emailRegex.test(cleaned)) return null;
  return cleaned.toLowerCase();
}

export function isValidEmail(raw: string | null | undefined): boolean {
  return sanitizeEmail(raw) !== null;
}

export interface NormalizedPhoneResult {
  raw: string;
  displayList: string[];
  primaryTelHref: string | null;
  primaryWhatsAppHref: string | null;
  primaryNormalizedMobile: string | null; // e.g. 01718863877
  isValidForCall: boolean;
  isValidForWhatsApp: boolean;
  hasWarning: boolean;
}

/**
 * Normalizes Bangladeshi mobile and landline numbers ONLY for link/display formatting.
 * Never alters raw DB values and never invents missing digits.
 */
export function normalizeBangladeshiPhone(rawInput: string | null | undefined): NormalizedPhoneResult {
  const raw = (rawInput ?? '').trim();
  if (!raw) {
    return {
      raw: '',
      displayList: [],
      primaryTelHref: null,
      primaryWhatsAppHref: null,
      primaryNormalizedMobile: null,
      isValidForCall: false,
      isValidForWhatsApp: false,
      hasWarning: false,
    };
  }

  const ascii = banglaToAsciiDigits(raw);
  const tokens = ascii
    .split(/[,;/|]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const validCallNumbers: string[] = [];
  const validWaNumbers: string[] = [];
  const displayList: string[] = [];
  let hasWarning = false;

  for (const token of tokens) {
    const cleaned = token.replace(/[^\d+]/g, '');
    const digitsOnly = cleaned.replace(/\D/g, '');

    if (!digitsOnly || /^0+$/.test(digitsOnly) || digitsOnly.length < 7) {
      hasWarning = true;
      continue;
    }

    // 1. Check standard BD Mobile patterns (strict 11-digit 01[3-9]XXXXXXXX)
    let mobile11: string | null = null;
    if (/^01[3-9]\d{8}$/.test(digitsOnly)) {
      mobile11 = digitsOnly;
    } else if (/^1[3-9]\d{8}$/.test(digitsOnly)) {
      // Missing leading zero (very common in Excel CSV exports: 1718863877 -> 01718863877)
      mobile11 = `0${digitsOnly}`;
    } else if (/^8801[3-9]\d{8}$/.test(digitsOnly)) {
      mobile11 = `0${digitsOnly.slice(3)}`;
    } else if (/^008801[3-9]\d{8}$/.test(digitsOnly)) {
      mobile11 = `0${digitsOnly.slice(5)}`;
    }

    if (mobile11) {
      const intl = `+88${mobile11}`; // +8801...
      validCallNumbers.push(intl);
      validWaNumbers.push(`88${mobile11}`); // 8801...
      displayList.push(mobile11);
      continue;
    }

    // 2. Check invalid-length mobile-like numbers (e.g. 9-digit 174555644 or 12-digit typo 17131918008)
    if (/^0?1[3-9]/.test(digitsOnly)) {
      hasWarning = true;
      continue;
    }

    // 3. Valid landline / TNT (7 to 11 digits, not all repeating same digit)
    if (digitsOnly.length >= 7 && digitsOnly.length <= 12 && !/^(\d)\1+$/.test(digitsOnly)) {
      const telCandidate = digitsOnly.startsWith('0') ? digitsOnly : `0${digitsOnly}`;
      validCallNumbers.push(telCandidate);
      displayList.push(telCandidate);
    } else {
      hasWarning = true;
    }
  }

  const primaryTel = validCallNumbers[0] ?? null;
  const primaryWa = validWaNumbers[0] ?? null;

  return {
    raw,
    displayList,
    primaryTelHref: primaryTel ? `tel:${primaryTel}` : null,
    primaryWhatsAppHref: primaryWa ? `https://wa.me/${primaryWa}` : null,
    primaryNormalizedMobile: primaryWa ? primaryWa.slice(2) : null,
    isValidForCall: primaryTel !== null,
    isValidForWhatsApp: primaryWa !== null,
    hasWarning,
  };
}

/**
 * Normalizes Bangladeshi mobile numbers missing leading zero (e.g. 1717850780 -> 01717850780)
 * for storage and import consistency.
 */
export function normalizeMobileForStorage(rawInput: string | null | undefined): string | null {
  const raw = (rawInput ?? '').trim();
  if (!raw) return null;

  const tokens = raw
    .split(/[,;/|]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) return null;

  const normalized = tokens.map((token) => {
    const ascii = banglaToAsciiDigits(token);
    const digitsOnly = ascii.replace(/\D/g, '');
    if (/^1[3-9]\d{8}$/.test(digitsOnly)) {
      return `0${digitsOnly}`;
    }
    if (/^8801[3-9]\d{8}$/.test(digitsOnly)) {
      return `0${digitsOnly.slice(3)}`;
    }
    if (/^008801[3-9]\d{8}$/.test(digitsOnly)) {
      return `0${digitsOnly.slice(5)}`;
    }
    if (/^01[3-9]\d{8}$/.test(digitsOnly)) {
      return digitsOnly;
    }
    return token;
  });

  return normalized.join(', ');
}

export function getBestContactInfo(inst: Pick<Institution, 'phone_raw' | 'mobile_raw' | 'email'>) {
  const mobile = normalizeBangladeshiPhone(inst.mobile_raw);
  const phone = normalizeBangladeshiPhone(inst.phone_raw);
  const email = sanitizeEmail(inst.email);

  const primaryTelHref = mobile.primaryTelHref ?? phone.primaryTelHref;
  const primaryWhatsAppHref = mobile.primaryWhatsAppHref ?? phone.primaryWhatsAppHref;
  const primaryDisplayNumber =
    mobile.displayList[0] ?? phone.displayList[0] ?? null;

  return {
    mobile,
    phone,
    email,
    primaryTelHref,
    primaryWhatsAppHref,
    primaryDisplayNumber,
    hasValidMobile: mobile.isValidForCall,
    hasValidPhone: phone.isValidForCall,
    hasValidEmail: email !== null,
  };
}

export function isCollegeType(originalType: string | null | undefined): boolean {
  const t = (originalType ?? '').toLowerCase();
  const hasCollege = t.includes('college') || t.includes('কলেজ');
  const hasSchool = t.includes('school') || t.includes('স্কুল') || t.includes('বিদ্যাল');
  return hasCollege && !hasSchool;
}

export function isCategoryUnassigned(refinedCategory: string | null | undefined): boolean {
  return !refinedCategory || refinedCategory === 'অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি';
}
