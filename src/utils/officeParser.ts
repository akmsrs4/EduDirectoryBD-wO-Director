import type { EducationOffice } from '../types/institution';
import { parseCSVText } from './csvParser';
import { normalizeMobileForStorage } from './validators';

/**
 * HTTP-verified official Bangladesh National Portal (.gov.bd) URLs for all 58 Upazilas
 * across the 8 districts of Rangpur Division.
 */
export const UPAZILA_PORTAL_URLS: Record<string, string> = {
  // রংপুর (৮)
  'রংপুর|সদর': 'https://seo.rangpursadar.rangpur.gov.bd',
  'রংপুর|মিঠাপুকুর': 'https://dshe.mithapukur.rangpur.gov.bd',
  'রংপুর|পীরগঞ্জ': 'https://seo.pirgonj.rangpur.gov.bd',
  'রংপুর|বদরগঞ্জ': 'https://seo.badargonj.rangpur.gov.bd',
  'রংপুর|তারাগঞ্জ': 'https://seo.taragonj.rangpur.gov.bd',
  'রংপুর|গংগাচড়া': 'https://seo.gangachara.rangpur.gov.bd',
  'রংপুর|কাউনিয়া': 'https://seo.kaunia.rangpur.gov.bd',
  'রংপুর|পীরগাছা': 'https://seo.pirgacha.rangpur.gov.bd',

  // কুড়িগ্রাম (৯)
  'কুড়িগ্রাম|সদর': 'https://seo.kurigramsadar.kurigram.gov.bd',
  'কুড়িগ্রাম|রাজিবপুর': 'https://seo.charrajibpur.kurigram.gov.bd',
  'কুড়িগ্রাম|চিলমারী': 'https://seo.chilmari.kurigram.gov.bd',
  'কুড়িগ্রাম|উলিপুর': 'https://seo.ulipur.kurigram.gov.bd',
  'কুড়িগ্রাম|নাগেশ্বরী': 'https://seo.nageshwari.kurigram.gov.bd',
  'কুড়িগ্রাম|রাজারহাট': 'https://seo.rajarhat.kurigram.gov.bd',
  'কুড়িগ্রাম|ফুলবাড়ী': 'https://seo.phulbari.kurigram.gov.bd',
  'কুড়িগ্রাম|রৌমারী': 'https://dshe.rowmari.kurigram.gov.bd',
  'কুড়িগ্রাম|ভুরুঙ্গামারী': 'https://seo.bhurungamari.kurigram.gov.bd',

  // নীলফামারী (৬)
  'নীলফামারী|সদর': 'https://seo.nilphamarisadar.nilphamari.gov.bd',
  'নীলফামারী|ডোমার': 'https://seo.domar.nilphamari.gov.bd',
  'নীলফামারী|ডিমলা': 'https://seo.dimla.nilphamari.gov.bd',
  'নীলফামারী|জলঢাকা': 'https://seo.jaldhaka.nilphamari.gov.bd',
  'নীলফামারী|কিশোরগঞ্জ': 'https://seo.kishorganj.nilphamari.gov.bd',
  'নীলফামারী|সৈয়দপুর': 'https://dshe.syedpur.nilphamari.gov.bd',

  // গাইবান্ধা (৭)
  'গাইবান্ধা|সদর': 'https://dshe.gaibandhasadar.gaibandha.gov.bd',
  'গাইবান্ধা|সুন্দরগঞ্জ': 'https://seo.sundarganj.gaibandha.gov.bd',
  'গাইবান্ধা|সাদুল্লাপুর': 'https://seo.sadullapur.gaibandha.gov.bd',
  'গাইবান্ধা|পলাশবাড়ী': 'https://seo.palashbari.gaibandha.gov.bd',
  'গাইবান্ধা|গোবিন্দগঞ্জ': 'https://dshe.gobindaganj.gaibandha.gov.bd',
  'গাইবান্ধা|সাঘাটা': 'https://seo.saghata.gaibandha.gov.bd',
  'গাইবান্ধা|ফুলছড়ি': 'https://seo.phulchari.gaibandha.gov.bd',

  // লালমনিরহাট (৫)
  'লালমনিরহাট|সদর': 'https://seo.sadar.lalmonirhat.gov.bd',
  'লালমনিরহাট|আদিতমারী': 'https://seo.aditmari.lalmonirhat.gov.bd',
  'লালমনিরহাট|কালিগঞ্জ': 'https://seo.kaliganj.lalmonirhat.gov.bd',
  'লালমনিরহাট|হাতিবান্ধা': 'https://seo.hatibandha.lalmonirhat.gov.bd',
  'লালমনিরহাট|পাটগ্রাম': 'https://seo.patgram.lalmonirhat.gov.bd',

  // দিনাজপুর (১৩)
  'দিনাজপুর|সদর': 'https://seo.dinajpursadar.dinajpur.gov.bd',
  'দিনাজপুর|বিরল': 'https://seo.birol.dinajpur.gov.bd',
  'দিনাজপুর|বোচাগঞ্জ': 'https://seo.bochaganj.dinajpur.gov.bd',
  'দিনাজপুর|কাহারোল': 'https://seo.kaharol.dinajpur.gov.bd',
  'দিনাজপুর|খানসামা': 'https://seo.khansama.dinajpur.gov.bd',
  'দিনাজপুর|চিরিরবন্দর': 'https://seo.chirirbandar.dinajpur.gov.bd',
  'দিনাজপুর|পার্বতীপুর': 'https://seo.parbatipur.dinajpur.gov.bd',
  'দিনাজপুর|নবাবগঞ্জ': 'https://seo.nawabganj.dinajpur.gov.bd',
  'দিনাজপুর|বীরগঞ্জ': 'https://seo.birganj.dinajpur.gov.bd',
  'দিনাজপুর|ফুলবাড়ী': 'https://seo.fulbari.dinajpur.gov.bd',
  'দিনাজপুর|বিরামপুর': 'https://seo.birampur.dinajpur.gov.bd',
  'দিনাজপুর|হাকিমপুর': 'https://seo.hakimpur.dinajpur.gov.bd',
  'দিনাজপুর|ঘোড়াঘাট': 'https://seo.ghoraghat.dinajpur.gov.bd',

  // পঞ্চগড় (৫)
  'পঞ্চগড়|সদর': 'https://dshe.panchagarhsadar.panchagarh.gov.bd',
  'পঞ্চগড়|বোদা': 'https://seo.boda.panchagarh.gov.bd',
  'পঞ্চগড়|দেবীগঞ্জ': 'https://dshe.debiganj.panchagarh.gov.bd',
  'পঞ্চগড়|আটোয়ারী': 'https://seo.atwari.panchagarh.gov.bd',
  'পঞ্চগড়|তেঁতুলিয়া': 'https://seo.tetulia.panchagarh.gov.bd',

  // ঠাকুরগাঁও (৫)
  'ঠাকুরগাঁও|সদর': 'https://seo.thakurgaonsadar.thakurgaon.gov.bd',
  'ঠাকুরগাঁও|পীরগঞ্জ': 'https://seo.pirganj.thakurgaon.gov.bd',
  'ঠাকুরগাঁও|রানীশংকৈল': 'https://seo.ranisankail.thakurgaon.gov.bd',
  'ঠাকুরগাঁও|বালিয়াডাঙ্গী': 'https://seo.baliadangi.thakurgaon.gov.bd',
  'ঠাকুরগাঁও|হরিপুর': 'https://seo.haripur.thakurgaon.gov.bd',
};

