import * as XLSX from 'xlsx';
import { getSupabaseClient } from '../lib/supabase';
import {
  CATEGORY_LABELS_EN,
  type Institution,
  type InstitutionCategoryName,
  type ReportColumnKey,
  type ReportConfig,
  type ReportLanguage,
} from '../types/institution';
import {
  toBanglaNumber,
  translateManagement,
  translateMpoStatus,
  translateOriginalType,
  translateVerification,
} from '../utils/bangla';
import {
  UNASSIGNED_CATEGORY_MESSAGE_BN,
  UNASSIGNED_CATEGORY_MESSAGE_EN,
  UNASSIGNED_HEAD_MESSAGE_BN,
  UNASSIGNED_HEAD_MESSAGE_EN,
  isValidEmail,
  sanitizeHeadName,
} from '../utils/validators';
import { fetchAllInstitutionsAdmin } from './institutions';
import { triggerBlobDownload } from './excel';

export const REPORT_COLUMNS_META: Array<{
  key: ReportColumnKey;
  labelBn: string;
  labelEn: string;
}> = [
  { key: 'serial_no', labelBn: 'ক্র.নং', labelEn: 'SL' },
  { key: 'eiin', labelBn: 'EIIN', labelEn: 'EIIN' },
  { key: 'name_bn', labelBn: 'প্রতিষ্ঠানের নাম (বাংলায়)', labelEn: 'Institution Name (Bangla)' },
  { key: 'name_en', labelBn: 'প্রতিষ্ঠানের নাম (ইংরেজিতে)', labelEn: 'Institution Name (English)' },
  { key: 'original_type', labelBn: 'মূল ধরন', labelEn: 'Original Type' },
  { key: 'refined_category', labelBn: 'পরিশোধিত ক্যাটাগরি', labelEn: 'Refined Category' },
  { key: 'management', labelBn: 'ব্যবস্থাপনা', labelEn: 'Management' },
  { key: 'district', labelBn: 'জেলা', labelEn: 'District' },
  { key: 'upazila', labelBn: 'উপজেলা/থানা', labelEn: 'Upazila' },
  { key: 'head_name', labelBn: 'প্রতিষ্ঠান প্রধান', labelEn: 'Head of Institution' },
  { key: 'head_designation', labelBn: 'পদবি', labelEn: 'Designation' },
  { key: 'mobile_raw', labelBn: 'মোবাইল', labelEn: 'Mobile' },
  { key: 'phone_raw', labelBn: 'ফোন', labelEn: 'Phone' },
  { key: 'email', labelBn: 'ইমেইল', labelEn: 'Email' },
  { key: 'mpo_code', labelBn: 'এমপিও কোড', labelEn: 'MPO Code' },
  { key: 'mpo_status', labelBn: 'এমপিও অবস্থা', labelEn: 'MPO Status' },
  { key: 'verification_status', labelBn: 'যাচাই অবস্থা', labelEn: 'Verification' },
];

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  name: 'স্ট্যান্ডার্ড প্রতিষ্ঠান রিপোর্ট',
  title: 'শিক্ষা প্রতিষ্ঠান ডিরেক্টরি রিপোর্ট — EduDirectory BD',
  subtitle: 'রংপুর অঞ্চল ভিত্তিক যাচাইকৃত ও চলমান তালিকা',
  language: 'bn',
  filters: {},
  columns: [
    'serial_no',
    'eiin',
    'name_bn',
    'name_en',
    'refined_category',
    'management',
    'district',
    'upazila',
    'mobile_raw',
    'mpo_status',
  ],
  sortBy: 'district',
  sortOrder: 'asc',
};

export function getColumnHeader(key: ReportColumnKey, lang: ReportLanguage): string {
  const meta = REPORT_COLUMNS_META.find((c) => c.key === key);
  if (!meta) return key;
  if (lang === 'bn') return meta.labelBn;
  if (lang === 'en') return meta.labelEn;
  return `${meta.labelBn} / ${meta.labelEn}`;
}

