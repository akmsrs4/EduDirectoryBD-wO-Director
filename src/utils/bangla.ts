const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function banglaToAsciiDigits(input: string): string {
  return input.replace(/[\u09E6-\u09EF]/g, (char) =>
    String(char.charCodeAt(0) - 0x09e6)
  );
}

export function toBanglaNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const str = typeof value === 'number' ? value.toLocaleString('en-US') : String(value);
  return str.replace(/\d/g, (digit) => BN_DIGITS[Number(digit)] ?? digit);
}

export function formatCount(value: number, lang: 'bn' | 'en' = 'bn'): string {
  return lang === 'bn' ? toBanglaNumber(value) : value.toLocaleString('en-US');
}

export function slugifyInstitution(nameEn: string, id: string): string {
  const base = nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base ? `${base}--${id}` : id;
}

export function extractIdFromSlug(slugOrId: string): string {
  const idx = slugOrId.lastIndexOf('--');
  return idx >= 0 ? slugOrId.slice(idx + 2) : slugOrId;
}

export function translateManagement(mgmt: string | null | undefined, lang: 'bn' | 'en' = 'bn'): string {
  const m = (mgmt || '').trim();
  if (!m) return lang === 'bn' ? 'উল্লেখ নেই' : 'Not specified';
  if (lang === 'en') return m;
  switch (m) {
    case 'Govt.':
      return 'সরকারি';
    case 'Non-Govt.':
      return 'বেসরকারি';
    case 'Autonomous':
      return 'স্বায়ত্তশাসিত';
    case 'Local Govt.':
      return 'স্থানীয় সরকার';
    case 'Others':
      return 'অন্যান্য';
    default:
      return m;
  }
}

export function translateMpoStatus(status: string | null | undefined, lang: 'bn' | 'en' = 'bn'): string {
  const s = (status || '').trim();
  if (!s) return lang === 'bn' ? 'তথ্য নেই' : 'Unknown';
  if (s.startsWith('Yes')) return lang === 'bn' ? 'হ্যাঁ (এমপিওভুক্ত)' : 'Yes (MPO)';
  if (s.startsWith('No')) return lang === 'bn' ? 'না (নন-এমপিও)' : 'No (Non-MPO)';
  if (s.startsWith('N/A')) return lang === 'bn' ? 'প্রযোজ্য নয়' : 'N/A';
  return s;
}

export function translateVerification(status: string | null | undefined, lang: 'bn' | 'en' = 'bn'): string {
  switch (status) {
    case 'verified':
      return lang === 'bn' ? 'যাচাইকৃত' : 'Verified';
    case 'needs_review':
      return lang === 'bn' ? 'সংশোধন প্রয়োজন' : 'Needs Review';
    default:
      return lang === 'bn' ? 'যাচাই বাকি' : 'Pending';
  }
}

export function translateOriginalType(type: string | null | undefined, lang: 'bn' | 'en' = 'bn'): string {
  const t = (type || '').trim();
  if (!t) return lang === 'bn' ? 'মাদ্রাসা / কারিগরি / উল্লেখ নেই' : 'Madrasah / Technical / Unspecified';
  if (lang === 'en') return t;
  if (t.includes('School and College')) return 'স্কুল অ্যান্ড কলেজ';
  if (t.includes('School')) return 'বিদ্যালয় (স্কুল)';
  if (t.includes('College')) return 'কলেজ';
  return t;
}