function deterministicOfficeId(key: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    const ch = key.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x01000193);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const tail = (Math.abs(h1 ^ h2) >>> 0).toString(16).padStart(12, '0').slice(-12);
  return `${hex1}-${hex2.slice(0, 4)}-4${hex2.slice(5, 8)}-9${hex1.slice(1, 4)}-${tail}`;
}

function parseBanglaOrAsciiInt(raw: string | undefined, fallback: number): number {
  const ascii = (raw ?? '').replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  const n = Number.parseInt(ascii.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePortalUrl(raw: string | undefined): string | null {
  const cleaned = (raw ?? '').trim().replace(/\/+$/, '');
  if (!cleaned || cleaned === '-') return null;
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) return cleaned;
  return `https://${cleaned}`;
}

function cleanMultiSlashText(raw: string | undefined): string | null {
  const cleaned = (raw ?? '').trim();
  if (!cleaned || cleaned === '-') return null;
  return cleaned;
}

export function mapDistrictOfficesCsv(csvText: string): EducationOffice[] {
  const rows = parseCSVText(csvText);
  if (rows.length < 2) return [];

  const offices: EducationOffice[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const serialNo = parseBanglaOrAsciiInt(r[0], i);
    const district = (r[1] ?? '').trim();
    const officeName = (r[2] ?? '').trim();
    if (!district || !officeName) continue;

    const officerName = cleanMultiSlashText(r[3]);
    const officerDesignation = cleanMultiSlashText(r[4]);
    const phoneRaw = cleanMultiSlashText(r[5]);
    const mobileRaw = normalizeMobileForStorage((r[6] ?? '').replace(/-/g, ''));
    const email = cleanMultiSlashText(r[7]);
    const portalUrl = normalizePortalUrl(r[8]);
    const officersUrl = portalUrl ? `${portalUrl}/pages/officers` : null;

    offices.push({
      id: deterministicOfficeId(`district-${district}-${officeName}`),
      serial_no: serialNo,
      office_type: 'district',
      district,
      upazila: null,
      office_name: officeName,
      officer_name: officerName,
      officer_designation: officerDesignation,
      phone_raw: phoneRaw,
      mobile_raw: mobileRaw,
      email,
      portal_url: portalUrl,
      officers_url: officersUrl,
      is_active: true,
    });
  }
  return offices;
}

export function mapUpazilaOfficesCsv(csvText: string): EducationOffice[] {
  const rows = parseCSVText(csvText);
  if (rows.length < 2) return [];

  const offices: EducationOffice[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const serialNo = parseBanglaOrAsciiInt(r[0], i);
    const district = (r[1] ?? '').trim();
    const upazila = (r[2] ?? '').trim();
    const officeName = (r[3] ?? '').trim();
    if (!district || !upazila || !officeName) continue;

    const phoneRaw = cleanMultiSlashText(r[4]);
    const email = cleanMultiSlashText(r[5]);
    const portalUrl = UPAZILA_PORTAL_URLS[`${district}|${upazila}`] ?? null;
    const officersUrl = portalUrl ? `${portalUrl}/pages/officers` : null;

    offices.push({
      id: deterministicOfficeId(`upazila-${district}-${upazila}`),
      serial_no: serialNo,
      office_type: 'upazila',
      district,
      upazila,
      office_name: officeName,
      // Upazila officers transfer frequently; keep individual names out of permanent card/modal
      officer_name: null,
      officer_designation: null,
      phone_raw: phoneRaw,
      mobile_raw: null,
      email,
      portal_url: portalUrl,
      officers_url: officersUrl,
      is_active: true,
    });
  }
  return offices;
}