export function formatReportCell(
  inst: Institution,
  rowIndex: number,
  key: ReportColumnKey,
  lang: ReportLanguage
): string {
  switch (key) {
    case 'serial_no':
      return lang === 'bn' ? toBanglaNumber(rowIndex + 1) : String(rowIndex + 1);
    case 'eiin':
      return inst.eiin ?? '—';
    case 'name_bn':
      return inst.name_bn ?? '—';
    case 'name_en':
      return inst.name_en;
    case 'original_type':
      if (lang === 'bn') return translateOriginalType(inst.original_type, 'bn');
      if (lang === 'en') return translateOriginalType(inst.original_type, 'en');
      return `${translateOriginalType(inst.original_type, 'bn')} (${inst.original_type ?? 'N/A'})`;
    case 'refined_category': {
      const cat = inst.refined_category as InstitutionCategoryName | null;
      if (!cat) {
        if (lang === 'bn') return UNASSIGNED_CATEGORY_MESSAGE_BN;
        if (lang === 'en') return UNASSIGNED_CATEGORY_MESSAGE_EN;
        return `${UNASSIGNED_CATEGORY_MESSAGE_BN} / ${UNASSIGNED_CATEGORY_MESSAGE_EN}`;
      }
      const en = CATEGORY_LABELS_EN[cat] ?? cat;
      if (lang === 'bn') return cat;
      if (lang === 'en') return en;
      return `${cat} (${en})`;
    }
    case 'management':
      if (lang === 'bn') return translateManagement(inst.management, 'bn');
      if (lang === 'en') return translateManagement(inst.management, 'en');
      return `${translateManagement(inst.management, 'bn')} (${inst.management ?? 'N/A'})`;
    case 'district':
      return inst.district;
    case 'upazila':
      return inst.upazila;
    case 'head_name': {
      const clean = sanitizeHeadName(inst.head_name);
      if (clean) return clean;
      if (lang === 'bn') return UNASSIGNED_HEAD_MESSAGE_BN;
      if (lang === 'en') return UNASSIGNED_HEAD_MESSAGE_EN;
      return `${UNASSIGNED_HEAD_MESSAGE_BN} (${UNASSIGNED_HEAD_MESSAGE_EN})`;
    }
    case 'head_designation':
      return inst.head_designation ?? '—';
    case 'mobile_raw':
      return inst.mobile_raw ?? '—';
    case 'phone_raw':
      return inst.phone_raw ?? '—';
    case 'email':
      return isValidEmail(inst.email) ? inst.email! : '—';
    case 'mpo_code':
      return inst.mpo_code ?? '—';
    case 'mpo_status':
      if (lang === 'bn') return translateMpoStatus(inst.mpo_status, 'bn');
      if (lang === 'en') return translateMpoStatus(inst.mpo_status, 'en');
      return inst.mpo_status ?? '—';
    case 'verification_status':
      if (lang === 'bn') return translateVerification(inst.verification_status, 'bn');
      if (lang === 'en') return translateVerification(inst.verification_status, 'en');
      return `${translateVerification(inst.verification_status, 'bn')} (${inst.verification_status})`;
  }
}

export async function generateAdminReportRows(config: ReportConfig): Promise<Institution[]> {
  const supabase = getSupabaseClient();
  let rows: Institution[] = [];

  if (supabase) {
    // Strictly call admin-gated RPC so DB enforces admin privileges
    const { data, error } = await supabase.rpc('admin_generate_report_rows', {
      p_filters: config.filters,
    });
    if (error) throw error;
    rows = (data ?? []) as Institution[];
  } else {
    rows = await fetchAllInstitutionsAdmin({
      district: config.filters.district,
      upazila: config.filters.upazila,
      refined_category: config.filters.refined_category,
      management: config.filters.management,
      mpo_status: config.filters.mpo_status,
      verification_status: config.filters.verification_status as Institution['verification_status'] | '',
      include_inactive: config.filters.include_inactive,
    });
  }

  const dir = config.sortOrder === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    const va = String(a[config.sortBy] ?? '');
    const vb = String(b[config.sortBy] ?? '');
    return va.localeCompare(vb, 'bn') * dir;
  });

  return rows;
}

export function exportReportToExcel(config: ReportConfig, rows: Institution[]): void {
  const headers = config.columns.map((c) => getColumnHeader(c, config.language));
  const dataMatrix: string[][] = [
    [config.title],
    [config.subtitle || `Generated: ${new Date().toLocaleDateString('en-GB')}`],
    [],
    headers,
    ...rows.map((inst, idx) =>
      config.columns.map((col) => formatReportCell(inst, idx, col, config.language))
    ),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(dataMatrix);
  ws['!cols'] = config.columns.map((col) => ({
    wch: col === 'name_bn' || col === 'name_en' ? 36 : col === 'refined_category' ? 28 : 18,
  }));

  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  const safeName = (config.name || 'EduDirectory_Report').replace(/[^\w\u0980-\u09FF-]+/g, '_');
  XLSX.writeFile(wb, `${safeName}.xlsx`);
}

export function exportReportToCsv(config: ReportConfig, rows: Institution[]): void {
  const headers = config.columns.map((c) => getColumnHeader(c, config.language));
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(',')];

  rows.forEach((inst, idx) => {
    lines.push(
      config.columns
        .map((col) => esc(formatReportCell(inst, idx, col, config.language)))
        .join(',')
    );
  });

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const safeName = (config.name || 'EduDirectory_Report').replace(/[^\w\u0980-\u09FF-]+/g, '_');
  triggerBlobDownload(blob, `${safeName}.csv`);
}

export interface SavedReportTemplate {
  id: string;
  name: string;
  description?: string | null;
  config_json: ReportConfig;
  created_at: string;
}

const LOCAL_TEMPLATES_KEY = 'edudirectory_report_templates_v1';

export async function listReportTemplates(): Promise<SavedReportTemplate[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('report_templates')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as SavedReportTemplate[];
  }
  try {
    const raw = localStorage.getItem(LOCAL_TEMPLATES_KEY);
    return raw ? (JSON.parse(raw) as SavedReportTemplate[]) : [];
  } catch {
    return [];
  }
}

export async function saveReportTemplate(
  name: string,
  config: ReportConfig
): Promise<SavedReportTemplate> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('report_templates')
      .insert({ name, config_json: config })
      .select('*')
      .single();
    if (error) throw error;
    return data as SavedReportTemplate;
  }

  const item: SavedReportTemplate = {
    id: crypto.randomUUID(),
    name,
    config_json: config,
    created_at: new Date().toISOString(),
  };
  const existing = await listReportTemplates();
  localStorage.setItem(LOCAL_TEMPLATES_KEY, JSON.stringify([item, ...existing]));
  return item;
}

export async function deleteReportTemplate(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from('report_templates').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const existing = await listReportTemplates();
  localStorage.setItem(
    LOCAL_TEMPLATES_KEY,
    JSON.stringify(existing.filter((t) => t.id !== id))
  );
}
