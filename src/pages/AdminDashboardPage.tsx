import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart2,
  Building2,
  CheckSquare,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  History,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { ExcelImportExportPanel } from '../components/admin/ExcelImportExportPanel';
import { InstitutionEditModal } from '../components/admin/InstitutionEditModal';
import { OfficeEditModal } from '../components/admin/OfficeEditModal';
import { ReportBuilderPanel } from '../components/admin/ReportBuilderPanel';
import { useAuth } from '../hooks/useAuth';
import { downloadExcelImportTemplate } from '../services/excel';
import {
  bulkAssignCategoryAdmin,
  fetchAdminDataQualityStats,
  fetchAllInstitutionsAdmin,
  fetchAuditLogsAdmin,
  fetchImportBatchesAdmin,
  queryInstitutions,
} from '../services/institutions';
import {
  fetchAllEducationOffices,
  filterOfficesLocally,
} from '../services/offices';
import {
  INSTITUTION_CATEGORIES,
  type AuditLogEntry,
  type DataQualityStats,
  type EducationOffice,
  type EducationOfficeType,
  type ImportBatchEntry,
  type Institution,
  type InstitutionFilterParams,
} from '../types/institution';
import { toBanglaNumber, translateManagement, translateVerification } from '../utils/bangla';
import { updatePageMeta } from '../utils/seo';
import {
  UNASSIGNED_CATEGORY_MESSAGE_BN,
  isCategoryUnassigned,
  isHeadNameMissing,
} from '../utils/validators';

interface AdminDashboardPageProps {
  onNavigate: (path: string) => void;
  initialEditId?: string;
}

type AdminTab = 'overview' | 'manage' | 'offices' | 'excel' | 'reports' | 'logs';

