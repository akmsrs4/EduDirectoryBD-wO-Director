import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  Eye,
  Filter,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UserCheck,
} from 'lucide-react';
import { OfficeDetailModal } from '../components/OfficeDetailModal';
import { useLanguage } from '../hooks/useLanguage';
import { fetchAllEducationOffices, filterOfficesLocally } from '../services/offices';
import type { EducationOffice, EducationOfficeFilterParams } from '../types/institution';
import { toBanglaNumber } from '../utils/bangla';
import { updatePageMeta } from '../utils/seo';
import { normalizeBangladeshiPhone, sanitizeEmail } from '../utils/validators';

interface OfficesPageProps {
  onNavigate: (path: string) => void;
}

export function OfficesPage({ onNavigate }: OfficesPageProps) {
  const { lang } = useLanguage();
  const [allOffices, setAllOffices] = useState<EducationOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<EducationOfficeFilterParams>({
    search: '',
    district: '',
    upazila: '',
    office_type: '',
  });
  const [searchInput, setSearchInput] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<EducationOffice | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    updatePageMeta({
      title: 'শিক্ষা অফিসসমূহ (জেলা ও উপজেলা) — EduDirectory BD',
      description:
        'রংপুর অঞ্চলের ৮টি জেলা শিক্ষা অফিস ও ৫৮টি উপজেলা মাধ্যমিক শিক্ষা অফিসের অফিসিয়াল টিএনটি ফোন, ইমেইল, কর্মকর্তাদের তালিকা ও সরকারি ওয়েব পোর্টাল।',
      canonicalPath: '/offices',
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchAllEducationOffices()
      .then(({ offices }) => {
        if (!mounted) return;
        setAllOffices(offices);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'শিক্ষা অফিসের তথ্য লোড করা যায়নি।');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((p) => (p.search === searchInput ? p : { ...p, search: searchInput }));
    }, 220);
    return () => clearTimeout(t);
  }, [searchInput]);

  const districts = useMemo(() => {
    const ordered: string[] = [];
    for (const o of allOffices) {
      if (o.district && !ordered.includes(o.district)) ordered.push(o.district);
    }
    return ordered;
  }, [allOffices]);

  const availableUpazilas = useMemo(() => {
    if (!filters.district) return [];
    const list: string[] = [];
    for (const o of allOffices) {
      if (o.district === filters.district && o.upazila && !list.includes(o.upazila)) {
        list.push(o.upazila);
      }
    }
    return list;
  }, [allOffices, filters.district]);

  const filteredOffices = useMemo(
    () => filterOfficesLocally(allOffices, filters),
    [allOffices, filters]
  );

  const hasActiveFilters = Boolean(
    searchInput || filters.district || filters.upazila || filters.office_type
  );

  const resetFilters = () => {
    setSearchInput('');
    setFilters({ search: '', district: '', upazila: '', office_type: '' });
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Mobile Quick Switcher & Back Navigation */}
      <div className="space-y-3">
        <div className="md:hidden grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
          >
            <GraduationCap className="w-4 h-4 shrink-0 text-blue-700" />
            <span>{lang === 'bn' ? 'শিক্ষাপ্রতিষ্ঠানসমূহ' : 'Institutions'}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/offices')}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-blue-700 text-white text-xs font-semibold shadow-sm"
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>{lang === 'bn' ? 'শিক্ষা অফিসসমূহ' : 'Education Offices'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>
            {lang === 'bn' ? 'শিক্ষাপ্রতিষ্ঠানসমূহে ফিরে যান' : 'Back to Institutions'}
          </span>
        </button>
      </div>

      {/* Hero Section */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold tracking-wide uppercase text-blue-700">
              {lang === 'bn'
                ? 'জাতীয় তথ্য বাতায়ন ও অফিসিয়াল যোগাযোগ'
                : 'Official Education Administration Directory'}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
              {lang === 'bn'
                ? 'শিক্ষা অফিসসমূহ (জেলা ও উপজেলা)'
                : 'Education Offices (District & Upazila)'}
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              {lang === 'bn'
                ? 'রংপুর অঞ্চলের ৮টি জেলা শিক্ষা অফিস এবং ৫৮টি উপজেলা মাধ্যমিক শিক্ষা অফিসের অফিসিয়াল টিএনটি ফোন, ইমেইল, কর্মকর্তাদের তালিকা ও সরকারি ওয়েব পোর্টাল।'
                : 'Official contacts, officer directories, and government web portals for 8 District Education Offices and 58 Upazila Secondary Education Offices.'}
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl px-5 py-3.5 bg-slate-50/80 shrink-0">
            <div className="text-xs font-medium text-slate-500">
              {lang === 'bn' ? 'রংপুর অঞ্চল · জেলা / উপজেলা' : 'Rangpur Region · Districts / Upazilas'}
            </div>
            <div className="text-xl sm:text-2xl font-bold text-blue-700 tabular-nums mt-0.5">
              {lang === 'bn' ? '৮ জেলা / ৫৮ উপজেলা' : '8 Districts / 58 Upazilas'}
            </div>
          </div>
        </div>
      </section>

      {/* Search & Filter Controls */}
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
                  ? 'অফিসের নাম, জেলা, উপজেলা, টিএনটি বা ইমেইল দিয়ে খুঁজুন...'
                  : 'Search office name, district, upazila, phone, or email...'
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

            {hasActiveFilters && (
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
          } grid-cols-1 sm:grid-cols-3 gap-3 pt-1`}
        >
          {/* District Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'জেলা' : 'District'}
            </label>
            <select
              value={filters.district ?? ''}
              onChange={(e) =>
                setFilters((p) => ({ ...p, district: e.target.value, upazila: '' }))
              }
              className="w-full min-h-[44px] px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">{lang === 'bn' ? 'সকল' : 'All'}</option>
              {districts.map((d) => (
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
              onChange={(e) => setFilters((p) => ({ ...p, upazila: e.target.value }))}
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

          {/* Office Type Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'অফিসের ধরন' : 'Office Level'}
            </label>
            <select
              value={filters.office_type ?? ''}
              onChange={(e) =>
                setFilters((p) => ({
                  ...p,
                  office_type: e.target.value as EducationOfficeFilterParams['office_type'],
                }))
              }
              className="w-full min-h-[44px] px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">{lang === 'bn' ? 'সকল' : 'All'}</option>
              <option value="district">
                {lang === 'bn' ? 'জেলা শিক্ষা অফিস' : 'District Education Office'}
              </option>
              <option value="upazila">
                {lang === 'bn' ? 'উপজেলা মাধ্যমিক শিক্ষা অফিস' : 'Upazila Secondary Education Office'}
              </option>
            </select>
          </div>
        </div>
      </section>

      {/* Results Header */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Filter className="w-4 h-4 text-slate-400" />
        <span>
          {lang === 'bn'
            ? `মোট ${toBanglaNumber(filteredOffices.length)}টি শিক্ষা অফিস পাওয়া গেছে`
            : `${filteredOffices.length} education offices found`}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Office Card Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 animate-pulse"
            >
              <div className="h-5 bg-slate-200 rounded w-1/3" />
              <div className="h-6 bg-slate-200 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-10 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filteredOffices.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <p className="text-base font-semibold text-slate-800">
            {lang === 'bn'
              ? 'কোনো শিক্ষা অফিস খুঁজে পাওয়া যায়নি'
              : 'No matching education offices found'}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{lang === 'bn' ? 'সকল ফিল্টার রিসেট করুন' : 'Reset Filters'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOffices.map((office) => {
            const isDeo = office.office_type === 'district';
            const phoneNorm = normalizeBangladeshiPhone(office.phone_raw?.split(/[/,;]+/)[0]);
            const mobileNorm = normalizeBangladeshiPhone(office.mobile_raw?.split(/[/,;]+/)[0]);
            const emailFirst =
              office.email
                ?.split(/[/,;]+/)
                .map((e) => sanitizeEmail(e) ?? e.trim())
                .find(Boolean) ?? null;

            return (
              <article
                key={office.id}
                className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                        isDeo
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>
                        {isDeo
                          ? lang === 'bn'
                            ? 'জেলা শিক্ষা অফিস'
                            : 'District Office'
                          : lang === 'bn'
                          ? 'উপজেলা অফিস'
                          : 'Upazila Office'}
                      </span>
                    </span>
                  </div>

                  <div>
                    <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {office.office_name}
                    </h2>
                    <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {office.upazila ? `${office.upazila}, ` : ''}
                        {office.district}
                      </span>
                    </p>
                  </div>

                  {/* Officer Name shown ONLY for District Education Offices */}
                  {isDeo && office.officer_name && (
                    <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <UserCheck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        <span>{office.officer_designation || 'জেলা শিক্ষা অফিসার'}</span>
                      </div>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {office.officer_name}
                      </div>
                    </div>
                  )}

                  {/* Permanent Contact Lines with Quick Copy */}
                  <div className="space-y-2 text-xs">
                    {office.phone_raw && (
                      <div className="flex items-center justify-between gap-2 bg-slate-50/70 rounded-lg px-2.5 py-1.5 border border-slate-100">
                        <div className="min-w-0 truncate">
                          <span className="text-slate-500">টিএনটি: </span>
                          <span className="font-mono-tabular font-semibold text-slate-800">
                            {office.phone_raw}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {phoneNorm.primaryTelHref && (
                            <a
                              href={phoneNorm.primaryTelHref}
                              title="কল করুন"
                              className="p-1.5 rounded-md text-blue-700 hover:bg-blue-100/70"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                phoneNorm.displayList[0] ?? office.phone_raw!,
                                `${office.id}-phone`
                              )
                            }
                            title="নম্বর কপি করুন"
                            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-200/70"
                          >
                            {copiedId === `${office.id}-phone` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {isDeo && office.mobile_raw && (
                      <div className="flex items-center justify-between gap-2 bg-slate-50/70 rounded-lg px-2.5 py-1.5 border border-slate-100">
                        <div className="min-w-0 truncate">
                          <span className="text-slate-500">মোবাইল: </span>
                          <span className="font-mono-tabular font-semibold text-slate-800">
                            {office.mobile_raw}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {mobileNorm.primaryTelHref && (
                            <a
                              href={mobileNorm.primaryTelHref}
                              title="কল করুন"
                              className="p-1.5 rounded-md text-blue-700 hover:bg-blue-100/70"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                mobileNorm.displayList[0] ?? office.mobile_raw!,
                                `${office.id}-mobile`
                              )
                            }
                            title="মোবাইল কপি করুন"
                            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-200/70"
                          >
                            {copiedId === `${office.id}-mobile` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {emailFirst && (
                      <div className="flex items-center justify-between gap-2 bg-slate-50/70 rounded-lg px-2.5 py-1.5 border border-slate-100">
                        <div className="min-w-0 truncate">
                          <span className="text-slate-500">ইমেইল: </span>
                          <span className="font-medium text-slate-800">{office.email}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={`mailto:${emailFirst}`}
                            title="ইমেইল পাঠান"
                            className="p-1.5 rounded-md text-blue-700 hover:bg-blue-100/70"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopy(emailFirst, `${office.id}-email`)}
                            title="ইমেইল কপি করুন"
                            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-200/70"
                          >
                            {copiedId === `${office.id}-email` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Details Button */}
                <button
                  type="button"
                  onClick={() => setSelectedOffice(office)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 min-h-[42px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold transition-colors"
                >
                  <Eye className="w-4 h-4 shrink-0" />
                  <span>{lang === 'bn' ? 'বিস্তারিত' : 'Details'}</span>
                </button>
              </article>
            );
          })}
        </div>
      )}

      {selectedOffice && (
        <OfficeDetailModal
          office={selectedOffice}
          onClose={() => setSelectedOffice(null)}
        />
      )}
    </div>
  );
}
