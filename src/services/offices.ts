import { getCachedMeta, setCachedMeta } from '../lib/indexeddb';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import type { EducationOffice, EducationOfficeFilterParams } from '../types/institution';
import { mapDistrictOfficesCsv, mapUpazilaOfficesCsv } from '../utils/officeParser';

const BOOK1_CSV_PATH = '/assets/aistudio/Book1_26c72781.csv';
const BOOK2_CSV_PATH = '/assets/aistudio/Book2_52e85d2c.csv';
const CACHE_KEY = 'education_offices_v1';

let memoryOfficesCache: EducationOffice[] | null = null;
let memoryOfficesPromise: Promise<EducationOffice[]> | null = null;

export async function loadBundledCsvOffices(): Promise<EducationOffice[]> {
  if (memoryOfficesCache) return memoryOfficesCache;
  if (!memoryOfficesPromise) {
    memoryOfficesPromise = (async () => {
      const [res1, res2] = await Promise.all([fetch(BOOK1_CSV_PATH), fetch(BOOK2_CSV_PATH)]);
      if (!res1.ok || !res2.ok) {
        throw new Error('শিক্ষা অফিসের ডাটা ফাইল লোড করা যায়নি।');
      }
      const [text1, text2] = await Promise.all([res1.text(), res2.text()]);
      const combined = [...mapDistrictOfficesCsv(text1), ...mapUpazilaOfficesCsv(text2)];
      memoryOfficesCache = combined;
      await setCachedMeta(CACHE_KEY, combined);
      return combined;
    })();
  }
  return memoryOfficesPromise;
}

export function filterOfficesLocally(
  all: EducationOffice[],
  params: EducationOfficeFilterParams
): EducationOffice[] {
  const q = (params.search ?? '').trim().toLowerCase();

  const filtered = all.filter((o) => {
    if (!params.include_inactive && !o.is_active) return false;
    if (params.district && o.district !== params.district) return false;
    if (params.upazila) {
      if ((o.upazila ?? '') !== params.upazila) return false;
    }
    if (params.office_type && o.office_type !== params.office_type) return false;
    if (q) {
      const haystack = [
        o.office_name,
        o.district,
        o.upazila ?? '',
        o.officer_name ?? '',
        o.phone_raw ?? '',
        o.mobile_raw ?? '',
        o.email ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // Sort: District offices first, then by serial_no
  return filtered.sort((a, b) => {
    if (a.office_type !== b.office_type) {
      return a.office_type === 'district' ? -1 : 1;
    }
    return (a.serial_no ?? 999) - (b.serial_no ?? 999);
  });
}

export async function fetchAllEducationOffices(
  includeInactive = false
): Promise<{ offices: EducationOffice[]; source: 'supabase' | 'offline_cache' | 'csv_seed' }> {
  const supabase = getSupabaseClient();

  if (supabase && (typeof navigator === 'undefined' || navigator.onLine)) {
    try {
      let query = supabase
        .from('education_offices')
        .select('*')
        .order('office_type', { ascending: true })
        .order('serial_no', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const offices = data as EducationOffice[];
        await setCachedMeta(CACHE_KEY, offices);
        return { offices, source: 'supabase' };
      }
    } catch {
      // Fall back cleanly if table hasn't been migrated yet or offline
    }
  }

  if (isSupabaseConfigured()) {
    const cached = await getCachedMeta<EducationOffice[]>(CACHE_KEY);
    if (cached && cached.value.length > 0) {
      return { offices: cached.value, source: 'offline_cache' };
    }
  }

  const seeded = await loadBundledCsvOffices();
  return { offices: seeded, source: 'csv_seed' };
}

export async function updateEducationOfficeAdmin(
  id: string,
  payload: Partial<EducationOffice>
): Promise<EducationOffice> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase সংযুক্ত নয়।');

  const { data, error } = await supabase
    .from('education_offices')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as EducationOffice;
}

export async function createEducationOfficeAdmin(
  payload: Omit<EducationOffice, 'id' | 'created_at' | 'updated_at'>
): Promise<EducationOffice> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase সংযুক্ত নয়।');

  const { data, error } = await supabase
    .from('education_offices')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as EducationOffice;
}
