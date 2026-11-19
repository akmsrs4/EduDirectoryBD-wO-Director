import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  GraduationCap,
  MessageCircle,
  Phone,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import {
  fetchDirectoryStats,
  fetchFilterOptions,
  queryInstitutions,
} from '../services/institutions';
import {
  CATEGORY_LABELS_EN,
  INSTITUTION_CATEGORIES,
  type FilterOptions,
  type Institution,
  type InstitutionCategoryName,
  type InstitutionFilterParams,
} from '../types/institution';
import {
  formatCount,
  slugifyInstitution,
  translateManagement,
  translateMpoStatus,
  translateOriginalType,
  translateVerification,
} from '../utils/bangla';
import { updatePageMeta } from '../utils/seo';
import {
  UNASSIGNED_CATEGORY_MESSAGE_BN,
  UNASSIGNED_CATEGORY_MESSAGE_EN,
  getBestContactInfo,
  isCategoryUnassigned,
  isHeadNameMissing,
} from '../utils/validators';

interface DirectoryPageProps {
  onNavigate: (path: string) => void;
  initialDistrict?: string;
  initialCategory?: string;
}

const PUBLIC_CATEGORIES = [
  { value: 'কলেজ', labelBn: 'কলেজ', labelEn: 'College' },
  { value: 'স্কুল এন্ড কলেজ', labelBn: 'স্কুল এন্ড কলেজ', labelEn: 'School & College' },
  { value: 'স্কুল', labelBn: 'স্কুল', labelEn: 'School' },
] as const;

const PUBLIC_MANAGEMENTS = [
  { value: 'Non-Govt.', labelBn: 'বেসরকারি', labelEn: 'Non-Government' },
  { value: 'Govt.', labelBn: 'সরকারি', labelEn: 'Government' },
] as const;

