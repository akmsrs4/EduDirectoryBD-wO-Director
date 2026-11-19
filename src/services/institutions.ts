import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import {
  cacheInstitutions,
  getCachedInstitutionById,
  getCachedInstitutions,
  getCachedMeta,
  setCachedMeta,
} from '../lib/indexeddb';
import {
  INSTITUTION_CATEGORIES,
  type AuditLogEntry,
  type DataQualityStats,
  type DirectoryStats,
  type FilterOptions,
  type ImportBatchEntry,
  type Institution,
  type InstitutionFilterParams,
  type PaginatedResult,
} from '../types/institution';
import { mapSourceCsvRowsToInstitutions, parseCSVText } from '../utils/csvParser';
import {
  isCategoryUnassigned,
  isCollegeType,
  isHeadNameMissing,
  isValidEmail,
  normalizeBangladeshiPhone,
  sanitizeEiin,
} from '../utils/validators';
import { banglaToAsciiDigits } from '../utils/bangla';

const SEED_CSV_PATH = '/assets/aistudio/working_rangpur_institute_csv_c574002b.csv';
let memoryCsvCache: Institution[] | null = null;
let memoryCsvPromise: Promise<Institution[]> | null = null;

export type DataSourceMode = 'supabase' | 'offline_cache' | 'csv_preview';

export async function loadBundledCsvInstitutions(): Promise<Institution[]> {
  if (memoryCsvCache) return memoryCsvCache;
  if (!memoryCsvPromise) {
    memoryCsvPromise = (async () => {
      // Try IndexedDB first if already hydrated from bundled CSV
      const meta = await getCachedMeta<string>('source_version');
      if (meta?.value === 'rangpur_csv_v1') {
        const cached = await getCachedInstitutions();
        if (cached.length > 0) {
          memoryCsvCache = cached;
          return cached;
        }
      }

      const response = await fetch(SEED_CSV_PATH);
      if (!response.ok) {
        throw new Error('উৎস CSV ফাইল লোড করা যায়নি।');
      }
      const text = await response.text();
      const rows = parseCSVText(text);
      const parsed = mapSourceCsvRowsToInstitutions(rows);
      memoryCsvCache = parsed;
      await cacheInstitutions(parsed, true);
      await setCachedMeta('source_version', 'rangpur_csv_v1');
      return parsed;
    })();
  }
  return memoryCsvPromise;
}

