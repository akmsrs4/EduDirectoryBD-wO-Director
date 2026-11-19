import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FileUp,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import {
  FIELD_DEFINITIONS,
  buildImportPreview,
  downloadExcelImportTemplate,
  executeBatchImportToSupabase,
  exportInstitutionsToCsv,
  exportInstitutionsToExcel,
  exportInstitutionsToJsonBackup,
  parseImportFile,
  type ImportPreviewReport,
  type ParsedWorkbookData,
  type TemplateFieldKey,
} from '../../services/excel';
import { fetchAllInstitutionsAdmin } from '../../services/institutions';
import {
  INSTITUTION_CATEGORIES,
  type ImportMode,
  type Institution,
} from '../../types/institution';
import { toBanglaNumber } from '../../utils/bangla';
import {
  isCategoryUnassigned,
  isHeadNameMissing,
  isValidEmail,
  normalizeBangladeshiPhone,
  sanitizeEiin,
} from '../../utils/validators';

interface ExcelImportExportPanelProps {
  institutions: Institution[];
  readOnlyPreview: boolean;
  onImportCompleted: () => void;
}

export function ExcelImportExportPanel({
  institutions,
  readOnlyPreview,
  onImportCompleted,
}: ExcelImportExportPanelProps) {
  // Import state
  const [parsed, setParsed] = useState<ParsedWorkbookData | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<TemplateFieldKey, string>>>({});
  const [mode, setMode] = useState<ImportMode>('merge_update');
  const [overwriteManual, setOverwriteManual] = useState(true);
  const [replaceConfirmText, setReplaceConfirmText] = useState('');
  const [preview, setPreview] = useState<ImportPreviewReport | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [importResult, setImportResult] = useState<{
    inserted: number;
    updated: number;
    skipped: number;
    warnings: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Export filter state
  const [expDistrict, setExpDistrict] = useState('');
  const [expCategory, setExpCategory] = useState('');
  const [expOnlyIncomplete, setExpOnlyIncomplete] = useState(false);

  const districts = useMemo(
    () => [...new Set(institutions.map((i) => i.district).filter(Boolean))].sort(),
    [institutions]
  );

  const handleFileSelected = async (file: File) => {
    setParsing(true);
    setImportError(null);
    setImportResult(null);
    setPreview(null);
    try {
      const wbData = await parseImportFile(file);
      setParsed(wbData);
      setMapping(wbData.columnMapping);
      const initialPreview = buildImportPreview(
        wbData.rawRows,
        wbData.columnMapping,
        institutions,
        mode,
        overwriteManual
      );
      setPreview(initialPreview);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'ফাইল পড়া সম্ভব হয়নি।');
    } finally {
      setParsing(false);
    }
  };

  const handleLoadSourceCsv = async () => {
    setParsing(true);
    setImportError(null);
    try {
      const resp = await fetch('/assets/aistudio/working_rangpur_institute_csv_c574002b.csv');
      if (!resp.ok) throw new Error('মূল CSV ফাইল লোড করা যায়নি।');
      const blob = await resp.blob();
      const file = new File([blob], 'working_rangpur_institute_csv.csv', {
        type: 'text/csv',
      });
      const wbData = await parseImportFile(file);
      setMode('seed_csv');
      setOverwriteManual(false);
      setParsed(wbData);
      setMapping(wbData.columnMapping);
      setPreview(
        buildImportPreview(
          wbData.rawRows,
          wbData.columnMapping,
          institutions,
          'seed_csv',
          false
        )
      );
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'CSV লোড ব্যর্থ হয়েছে।');
    } finally {
      setParsing(false);
    }
  };

  const recomputePreview = (
    nextMapping = mapping,
    nextMode = mode,
    nextOverwrite = overwriteManual
  ) => {
    if (!parsed) return;
    setPreview(
      buildImportPreview(
        parsed.rawRows,
        nextMapping,
        institutions,
        nextMode,
        nextOverwrite
      )
    );
  };

  const handleRunImport = async () => {
    if (!preview || !parsed) return;
    if (readOnlyPreview) {
      setImportError(
        'কেন্দ্রীয় ডাটাবেস সংযোগ সক্রিয় না থাকায় রিড-অনলি প্রিভিউ মোডে পরিবর্তন সংরক্ষণ করা যাবে না।'
      );
      return;
    }
    if (mode === 'full_replace' && replaceConfirmText.trim() !== 'REPLACE ALL') {
      setImportError('সম্পূর্ণ প্রতিস্থাপন মোডের জন্য নিচে "REPLACE ALL" টাইপ করে নিশ্চিত করুন।');
      return;
    }

    setImporting(true);
    setImportError(null);
    setProgress({ done: 0, total: preview.insertCount + preview.updateCount });
    try {
      if (mode === 'full_replace') {
        const allBackup = await fetchAllInstitutionsAdmin({ include_inactive: true });
        exportInstitutionsToJsonBackup(
          allBackup,
          `Pre_Replace_Backup_${new Date().toISOString().slice(0, 10)}.json`
        );
      }

      const res = await executeBatchImportToSupabase({
        filename: parsed.filename,
        mode,
        overwriteManual,
        validRows: preview.rows,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setImportResult(res);
      onImportCompleted();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'ব্যাচ ইম্পোর্ট ব্যর্থ হয়েছে।');
    } finally {
      setImporting(false);
    }
  };

  const filteredForExport = useMemo(() => {
    return institutions.filter((inst) => {
      if (!inst.is_active) return false;
      if (expDistrict && inst.district !== expDistrict) return false;
      if (expCategory) {
        if (expCategory === 'UNASSIGNED') {
          if (!isCategoryUnassigned(inst.refined_category)) return false;
        } else if (inst.refined_category !== expCategory) {
          return false;
        }
      }
      if (expOnlyIncomplete) {
        const incomplete =
          !sanitizeEiin(inst.eiin) ||
          !normalizeBangladeshiPhone(inst.mobile_raw).isValidForCall ||
          !isValidEmail(inst.email) ||
          isHeadNameMissing(inst.head_name) ||
          isCategoryUnassigned(inst.refined_category);
        if (!incomplete) return false;
      }
      return true;
    });
  }, [institutions, expDistrict, expCategory, expOnlyIncomplete]);

  return (
    <div className="space-y-6">
      {/* Top Action Cards: Download Template + Export */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                অফিসিয়াল Excel Import Template
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                ২টি শিট (Institution Data ও Instructions), ড্রপডাউন ভ্যালিডেশন, এবং মোবাইল/EIIN-এর শূন্য সংরক্ষণের জন্য Text ফরম্যাটসহ রেডি টেমপ্লেট।
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={downloadExcelImportTemplate}
              className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>ডাউনলোড Excel Import Template</span>
            </button>

            <button
              type="button"
              disabled={parsing}
              onClick={handleLoadSourceCsv}
              className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors"
            >
              <Database className="w-4 h-4 text-blue-700" />
              <span>মূল ৪,৪১৪ CSV সিড প্রিভিউ লোড করুন</span>
            </button>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                ডাটা এক্সপোর্ট ও পূর্ণাঙ্গ ব্যাকআপ
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Record ID-সহ এক্সপোর্ট করুন যাতে অফলাইনে এডিট করে পুনরায় নিরাপদে আপডেট করা যায়।
              </p>
            </div>
            <span className="font-mono-tabular text-xs font-bold text-blue-700">
              {toBanglaNumber(filteredForExport.length)}টি রেকর্ড
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <select
              value={expDistrict}
              onChange={(e) => setExpDistrict(e.target.value)}
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
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
              className="min-h-[40px] px-3 rounded-lg border border-slate-300 text-xs bg-white"
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

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={expOnlyIncomplete}
              onChange={(e) => setExpOnlyIncomplete(e.target.checked)}
              className="rounded border-slate-300 text-blue-700"
            />
            <span>শুধুমাত্র অসম্পূর্ণ বা যাচাই বাকি রেকর্ড এক্সপোর্ট করুন</span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportInstitutionsToExcel(filteredForExport)}
              className="px-3.5 min-h-[40px] rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={() => exportInstitutionsToCsv(filteredForExport)}
              className="px-3.5 min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <span>CSV (UTF-8)</span>
            </button>
            <button
              type="button"
              onClick={() => exportInstitutionsToJsonBackup(institutions)}
              className="px-3.5 min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <span>পূর্ণ JSON ব্যাকআপ</span>
            </button>
          </div>
        </section>
      </div>

      {/* 10-Step Safe Import Pipeline */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              নিরাপদ Excel / CSV বাল্ক ইম্পোর্ট উইজার্ড
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              ফাইল নির্বাচন করুন → কলাম যাচাই করুন → ডুপ্লিকেট ও পরিবর্তন (Diff) দেখুন → নিরাপদ ব্যাচ ইম্পোর্ট করুন।
            </p>
          </div>

          <label className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-xl bg-slate-900 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer transition-colors shrink-0">
            <FileUp className="w-4 h-4" />
            <span>{parsing ? 'পড়া হচ্ছে...' : 'Excel / CSV ফাইল আপলোড'}</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileSelected(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>

        {importError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
            {importError}
          </div>
        )}

        {importResult && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <div className="space-y-1">
              <div className="font-bold">ব্যাচ ইম্পোর্ট সফলভাবে সম্পন্ন হয়েছে!</div>
              <div className="tabular-nums">
                নতুন যুক্ত: {toBanglaNumber(importResult.inserted)} · আপডেট:{' '}
                {toBanglaNumber(importResult.updated)} · স্কিপ:{' '}
                {toBanglaNumber(importResult.skipped)} · সতর্কতা:{' '}
                {toBanglaNumber(importResult.warnings)}
              </div>
            </div>
          </div>
        )}

        {parsed && preview && (
          <div className="space-y-5 pt-2 border-t border-slate-100">
            {/* Step 3 & 4: Mode + Overwrite Protection + Column Mapping */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  ইম্পোর্ট মোড নির্বাচন করুন
                </label>
                <select
                  value={mode}
                  onChange={(e) => {
                    const nextMode = e.target.value as ImportMode;
                    setMode(nextMode);
                    recomputePreview(mapping, nextMode, overwriteManual);
                  }}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-xs bg-white font-medium"
                >
                  <option value="merge_update">A. বিদ্যমান তথ্য মার্জ ও আপডেট (Merge/Update)</option>
                  <option value="add_new_only">B. শুধুমাত্র নতুন প্রতিষ্ঠান যোগ (Add New Only)</option>
                  <option value="full_replace">C. সুরক্ষিত পূর্ণ প্রতিস্থাপন (Full Replace)</option>
                  <option value="seed_csv">মূল CSV প্রাথমিক সিড (Seed Mode)</option>
                </select>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <label className="block text-xs font-bold text-slate-700">
                  সুরক্ষা নীতি (Data Safety Guard)
                </label>
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overwriteManual}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setOverwriteManual(next);
                      recomputePreview(mapping, mode, next);
                    }}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span>
                    <strong>সর্বশেষ তথ্য দিয়ে আপডেট অনুমতি (Latest Update Wins):</strong> চালু থাকলে রিপিট হওয়া EIIN বা প্রতিষ্ঠানের ক্ষেত্রে নতুন ফাইলের অ-খালি (non-empty) তথ্য পূর্বের তথ্যকে আপডেট করবে। খালি সেল বা প্লেসহোল্ডার কখনো পূর্বের তথ্য মুছবে না এবং তালিকার বাইরের বাকি সব প্রতিষ্ঠান অপরিবর্তিত থাকবে।
                  </span>
                </label>
              </div>
            </div>

            {mode === 'full_replace' && (
              <div className="p-4 rounded-xl border border-red-200 bg-red-50 space-y-2 text-xs text-red-900">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldAlert className="w-4 h-4 text-red-700" />
                  <span>সতর্কতা: পূর্ণ প্রতিস্থাপন মোড!</span>
                </div>
                <p>
                  এই মোডে নতুন ফাইলে না থাকা পুরোনো রেকর্ডগুলো নিষ্ক্রিয় (Archived) হবে এবং শুরুতে স্বয়ংক্রিয়ভাবে একটি পূর্ণ JSON ব্যাকআপ ডাউনলোড হবে। নিশ্চিত করতে নিচে{' '}
                  <code className="font-mono bg-red-100 px-1 rounded">REPLACE ALL</code> লিখুন:
                </p>
                <input
                  type="text"
                  value={replaceConfirmText}
                  onChange={(e) => setReplaceConfirmText(e.target.value)}
                  placeholder="REPLACE ALL"
                  className="min-h-[38px] px-3 rounded-lg border border-red-300 bg-white font-mono text-xs"
                />
              </div>
            )}

            {/* Compact Column Mapper */}
            <details className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <summary className="text-xs font-bold text-slate-800 cursor-pointer">
                কলাম ম্যাপিং দেখুন / পরিবর্তন করুন ({parsed.filename} · {toBanglaNumber(parsed.rawRows.length)} সারি)
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                {FIELD_DEFINITIONS.map((field) => (
                  <div key={field.key}>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {field.labelBn} {field.required ? '*' : ''}
                    </label>
                    <select
                      value={mapping[field.key] ?? ''}
                      onChange={(e) => {
                        const nextMap = { ...mapping, [field.key]: e.target.value || undefined };
                        setMapping(nextMap);
                        recomputePreview(nextMap, mode, overwriteManual);
                      }}
                      className="w-full min-h-[36px] px-2 rounded-lg border border-slate-300 bg-white text-xs"
                    >
                      <option value="">-- ম্যাপ করা হয়নি --</option>
                      {parsed.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </details>

            {/* Preview Summary Counts */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="border border-slate-200 rounded-xl p-3">
                <div className="text-[11px] text-slate-500">মোট সারি</div>
                <div className="text-lg font-bold text-slate-900 tabular-nums">
                  {toBanglaNumber(preview.totalRows)}
                </div>
              </div>
              <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3">
                <div className="text-[11px] text-emerald-700">নতুন যোগ হবে</div>
                <div className="text-lg font-bold text-emerald-800 tabular-nums">
                  {toBanglaNumber(preview.insertCount)}
                </div>
              </div>
              <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-3">
                <div className="text-[11px] text-blue-700">আপডেট / মার্জ</div>
                <div className="text-lg font-bold text-blue-800 tabular-nums">
                  {toBanglaNumber(preview.updateCount)}
                </div>
              </div>
              <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-3">
                <div className="text-[11px] text-amber-700">সতর্কতা / স্কিপ</div>
                <div className="text-lg font-bold text-amber-800 tabular-nums">
                  {toBanglaNumber(preview.warningCount + preview.skipCount)}
                </div>
              </div>
              <div className="border border-red-200 bg-red-50/40 rounded-xl p-3">
                <div className="text-[11px] text-red-700">ত্রুটিপূর্ণ সারি</div>
                <div className="text-lg font-bold text-red-800 tabular-nums">
                  {toBanglaNumber(preview.errorCount)}
                </div>
              </div>
            </div>

            {/* Diff & Validation Preview Table (First 40 rows) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>প্রিভিউ ও পরিবর্তন যাচাই (প্রথম ৪০টি সারি)</span>
                <button
                  type="button"
                  onClick={() => recomputePreview()}
                  className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>পুনরায় যাচাই</span>
                </button>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">সারি</th>
                      <th className="py-2 px-3">অ্যাকশন</th>
                      <th className="py-2 px-3">EIIN</th>
                      <th className="py-2 px-3">প্রতিষ্ঠান</th>
                      <th className="py-2 px-3">পরিবর্তন (Diff) ও মন্তব্য</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.slice(0, 40).map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="py-2 px-3 font-mono-tabular">#{row.rowNumber}</td>
                        <td className="py-2 px-3 font-semibold whitespace-nowrap">
                          {row.status === 'insert' && <span className="text-emerald-700">নতুন যোগ</span>}
                          {row.status === 'update' && (
                            <span className="text-blue-700">আপডেট ({row.matchMethod})</span>
                          )}
                          {row.status === 'skip' && <span className="text-slate-500">স্কিপ</span>}
                          {row.status === 'warning' && (
                            <span className="text-amber-700">সতর্কতা</span>
                          )}
                          {row.status === 'error' && <span className="text-red-700">ত্রুটি</span>}
                        </td>
                        <td className="py-2 px-3 font-mono-tabular">
                          {row.candidate.eiin ?? '—'}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-slate-900">
                            {row.candidate.name_bn || row.candidate.name_en}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {row.candidate.upazila}, {row.candidate.district}
                          </div>
                        </td>
                        <td className="py-2 px-3 space-y-1">
                          {row.changes.map((c, idx) => (
                            <div key={idx} className="text-[11px]">
                              <strong>{c.field}:</strong>{' '}
                              <span className="text-slate-400 line-through">{c.from}</span> →{' '}
                              <span className="text-blue-700 font-medium">{c.to}</span>
                            </div>
                          ))}
                          {row.reasons.map((r, idx) => (
                            <div key={idx} className="text-[11px] text-amber-800">
                              {r}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Batch Import Progress & Confirm Action */}
            {importing && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700 tabular-nums">
                  <span>Supabase ডাটাবেসে ব্যাচ ইম্পোর্ট চলছে...</span>
                  <span>
                    {toBanglaNumber(progress.done)} / {toBanglaNumber(progress.total)}
                  </span>
                </div>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-700 transition-all"
                    style={{
                      width: `${
                        progress.total > 0
                          ? Math.round((progress.done / progress.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              {readOnlyPreview && (
                <div className="flex items-center gap-2 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Supabase সংযোগ না থাকায় এখন শুধুমাত্র প্রিভিউ ও যাচাই পরীক্ষা করা যাচ্ছে।</span>
                </div>
              )}

              <button
                type="button"
                disabled={
                  importing ||
                  readOnlyPreview ||
                  preview.insertCount + preview.updateCount === 0
                }
                onClick={handleRunImport}
                className="ml-auto inline-flex items-center gap-2 px-5 min-h-[44px] rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-sm font-semibold transition-colors"
              >
                <FileUp className="w-4 h-4" />
                <span>
                  {importing
                    ? 'ইম্পোর্ট হচ্ছে...'
                    : `নিশ্চিত করুন ও ইম্পোর্ট চালান (${toBanglaNumber(
                        preview.insertCount + preview.updateCount
                      )}টি রেকর্ড)`}
                </span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