export function AdminDashboardPage({
  onNavigate,
  initialEditId,
}: AdminDashboardPageProps) {
  const { isAdmin, loading: authLoading, adminProfile, signOut } = useAuth();
  const isPreviewReadOnly = false;
  const [activeTab, setActiveTab] = useState<AdminTab>(initialEditId ? 'manage' : 'overview');

  const [quality, setQuality] = useState<DataQualityStats | null>(null);
  const [allInstitutions, setAllInstitutions] = useState<Institution[]>([]);
  const [manageFilters, setManageFilters] = useState<InstitutionFilterParams>({
    search: '',
    district: '',
    refined_category: 'ALL',
    quality_issue: '',
    include_inactive: true,
    page: 1,
    pageSize: 25,
    sortBy: 'name_en',
    sortOrder: 'asc',
  });
  const [manageItems, setManageItems] = useState<Institution[]>([]);
  const [manageTotal, setManageTotal] = useState(0);
  const [manageTotalPages, setManageTotalPages] = useState(1);
  const [loadingManage, setLoadingManage] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [bulkApplying, setBulkApplying] = useState(false);

  const [editingInstitution, setEditingInstitution] = useState<Institution | null | undefined>(
    undefined
  ); // undefined = closed, null = new, Institution = edit

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [importBatches, setImportBatches] = useState<ImportBatchEntry[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [allOffices, setAllOffices] = useState<EducationOffice[]>([]);
  const [officesSource, setOfficesSource] = useState<'supabase' | 'offline_cache' | 'csv_seed'>(
    'csv_seed'
  );
  const [officeSearch, setOfficeSearch] = useState('');
  const [officeDistrict, setOfficeDistrict] = useState('');
  const [officeTypeFilter, setOfficeTypeFilter] = useState<'' | EducationOfficeType>('');
  const [editingOffice, setEditingOffice] = useState<EducationOffice | null>(null);

  useEffect(() => {
    updatePageMeta({
      title: 'অ্যাডমিন ড্যাশবোর্ড — EduDirectory BD',
      description: 'EduDirectory BD অ্যাডমিন প্যানেল।',
      noIndex: true,
    });
  }, []);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      onNavigate('/login');
    }
  }, [authLoading, isAdmin, onNavigate]);

  const loadDashboardData = async () => {
    try {
      const [qStats, allRows, logs, batches, officeResult] = await Promise.all([
        fetchAdminDataQualityStats(),
        fetchAllInstitutionsAdmin({ include_inactive: true }),
        fetchAuditLogsAdmin(40).catch(() => []),
        fetchImportBatchesAdmin(20).catch(() => []),
        fetchAllEducationOffices(true).catch(() => ({
          offices: [] as EducationOffice[],
          source: 'csv_seed' as const,
        })),
      ]);
      setQuality(qStats);
      setAllInstitutions(allRows);
      setAuditLogs(logs);
      setImportBatches(batches);
      setAllOffices(officeResult.offices);
      setOfficesSource(officeResult.source);

      if (initialEditId) {
        const target = allRows.find((r) => r.id === initialEditId);
        if (target) setEditingInstitution(target);
      }
    } catch {
      // Handled safely
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void loadDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const refreshManageList = async () => {
    setLoadingManage(true);
    try {
      const { result } = await queryInstitutions(manageFilters);
      setManageItems(result.items);
      setManageTotal(result.total);
      setManageTotalPages(result.totalPages);
    } finally {
      setLoadingManage(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void refreshManageList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, manageFilters]);

  const districts = useMemo(
    () => [...new Set(allInstitutions.map((i) => i.district).filter(Boolean))].sort(),
    [allInstitutions]
  );

  const officeDistricts = useMemo(
    () => [...new Set(allOffices.map((o) => o.district).filter(Boolean))],
    [allOffices]
  );

  const filteredOffices = useMemo(
    () =>
      filterOfficesLocally(allOffices, {
        search: officeSearch,
        district: officeDistrict,
        office_type: officeTypeFilter,
        include_inactive: true,
      }),
    [allOffices, officeSearch, officeDistrict, officeTypeFilter]
  );

  const openQualityDrilldown = (issue: InstitutionFilterParams['quality_issue']) => {
    setManageFilters((prev) => ({
      ...prev,
      quality_issue: issue,
      district: '',
      refined_category: 'ALL',
      page: 1,
    }));
    setActiveTab('manage');
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkAssignCategory = async () => {
    if (selectedIds.length === 0 || !bulkCategory) return;
    if (isPreviewReadOnly) {
      setActionMessage('Supabase সংযুক্ত না থাকায় রিড-অনলি প্রিভিউ মোডে বাল্ক পরিবর্তন সংরক্ষণ করা যাবে না।');
      return;
    }
    setBulkApplying(true);
    try {
      await bulkAssignCategoryAdmin(selectedIds, bulkCategory, 'verified');
      setActionMessage(`${toBanglaNumber(selectedIds.length)}টি প্রতিষ্ঠানের ক্যাটাগরি আপডেট হয়েছে।`);
      setSelectedIds([]);
      await Promise.all([loadDashboardData(), refreshManageList()]);
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : 'বাল্ক আপডেট ব্যর্থ হয়েছে।');
    } finally {
      setBulkApplying(false);
    }
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-slate-600">
        অ্যাডমিন সেশন যাচাই করা হচ্ছে...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Admin Top Header (Hidden on Print) */}
      <section className="no-print bg-white border border-slate-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
            <ShieldCheck className="w-4 h-4" />
            <span>
              {isPreviewReadOnly
                ? 'রিড-অনলি অ্যাডমিন প্রিভিউ (স্থানীয় CSV)'
                : `লগইনকৃত অ্যাডমিন: ${adminProfile?.email ?? ''}`}
            </span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
            EduDirectory BD অ্যাডমিন কন্ট্রোল প্যানেল
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadExcelImportTemplate}
            className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 text-xs font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>ডাউনলোড Excel Import Template</span>
          </button>

          <button
            type="button"
            onClick={() => setEditingInstitution(null)}
            className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন প্রতিষ্ঠান</span>
          </button>

          <button
            type="button"
            onClick={() => void signOut().then(() => onNavigate('/'))}
            className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
          >
            <LogOut className="w-4 h-4" />
            <span>লগআউট</span>
          </button>
        </div>
      </section>

      {actionMessage && (
        <div className="no-print rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="font-semibold underline"
          >
            বন্ধ করুন
          </button>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="no-print flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'overview', label: 'ওভারভিউ ও ডেটা কোয়ালিটি', icon: BarChart2 },
          { id: 'manage', label: 'প্রতিষ্ঠান সম্পাদনা ও শ্রেণিবিভাগ', icon: Edit3 },
          { id: 'offices', label: 'শিক্ষা অফিসসমূহ (৮ + ৫৮)', icon: Building2 },
          { id: 'excel', label: 'Excel ইম্পোর্ট ও এক্সপোর্ট', icon: FileSpreadsheet },
          { id: 'reports', label: 'কাস্টম রিপোর্ট (অ্যাডমিন)', icon: FileText },
          { id: 'logs', label: 'অডিট ও ইম্পোর্ট ইতিহাস', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`inline-flex items-center gap-2 px-4 min-h-[42px] rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Overview & Data Quality Dashboard */}
      {activeTab === 'overview' && quality && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">সক্রিয় প্রতিষ্ঠান</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                {toBanglaNumber(quality.total_active)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                নিষ্ক্রিয়: {toBanglaNumber(quality.total_inactive)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">জেলা / উপজেলা</div>
              <div className="text-2xl font-bold text-blue-700 tabular-nums mt-1">
                {toBanglaNumber(quality.districts)} / {toBanglaNumber(quality.upazilas)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">সরকারি / বেসরকারি</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                {toBanglaNumber(quality.govt_count)} / {toBanglaNumber(quality.non_govt_count)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">কলেজ (শ্রেণিবিভাগ বাকি)</div>
              <div className="text-2xl font-bold text-amber-700 tabular-nums mt-1">
                {toBanglaNumber(quality.colleges_pending)}
              </div>
              <button
                type="button"
                onClick={() => openQualityDrilldown('colleges_pending')}
                className="text-xs font-semibold text-blue-700 hover:underline mt-1"
              >
                তালিকা দেখুন →
              </button>
            </div>
          </div>

          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                ডেটা কোয়ালিটি ড্যাশবোর্ড (অসম্পূর্ণ ও যাচাই বাকি রেকর্ড)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                যেকোনো কার্ডে ক্লিক করলে সরাসরি সেই অসম্পূর্ণ রেকর্ডগুলোর তালিকা সম্পাদনার জন্য ওপেন হবে।
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  label: 'প্রতিষ্ঠান প্রধানের নাম অনুপস্থিত / প্লেসহোল্ডার',
                  count: quality.missing_head_name,
                  issue: 'missing_head' as const,
                },
                {
                  label: 'মোবাইল নম্বর নেই বা অবৈধ ফরম্যাট',
                  count: quality.missing_mobile,
                  issue: 'missing_mobile' as const,
                },
                {
                  label: 'ইমেইল ঠিকানা নেই বা প্লেসহোল্ডার',
                  count: quality.missing_email,
                  issue: 'missing_email' as const,
                },
                {
                  label: 'ক্যাটাগরি নির্ধারণ বাকি (কলেজ/মাদ্রাসা/অন্যান্য)',
                  count: quality.unassigned_category,
                  issue: 'unassigned_category' as const,
                },
                {
                  label: 'বৈধ EIIN অনুপস্থিত',
                  count: quality.missing_eiin,
                  issue: 'missing_eiin' as const,
                },
                {
                  label: 'যাচাই (Verification) বাকি',
                  count: quality.pending_verification,
                  issue: 'pending_verification' as const,
                },
              ].map((card) => (
                <button
                  key={card.issue}
                  type="button"
                  onClick={() => openQualityDrilldown(card.issue)}
                  className="text-left border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl p-4 transition-colors space-y-1.5"
                >
                  <div className="text-xs font-medium text-slate-600">{card.label}</div>
                  <div className="text-2xl font-bold text-amber-700 tabular-nums">
                    {toBanglaNumber(card.count)}
                  </div>
                  <div className="text-xs font-semibold text-blue-700">সংশোধন করতে যান →</div>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-3">
            <h2 className="font-display text-lg font-bold text-slate-900">
              ক্যাটাগরিভিত্তিক বর্তমান বণ্টন
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {INSTITUTION_CATEGORIES.map((cat) => (
                <div key={cat} className="border border-slate-200 rounded-xl p-3.5">
                  <div className="text-xs font-medium text-slate-600">{cat}</div>
                  <div className="text-lg font-bold text-slate-900 tabular-nums mt-1">
                    {toBanglaNumber(quality.category_breakdown[cat] ?? 0)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Manage, Individual Edit & Bulk College/Category Classification */}
      {activeTab === 'manage' && (
        <div className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={manageFilters.search ?? ''}
                  onChange={(e) =>
                    setManageFilters((p) => ({ ...p, search: e.target.value, page: 1 }))
                  }
                  placeholder="নাম, EIIN বা মোবাইল খুঁজুন..."
                  className="w-full min-h-[40px] pl-9 pr-3 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <select
                value={manageFilters.district ?? ''}
                onChange={(e) =>
                  setManageFilters((p) => ({ ...p, district: e.target.value, page: 1 }))
                }
                className="min-h-[40px] px-3 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="">সকল জেলা</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={manageFilters.refined_category ?? 'ALL'}
                onChange={(e) =>
                  setManageFilters((p) => ({
                    ...p,
                    refined_category: e.target.value,
                    page: 1,
                  }))
                }
                className="min-h-[40px] px-3 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="ALL">সকল ক্যাটাগরি</option>
                {INSTITUTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={manageFilters.quality_issue ?? ''}
                onChange={(e) =>
                  setManageFilters((p) => ({
                    ...p,
                    quality_issue: e.target.value as InstitutionFilterParams['quality_issue'],
                    page: 1,
                  }))
                }
                className="min-h-[40px] px-3 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="">সকল ডেটা অবস্থা</option>
                <option value="colleges_pending">কলেজ (শ্রেণিবিভাগ বাকি)</option>
                <option value="missing_head">প্রতিষ্ঠান প্রধান অনুপস্থিত</option>
                <option value="missing_mobile">মোবাইল নেই / অবৈধ</option>
                <option value="missing_email">ইমেইল নেই / অবৈধ</option>
                <option value="missing_eiin">EIIN নেই</option>
                <option value="unassigned_category">ক্যাটাগরি নির্ধারণ বাকি</option>
                <option value="pending_verification">যাচাই বাকি</option>
              </select>
            </div>

            {/* Bulk Category Assignment Bar */}
            {selectedIds.length > 0 && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                  <CheckSquare className="w-4 h-4" />
                  <span>{toBanglaNumber(selectedIds.length)}টি প্রতিষ্ঠান নির্বাচিত</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    className="min-h-[38px] px-3 rounded-lg border border-blue-300 bg-white text-xs font-medium"
                  >
                    <option value="">-- নতুন ক্যাটাগরি বাছাই করুন --</option>
                    {INSTITUTION_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={bulkApplying || !bulkCategory}
                    onClick={handleBulkAssignCategory}
                    className="px-4 min-h-[38px] rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {bulkApplying ? 'আপডেট হচ্ছে...' : 'বাল্ক ক্যাটাগরি সেট করুন'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="px-3 min-h-[38px] rounded-lg border border-slate-300 bg-white text-xs font-medium"
                  >
                    নির্বাচন বাতিল
                  </button>
                </div>
              </div>
            )}
          </section>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>মোট পাওয়া গেছে: {toBanglaNumber(manageTotal)}টি</span>
              <span className="tabular-nums">
                পেজ {toBanglaNumber(manageFilters.page ?? 1)} /{' '}
                {toBanglaNumber(manageTotalPages)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={
                          manageItems.length > 0 &&
                          manageItems.every((i) => selectedIds.includes(i.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(manageItems.map((i) => i.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                      />
                    </th>
                    <th className="py-2.5 px-3">EIIN</th>
                    <th className="py-2.5 px-3">প্রতিষ্ঠানের নাম</th>
                    <th className="py-2.5 px-3">মূল ধরন ও ক্যাটাগরি</th>
                    <th className="py-2.5 px-3">প্রতিষ্ঠান প্রধান</th>
                    <th className="py-2.5 px-3">অবস্থা</th>
                    <th className="py-2.5 px-3 text-right">সম্পাদনা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingManage ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        লোড হচ্ছে...
                      </td>
                    </tr>
                  ) : (
                    manageItems.map((inst) => (
                      <tr key={inst.id} className={!inst.is_active ? 'bg-red-50/40' : ''}>
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(inst.id)}
                            onChange={() => toggleSelectRow(inst.id)}
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular font-semibold">
                          {inst.eiin ?? '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">
                            {inst.name_bn || inst.name_en}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {inst.upazila}, {inst.district} · {translateManagement(inst.management, 'bn')}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div
                            className={`font-semibold ${
                              isCategoryUnassigned(inst.refined_category)
                                ? 'text-amber-700'
                                : 'text-slate-800'
                            }`}
                          >
                            {inst.refined_category ?? UNASSIGNED_CATEGORY_MESSAGE_BN}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            মূল: {inst.original_type || 'উল্লেখ নেই'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {isHeadNameMissing(inst.head_name) ? (
                            <span className="text-amber-700">যুক্ত করা হয়নি</span>
                          ) : (
                            <span className="text-slate-800 font-medium">{inst.head_name}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {!inst.is_active ? (
                            <span className="text-red-700 font-semibold">নিষ্ক্রিয়</span>
                          ) : (
                            <span
                              className={
                                inst.verification_status === 'verified'
                                  ? 'text-emerald-700 font-semibold'
                                  : 'text-amber-700 font-semibold'
                              }
                            >
                              {translateVerification(inst.verification_status, 'bn')}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setEditingInstitution(inst)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>সম্পাদনা</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
              <button
                type="button"
                disabled={(manageFilters.page ?? 1) <= 1}
                onClick={() =>
                  setManageFilters((p) => ({ ...p, page: Math.max(1, (p.page ?? 1) - 1) }))
                }
                className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40"
              >
                পূর্ববর্তী
              </button>
              <button
                type="button"
                disabled={(manageFilters.page ?? 1) >= manageTotalPages}
                onClick={() =>
                  setManageFilters((p) => ({
                    ...p,
                    page: Math.min(manageTotalPages, (p.page ?? 1) + 1),
                  }))
                }
                className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40"
              >
                পরবর্তী
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Education Offices Management */}
      {activeTab === 'offices' && (
        <div className="space-y-4">
          {officesSource !== 'supabase' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              বর্তমানে CSV থেকে {toBanglaNumber(allOffices.length)}টি অফিসের তথ্য প্রদর্শিত হচ্ছে। অ্যাডমিন থেকে স্থায়ীভাবে আপডেট সংরক্ষণ করতে Supabase SQL Editor-এ নতুন <code className="font-mono font-semibold">supabase_setup.sql</code> (Section 16) রান করুন।
            </div>
          )}

          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  জেলা ও উপজেলা শিক্ষা অফিসসমূহ সম্পাদনা
                </h2>
                <p className="text-xs text-slate-500">
                  জেলা শিক্ষা অফিসারের নাম, পদবি, মোবাইল, T&amp;T, ইমেইল ও সরকারি পোর্টাল লিংক হালনাগাদ করুন।
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600 tabular-nums">
                প্রদর্শিত: {toBanglaNumber(filteredOffices.length)} / {toBanglaNumber(allOffices.length)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={officeSearch}
                  onChange={(e) => setOfficeSearch(e.target.value)}
                  placeholder="অফিস, জেলা, কর্মকর্তা বা ইমেইল খুঁজুন..."
                  className="w-full min-h-[40px] pl-9 pr-3 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <select
                value={officeDistrict}
                onChange={(e) => setOfficeDistrict(e.target.value)}
                className="min-h-[40px] px-3 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="">সকল জেলা</option>
                {officeDistricts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={officeTypeFilter}
                onChange={(e) => setOfficeTypeFilter(e.target.value as '' | EducationOfficeType)}
                className="min-h-[40px] px-3 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="">সকল অফিস</option>
                <option value="district">জেলা শিক্ষা অফিস</option>
                <option value="upazila">উপজেলা মাধ্যমিক শিক্ষা অফিস</option>
              </select>
            </div>
          </section>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3">ধরন ও এলাকা</th>
                    <th className="py-2.5 px-3">অফিসের নাম</th>
                    <th className="py-2.5 px-3">কর্মকর্তা (জেলা অফিস)</th>
                    <th className="py-2.5 px-3">যোগাযোগ (T&amp;T / ইমেইল)</th>
                    <th className="py-2.5 px-3">পোর্টাল লিংক</th>
                    <th className="py-2.5 px-3 text-right">সম্পাদনা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOffices.map((office) => (
                    <tr key={office.id}>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            office.office_type === 'district'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {office.office_type === 'district' ? 'জেলা অফিস' : 'উপজেলা অফিস'}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {office.upazila ? `${office.upazila}, ` : ''}
                          {office.district}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {office.office_name}
                      </td>
                      <td className="py-2.5 px-3">
                        {office.office_type === 'district' ? (
                          <div>
                            <div className="font-medium text-slate-800">
                              {office.officer_name || '—'}
                            </div>
                            {office.mobile_raw && (
                              <div className="text-[11px] font-mono-tabular text-slate-500">
                                {office.mobile_raw}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            পোর্টাল লিংক প্রযোজ্য
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono-tabular text-slate-800">
                          {office.phone_raw || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500 break-all">
                          {office.email || '—'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {office.portal_url ? (
                          <a
                            href={office.portal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium"
                          >
                            <span>পোর্টাল</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingOffice(office)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>সম্পাদনা</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Excel Import/Export */}
      {activeTab === 'excel' && (
        <ExcelImportExportPanel
          institutions={allInstitutions}
          readOnlyPreview={isPreviewReadOnly}
          onImportCompleted={() => {
            void loadDashboardData();
            void refreshManageList();
          }}
        />
      )}

      {/* TAB 4: Admin-Only Custom Report Builder */}
      {activeTab === 'reports' && (
        <ReportBuilderPanel
          institutions={allInstitutions}
          readOnlyPreview={isPreviewReadOnly}
        />
      )}

      {/* TAB 5: Audit Logs & Import History */}
      {activeTab === 'logs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-900">
              সাম্প্রতিক ইম্পোর্ট ব্যাচ ইতিহাস
            </h2>
            {importBatches.length === 0 ? (
              <p className="text-xs text-slate-500">
                এখনো কোনো Supabase ইম্পোর্ট ব্যাচ রেকর্ড পাওয়া যায়নি।
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {importBatches.map((b) => (
                  <div key={b.id} className="py-2.5 space-y-0.5">
                    <div className="font-semibold text-slate-900">{b.filename}</div>
                    <div className="text-slate-600 tabular-nums">
                      মোড: {b.import_mode} · নতুন: {b.inserted_count} · আপডেট: {b.updated_count} · স্কিপ: {b.skipped_count}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {b.imported_by_email} · {new Date(b.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-900">
              অডিট লগ (Admin Activity)
            </h2>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">
                কোনো অডিট লগ পাওয়া যায়নি (Supabase সংযুক্ত হলে স্বয়ংক্রিয়ভাবে লগ হবে)।
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-2.5 space-y-0.5">
                    <div className="font-semibold text-slate-900">
                      {log.action} · <span className="font-mono">{log.entity_id ?? ''}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {log.actor_email} · {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {editingInstitution !== undefined && (
        <InstitutionEditModal
          institution={editingInstitution}
          readOnlyPreview={isPreviewReadOnly}
          onClose={() => setEditingInstitution(undefined)}
          onSaved={() => {
            setEditingInstitution(undefined);
            setActionMessage('প্রতিষ্ঠানের তথ্য সফলভাবে আপডেট হয়েছে।');
            void loadDashboardData();
            void refreshManageList();
          }}
        />
      )}

      {editingOffice && (
        <OfficeEditModal
          office={editingOffice}
          onClose={() => setEditingOffice(null)}
          onSaved={() => {
            setEditingOffice(null);
            setActionMessage('শিক্ষা অফিসের তথ্য সফলভাবে আপডেট হয়েছে।');
            void loadDashboardData();
          }}
        />
      )}
    </div>
  );
}