export function DirectoryPage({
  onNavigate,
  initialDistrict = '',
  initialCategory = '',
}: DirectoryPageProps) {
  const { lang } = useLanguage();
  const [filters, setFilters] = useState<InstitutionFilterParams>({
    search: '',
    region: '',
    district: initialDistrict,
    upazila: '',
    refined_category: initialCategory || '',
    management: '',
    mpo_status: '',
    verification_status: '',
    page: 1,
    pageSize: 24,
    sortBy: 'name_en',
    sortOrder: 'asc',
  });

  const [searchInput, setSearchInput] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [items, setItems] = useState<Institution[]>([]);
  const [total, setTotal] = useState(0);
  const [totalListedCount, setTotalListedCount] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [options, setOptions] = useState<FilterOptions>({
    regions: [],
    districts: [],
    upazilas_by_district: {},
    managements: [],
    original_types: [],
    mpo_statuses: [],
    categories: [...INSTITUTION_CATEGORIES],
  });

  useEffect(() => {
    updatePageMeta({
      title: 'EduDirectory BD — বাংলাদেশের শিক্ষা প্রতিষ্ঠানের স্মার্ট ডিজিটাল ডিরেক্টরি',
      description:
        'বাংলাদেশের শিক্ষা প্রতিষ্ঠানের স্মার্ট ডিজিটাল ডিরেক্টরি। জেলা, উপজেলা, EIIN, ধরন ও ব্যবস্থাপনা অনুযায়ী স্কুল ও কলেজের তথ্য খুঁজুন।',
      canonicalPath: '/',
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchFilterOptions(), fetchDirectoryStats().catch(() => null)])
      .then(([optsRes, statsRes]) => {
        if (!mounted) return;
        setOptions(optsRes);
        if (statsRes?.stats) {
          setTotalListedCount(statsRes.stats.total);
        }
      })
      .catch(() => {
        // Handled gracefully
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Debounce search input -> filter state
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) =>
        prev.search === searchInput ? prev : { ...prev, search: searchInput, page: 1 }
      );
    }, 280);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    queryInstitutions(filters)
      .then(({ result }) => {
        if (!mounted) return;
        setItems(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'তথ্য লোড করতে সমস্যা হয়েছে।');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [filters]);

  const availableUpazilas = useMemo(() => {
    if (!filters.district) return [];
    return options.upazilas_by_district[filters.district] ?? [];
  }, [filters.district, options.upazilas_by_district]);

  const hasActiveCustomFilters = Boolean(
    searchInput ||
      filters.district ||
      filters.upazila ||
      filters.refined_category ||
      filters.management
  );

  const resetFilters = () => {
    setSearchInput('');
    setFilters({
      search: '',
      region: '',
      district: '',
      upazila: '',
      refined_category: '',
      management: '',
      mpo_status: '',
      verification_status: '',
      page: 1,
      pageSize: filters.pageSize ?? 24,
      sortBy: 'name_en',
      sortOrder: 'asc',
    });
  };

  const openProfile = (inst: Institution) => {
    onNavigate(`/institution/${slugifyInstitution(inst.name_en, inst.id)}`);
  };

  const displayListedTotal =
    totalListedCount ?? (hasActiveCustomFilters ? null : total > 0 ? total : null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Mobile Quick Switcher between Institutions & Education Offices */}
      <div className="md:hidden grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-blue-700 text-white text-xs font-semibold shadow-sm"
        >
          <GraduationCap className="w-4 h-4 shrink-0" />
          <span>{lang === 'bn' ? 'শিক্ষাপ্রতিষ্ঠানসমূহ' : 'Institutions'}</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/offices')}
          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
        >
          <Building2 className="w-4 h-4 shrink-0 text-blue-700" />
          <span>{lang === 'bn' ? 'শিক্ষা অফিসসমূহ' : 'Education Offices'}</span>
        </button>
      </div>

      {/* Hero Summary Section */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold tracking-wide uppercase text-blue-700">
              {lang === 'bn'
                ? 'রংপুর অঞ্চল · শিক্ষাপ্রতিষ্ঠান তথ্যভাণ্ডার'
                : 'Rangpur Region Educational Directory'}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
              বাংলাদেশের শিক্ষা প্রতিষ্ঠানের স্মার্ট ডিজিটাল ডিরেক্টরি
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              {lang === 'bn'
                ? 'প্রতিষ্ঠানের বাংলা বা ইংরেজি নাম, EIIN নম্বর, ফোন, মোবাইল বা ইমেইল দিয়ে দ্রুত খুঁজুন এবং জেলা ও উপজেলা অনুযায়ী তথ্য দেখুন।'
                : 'Search schools, colleges, and school & colleges by Bangla/English name, EIIN, phone, or email across districts and upazilas.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
            <div className="border border-slate-200 rounded-xl px-4 py-3.5 bg-slate-50/80">
              <div className="text-xs font-medium text-slate-500">
                {lang === 'bn' ? 'রংপুর অঞ্চল · জেলা / উপজেলা' : 'Rangpur Region · Area'}
              </div>
              <div className="text-lg sm:text-xl font-bold text-blue-700 tabular-nums mt-0.5 whitespace-nowrap">
                {lang === 'bn' ? '৮ জেলা / ৫৮ উপজেলা' : '8 Districts / 58 Upazilas'}
              </div>
            </div>

            <div className="border border-blue-200/80 rounded-xl px-4 py-3.5 bg-blue-50/50">
              <div className="text-xs font-medium text-slate-600">
                {lang === 'bn' ? 'তালিকাভুক্ত শিক্ষাপ্রতিষ্ঠান' : 'Listed Institutions'}
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums mt-0.5 whitespace-nowrap">
                {displayListedTotal !== null
                  ? lang === 'bn'
                    ? `${formatCount(displayListedTotal, 'bn')}টি`
                    : `${formatCount(displayListedTotal, 'en')}`
                  : '...'}
              </div>
              <div className="text-[11px] font-medium text-slate-600 mt-0.5">
                {lang === 'bn' ? 'এ পর্যন্ত তালিকাভুক্ত রয়েছে' : 'Currently listed in directory'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search & Clean 4-Filter Controls */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? 'প্রতিষ্ঠানের নাম (বাংলা/ইংরেজি), EIIN, মোবাইল বা ইমেইল লিখুন...'
                  : 'Search by Bangla/English name, EIIN, phone, or email...'
              }
              className="w-full min-h-[46px] pl-10 pr-4 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              className="lg:hidden flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 min-h-[46px] rounded-xl border border-slate-300 bg-slate-50 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              <SlidersHorizontal className="w-4 h-4 text-blue-700" />
              <span>{lang === 'bn' ? 'ফিল্টার' : 'Filters'}</span>
            </button>

            {hasActiveCustomFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[46px] rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{lang === 'bn' ? 'রিসেট করুন' : 'Reset'}</span>
              </button>
            )}
          </div>
        </div>

        <div
          className={`${
            mobileFiltersOpen ? 'grid' : 'hidden lg:grid'
          } grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1`}
        >
          {/* District Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'জেলা' : 'District'}
            </label>
            <select
              value={filters.district ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  district: e.target.value,
                  upazila: '',
                  page: 1,
                }))
              }
              className="w-full min-h-[44px] px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">{lang === 'bn' ? 'সকল' : 'All'}</option>
              {options.districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Cascading Upazila Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'উপজেলা / থানা' : 'Upazila / Thana'}
            </label>
            <select
              value={filters.upazila ?? ''}
              disabled={!filters.district}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, upazila: e.target.value, page: 1 }))
              }
              className="w-full min-h-[44px] px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">
                {filters.district
                  ? lang === 'bn'
                    ? 'সকল'
                    : 'All'
                  : lang === 'bn'
                  ? 'আগে জেলা নির্বাচন করুন'
                  : 'Select District First'}
              </option>
              {availableUpazilas.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter (সকল default + কলেজ, স্কুল এন্ড কলেজ, স্কুল) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'প্রতিষ্ঠানের ক্যাটাগরি' : 'Institution Category'}
            </label>
            <select
              value={filters.refined_category ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  refined_category: e.target.value,
                  page: 1,
                }))
              }
              className="w-full min-h-[44px] px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">{lang === 'bn' ? 'সকল' : 'All'}</option>
              {PUBLIC_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {lang === 'bn' ? cat.labelBn : cat.labelEn}
                </option>
              ))}
            </select>
          </div>

          {/* Management Filter (সকল default + বেসরকারি, সরকারি) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'ব্যবস্থাপনা' : 'Management'}
            </label>
            <select
              value={filters.management ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, management: e.target.value, page: 1 }))
              }
              className="w-full min-h-[44px] px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">{lang === 'bn' ? 'সকল' : 'All'}</option>
              {PUBLIC_MANAGEMENTS.map((m) => (
                <option key={m.value} value={m.value}>
                  {lang === 'bn' ? m.labelBn : m.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Results Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span>
            {lang === 'bn'
              ? `মোট ${formatCount(total, 'bn')}টি প্রতিষ্ঠান পাওয়া গেছে`
              : `${formatCount(total, 'en')} institutions found`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500">
            {lang === 'bn' ? 'প্রতি পেজে:' : 'Per page:'}
          </label>
          <select
            value={filters.pageSize ?? 24}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                pageSize: Number(e.target.value),
                page: 1,
              }))
            }
            className="min-h-[36px] px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700"
          >
            <option value={24}>24</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Results Content */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-800 space-y-2">
          <p className="font-semibold">{error}</p>
          <button
            type="button"
            onClick={() => setFilters((p) => ({ ...p }))}
            className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-medium"
          >
            {lang === 'bn' ? 'পুনরায় চেষ্টা করুন' : 'Retry'}
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-20 bg-white border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <p className="text-base font-semibold text-slate-800">
            {lang === 'bn'
              ? 'নির্বাচিত শর্তে কোনো শিক্ষা প্রতিষ্ঠান পাওয়া যায়নি।'
              : 'No educational institutions matched your current filters.'}
          </p>
          <p className="text-sm text-slate-500">
            {lang === 'bn'
              ? 'অনুসন্ধান শব্দ বা ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।'
              : 'Try adjusting your search keywords or resetting filters.'}
          </p>
          {hasActiveCustomFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{lang === 'bn' ? 'ফিল্টার রিসেট করুন' : 'Reset Filters'}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4">EIIN</th>
                    <th className="py-3.5 px-4">
                      {lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name'}
                    </th>
                    <th className="py-3.5 px-4">
                      {lang === 'bn' ? 'ক্যাটাগরি ও ধরন' : 'Category & Type'}
                    </th>
                    <th className="py-3.5 px-4">
                      {lang === 'bn' ? 'জেলা ও উপজেলা' : 'District & Upazila'}
                    </th>
                    <th className="py-3.5 px-4">
                      {lang === 'bn' ? 'যোগাযোগ ও অবস্থা' : 'Contact & Status'}
                    </th>
                    <th className="py-3.5 px-4 text-right">
                      {lang === 'bn' ? 'পদক্ষেপ' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {items.map((inst) => {
                    const contact = getBestContactInfo(inst);
                    const unassignedCat = isCategoryUnassigned(inst.refined_category);
                    const headMissing = isHeadNameMissing(inst.head_name);
                    return (
                      <tr
                        key={inst.id}
                        className="hover:bg-blue-50/40 transition-colors group"
                      >
                        <td className="py-3.5 px-4 align-top font-mono-tabular text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {inst.eiin ?? '—'}
                        </td>
                        <td className="py-3.5 px-4 align-top max-w-xs">
                          <button
                            type="button"
                            onClick={() => openProfile(inst)}
                            className="text-left font-semibold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug"
                          >
                            {inst.name_bn || inst.name_en}
                          </button>
                          {inst.name_bn && (
                            <div className="text-xs text-slate-500 mt-0.5 leading-snug">
                              {inst.name_en}
                            </div>
                          )}
                          <div className="text-xs text-slate-500 mt-1">
                            {headMissing
                              ? lang === 'bn'
                                ? 'প্রধান: যুক্ত করা হয়নি'
                                : 'Head: Not added'
                              : `${lang === 'bn' ? 'প্রধান' : 'Head'}: ${inst.head_name}`}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 align-top max-w-[220px]">
                          <div
                            className={`text-xs font-semibold ${
                              unassignedCat ? 'text-amber-700' : 'text-slate-800'
                            }`}
                          >
                            {inst.refined_category
                              ? lang === 'bn'
                                ? inst.refined_category
                                : CATEGORY_LABELS_EN[
                                    inst.refined_category as InstitutionCategoryName
                                  ] ?? inst.refined_category
                              : lang === 'bn'
                              ? UNASSIGNED_CATEGORY_MESSAGE_BN
                              : UNASSIGNED_CATEGORY_MESSAGE_EN}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {translateOriginalType(inst.original_type, lang)} ·{' '}
                            {translateManagement(inst.management, lang)}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <div className="font-medium text-slate-800">{inst.district}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{inst.upazila}</div>
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-mono-tabular text-xs text-slate-800">
                            {contact.primaryDisplayNumber ?? '—'}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {translateMpoStatus(inst.mpo_status, lang)} ·{' '}
                            <span
                              className={
                                inst.verification_status === 'verified'
                                  ? 'text-emerald-700 font-medium'
                                  : 'text-amber-700 font-medium'
                              }
                            >
                              {translateVerification(inst.verification_status, lang)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {contact.primaryTelHref && (
                              <a
                                href={contact.primaryTelHref}
                                title={lang === 'bn' ? 'কল করুন' : 'Call'}
                                className="p-2 rounded-lg border border-slate-200 text-blue-700 hover:bg-blue-50 transition-colors"
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                            )}
                            {contact.primaryWhatsAppHref && (
                              <a
                                href={contact.primaryWhatsAppHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="WhatsApp"
                                className="p-2 rounded-lg border border-slate-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => openProfile(inst)}
                              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-900 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{lang === 'bn' ? 'বিস্তারিত' : 'View'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile & Tablet Touch-Friendly Cards */}
          <div className="lg:hidden space-y-3">
            {items.map((inst) => {
              const contact = getBestContactInfo(inst);
              const unassignedCat = isCategoryUnassigned(inst.refined_category);
              return (
                <article
                  key={inst.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-mono-tabular text-blue-700 font-semibold">
                        EIIN: {inst.eiin ?? '—'} · {inst.upazila}, {inst.district}
                      </div>
                      <h2 className="font-semibold text-base text-slate-900 mt-1 leading-snug">
                        <button
                          type="button"
                          onClick={() => openProfile(inst)}
                          className="text-left hover:text-blue-700"
                        >
                          {inst.name_bn || inst.name_en}
                        </button>
                      </h2>
                      {inst.name_bn && (
                        <p className="text-xs text-slate-500 mt-0.5">{inst.name_en}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-slate-500">
                        {lang === 'bn' ? 'ক্যাটাগরি: ' : 'Category: '}
                      </span>
                      <span
                        className={`font-semibold ${
                          unassignedCat ? 'text-amber-700' : 'text-slate-800'
                        }`}
                      >
                        {inst.refined_category ||
                          (lang === 'bn'
                            ? UNASSIGNED_CATEGORY_MESSAGE_BN
                            : UNASSIGNED_CATEGORY_MESSAGE_EN)}
                      </span>
                    </div>
                    <div>
                      {translateOriginalType(inst.original_type, lang)} ·{' '}
                      {translateManagement(inst.management, lang)} ·{' '}
                      {translateMpoStatus(inst.mpo_status, lang)}
                    </div>
                    {contact.primaryDisplayNumber && (
                      <div className="font-mono-tabular text-slate-800">
                        {lang === 'bn' ? 'যোগাযোগ: ' : 'Contact: '}
                        {contact.primaryDisplayNumber}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {contact.primaryTelHref && (
                      <a
                        href={contact.primaryTelHref}
                        className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 text-white text-xs font-semibold px-3"
                      >
                        <Phone className="w-4 h-4" />
                        <span>{lang === 'bn' ? 'কল' : 'Call'}</span>
                      </a>
                    )}
                    {contact.primaryWhatsAppHref && (
                      <a
                        href={contact.primaryWhatsAppHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold px-3"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => openProfile(inst)}
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 text-xs font-semibold px-3"
                    >
                      <Eye className="w-4 h-4" />
                      <span>{lang === 'bn' ? 'প্রোফাইল' : 'Profile'}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination Bar */}
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-slate-600 tabular-nums">
              {lang === 'bn'
                ? `পেজ ${formatCount(filters.page ?? 1, 'bn')} / ${formatCount(totalPages, 'bn')}`
                : `Page ${filters.page ?? 1} of ${totalPages}`}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() =>
                  setFilters((p) => ({ ...p, page: Math.max(1, (p.page ?? 1) - 1) }))
                }
                className="min-h-[40px] px-3 rounded-lg border border-slate-300 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{lang === 'bn' ? 'পূর্ববর্তী' : 'Prev'}</span>
              </button>

              <button
                type="button"
                disabled={(filters.page ?? 1) >= totalPages}
                onClick={() =>
                  setFilters((p) => ({
                    ...p,
                    page: Math.min(totalPages, (p.page ?? 1) + 1),
                  }))
                }
                className="min-h-[40px] px-3 rounded-lg border border-slate-300 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1"
              >
                <span>{lang === 'bn' ? 'পরবর্তী' : 'Next'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
