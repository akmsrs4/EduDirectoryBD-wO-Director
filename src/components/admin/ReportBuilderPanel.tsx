import React, { useEffect, useMemo, useState } from 'react';
import {
  BookmarkPlus,
  Download,
  FileText,
  Printer,
  Trash2,
} from 'lucide-react';
import {
  DEFAULT_REPORT_CONFIG,
  REPORT_COLUMNS_META,
  deleteReportTemplate,
  exportReportToCsv,
  exportReportToExcel,
  formatReportCell,
  generateAdminReportRows,
  getColumnHeader,
  listReportTemplates,
  saveReportTemplate,
  type SavedReportTemplate,
} from '../../services/reports';
import {
  INSTITUTION_CATEGORIES,
  type Institution,
  type ReportColumnKey,
  type ReportConfig,
  type ReportLanguage,
} from '../../types/institution';
import { toBanglaNumber } from '../../utils/bangla';

interface ReportBuilderPanelProps {
  institutions: Institution[];
  readOnlyPreview: boolean;
}

export function ReportBuilderPanel({
  institutions,
  readOnlyPreview,
}: ReportBuilderPanelProps) {
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_REPORT_CONFIG);
  const [rows, setRows] = useState<Institution[]>([]);
  const [generating, setGenerating] = useState(false);
  const [templates, setTemplates] = useState<SavedReportTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const districts = useMemo(
    () => [...new Set(institutions.map((i) => i.district).filter(Boolean))].sort(),
    [institutions]
  );

  const upazilas = useMemo(() => {
    if (!config.filters.district) return [];
    return [
      ...new Set(
        institutions
          .filter((i) => i.district === config.filters.district)
          .map((i) => i.upazila)
          .filter(Boolean)
      ),
    ].sort();
  }, [institutions, config.filters.district]);

  useEffect(() => {
    listReportTemplates()
      .then(setTemplates)
      .catch(() => {
        // Ignore
      });
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateAdminReportRows(config);
      setRows(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'রিপোর্ট তৈরি করতে সমস্যা হয়েছে।');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    void handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleColumn = (key: ReportColumnKey) => {
    setConfig((prev) => {
      const exists = prev.columns.includes(key);
      if (exists && prev.columns.length <= 1) return prev;
      return {
        ...prev,
        columns: exists
          ? prev.columns.filter((c) => c !== key)
          : [...prev.columns, key],
      };
    });
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    try {
      const saved = await saveReportTemplate(templateName.trim(), config);
      setTemplates((prev) => [saved, ...prev]);
      setTemplateName('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'টেমপ্লেট সংরক্ষণ করা যায়নি।');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteReportTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls (Hidden when printing) */}
      <div className="no-print space-y-5">
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                অ্যাডমিন কাস্টম রিপোর্ট বিল্ডার
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                শুধুমাত্র অনুমোদিত অ্যাডমিনদের জন্য। রিপোর্টের ভাষা (বাংলা / English / উভয়) স্বাধীনভাবে নির্বাচন করে Excel, CSV বা প্রিন্ট PDF তৈরি করুন।
              </p>
            </div>
            {readOnlyPreview && (
              <span className="text-xs font-semibold text-amber-700">
                প্রিভিউ মোড · টেমপ্লেট লোকালি সংরক্ষিত হবে
              </span>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          {/* Title, Subtitle & Independent Report Language */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                রিপোর্টের শিরোনাম (Custom Title)
              </label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => setConfig((p) => ({ ...p, title: e.target.value }))}
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                উপ-শিরোনাম (Subtitle)
              </label>
              <input
                type="text"
                value={config.subtitle ?? ''}
                onChange={(e) => setConfig((p) => ({ ...p, subtitle: e.target.value }))}
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                রিপোর্টের ভাষা (Report Language)
              </label>
              <select
                value={config.language}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, language: e.target.value as ReportLanguage }))
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 text-sm bg-white font-semibold"
              >
                <option value="bn">বাংলা (Bangla Only)</option>
                <option value="en">English (English Only)</option>
                <option value="both">বাংলা ও English (Bilingual)</option>
              </select>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">জেলা</label>
              <select
                value={config.filters.district ?? ''}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    filters: { ...p.filters, district: e.target.value, upazila: '' },
                  }))
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="">সকল জেলা</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">উপজেলা</label>
              <select
                value={config.filters.upazila ?? ''}
                disabled={!config.filters.district}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    filters: { ...p.filters, upazila: e.target.value },
                  }))
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 text-xs bg-white disabled:bg-slate-100"
              >
                <option value="">সকল উপজেলা</option>
                {upazilas.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ক্যাটাগরি</label>
              <select
                value={config.filters.refined_category ?? ''}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    filters: { ...p.filters, refined_category: e.target.value },
                  }))
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="">সকল ক্যাটাগরি</option>
                <option value="UNASSIGNED">ক্যাটাগরি যাচাই বাকি</option>
                {INSTITUTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ব্যবস্থাপনা</label>
              <select
                value={config.filters.management ?? ''}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    filters: { ...p.filters, management: e.target.value },
                  }))
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="">সকল</option>
                <option value="Govt.">সরকারি (Govt.)</option>
                <option value="Non-Govt.">বেসরকারি (Non-Govt.)</option>
                <option value="Autonomous">স্বায়ত্তশাসিত</option>
                <option value="Local Govt.">স্থানীয় সরকার</option>
                <option value="Others">অন্যান্য</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ক্রমানুসারে (Sort)</label>
              <select
                value={config.sortBy}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    sortBy: e.target.value as ReportConfig['sortBy'],
                  }))
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="district">জেলা অনুযায়ী</option>
                <option value="upazila">উপজেলা অনুযায়ী</option>
                <option value="name_en">নাম (English)</option>
                <option value="name_bn">নাম (বাংলা)</option>
                <option value="eiin">EIIN অনুযায়ী</option>
              </select>
            </div>
          </div>

          {/* Column Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              রিপোর্টের কলাম নির্বাচন করুন
            </label>
            <div className="flex flex-wrap gap-2">
              {REPORT_COLUMNS_META.map((col) => {
                const checked = config.columns.includes(col.key);
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => toggleColumn(col.key)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      checked
                        ? 'border-blue-700 bg-blue-50 text-blue-800 font-semibold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {col.labelBn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Bar & Saved Templates */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerate}
                className="px-4 min-h-[42px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                <span>{generating ? 'তৈরি হচ্ছে...' : 'রিপোর্ট তৈরি / আপডেট করুন'}</span>
              </button>

              <button
                type="button"
                disabled={rows.length === 0}
                onClick={() => exportReportToExcel(config, rows)}
                className="px-4 min-h-[42px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                disabled={rows.length === 0}
                onClick={() => exportReportToCsv(config, rows)}
                className="px-4 min-h-[42px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>CSV</span>
              </button>

              <button
                type="button"
                disabled={rows.length === 0}
                onClick={() => window.print()}
                className="px-4 min-h-[42px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>প্রিন্ট / PDF সংরক্ষণ</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="টেমপ্লেটের নাম লিখুন..."
                className="min-h-[38px] px-3 rounded-lg border border-slate-300 text-xs"
              />
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="px-3 min-h-[38px] rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 inline-flex items-center gap-1"
              >
                <BookmarkPlus className="w-4 h-4 text-blue-700" />
                <span>টেমপ্লেট সেভ</span>
              </button>
            </div>
          </div>

          {templates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs font-semibold text-slate-500">সংরক্ষিত টেমপ্লেট:</span>
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="inline-flex items-center gap-1 border border-slate-200 rounded-lg px-2.5 py-1 bg-slate-50 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => setConfig(tpl.config_json)}
                    className="font-semibold text-blue-700 hover:underline"
                  >
                    {tpl.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteTemplate(tpl.id)}
                    className="text-slate-400 hover:text-red-700 p-0.5"
                    title="মুছুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Print-Ready & Live Report Preview */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900">{config.title}</h3>
            {config.subtitle && <p className="text-xs text-slate-600">{config.subtitle}</p>}
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            মোট রেকর্ড: {toBanglaNumber(rows.length)} · তারিখ:{' '}
            {new Date().toLocaleDateString('en-GB')}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="print-table w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {config.columns.map((col) => (
                  <th key={col} className="py-2.5 px-3 font-semibold text-slate-700">
                    {getColumnHeader(col, config.language)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 150).map((inst, idx) => (
                <tr key={inst.id}>
                  {config.columns.map((col) => (
                    <td key={col} className="py-2 px-3 text-slate-800">
                      {formatReportCell(inst, idx, col, config.language)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 150 && (
            <p className="no-print text-xs text-slate-500 mt-3">
              ব্রাউজার প্রিভিউতে প্রথম ১৫০টি সারি দেখানো হচ্ছে; Excel বা CSV এক্সপোর্টে সম্পূর্ণ{' '}
              {toBanglaNumber(rows.length)}টি সারিই থাকবে (প্রিন্ট করতে ফিল্টার সংকুচিত করুন)।
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
