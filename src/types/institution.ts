export type VerificationStatus = 'verified' | 'pending' | 'needs_review';

export type UiLanguage = 'bn' | 'en';
export type ReportLanguage = 'bn' | 'en' | 'both';

export const INSTITUTION_CATEGORIES = [
  'সরকারি কলেজ',
  'বেসরকারি ডিগ্রি কলেজ',
  'বেসরকারি উচ্চ মাধ্যমিক কলেজ',
  'সরকারি স্কুল অ্যান্ড কলেজ',
  'বেসরকারি স্কুল অ্যান্ড কলেজ',
  'সরকারি উচ্চ বিদ্যালয়',
  'বেসরকারি উচ্চ বিদ্যালয়',
  'অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি',
] as const;

export type InstitutionCategoryName = (typeof INSTITUTION_CATEGORIES)[number];

export const CATEGORY_LABELS_EN: Record<InstitutionCategoryName, string> = {
  'সরকারি কলেজ': 'Government College',
  'বেসরকারি ডিগ্রি কলেজ': 'Non-Government Degree College',
  'বেসরকারি উচ্চ মাধ্যমিক কলেজ': 'Non-Government Higher Secondary College',
  'সরকারি স্কুল অ্যান্ড কলেজ': 'Government School and College',
  'বেসরকারি স্কুল অ্যান্ড কলেজ': 'Non-Government School and College',
  'সরকারি উচ্চ বিদ্যালয়': 'Government High School',
  'বেসরকারি উচ্চ বিদ্যালয়': 'Non-Government High School',
  'অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি': 'Others / Pending Classification',
};

export interface Institution {
  id: string;
  serial_no: number | null;
  eiin: string | null;
  mpo_code: string | null;
  name_en: string;
  name_bn: string | null;
  original_type: string | null;
  refined_category: string | null;
  management: string | null;
  region: string;
  district: string;
  upazila: string;
  head_name: string | null;
  head_designation: string | null;
  phone_raw: string | null;
  mobile_raw: string | null;
  email: string | null;
  mpo_status: string | null;
  verification_status: VerificationStatus;
  is_active: boolean;
  admin_notes: string | null;
  source_batch_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InstitutionFilterParams {
  search?: string;
  region?: string;
  district?: string;
  upazila?: string;
  refined_category?: string; // 'ALL' | 'UNASSIGNED' | exact category name
  original_type?: string;
  management?: string;
  mpo_status?: string;
  verification_status?: VerificationStatus | '';
  quality_issue?:
    | ''
    | 'missing_mobile'
    | 'missing_email'
    | 'missing_head'
    | 'missing_eiin'
    | 'unassigned_category'
    | 'colleges_pending'
    | 'pending_verification';
  include_inactive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'name_en' | 'name_bn' | 'district' | 'upazila' | 'eiin' | 'serial_no' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DirectoryStats {
  total: number;
  districts: number;
  upazilas: number;
  govt: number;
  non_govt: number;
  mpo_yes: number;
  verified: number;
  pending: number;
}

export interface FilterOptions {
  regions: string[];
  districts: string[];
  upazilas_by_district: Record<string, string[]>;
  managements: string[];
  original_types: string[];
  mpo_statuses: string[];
  categories: string[];
}

export interface DataQualityStats {
  total_active: number;
  total_inactive: number;
  districts: number;
  upazilas: number;
  govt_count: number;
  non_govt_count: number;
  missing_eiin: number;
  missing_mobile: number;
  missing_email: number;
  missing_head_name: number;
  unassigned_category: number;
  colleges_pending: number;
  pending_verification: number;
  category_breakdown: Record<string, number>;
}

export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'super_admin' | 'admin' | 'editor';
  is_active: boolean;
}

export interface AuditLogEntry {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ImportBatchEntry {
  id: string;
  filename: string;
  import_mode: ImportMode;
  total_rows: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  warning_count: number;
  imported_by_email: string | null;
  created_at: string;
}

export type ImportMode = 'merge_update' | 'add_new_only' | 'full_replace' | 'seed_csv';

export interface ReportConfig {
  id?: string;
  name: string;
  title: string;
  subtitle?: string;
  language: ReportLanguage;
  filters: {
    district?: string;
    upazila?: string;
    refined_category?: string;
    management?: string;
    mpo_status?: string;
    verification_status?: string;
    include_inactive?: boolean;
  };
  columns: ReportColumnKey[];
  sortBy: 'district' | 'upazila' | 'name_en' | 'name_bn' | 'eiin' | 'refined_category';
  sortOrder: 'asc' | 'desc';
}

export type ReportColumnKey =
  | 'serial_no'
  | 'eiin'
  | 'name_bn'
  | 'name_en'
  | 'original_type'
  | 'refined_category'
  | 'management'
  | 'district'
  | 'upazila'
  | 'head_name'
  | 'head_designation'
  | 'mobile_raw'
  | 'phone_raw'
  | 'email'
  | 'mpo_code'
  | 'mpo_status'
  | 'verification_status';

export type EducationOfficeType = 'district' | 'upazila';

export interface EducationOffice {
  id: string;
  serial_no: number | null;
  office_type: EducationOfficeType;
  district: string;
  upazila: string | null;
  office_name: string;
  officer_name: string | null;
  officer_designation: string | null;
  phone_raw: string | null;
  mobile_raw: string | null;
  email: string | null;
  portal_url: string | null;
  officers_url: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EducationOfficeFilterParams {
  search?: string;
  district?: string;
  upazila?: string;
  office_type?: '' | EducationOfficeType;
  include_inactive?: boolean;
}