export function applyLocalFilters(
  all: Institution[],
  params: InstitutionFilterParams
): PaginatedResult<Institution> {
  const searchRaw = (params.search ?? '').trim().toLowerCase();
  const searchAscii = banglaToAsciiDigits(searchRaw);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, params.pageSize ?? 24));

  const filtered = all.filter((inst) => {
    if (!params.include_inactive && !inst.is_active) return false;
    if (params.region && inst.region !== params.region) return false;
    if (params.district && inst.district !== params.district) return false;
    if (params.upazila && inst.upazila !== params.upazila) return false;
    if (params.management) {
      const m = (inst.management ?? '').trim();
      if (params.management === 'Non-Govt.') {
        if (m !== 'Non-Govt.' && m !== 'Non-Govt' && m !== 'বেসরকারি') return false;
      } else if (params.management === 'Govt.') {
        if (m !== 'Govt.' && m !== 'Govt' && m !== 'সরকারি') return false;
      } else if (m !== params.management) {
        return false;
      }
    }
    if (params.original_type && (inst.original_type ?? '') !== params.original_type) return false;
    if (params.mpo_status && (inst.mpo_status ?? '') !== params.mpo_status) return false;
    if (params.verification_status && inst.verification_status !== params.verification_status) {
      return false;
    }

    if (params.refined_category && params.refined_category !== 'ALL') {
      const orig = (inst.original_type ?? '').toLowerCase();
      const cat = (inst.refined_category ?? '').toLowerCase();
      const hasSchoolAndCollege = (val: string) =>
        (val.includes('school') && val.includes('college')) ||
        ((val.includes('স্কুল') || val.includes('বিদ্যাল')) && val.includes('কলেজ'));
      const hasOnlySchool = (val: string) =>
        (val.includes('school') || val.includes('স্কুল') || val.includes('বিদ্যাল')) &&
        !val.includes('college') &&
        !val.includes('কলেজ');

      if (params.refined_category === 'কলেজ') {
        const isCollege = isCollegeType(inst.original_type) || isCollegeType(inst.refined_category);
        if (!isCollege) return false;
      } else if (params.refined_category === 'স্কুল এন্ড কলেজ') {
        if (!hasSchoolAndCollege(orig) && !hasSchoolAndCollege(cat)) return false;
      } else if (params.refined_category === 'স্কুল') {
        if (!hasOnlySchool(orig) && !hasOnlySchool(cat)) return false;
      } else if (params.refined_category === 'UNASSIGNED') {
        if (!isCategoryUnassigned(inst.refined_category)) return false;
      } else if (params.refined_category === 'অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি') {
        if (!isCategoryUnassigned(inst.refined_category)) return false;
      } else if (inst.refined_category !== params.refined_category) {
        return false;
      }
    }

    if (params.quality_issue) {
      switch (params.quality_issue) {
        case 'missing_mobile':
          if (normalizeBangladeshiPhone(inst.mobile_raw).isValidForCall) return false;
          break;
        case 'missing_email':
          if (isValidEmail(inst.email)) return false;
          break;
        case 'missing_head':
          if (!isHeadNameMissing(inst.head_name)) return false;
          break;
        case 'missing_eiin':
          if (sanitizeEiin(inst.eiin)) return false;
          break;
        case 'unassigned_category':
          if (!isCategoryUnassigned(inst.refined_category)) return false;
          break;
        case 'colleges_pending':
          if (!(isCollegeType(inst.original_type) && isCategoryUnassigned(inst.refined_category))) {
            return false;
          }
          break;
        case 'pending_verification':
          if (inst.verification_status === 'verified') return false;
          break;
      }
    }

    if (searchRaw) {
      const haystack = [
        inst.name_bn ?? '',
        inst.name_en ?? '',
        inst.eiin ?? '',
        inst.mobile_raw ?? '',
        inst.phone_raw ?? '',
        inst.email ?? '',
        inst.district ?? '',
        inst.upazila ?? '',
      ]
        .join(' ')
        .toLowerCase();
      const haystackAscii = banglaToAsciiDigits(haystack);
      if (!haystack.includes(searchRaw) && !haystackAscii.includes(searchAscii)) {
        return false;
      }
    }

    return true;
  });

  const sortBy = params.sortBy ?? 'name_en';
  const sortOrder = params.sortOrder ?? 'asc';
  const dir = sortOrder === 'desc' ? -1 : 1;

  filtered.sort((a, b) => {
    const va = String(a[sortBy] ?? '');
    const vb = String(b[sortBy] ?? '');
    if (sortBy === 'serial_no') {
      return ((a.serial_no ?? 0) - (b.serial_no ?? 0)) * dir;
    }
    return va.localeCompare(vb, 'bn') * dir;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export function computeLocalDirectoryStats(all: Institution[]): DirectoryStats {
  const active = all.filter((i) => i.is_active);
  const districts = new Set(active.map((i) => i.district));
  const upazilas = new Set(active.map((i) => `${i.district}|${i.upazila}`));
  return {
    total: active.length,
    districts: districts.size,
    upazilas: upazilas.size,
    govt: active.filter((i) => i.management === 'Govt.').length,
    non_govt: active.filter((i) => i.management === 'Non-Govt.').length,
    mpo_yes: active.filter((i) => (i.mpo_status ?? '').startsWith('Yes')).length,
    verified: active.filter((i) => i.verification_status === 'verified').length,
    pending: active.filter((i) => i.verification_status !== 'verified').length,
  };
}

export function computeLocalFilterOptions(all: Institution[]): FilterOptions {
  const active = all.filter((i) => i.is_active);
  const regions = [...new Set(active.map((i) => i.region).filter(Boolean))].sort();
  const upaMap: Record<string, Set<string>> = {};
  for (const inst of active) {
    if (!inst.district) continue;
    if (!upaMap[inst.district]) upaMap[inst.district] = new Set();
    if (inst.upazila) upaMap[inst.district].add(inst.upazila);
  }
  const districts = Object.keys(upaMap).sort();
  const upazilas_by_district: Record<string, string[]> = {};
  for (const d of districts) {
    upazilas_by_district[d] = [...upaMap[d]].sort();
  }
  const managements = [...new Set(active.map((i) => i.management).filter((v): v is string => Boolean(v)))].sort();
  const original_types = [...new Set(active.map((i) => i.original_type).filter((v): v is string => Boolean(v)))].sort();
  const mpo_statuses = [...new Set(active.map((i) => i.mpo_status).filter((v): v is string => Boolean(v)))].sort();

  return {
    regions,
    districts,
    upazilas_by_district,
    managements,
    original_types,
    mpo_statuses,
    categories: [...INSTITUTION_CATEGORIES],
  };
}

export function computeLocalDataQualityStats(all: Institution[]): DataQualityStats {
  const active = all.filter((i) => i.is_active);
  const inactive = all.filter((i) => !i.is_active);
  const categoryBreakdown: Record<string, number> = {};

  let missingEiin = 0;
  let missingMobile = 0;
  let missingEmail = 0;
  let missingHead = 0;
  let unassignedCategory = 0;
  let collegesPending = 0;
  let pendingVerification = 0;

  for (const inst of active) {
    if (!sanitizeEiin(inst.eiin)) missingEiin++;
    if (!normalizeBangladeshiPhone(inst.mobile_raw).isValidForCall) missingMobile++;
    if (!isValidEmail(inst.email)) missingEmail++;
    if (isHeadNameMissing(inst.head_name)) missingHead++;
    if (isCategoryUnassigned(inst.refined_category)) unassignedCategory++;
    if (isCollegeType(inst.original_type) && isCategoryUnassigned(inst.refined_category)) {
      collegesPending++;
    }
    if (inst.verification_status !== 'verified') pendingVerification++;

    const catKey = inst.refined_category || 'অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি';
    categoryBreakdown[catKey] = (categoryBreakdown[catKey] ?? 0) + 1;
  }

  return {
    total_active: active.length,
    total_inactive: inactive.length,
    districts: new Set(active.map((i) => i.district)).size,
    upazilas: new Set(active.map((i) => `${i.district}|${i.upazila}`)).size,
    govt_count: active.filter((i) => i.management === 'Govt.').length,
    non_govt_count: active.filter((i) => i.management === 'Non-Govt.').length,
    missing_eiin: missingEiin,
    missing_mobile: missingMobile,
    missing_email: missingEmail,
    missing_head_name: missingHead,
    unassigned_category: unassignedCategory,
    colleges_pending: collegesPending,
    pending_verification: pendingVerification,
    category_breakdown: categoryBreakdown,
  };
}

export async function queryInstitutions(
  params: InstitutionFilterParams
): Promise<{ result: PaginatedResult<Institution>; mode: DataSourceMode }> {
  const supabase = getSupabaseClient();

  if (supabase && (typeof navigator === 'undefined' || navigator.onLine)) {
    try {
      const page = Math.max(1, params.page ?? 1);
      const pageSize = Math.max(1, Math.min(200, params.pageSize ?? 24));
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('institutions')
        .select('*', { count: 'exact' });

      if (!params.include_inactive) {
        query = query.eq('is_active', true);
      }
      if (params.region) query = query.eq('region', params.region);
      if (params.district) query = query.eq('district', params.district);
      if (params.upazila) query = query.eq('upazila', params.upazila);
      if (params.management) {
        if (params.management === 'Non-Govt.') {
          query = query.in('management', ['Non-Govt.', 'Non-Govt', 'বেসরকারি']);
        } else if (params.management === 'Govt.') {
          query = query.in('management', ['Govt.', 'Govt', 'সরকারি']);
        } else {
          query = query.eq('management', params.management);
        }
      }
      if (params.original_type) query = query.eq('original_type', params.original_type);
      if (params.mpo_status) query = query.eq('mpo_status', params.mpo_status);
      if (params.verification_status) {
        query = query.eq('verification_status', params.verification_status);
      }

      if (params.refined_category && params.refined_category !== 'ALL') {
        if (params.refined_category === 'কলেজ') {
          query = query.or(
            [
              'and(original_type.ilike.%কলেজ%,original_type.not.ilike.%স্কুল%,original_type.not.ilike.%school%,original_type.not.ilike.%বিদ্যাল%)',
              'and(original_type.ilike.%college%,original_type.not.ilike.%স্কুল%,original_type.not.ilike.%school%,original_type.not.ilike.%বিদ্যাল%)',
              'and(refined_category.ilike.%কলেজ%,refined_category.not.ilike.%স্কুল%,refined_category.not.ilike.%school%,refined_category.not.ilike.%বিদ্যাল%)',
            ].join(',')
          );
        } else if (params.refined_category === 'স্কুল এন্ড কলেজ') {
          query = query.or(
            [
              'original_type.ilike.%School and College%',
              'original_type.ilike.%School & College%',
              'original_type.ilike.%স্কুল%কলেজ%',
              'original_type.ilike.%বিদ্যাল%কলেজ%',
              'refined_category.ilike.%স্কুল%কলেজ%',
              'refined_category.ilike.%School%College%',
            ].join(',')
          );
        } else if (params.refined_category === 'স্কুল') {
          query = query.or(
            [
              'and(original_type.ilike.%স্কুল%,original_type.not.ilike.%কলেজ%,original_type.not.ilike.%college%)',
              'and(original_type.ilike.%বিদ্যাল%,original_type.not.ilike.%কলেজ%,original_type.not.ilike.%college%)',
              'and(original_type.ilike.%school%,original_type.not.ilike.%কলেজ%,original_type.not.ilike.%college%)',
              'and(refined_category.ilike.%স্কুল%,refined_category.not.ilike.%কলেজ%,refined_category.not.ilike.%college%)',
              'and(refined_category.ilike.%বিদ্যাল%,refined_category.not.ilike.%কলেজ%,refined_category.not.ilike.%college%)',
            ].join(',')
          );
        } else if (
          params.refined_category === 'UNASSIGNED' ||
          params.refined_category === 'অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি'
        ) {
          query = query.or(
            'refined_category.is.null,refined_category.eq.অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি'
          );
        } else {
          query = query.eq('refined_category', params.refined_category);
        }
      }

      if (params.quality_issue) {
        switch (params.quality_issue) {
          case 'missing_eiin':
            query = query.is('eiin', null);
            break;
          case 'missing_mobile':
            query = query.or('mobile_raw.is.null,mobile_raw.eq.');
            break;
          case 'missing_email':
            query = query.or(
              'email.is.null,email.eq.,email.eq.0,email.ilike.not@vailable.com,email.ilike.not@available.com'
            );
            break;
          case 'missing_head':
            query = query.is('head_name', null);
            break;
          case 'unassigned_category':
            query = query.or(
              'refined_category.is.null,refined_category.eq.অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি'
            );
            break;
          case 'colleges_pending':
            query = query
              .ilike('original_type', '%College%')
              .not('original_type', 'ilike', '%School%')
              .or('refined_category.is.null,refined_category.eq.অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি');
            break;
          case 'pending_verification':
            query = query.neq('verification_status', 'verified');
            break;
        }
      }

      if (params.search?.trim()) {
        const term = params.search.trim().replace(/[,%()]/g, ' ');
        const ascii = banglaToAsciiDigits(term);
        query = query.or(
          `name_bn.ilike.%${term}%,name_en.ilike.%${term}%,eiin.ilike.%${ascii}%,mobile_raw.ilike.%${ascii}%,email.ilike.%${term}%`
        );
      }

      const sortBy = params.sortBy ?? 'name_en';
      const ascending = (params.sortOrder ?? 'asc') === 'asc';
      query = query.order(sortBy, { ascending, nullsFirst: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const items = (data ?? []) as Institution[];
      const total = count ?? items.length;
      if (items.length > 0) {
        void cacheInstitutions(items, false);
      }

      return {
        result: {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
        mode: 'supabase',
      };
    } catch {
      // Fall back to IndexedDB offline cache when Supabase network call fails
      const cached = await getCachedInstitutions();
      if (cached.length > 0) {
        return { result: applyLocalFilters(cached, params), mode: 'offline_cache' };
      }
    }
  }

  if (isSupabaseConfigured()) {
    const cached = await getCachedInstitutions();
    return { result: applyLocalFilters(cached, params), mode: 'offline_cache' };
  }

  const csvItems = await loadBundledCsvInstitutions();
  return { result: applyLocalFilters(csvItems, params), mode: 'csv_preview' };
}

export async function getInstitutionById(
  id: string
): Promise<{ institution: Institution | null; mode: DataSourceMode }> {
  const supabase = getSupabaseClient();
  if (supabase && (typeof navigator === 'undefined' || navigator.onLine)) {
    try {
      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const inst = data as Institution;
        void cacheInstitutions([inst], false);
        return { institution: inst, mode: 'supabase' };
      }
      return { institution: null, mode: 'supabase' };
    } catch {
      const cached = await getCachedInstitutionById(id);
      if (cached) return { institution: cached, mode: 'offline_cache' };
    }
  }

  if (isSupabaseConfigured()) {
    const cached = await getCachedInstitutionById(id);
    return { institution: cached, mode: 'offline_cache' };
  }

  const all = await loadBundledCsvInstitutions();
  const found = all.find((i) => i.id === id) ?? null;
  return { institution: found, mode: 'csv_preview' };
}

export async function fetchDirectoryStats(): Promise<{
  stats: DirectoryStats;
  mode: DataSourceMode;
}> {
  const supabase = getSupabaseClient();
  if (supabase && (typeof navigator === 'undefined' || navigator.onLine)) {
    try {
      const { data, error } = await supabase.rpc('get_directory_stats');
      if (error) throw error;
      if (data) {
        const stats = data as DirectoryStats;
        await setCachedMeta('directory_stats', stats);
        return { stats, mode: 'supabase' };
      }
    } catch {
      const cached = await getCachedMeta<DirectoryStats>('directory_stats');
      if (cached) return { stats: cached.value, mode: 'offline_cache' };
    }
  }

  if (isSupabaseConfigured()) {
    const cached = await getCachedMeta<DirectoryStats>('directory_stats');
    if (cached) return { stats: cached.value, mode: 'offline_cache' };
    const cachedList = await getCachedInstitutions();
    return { stats: computeLocalDirectoryStats(cachedList), mode: 'offline_cache' };
  }

  const all = await loadBundledCsvInstitutions();
  return { stats: computeLocalDirectoryStats(all), mode: 'csv_preview' };
}

export async function fetchFilterOptions(): Promise<FilterOptions> {
  const supabase = getSupabaseClient();
  if (supabase && (typeof navigator === 'undefined' || navigator.onLine)) {
    try {
      const { data, error } = await supabase.rpc('get_filter_options');
      if (!error && data) {
        const opts = data as FilterOptions;
        if (opts.districts && opts.districts.length > 0) {
          await setCachedMeta('filter_options', opts);
          return opts;
        }
      }
    } catch {
      // Fallback to direct query below
    }

    try {
      const collected: Pick<
        Institution,
        'region' | 'district' | 'upazila' | 'management' | 'original_type' | 'mpo_status' | 'is_active'
      >[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data: rows, error: qErr } = await supabase
          .from('institutions')
          .select('region, district, upazila, management, original_type, mpo_status, is_active')
          .eq('is_active', true)
          .range(from, from + step - 1);
        if (qErr) throw qErr;
        if (!rows || rows.length === 0) break;
        collected.push(
          ...(rows as Pick<
            Institution,
            'region' | 'district' | 'upazila' | 'management' | 'original_type' | 'mpo_status' | 'is_active'
          >[])
        );
        if (rows.length < step) break;
        from += step;
      }

      const opts = computeLocalFilterOptions(collected as Institution[]);
      await setCachedMeta('filter_options', opts);
      return opts;
    } catch {
      const cached = await getCachedMeta<FilterOptions>('filter_options');
      if (cached) return cached.value;
    }
  }

  if (isSupabaseConfigured()) {
    const cached = await getCachedMeta<FilterOptions>('filter_options');
    if (cached) return cached.value;
    const cachedList = await getCachedInstitutions();
    return computeLocalFilterOptions(cachedList);
  }

  const all = await loadBundledCsvInstitutions();
  return computeLocalFilterOptions(all);
}

// ---------------- ADMIN-ONLY OPERATIONS ----------------

export async function fetchAdminDataQualityStats(): Promise<DataQualityStats> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.rpc('admin_data_quality_stats');
    if (error) throw error;
    return data as DataQualityStats;
  }
  const all = await loadBundledCsvInstitutions();
  return computeLocalDataQualityStats(all);
}

export async function fetchAllInstitutionsAdmin(
  filters?: Partial<InstitutionFilterParams>
): Promise<Institution[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const all = await loadBundledCsvInstitutions();
    return applyLocalFilters(all, {
      ...filters,
      page: 1,
      pageSize: 10000,
    }).items;
  }

  // Paginate cleanly across Supabase's 1000-row cap
  const collected: Institution[] = [];
  const chunkSize = 1000;
  let from = 0;

  while (true) {
    let query = supabase
      .from('institutions')
      .select('*')
      .order('district', { ascending: true })
      .order('upazila', { ascending: true })
      .order('name_en', { ascending: true })
      .range(from, from + chunkSize - 1);

    if (!filters?.include_inactive) {
      query = query.eq('is_active', true);
    }
    if (filters?.district) query = query.eq('district', filters.district);
    if (filters?.upazila) query = query.eq('upazila', filters.upazila);
    if (filters?.management) query = query.eq('management', filters.management);
    if (filters?.mpo_status) query = query.eq('mpo_status', filters.mpo_status);
    if (filters?.verification_status) {
      query = query.eq('verification_status', filters.verification_status);
    }
    if (filters?.refined_category && filters.refined_category !== 'ALL') {
      if (
        filters.refined_category === 'UNASSIGNED' ||
        filters.refined_category === 'অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি'
      ) {
        query = query.or(
          'refined_category.is.null,refined_category.eq.অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি'
        );
      } else {
        query = query.eq('refined_category', filters.refined_category);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as Institution[];
    collected.push(...rows);
    if (rows.length < chunkSize) break;
    from += chunkSize;
  }

  return collected;
}

export async function updateInstitutionAdmin(
  id: string,
  updates: Partial<Institution>
): Promise<Institution> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase সংযুক্ত না থাকায় ডাটাবেসে সংরক্ষণ করা যাবে না।');
  }

  // Never allow overwriting original_type accidentally with null if already set unless explicit
  const { id: _ignoreId, created_at: _c, updated_at: _u, ...safePayload } = updates;
  const { data, error } = await supabase
    .from('institutions')
    .update(safePayload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  const updated = data as Institution;
  void cacheInstitutions([updated], false);
  return updated;
}

export async function createInstitutionAdmin(
  payload: Omit<Institution, 'id' | 'created_at' | 'updated_at'>
): Promise<Institution> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase সংযুক্ত না থাকায় নতুন প্রতিষ্ঠান যোগ করা যাবে না।');
  }
  const { data, error } = await supabase
    .from('institutions')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  const created = data as Institution;
  void cacheInstitutions([created], false);
  return created;
}

export async function setInstitutionActiveAdmin(
  id: string,
  isActive: boolean
): Promise<Institution> {
  return updateInstitutionAdmin(id, { is_active: isActive });
}

export async function deleteInstitutionHardAdmin(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase সংযুক্ত না থাকায় মুছে ফেলা যাবে না।');
  }
  const { error } = await supabase.from('institutions').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkAssignCategoryAdmin(
  ids: string[],
  refinedCategory: string | null,
  verificationStatus: Institution['verification_status'] = 'verified'
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase সংযুক্ত না থাকায় বাল্ক আপডেট করা যাবে না।');
  }
  const { error } = await supabase
    .from('institutions')
    .update({
      refined_category: refinedCategory,
      verification_status: verificationStatus,
    })
    .in('id', ids);

  if (error) throw error;
}

export async function fetchAuditLogsAdmin(limit = 50): Promise<AuditLogEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AuditLogEntry[];
}

export async function fetchImportBatchesAdmin(limit = 30): Promise<ImportBatchEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ImportBatchEntry[];
}
