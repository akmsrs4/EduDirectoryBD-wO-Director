-- ============================================================================
-- EduDirectory BD — Complete Idempotent Supabase PostgreSQL Setup Script
-- ============================================================================
-- Run this entire script ONCE in Supabase Dashboard -> SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS, CREATE OR REPLACE, and idempotent guards.
-- Never expose Supabase service_role key in frontend code.
-- ============================================================================

-- 1. Required Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Institution Categories Table (8 Standard Categories)
CREATE TABLE IF NOT EXISTS public.institution_categories (
  id TEXT PRIMARY KEY,
  name_bn TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_pending_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.institution_categories (id, name_bn, name_en, sort_order, is_pending_default)
VALUES
  ('govt-college', 'সরকারি কলেজ', 'Government College', 1, FALSE),
  ('non-govt-degree-college', 'বেসরকারি ডিগ্রি কলেজ', 'Non-Government Degree College', 2, FALSE),
  ('non-govt-hs-college', 'বেসরকারি উচ্চ মাধ্যমিক কলেজ', 'Non-Government Higher Secondary College', 3, FALSE),
  ('govt-school-college', 'সরকারি স্কুল অ্যান্ড কলেজ', 'Government School and College', 4, FALSE),
  ('non-govt-school-college', 'বেসরকারি স্কুল অ্যান্ড কলেজ', 'Non-Government School and College', 5, FALSE),
  ('govt-high-school', 'সরকারি উচ্চ বিদ্যালয়', 'Government High School', 6, FALSE),
  ('non-govt-high-school', 'বেসরকারি উচ্চ বিদ্যালয়', 'Non-Government High School', 7, FALSE),
  ('other-pending', 'অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি', 'Others / Pending Classification', 8, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name_bn = EXCLUDED.name_bn,
  name_en = EXCLUDED.name_en,
  sort_order = EXCLUDED.sort_order,
  is_pending_default = EXCLUDED.is_pending_default;

-- 3. Admin Users Table (Linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'editor')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Import Batches Table (Tracks Excel/CSV imports & bulk updates)
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  import_mode TEXT NOT NULL CHECK (import_mode IN ('merge_update', 'add_new_only', 'full_replace', 'seed_csv')),
  total_rows INT NOT NULL DEFAULT 0,
  inserted_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  warning_count INT NOT NULL DEFAULT 0,
  imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  imported_by_email TEXT,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Institutions Table (Central Directory Records)
CREATE TABLE IF NOT EXISTS public.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_no INT,
  eiin TEXT,
  mpo_code TEXT,
  name_en TEXT NOT NULL,
  name_bn TEXT,
  original_type TEXT, -- Retained untouched from source Excel/CSV
  refined_category TEXT REFERENCES public.institution_categories(name_bn) ON UPDATE CASCADE ON DELETE SET NULL,
  management TEXT,
  region TEXT NOT NULL DEFAULT 'RANGPUR',
  district TEXT NOT NULL,
  upazila TEXT NOT NULL,
  head_name TEXT, -- NULL if unverified/placeholder ("প্রতিষ্ঠান প্রধান")
  head_designation TEXT,
  phone_raw TEXT, -- Raw phone string preserved exactly
  mobile_raw TEXT, -- Raw mobile string preserved exactly
  email TEXT,
  mpo_status TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('verified', 'pending', 'needs_review')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  admin_notes TEXT,
  source_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Strict Unique Constraint on EIIN (allows multiple NULLs for missing EIINs, enforces 100% uniqueness on every valid EIIN)
DROP INDEX IF EXISTS public.idx_institutions_unique_valid_eiin;
UPDATE public.institutions
SET eiin = CASE
  WHEN eiin IS NULL THEN NULL
  WHEN regexp_replace(translate(trim(eiin), '০১২৩৪৫৬৭৮৯', '0123456789'), '\D', '', 'g') ~ '^\d{5,8}$'
   AND regexp_replace(translate(trim(eiin), '০১২৩৪৫৬৭৮৯', '0123456789'), '\D', '', 'g') !~ '^0+$'
    THEN regexp_replace(translate(trim(eiin), '০১২৩৪৫৬৭৮৯', '0123456789'), '\D', '', 'g')
  ELSE NULL
END
WHERE eiin IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_institutions_eiin'
  ) THEN
    ALTER TABLE public.institutions ADD CONSTRAINT uq_institutions_eiin UNIQUE (eiin);
  END IF;
END $$;

-- Standard query & filter indexes
CREATE INDEX IF NOT EXISTS idx_institutions_active ON public.institutions (is_active);
CREATE INDEX IF NOT EXISTS idx_institutions_district_upazila ON public.institutions (district, upazila);
CREATE INDEX IF NOT EXISTS idx_institutions_refined_category ON public.institutions (refined_category);
CREATE INDEX IF NOT EXISTS idx_institutions_original_type ON public.institutions (original_type);
CREATE INDEX IF NOT EXISTS idx_institutions_management ON public.institutions (management);
CREATE INDEX IF NOT EXISTS idx_institutions_mpo_status ON public.institutions (mpo_status);
CREATE INDEX IF NOT EXISTS idx_institutions_verification ON public.institutions (verification_status);

-- Trigram indexes for fast substring/fuzzy search in Bangla & English
CREATE INDEX IF NOT EXISTS idx_institutions_name_bn_trgm ON public.institutions USING gin (name_bn gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_institutions_name_en_trgm ON public.institutions USING gin (name_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_institutions_eiin_trgm ON public.institutions USING gin (eiin gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_institutions_mobile_trgm ON public.institutions USING gin (mobile_raw gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_institutions_email_trgm ON public.institutions USING gin (email gin_trgm_ops);

-- 6. Audit Logs Table (Admin-only accountability trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- 7. Saved Report Templates Table (Admin-only)
CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  config_json JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Updated-at Trigger Helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_institutions_updated_at ON public.institutions;
CREATE TRIGGER trg_institutions_updated_at
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_report_templates_updated_at ON public.report_templates;
CREATE TRIGGER trg_report_templates_updated_at
  BEFORE UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8b. Auto-Normalize Bangladeshi Mobile Numbers (Prepend leading '0') & Sanitize EIIN/Head Name Trigger
CREATE OR REPLACE FUNCTION public.normalize_bd_mobile_text(p_raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_trimmed TEXT;
  v_token TEXT;
  v_ascii TEXT;
  v_digits TEXT;
  v_parts TEXT[] := ARRAY[]::TEXT[];
BEGIN
  v_trimmed := NULLIF(trim(COALESCE(p_raw, '')), '');
  IF v_trimmed IS NULL THEN
    RETURN NULL;
  END IF;

  FOR v_token IN SELECT trim(x) FROM regexp_split_to_table(v_trimmed, '[,;/|]+') AS x
  LOOP
    IF v_token = '' THEN CONTINUE; END IF;
    -- Convert Bangla numerals (০-৯) to ASCII (0-9)
    v_ascii := translate(v_token, '০১২৩৪৫৬৭৮৯', '0123456789');
    v_digits := regexp_replace(v_ascii, '\D', '', 'g');

    IF v_digits ~ '^1[3-9][0-9]{8}$' THEN
      -- Missing leading zero (e.g. 1717850780 -> 01717850780)
      v_parts := array_append(v_parts, '0' || v_digits);
    ELSIF v_digits ~ '^8801[3-9][0-9]{8}$' THEN
      v_parts := array_append(v_parts, '0' || substr(v_digits, 4));
    ELSIF v_digits ~ '^008801[3-9][0-9]{8}$' THEN
      v_parts := array_append(v_parts, '0' || substr(v_digits, 6));
    ELSIF v_digits ~ '^01[3-9][0-9]{8}$' THEN
      v_parts := array_append(v_parts, v_digits);
    ELSE
      v_parts := array_append(v_parts, v_token);
    END IF;
  END LOOP;

  IF array_length(v_parts, 1) IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN array_to_string(v_parts, ', ');
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_institution_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_eiin_digits TEXT;
BEGIN
  -- Normalize EIIN (Bangla digits -> ASCII, non-numeric or invalid -> NULL)
  IF NEW.eiin IS NOT NULL THEN
    v_eiin_digits := regexp_replace(translate(trim(NEW.eiin), '০১২৩৪৫৬৭৮৯', '0123456789'), '\D', '', 'g');
    IF v_eiin_digits ~ '^\d{5,8}$' AND v_eiin_digits !~ '^0+$' THEN
      NEW.eiin := v_eiin_digits;
    ELSE
      NEW.eiin := NULL;
    END IF;
  END IF;

  -- Auto-prepend leading 0 to 10-digit Bangladeshi mobile numbers
  NEW.mobile_raw := public.normalize_bd_mobile_text(NEW.mobile_raw);
  NEW.phone_raw := public.normalize_bd_mobile_text(NEW.phone_raw);

  -- Clean placeholder head names
  IF NEW.head_name IS NOT NULL AND trim(NEW.head_name) IN ('', '-', '--', 'N/A', 'NA', 'নাই', '0', 'প্রতিষ্ঠান প্রধান', 'প্রতিষ্ঠান প্রধানের নাম') THEN
    NEW.head_name := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_institutions_normalize ON public.institutions;
CREATE TRIGGER trg_institutions_normalize
  BEFORE INSERT OR UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.normalize_institution_fields();

-- Backfill existing records so any previously saved mobile numbers without leading '0' are immediately fixed
UPDATE public.institutions
SET
  mobile_raw = public.normalize_bd_mobile_text(mobile_raw),
  phone_raw = public.normalize_bd_mobile_text(phone_raw)
WHERE
  (mobile_raw IS NOT NULL AND mobile_raw IS DISTINCT FROM public.normalize_bd_mobile_text(mobile_raw))
  OR (phone_raw IS NOT NULL AND phone_raw IS DISTINCT FROM public.normalize_bd_mobile_text(phone_raw));

-- 9. Admin Verification Helper Function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.is_active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- 10. Institution Audit Trigger (Logs admin mutations automatically)
CREATE OR REPLACE FUNCTION public.log_institution_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (actor_user_id, actor_email, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      v_email,
      'create_institution',
      'institution',
      NEW.id::text,
      jsonb_build_object('name_en', NEW.name_en, 'eiin', NEW.eiin, 'district', NEW.district)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (actor_user_id, actor_email, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      v_email,
      CASE WHEN OLD.is_active = TRUE AND NEW.is_active = FALSE THEN 'deactivate_institution'
           WHEN OLD.is_active = FALSE AND NEW.is_active = TRUE THEN 'restore_institution'
           ELSE 'update_institution' END,
      'institution',
      NEW.id::text,
      jsonb_build_object(
        'name_en', NEW.name_en,
        'refined_category', jsonb_build_object('old', OLD.refined_category, 'new', NEW.refined_category),
        'head_name', jsonb_build_object('old', OLD.head_name, 'new', NEW.head_name),
        'verification_status', jsonb_build_object('old', OLD.verification_status, 'new', NEW.verification_status)
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (actor_user_id, actor_email, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      v_email,
      'delete_institution',
      'institution',
      OLD.id::text,
      jsonb_build_object('name_en', OLD.name_en, 'eiin', OLD.eiin)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_institutions_audit ON public.institutions;
CREATE TRIGGER trg_institutions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.log_institution_changes();

-- 11. Row Level Security (RLS)
ALTER TABLE public.institution_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

-- institution_categories policies
DROP POLICY IF EXISTS "Public read institution_categories" ON public.institution_categories;
CREATE POLICY "Public read institution_categories"
  ON public.institution_categories FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Admin write institution_categories" ON public.institution_categories;
CREATE POLICY "Admin write institution_categories"
  ON public.institution_categories FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- admin_users policies
DROP POLICY IF EXISTS "Users read own admin profile" ON public.admin_users;
CREATE POLICY "Users read own admin profile"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admin manage admin_users" ON public.admin_users;
CREATE POLICY "Admin manage admin_users"
  ON public.admin_users FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- institutions policies (Public read-only active records; Admin full CRUD)
DROP POLICY IF EXISTS "Public read active institutions" ON public.institutions;
CREATE POLICY "Public read active institutions"
  ON public.institutions FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admin insert institutions" ON public.institutions;
CREATE POLICY "Admin insert institutions"
  ON public.institutions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin update institutions" ON public.institutions;
CREATE POLICY "Admin update institutions"
  ON public.institutions FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin delete institutions" ON public.institutions;
CREATE POLICY "Admin delete institutions"
  ON public.institutions FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- import_batches policies (Admin only)
DROP POLICY IF EXISTS "Admin only import_batches" ON public.import_batches;
CREATE POLICY "Admin only import_batches"
  ON public.import_batches FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- audit_logs policies (Admin read/insert only)
DROP POLICY IF EXISTS "Admin read audit_logs" ON public.audit_logs;
CREATE POLICY "Admin read audit_logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin insert audit_logs" ON public.audit_logs;
CREATE POLICY "Admin insert audit_logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- report_templates policies (Admin only — public cannot access reports)
DROP POLICY IF EXISTS "Admin only report_templates" ON public.report_templates;
CREATE POLICY "Admin only report_templates"
  ON public.report_templates FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Explicit table privileges for Supabase PostgREST (RLS policies still enforce row-level security)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.institution_categories, public.institutions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.institution_categories, public.institutions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users, public.import_batches, public.audit_logs, public.report_templates TO authenticated;

-- 12. Public Read-Only Aggregate RPCs
CREATE OR REPLACE FUNCTION public.get_directory_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*)::int,
    'districts', COUNT(DISTINCT district)::int,
    'upazilas', COUNT(DISTINCT district || '|' || upazila)::int,
    'govt', COUNT(*) FILTER (WHERE management = 'Govt.')::int,
    'non_govt', COUNT(*) FILTER (WHERE management = 'Non-Govt.')::int,
    'mpo_yes', COUNT(*) FILTER (WHERE mpo_status ILIKE 'Yes%')::int,
    'verified', COUNT(*) FILTER (WHERE verification_status = 'verified')::int,
    'pending', COUNT(*) FILTER (WHERE verification_status <> 'verified')::int
  )
  FROM public.institutions
  WHERE is_active = TRUE;
$$;

GRANT EXECUTE ON FUNCTION public.get_directory_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_filter_options()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dist_upa AS (
    SELECT district, jsonb_agg(DISTINCT upazila ORDER BY upazila) AS upazilas
    FROM public.institutions
    WHERE is_active = TRUE AND district IS NOT NULL AND upazila IS NOT NULL
    GROUP BY district
  )
  SELECT jsonb_build_object(
    'regions', COALESCE((SELECT jsonb_agg(DISTINCT region ORDER BY region) FROM public.institutions WHERE is_active = TRUE AND region IS NOT NULL), '[]'::jsonb),
    'districts', COALESCE((SELECT jsonb_agg(district ORDER BY district) FROM dist_upa), '[]'::jsonb),
    'upazilas_by_district', COALESCE((SELECT jsonb_object_agg(district, upazilas) FROM dist_upa), '{}'::jsonb),
    'managements', COALESCE((SELECT jsonb_agg(DISTINCT management ORDER BY management) FROM public.institutions WHERE is_active = TRUE AND management IS NOT NULL AND management <> ''), '[]'::jsonb),
    'original_types', COALESCE((SELECT jsonb_agg(DISTINCT original_type ORDER BY original_type) FROM public.institutions WHERE is_active = TRUE AND original_type IS NOT NULL AND original_type <> ''), '[]'::jsonb),
    'mpo_statuses', COALESCE((SELECT jsonb_agg(DISTINCT mpo_status ORDER BY mpo_status) FROM public.institutions WHERE is_active = TRUE AND mpo_status IS NOT NULL AND mpo_status <> ''), '[]'::jsonb),
    'categories', COALESCE((SELECT jsonb_agg(name_bn ORDER BY sort_order) FROM public.institution_categories), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_filter_options() TO anon, authenticated;

-- 13. Admin-Only Data Quality & Dashboard Metrics RPC
CREATE OR REPLACE FUNCTION public.admin_data_quality_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'total_active', COUNT(*) FILTER (WHERE is_active = TRUE)::int,
    'total_inactive', COUNT(*) FILTER (WHERE is_active = FALSE)::int,
    'districts', COUNT(DISTINCT district) FILTER (WHERE is_active = TRUE)::int,
    'upazilas', COUNT(DISTINCT district || '|' || upazila) FILTER (WHERE is_active = TRUE)::int,
    'govt_count', COUNT(*) FILTER (WHERE is_active = TRUE AND management = 'Govt.')::int,
    'non_govt_count', COUNT(*) FILTER (WHERE is_active = TRUE AND management = 'Non-Govt.')::int,
    'missing_eiin', COUNT(*) FILTER (WHERE is_active = TRUE AND (eiin IS NULL OR eiin !~ '^\d{5,8}$'))::int,
    'missing_mobile', COUNT(*) FILTER (WHERE is_active = TRUE AND (mobile_raw IS NULL OR length(regexp_replace(mobile_raw, '\D', '', 'g')) < 7))::int,
    'missing_email', COUNT(*) FILTER (WHERE is_active = TRUE AND (email IS NULL OR email = '' OR email = '0' OR lower(email) IN ('not@vailable.com', 'not@available.com', 'abc@gmail.com')))::int,
    'missing_head_name', COUNT(*) FILTER (WHERE is_active = TRUE AND (head_name IS NULL OR trim(head_name) = '' OR trim(head_name) IN ('প্রতিষ্ঠান প্রধান', 'প্রতিষ্ঠান প্রধানের নাম')))::int,
    'unassigned_category', COUNT(*) FILTER (WHERE is_active = TRUE AND (refined_category IS NULL OR refined_category = 'অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি'))::int,
    'colleges_pending', COUNT(*) FILTER (WHERE is_active = TRUE AND original_type ILIKE '%College%' AND (refined_category IS NULL OR refined_category = 'অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি'))::int,
    'pending_verification', COUNT(*) FILTER (WHERE is_active = TRUE AND verification_status <> 'verified')::int,
    'category_breakdown', COALESCE((
      SELECT jsonb_object_agg(cat, cnt)
      FROM (
        SELECT COALESCE(refined_category, 'শ্রেণিবিভাগ যাচাই বাকি') AS cat, COUNT(*)::int AS cnt
        FROM public.institutions
        WHERE is_active = TRUE
        GROUP BY 1
      ) c
    ), '{}'::jsonb)
  ) INTO v_res
  FROM public.institutions;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_data_quality_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_data_quality_stats() TO authenticated;

-- 14. Admin-Only Batch Upsert RPC (Safe Excel/CSV Import Engine)
CREATE OR REPLACE FUNCTION public.admin_batch_upsert_institutions(
  p_rows JSONB,
  p_mode TEXT DEFAULT 'merge_update',
  p_overwrite_manual BOOLEAN DEFAULT TRUE,
  p_batch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row JSONB;
  v_existing public.institutions%ROWTYPE;
  v_found_count INT;
  v_inserted INT := 0;
  v_updated INT := 0;
  v_skipped INT := 0;
  v_warnings JSONB := '[]'::jsonb;
  v_id UUID;
  v_eiin TEXT;
  v_name_en TEXT;
  v_district TEXT;
  v_upazila TEXT;
  v_head_name TEXT;
  v_refined_cat TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required for batch import';
  END IF;

  IF p_mode NOT IN ('merge_update', 'add_new_only', 'full_replace', 'seed_csv') THEN
    RAISE EXCEPTION 'Invalid import mode: %', p_mode;
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_id := NULLIF(trim(v_row->>'id'), '')::uuid;
    v_eiin := regexp_replace(translate(trim(COALESCE(v_row->>'eiin', '')), '০১২৩৪৫৬৭৮৯', '0123456789'), '\D', '', 'g');
    IF v_eiin = '' OR v_eiin !~ '^\d{5,8}$' OR v_eiin ~ '^0+$' THEN
      v_eiin := NULL;
    END IF;
    v_name_en := trim(COALESCE(v_row->>'name_en', ''));
    v_district := trim(COALESCE(v_row->>'district', ''));
    v_upazila := trim(COALESCE(v_row->>'upazila', ''));

    -- Sanitize placeholder head names
    v_head_name := NULLIF(trim(COALESCE(v_row->>'head_name', '')), '');
    IF v_head_name IN ('প্রতিষ্ঠান প্রধান', 'প্রতিষ্ঠান প্রধানের নাম', '-', 'N/A', 'নাই') THEN
      v_head_name := NULL;
    END IF;

    v_refined_cat := NULLIF(trim(COALESCE(v_row->>'refined_category', '')), '');

    v_found_count := 0;
    v_existing := NULL;

    -- Tier 1: Match by valid unique EIIN first (guarantees repeated EIIN always updates the exact institution)
    IF v_eiin IS NOT NULL THEN
      SELECT * INTO v_existing FROM public.institutions WHERE eiin = v_eiin LIMIT 1;
      IF FOUND THEN v_found_count := 1; END IF;
    END IF;

    -- Tier 2: Match by Internal Record ID (UUID)
    IF v_found_count = 0 AND v_id IS NOT NULL THEN
      SELECT * INTO v_existing FROM public.institutions WHERE id = v_id;
      IF FOUND THEN v_found_count := 1; END IF;
    END IF;

    -- Tier 3: Match by exact normalized (name_en + district + upazila) only if unique
    IF v_found_count = 0 AND v_name_en <> '' AND v_district <> '' AND v_upazila <> '' THEN
      SELECT COUNT(*) INTO v_found_count
      FROM public.institutions
      WHERE upper(trim(name_en)) = upper(v_name_en)
        AND upper(trim(district)) = upper(v_district)
        AND upper(trim(upazila)) = upper(v_upazila);
      IF v_found_count = 1 THEN
        SELECT * INTO v_existing
        FROM public.institutions
        WHERE upper(trim(name_en)) = upper(v_name_en)
          AND upper(trim(district)) = upper(v_district)
          AND upper(trim(upazila)) = upper(v_upazila)
        LIMIT 1;
      ELSIF v_found_count > 1 THEN
        v_skipped := v_skipped + 1;
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('name_en', v_name_en, 'district', v_district, 'upazila', v_upazila, 'reason', 'Multiple matching records found; manual review required'));
        CONTINUE;
      END IF;
    END IF;

    IF v_found_count = 1 THEN
      IF p_mode = 'add_new_only' THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      -- Latest non-empty update wins while preserving untouched existing values when incoming cell is empty/placeholder
      UPDATE public.institutions SET
        serial_no = COALESCE(NULLIF(v_row->>'serial_no', '')::int, serial_no),
        eiin = COALESCE(v_eiin, eiin),
        mpo_code = COALESCE(NULLIF(trim(v_row->>'mpo_code'), ''), mpo_code),
        name_en = CASE WHEN v_name_en <> '' THEN v_name_en ELSE name_en END,
        name_bn = COALESCE(NULLIF(trim(v_row->>'name_bn'), ''), name_bn),
        original_type = CASE WHEN COALESCE(original_type, '') = '' THEN NULLIF(trim(v_row->>'original_type'), '') ELSE original_type END,
        refined_category = CASE
          WHEN p_overwrite_manual AND v_refined_cat IS NOT NULL THEN v_refined_cat
          WHEN refined_category IS NULL AND v_refined_cat IS NOT NULL THEN v_refined_cat
          WHEN refined_category = 'অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি' AND v_refined_cat IS NOT NULL AND v_refined_cat <> 'অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি' THEN v_refined_cat
          ELSE refined_category
        END,
        management = COALESCE(NULLIF(trim(v_row->>'management'), ''), management),
        region = COALESCE(NULLIF(trim(v_row->>'region'), ''), region),
        district = CASE WHEN v_district <> '' THEN v_district ELSE district END,
        upazila = CASE WHEN v_upazila <> '' THEN v_upazila ELSE upazila END,
        head_name = CASE
          WHEN p_overwrite_manual AND v_head_name IS NOT NULL THEN v_head_name
          WHEN head_name IS NULL AND v_head_name IS NOT NULL THEN v_head_name
          ELSE head_name
        END,
        head_designation = COALESCE(NULLIF(trim(v_row->>'head_designation'), ''), head_designation),
        phone_raw = COALESCE(NULLIF(trim(v_row->>'phone_raw'), ''), phone_raw),
        mobile_raw = COALESCE(NULLIF(trim(v_row->>'mobile_raw'), ''), mobile_raw),
        email = COALESCE(NULLIF(trim(v_row->>'email'), ''), email),
        mpo_status = COALESCE(NULLIF(trim(v_row->>'mpo_status'), ''), mpo_status),
        verification_status = COALESCE(NULLIF(trim(v_row->>'verification_status'), ''), verification_status),
        admin_notes = COALESCE(NULLIF(trim(v_row->>'admin_notes'), ''), admin_notes),
        is_active = TRUE,
        source_batch_id = COALESCE(p_batch_id, source_batch_id),
        updated_by = auth.uid()
      WHERE id = v_existing.id;

      v_updated := v_updated + 1;
    ELSE
      -- Insert new institution
      INSERT INTO public.institutions (
        id, serial_no, eiin, mpo_code, name_en, name_bn, original_type, refined_category,
        management, region, district, upazila, head_name, head_designation,
        phone_raw, mobile_raw, email, mpo_status, verification_status,
        is_active, admin_notes, source_batch_id, created_by, updated_by
      ) VALUES (
        COALESCE(v_id, gen_random_uuid()),
        NULLIF(v_row->>'serial_no', '')::int,
        v_eiin,
        NULLIF(trim(v_row->>'mpo_code'), ''),
        v_name_en,
        NULLIF(trim(v_row->>'name_bn'), ''),
        NULLIF(trim(v_row->>'original_type'), ''),
        v_refined_cat,
        NULLIF(trim(v_row->>'management'), ''),
        COALESCE(NULLIF(trim(v_row->>'region'), ''), 'RANGPUR'),
        v_district,
        v_upazila,
        v_head_name,
        NULLIF(trim(v_row->>'head_designation'), ''),
        NULLIF(trim(v_row->>'phone_raw'), ''),
        NULLIF(trim(v_row->>'mobile_raw'), ''),
        NULLIF(trim(v_row->>'email'), ''),
        NULLIF(trim(v_row->>'mpo_status'), ''),
        COALESCE(NULLIF(trim(v_row->>'verification_status'), ''), 'pending'),
        TRUE,
        NULLIF(trim(v_row->>'admin_notes'), ''),
        p_batch_id,
        auth.uid(),
        auth.uid()
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped,
    'warnings', v_warnings
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_batch_upsert_institutions(JSONB, TEXT, BOOLEAN, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_batch_upsert_institutions(JSONB, TEXT, BOOLEAN, UUID) TO authenticated;

-- 14b. Admin-Only Report Data RPC (Enforces strict admin-only report generation at DB level)
CREATE OR REPLACE FUNCTION public.admin_generate_report_rows(p_filters JSONB DEFAULT '{}'::jsonb)
RETURNS SETOF public.institutions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_district TEXT := NULLIF(trim(COALESCE(p_filters->>'district', '')), '');
  v_upazila TEXT := NULLIF(trim(COALESCE(p_filters->>'upazila', '')), '');
  v_category TEXT := NULLIF(trim(COALESCE(p_filters->>'refined_category', '')), '');
  v_management TEXT := NULLIF(trim(COALESCE(p_filters->>'management', '')), '');
  v_mpo TEXT := NULLIF(trim(COALESCE(p_filters->>'mpo_status', '')), '');
  v_verification TEXT := NULLIF(trim(COALESCE(p_filters->>'verification_status', '')), '');
  v_include_inactive BOOLEAN := COALESCE((p_filters->>'include_inactive')::boolean, FALSE);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can generate bulk reports';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.institutions i
  WHERE (v_include_inactive OR i.is_active = TRUE)
    AND (v_district IS NULL OR i.district = v_district)
    AND (v_upazila IS NULL OR i.upazila = v_upazila)
    AND (
      v_category IS NULL
      OR (v_category = 'UNASSIGNED' AND (i.refined_category IS NULL OR i.refined_category = 'অন্যান্য / শ্রেণিবিভাগ যাচাই বাকি'))
      OR i.refined_category = v_category
    )
    AND (v_management IS NULL OR i.management = v_management)
    AND (v_mpo IS NULL OR i.mpo_status = v_mpo)
    AND (v_verification IS NULL OR i.verification_status = v_verification)
  ORDER BY i.district ASC, i.upazila ASC, i.name_en ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_generate_report_rows(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_generate_report_rows(JSONB) TO authenticated;

-- 14c. Admin-Only Soft-Deactivate Records Not In Full Replace Batch
CREATE OR REPLACE FUNCTION public.admin_deactivate_not_in_batch(p_batch_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.institutions
  SET is_active = FALSE, updated_by = auth.uid()
  WHERE is_active = TRUE AND (source_batch_id IS DISTINCT FROM p_batch_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_deactivate_not_in_batch(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_not_in_batch(UUID) TO authenticated;

-- 15. Initial Admin Bootstrap (SQL-based Admin Creation for apsaidur@gmail.com)
-- নিচে v_admin_password এর '' এর ভেতরে আপনার পছন্দের পাসওয়ার্ড লিখে পুরো স্ক্রিপ্ট Run করুন
-- (অথবা ফাঁকা '' রেখে Run করে পরে Supabase Dashboard / Reset Password দিয়ে পাসওয়ার্ড সেট করুন)।
DO $$
DECLARE
  v_admin_email TEXT := 'apsaidur@gmail.com';
  v_admin_password TEXT := ''; -- <-- এখানে আপনার পাসওয়ার্ড লিখুন (যেমন: 'MyStrongPass@2026')
  v_admin_name TEXT := 'A K M Saidur Rahman';
  v_auth_uid UUID;
BEGIN
  SELECT id INTO v_auth_uid
  FROM auth.users
  WHERE lower(email) = lower(v_admin_email)
  LIMIT 1;

  IF v_auth_uid IS NULL THEN
    v_auth_uid := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_auth_uid,
      'authenticated',
      'authenticated',
      lower(v_admin_email),
      CASE
        WHEN trim(v_admin_password) <> '' THEN crypt(v_admin_password, gen_salt('bf'))
        ELSE ''
      END,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_admin_name),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_auth_uid,
      jsonb_build_object('sub', v_auth_uid::text, 'email', lower(v_admin_email)),
      'email',
      v_auth_uid::text,
      now(),
      now(),
      now()
    );
  ELSIF trim(v_admin_password) <> '' THEN
    UPDATE auth.users
    SET encrypted_password = crypt(v_admin_password, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_auth_uid;
  END IF;

  INSERT INTO public.admin_users (user_id, email, full_name, role, is_active)
  VALUES (v_auth_uid, lower(v_admin_email), v_admin_name, 'super_admin', TRUE)
  ON CONFLICT (email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    full_name = EXCLUDED.full_name,
    role = 'super_admin',
    is_active = TRUE;
END $$;

-- ============================================================================
-- 16. Education Offices Module (8 District + 58 Upazila Offices - Separate Table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.education_offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_no INT NOT NULL DEFAULT 1,
  office_type TEXT NOT NULL CHECK (office_type IN ('district', 'upazila')),
  district TEXT NOT NULL,
  upazila TEXT,
  office_name TEXT NOT NULL,
  officer_name TEXT,
  officer_designation TEXT,
  phone_raw TEXT,
  mobile_raw TEXT,
  email TEXT,
  portal_url TEXT,
  officers_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_education_offices_key
  ON public.education_offices (office_type, district, COALESCE(upazila, ''));

CREATE INDEX IF NOT EXISTS idx_education_offices_district
  ON public.education_offices (district);

CREATE INDEX IF NOT EXISTS idx_education_offices_type
  ON public.education_offices (office_type);

DROP TRIGGER IF EXISTS trg_education_offices_updated_at ON public.education_offices;
CREATE TRIGGER trg_education_offices_updated_at
  BEFORE UPDATE ON public.education_offices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.normalize_education_office_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.office_type = 'upazila' THEN
    NEW.officer_name := NULL;
    NEW.officer_designation := NULL;
    NEW.mobile_raw := NULL;
  END IF;
  NEW.mobile_raw := public.normalize_bd_mobile_text(NEW.mobile_raw);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_education_offices_normalize ON public.education_offices;
CREATE TRIGGER trg_education_offices_normalize
  BEFORE INSERT OR UPDATE ON public.education_offices
  FOR EACH ROW EXECUTE FUNCTION public.normalize_education_office_fields();

ALTER TABLE public.education_offices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active education_offices" ON public.education_offices;
CREATE POLICY "Public read active education_offices"
  ON public.education_offices FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admin manage education_offices" ON public.education_offices;
CREATE POLICY "Admin manage education_offices"
  ON public.education_offices FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.education_offices TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.education_offices TO authenticated;

-- Idempotent seed of all 66 verified Rangpur Division Education Offices (8 DEOs + 58 Upazilas)
-- Preserves any admin edits when re-running supabase_setup.sql
INSERT INTO public.education_offices (
  serial_no,
  office_type,
  district,
  upazila,
  office_name,
  officer_name,
  officer_designation,
  phone_raw,
  mobile_raw,
  email,
  portal_url,
  officers_url,
  is_active
) VALUES
  (1, 'district', 'রংপুর', NULL, 'জেলা শিক্ষা অফিস, রংপুর', 'মোঃ এনায়েত হোসেন', 'জেলা শিক্ষা অফিসার', '০৫২১-৬৩৪২০', '01713937586', 'deorangpur@yahoo.com', 'https://deo.rangpur.gov.bd', 'https://deo.rangpur.gov.bd/pages/officers', TRUE),
  (2, 'district', 'কুড়িগ্রাম', NULL, 'জেলা শিক্ষা অফিস, কুড়িগ্রাম', 'মোঃ শফিকুল ইসলাম', 'জেলা শিক্ষা অফিসার', '০৫৮১-৬১৬৭১', '01718158637', 'deokurigram@gmail.com', 'https://deo.kurigram.gov.bd', 'https://deo.kurigram.gov.bd/pages/officers', TRUE),
  (3, 'district', 'নীলফামারী', NULL, 'জেলা শিক্ষা অফিস, নীলফামারী', 'মোঃ হাফিজুর রহমান', 'জেলা শিক্ষা অফিসার', '০২৫৮৯৯৫৫৪৯৩ / ০৫৫১-৬১৪৬৩', '01737544898, 01718685011', 'deonilphamari@yahoo.com', 'https://deo.nilphamari.gov.bd', 'https://deo.nilphamari.gov.bd/pages/officers', TRUE),
  (4, 'district', 'গাইবান্ধা', NULL, 'জেলা শিক্ষা অফিস, গাইবান্ধা', 'মোঃ আতাউর রহমান', 'জেলা শিক্ষা অফিসার', NULL, '01712675737', 'deogaibandha@yahoo.com', 'https://deo.gaibandha.gov.bd', 'https://deo.gaibandha.gov.bd/pages/officers', TRUE),
  (5, 'district', 'লালমনিরহাট', NULL, 'জেলা শিক্ষা অফিস, লালমনিরহাট', 'রুখসানা পারভীন', 'জেলা শিক্ষা অফিসার (অতিরিক্ত দায়িত্ব)', '০২৫৮৯৯৮৬৬৭৯', '01793589935, 01724053636', 'deolalmonirhat@yahoo.com', 'https://deo.lalmonirhat.gov.bd', 'https://deo.lalmonirhat.gov.bd/pages/officers', TRUE),
  (6, 'district', 'দিনাজপুর', NULL, 'জেলা শিক্ষা অফিস, দিনাজপুর', 'খন্দকার মোঃ আলাউদ্দীন আল আজাদ', 'জেলা শিক্ষা অফিসার', '০৫৩১-৬৫০৮৬', '01303046367', 'dinajpurdeo2008@yahoo.com', 'https://deo.dinajpur.gov.bd', 'https://deo.dinajpur.gov.bd/pages/officers', TRUE),
  (7, 'district', 'পঞ্চগড়', NULL, 'জেলা শিক্ষা অফিস, পঞ্চগড়', 'মোঃ জাহাঙ্গীর আলম', 'জেলা শিক্ষা অফিসার (অতিরিক্ত দায়িত্ব)', NULL, '01718786849', 'jahangir.pgghs@gmail.com / panchagarhdeo2008@yahoo.com', 'https://deo.panchagarh.gov.bd', 'https://deo.panchagarh.gov.bd/pages/officers', TRUE),
  (8, 'district', 'ঠাকুরগাঁও', NULL, 'জেলা শিক্ষা অফিস, ঠাকুরগাঁও', 'মোঃ শাহীন আকতার', 'জেলা শিক্ষা অফিসার', '০২৫৮৯৯৩১২৬৫', '01725021999', 'thakurgaondeo2008@yahoo.com', 'https://deo.thakurgaon.gov.bd', 'https://deo.thakurgaon.gov.bd/pages/officers', TRUE),
  (1, 'upazila', 'রংপুর', 'সদর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, সদর', NULL, NULL, '0521-65806', NULL, 'rang_useosadar@yahoo.com / useorangpursadar@gmail.com', 'https://seo.rangpursadar.rangpur.gov.bd', 'https://seo.rangpursadar.rangpur.gov.bd/pages/officers', TRUE),
  (2, 'upazila', 'রংপুর', 'মিঠাপুকুর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, মিঠাপুকুর', NULL, NULL, '০২৫৮৮৮৭৮১৪৬ / 0522-56170', NULL, 'useomithapukur1@gmail.com', 'https://dshe.mithapukur.rangpur.gov.bd', 'https://dshe.mithapukur.rangpur.gov.bd/pages/officers', TRUE),
  (3, 'upazila', 'রংপুর', 'পীরগঞ্জ', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, পীরগঞ্জ', NULL, NULL, '0522756090', NULL, 'useopirganjrangpur@gmail.com', 'https://seo.pirgonj.rangpur.gov.bd', 'https://seo.pirgonj.rangpur.gov.bd/pages/officers', TRUE),
  (4, 'upazila', 'রংপুর', 'বদরগঞ্জ', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, বদরগঞ্জ', NULL, NULL, '05222-56374', NULL, 'useobadarganj@gmail.com', 'https://seo.badargonj.rangpur.gov.bd', 'https://seo.badargonj.rangpur.gov.bd/pages/officers', TRUE),
  (5, 'upazila', 'রংপুর', 'তারাগঞ্জ', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, তারাগঞ্জ', NULL, NULL, '05228-56108', NULL, 'useo.taraganj@gmail.com', 'https://seo.taragonj.rangpur.gov.bd', 'https://seo.taragonj.rangpur.gov.bd/pages/officers', TRUE),
  (6, 'upazila', 'রংপুর', 'গংগাচড়া', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, গংগাচড়া', NULL, NULL, '05223-56044', NULL, 'gangacharauseo@gmail.com', 'https://seo.gangachara.rangpur.gov.bd', 'https://seo.gangachara.rangpur.gov.bd/pages/officers', TRUE),
  (7, 'upazila', 'রংপুর', 'কাউনিয়া', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, কাউনিয়া', NULL, NULL, '05224-56059', NULL, 'zakiruseo@gmail.com', 'https://seo.kaunia.rangpur.gov.bd', 'https://seo.kaunia.rangpur.gov.bd/pages/officers', TRUE),
  (8, 'upazila', 'রংপুর', 'পীরগাছা', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, পীরগাছা', NULL, NULL, '০৫২২২৫৬৩২০ / 05226-56113', NULL, 'useopirgacharangpur@gmail.com', 'https://seo.pirgacha.rangpur.gov.bd', 'https://seo.pirgacha.rangpur.gov.bd/pages/officers', TRUE),
  (9, 'upazila', 'কুড়িগ্রাম', 'সদর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, সদর', NULL, NULL, '০৫৮১৬১৬১৫', NULL, 'useo.kurigramsadar@gmail.com', 'https://seo.kurigramsadar.kurigram.gov.bd', 'https://seo.kurigramsadar.kurigram.gov.bd/pages/officers', TRUE),
  (10, 'upazila', 'কুড়িগ্রাম', 'রাজিবপুর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, রাজিবপুর', NULL, NULL, '0582356015', NULL, 'useorajibpur@gmail.com', 'https://seo.charrajibpur.kurigram.gov.bd', 'https://seo.charrajibpur.kurigram.gov.bd/pages/officers', TRUE),
  (11, 'upazila', 'কুড়িগ্রাম', 'চিলমারী', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, চিলমারী', NULL, NULL, '0582456096', NULL, 'useo.chilmari@gmail.com', 'https://seo.chilmari.kurigram.gov.bd', 'https://seo.chilmari.kurigram.gov.bd/pages/officers', TRUE),
  (12, 'upazila', 'কুড়িগ্রাম', 'উলিপুর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, উলিপুর', NULL, NULL, '0582956172', NULL, 'useo_ulipur@yahoo.com', 'https://seo.ulipur.kurigram.gov.bd', 'https://seo.ulipur.kurigram.gov.bd/pages/officers', TRUE),
  (13, 'upazila', 'কুড়িগ্রাম', 'নাগেশ্বরী', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, নাগেশ্বরী', NULL, NULL, '0582656002', NULL, 'useo_nageswari@yahoo.com', 'https://seo.nageshwari.kurigram.gov.bd', 'https://seo.nageshwari.kurigram.gov.bd/pages/officers', TRUE),
  (14, 'upazila', 'কুড়িগ্রাম', 'রাজারহাট', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, রাজারহাট', NULL, NULL, '0582756039', NULL, 'useorajarhat.kurigram@gmail.com', 'https://seo.rajarhat.kurigram.gov.bd', 'https://seo.rajarhat.kurigram.gov.bd/pages/officers', TRUE),
  (15, 'upazila', 'কুড়িগ্রাম', 'ফুলবাড়ী', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, ফুলবাড়ী', NULL, NULL, '0582556025', NULL, 'fulbariuseo@gmail.com', 'https://seo.phulbari.kurigram.gov.bd', 'https://seo.phulbari.kurigram.gov.bd/pages/officers', TRUE),
  (16, 'upazila', 'কুড়িগ্রাম', 'রৌমারী', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, রৌমারী', NULL, NULL, '0582856041', NULL, 'useorowmari@yahoo.com', 'https://dshe.rowmari.kurigram.gov.bd', 'https://dshe.rowmari.kurigram.gov.bd/pages/officers', TRUE),
  (17, 'upazila', 'কুড়িগ্রাম', 'ভুরুঙ্গামারী', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, ভুরুঙ্গামারী', NULL, NULL, '0582256018', NULL, 'useobhurungamari15@gmail.com', 'https://seo.bhurungamari.kurigram.gov.bd', 'https://seo.bhurungamari.kurigram.gov.bd/pages/officers', TRUE),
  (18, 'upazila', 'নীলফামারী', 'সদর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, সদর', NULL, NULL, '055161967', NULL, 'useo.habib@gmail.com', 'https://seo.nilphamarisadar.nilphamari.gov.bd', 'https://seo.nilphamarisadar.nilphamari.gov.bd/pages/officers', TRUE),
  (19, 'upazila', 'নীলফামারী', 'ডোমার', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, ডোমার', NULL, NULL, '০৫৫২৩৭৫১৫৭ / 0552375026', NULL, 'useodomar@gmail.com', 'https://seo.domar.nilphamari.gov.bd', 'https://seo.domar.nilphamari.gov.bd/pages/officers', TRUE),
  (20, 'upazila', 'নীলফামারী', 'ডিমলা', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, ডিমলা', NULL, NULL, '0552256346', NULL, 'dimlauseo@gmail.com', 'https://seo.dimla.nilphamari.gov.bd', 'https://seo.dimla.nilphamari.gov.bd/pages/officers', TRUE),
  (21, 'upazila', 'নীলফামারী', 'জলঢাকা', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, জলঢাকা', NULL, NULL, '0552464112', NULL, 'useojaldhaka@gmail.com', 'https://seo.jaldhaka.nilphamari.gov.bd', 'https://seo.jaldhaka.nilphamari.gov.bd/pages/officers', TRUE),
  (22, 'upazila', 'নীলফামারী', 'কিশোরগঞ্জ', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, কিশোরগঞ্জ', NULL, NULL, '0552556042', NULL, 'useokishore@gmail.com', 'https://seo.kishorganj.nilphamari.gov.bd', 'https://seo.kishorganj.nilphamari.gov.bd/pages/officers', TRUE),
  (23, 'upazila', 'নীলফামারী', 'সৈয়দপুর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, সৈয়দপুর', NULL, NULL, '0552672519', NULL, 'useosaidpur@gmail.com', 'https://dshe.syedpur.nilphamari.gov.bd', 'https://dshe.syedpur.nilphamari.gov.bd/pages/officers', TRUE),
  (24, 'upazila', 'গাইবান্ধা', 'সদর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, সদর', NULL, NULL, '05415166', NULL, 'useosadargaibandha@gmail.com', 'https://dshe.gaibandhasadar.gaibandha.gov.bd', 'https://dshe.gaibandhasadar.gaibandha.gov.bd/pages/officers', TRUE),
  (25, 'upazila', 'গাইবান্ধা', 'সুন্দরগঞ্জ', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, সুন্দরগঞ্জ', NULL, NULL, '0542764034', NULL, 'useo.sundurgonj@gmail.com', 'https://seo.sundarganj.gaibandha.gov.bd', 'https://seo.sundarganj.gaibandha.gov.bd/pages/officers', TRUE),
  (26, 'upazila', 'গাইবান্ধা', 'সাদুল্লাপুর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, সাদুল্লাপুর', NULL, NULL, '০২৫৮৯৯৮৪৬১৪ / 0542556045', NULL, 'useosadullapurgaibandha@gmail.com', 'https://seo.sadullapur.gaibandha.gov.bd', 'https://seo.sadullapur.gaibandha.gov.bd/pages/officers', TRUE),
  (27, 'upazila', 'গাইবান্ধা', 'পলাশবাড়ী', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, পলাশবাড়ী', NULL, NULL, '0542456004', NULL, 'useopalashbari@gmail.com / useonoquibg@gmail.com', 'https://seo.palashbari.gaibandha.gov.bd', 'https://seo.palashbari.gaibandha.gov.bd/pages/officers', TRUE),
  (28, 'upazila', 'গাইবান্ধা', 'গোবিন্দগঞ্জ', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, গোবিন্দগঞ্জ', NULL, NULL, '0542375092', NULL, 'useo.gobindaganj@gmail.com', 'https://dshe.gobindaganj.gaibandha.gov.bd', 'https://dshe.gobindaganj.gaibandha.gov.bd/pages/officers', TRUE),
  (29, 'upazila', 'গাইবান্ধা', 'সাঘাটা', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, সাঘাটা', NULL, NULL, '0542656262', NULL, 'seosaghatagai@gmail.com', 'https://seo.saghata.gaibandha.gov.bd', 'https://seo.saghata.gaibandha.gov.bd/pages/officers', TRUE),
  (30, 'upazila', 'গাইবান্ধা', 'ফুলছড়ি', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, ফুলছড়ি', NULL, NULL, '0542256035', NULL, 'useo_fulchari@yahoo.com / useofulchari@gmail.com', 'https://seo.phulchari.gaibandha.gov.bd', 'https://seo.phulchari.gaibandha.gov.bd/pages/officers', TRUE),
  (31, 'upazila', 'লালমনিরহাট', 'সদর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, সদর', NULL, NULL, '০৫৯১৬১৭১০', NULL, 'useolalsadar@yahoo.com / useolalmonirhatsadar@gmail.com', 'https://seo.sadar.lalmonirhat.gov.bd', 'https://seo.sadar.lalmonirhat.gov.bd/pages/officers', TRUE),
  (32, 'upazila', 'লালমনিরহাট', 'আদিতমারী', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, আদিতমারী', NULL, NULL, '০২৫৮৯৯৮৮৪১৭ / 0592256013', NULL, 'useoaditmari@yahoo.com', 'https://seo.aditmari.lalmonirhat.gov.bd', 'https://seo.aditmari.lalmonirhat.gov.bd/pages/officers', TRUE),
  (33, 'upazila', 'লালমনিরহাট', 'কালিগঞ্জ', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, কালীগঞ্জ', NULL, NULL, '0592456008', NULL, 'useokalilal@gmail.com', 'https://seo.kaliganj.lalmonirhat.gov.bd', 'https://seo.kaliganj.lalmonirhat.gov.bd/pages/officers', TRUE),
  (34, 'upazila', 'লালমনিরহাট', 'হাতিবান্ধা', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, হাতীবান্ধা', NULL, NULL, '০৫৯২৩৫৬১৫৪', NULL, 'useohatibandha93@gmail.com', 'https://seo.hatibandha.lalmonirhat.gov.bd', 'https://seo.hatibandha.lalmonirhat.gov.bd/pages/officers', TRUE),
  (35, 'upazila', 'লালমনিরহাট', 'পাটগ্রাম', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, পাটগ্রাম', NULL, NULL, '0592556023', NULL, 'useopatlal@gmail.com', 'https://seo.patgram.lalmonirhat.gov.bd', 'https://seo.patgram.lalmonirhat.gov.bd/pages/officers', TRUE),
  (36, 'upazila', 'দিনাজপুর', 'সদর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, সদর', NULL, NULL, '০২৫৮৯৯২২০৬০ / 053162060', NULL, 'useodinajpur@gmail.com', 'https://seo.dinajpursadar.dinajpur.gov.bd', 'https://seo.dinajpursadar.dinajpur.gov.bd/pages/officers', TRUE),
  (37, 'upazila', 'দিনাজপুর', 'বিরল', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, বিরল', NULL, NULL, '0532456097', NULL, 'useo_birol@yahoo.com', 'https://seo.birol.dinajpur.gov.bd', 'https://seo.birol.dinajpur.gov.bd/pages/officers', TRUE),
  (38, 'upazila', 'দিনাজপুর', 'বোচাগঞ্জ', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, বোচাগঞ্জ', NULL, NULL, '0532573195', NULL, 'useobochagonj@gmail.com', 'https://seo.bochaganj.dinajpur.gov.bd', 'https://seo.bochaganj.dinajpur.gov.bd/pages/officers', TRUE),
  (39, 'upazila', 'দিনাজপুর', 'কাহারোল', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, কাহারোল', NULL, NULL, '0533556055', NULL, 'kaharoluseo@gmail.com', 'https://seo.kaharol.dinajpur.gov.bd', 'https://seo.kaharol.dinajpur.gov.bd/pages/officers', TRUE),
  (40, 'upazila', 'দিনাজপুর', 'খানসামা', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, খানসামা', NULL, NULL, '0533256011', NULL, 'useokhansama@gmail.com', 'https://seo.khansama.dinajpur.gov.bd', 'https://seo.khansama.dinajpur.gov.bd/pages/officers', TRUE),
  (41, 'upazila', 'দিনাজপুর', 'চিরিরবন্দর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, চিরিরবন্দর', NULL, NULL, '0532656216', NULL, 'useo.chirir@gmail.com', 'https://seo.chirirbandar.dinajpur.gov.bd', 'https://seo.chirirbandar.dinajpur.gov.bd/pages/officers', TRUE),
  (42, 'upazila', 'দিনাজপুর', 'পার্বতীপুর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, পার্বতীপুর', NULL, NULL, '0533474409', NULL, 'useoparbatipur15@gmail.com', 'https://seo.parbatipur.dinajpur.gov.bd', 'https://seo.parbatipur.dinajpur.gov.bd/pages/officers', TRUE),
  (43, 'upazila', 'দিনাজপুর', 'নবাবগঞ্জ', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, নবাবগঞ্জ', NULL, NULL, '0533356032', NULL, 'useo275nawabdin@yahoo.com', 'https://seo.nawabganj.dinajpur.gov.bd', 'https://seo.nawabganj.dinajpur.gov.bd/pages/officers', TRUE),
  (44, 'upazila', 'দিনাজপুর', 'বীরগঞ্জ', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, বীরগঞ্জ', NULL, NULL, '০৫৩২৩-৭২৫৬৫', NULL, 'useobirgonj@gmail.com', 'https://seo.birganj.dinajpur.gov.bd', 'https://seo.birganj.dinajpur.gov.bd/pages/officers', TRUE),
  (45, 'upazila', 'দিনাজপুর', 'ফুলবাড়ী', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, ফুলবাড়ী', NULL, NULL, '053275274', NULL, 'useofulbari2013@gmail.com', 'https://seo.fulbari.dinajpur.gov.bd', 'https://seo.fulbari.dinajpur.gov.bd/pages/officers', TRUE),
  (46, 'upazila', 'দিনাজপুর', 'বিরামপুর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, বিরামপুর', NULL, NULL, '0532256552', NULL, 'useobirampur@gmail.com', 'https://seo.birampur.dinajpur.gov.bd', 'https://seo.birampur.dinajpur.gov.bd/pages/officers', TRUE),
  (47, 'upazila', 'দিনাজপুর', 'হাকিমপুর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, হাকিমপুর', NULL, NULL, '0532975310', NULL, 'useohakimdinaj@gmail.com', 'https://seo.hakimpur.dinajpur.gov.bd', 'https://seo.hakimpur.dinajpur.gov.bd/pages/officers', TRUE),
  (48, 'upazila', 'দিনাজপুর', 'ঘোড়াঘাট', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, ঘোড়াঘাট', NULL, NULL, '0532856033', NULL, 'useo.ghoraghat@gmail.com', 'https://seo.ghoraghat.dinajpur.gov.bd', 'https://seo.ghoraghat.dinajpur.gov.bd/pages/officers', TRUE),
  (49, 'upazila', 'পঞ্চগড়', 'সদর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, সদর', NULL, NULL, '056861927', NULL, 'useopanchagarhsadar5@gmail.com', 'https://dshe.panchagarhsadar.panchagarh.gov.bd', 'https://dshe.panchagarhsadar.panchagarh.gov.bd/pages/officers', TRUE),
  (50, 'upazila', 'পঞ্চগড়', 'বোদা', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, বোদা', NULL, NULL, '0565356204', NULL, 'useoboda@yahoo.com', 'https://seo.boda.panchagarh.gov.bd', 'https://seo.boda.panchagarh.gov.bd/pages/officers', TRUE),
  (51, 'upazila', 'পঞ্চগড়', 'দেবীগঞ্জ', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, দেবীগঞ্জ', NULL, NULL, '0565456045', NULL, 'useodebigonj@yahoo.com', 'https://dshe.debiganj.panchagarh.gov.bd', 'https://dshe.debiganj.panchagarh.gov.bd/pages/officers', TRUE),
  (52, 'upazila', 'পঞ্চগড়', 'আটোয়ারী', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, আটোয়ারী', NULL, NULL, '০২৫৮৮৮৭৮৮৩০ / 0565256008', NULL, 'atwariuseo.bd@gmail.com', 'https://seo.atwari.panchagarh.gov.bd', 'https://seo.atwari.panchagarh.gov.bd/pages/officers', TRUE),
  (53, 'upazila', 'পঞ্চগড়', 'তেঁতুলিয়া', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, তেঁতুলিয়া', NULL, NULL, '0565575042', NULL, 'useotetulia@gmail.com', 'https://seo.tetulia.panchagarh.gov.bd', 'https://seo.tetulia.panchagarh.gov.bd/pages/officers', TRUE),
  (54, 'upazila', 'ঠাকুরগাঁও', 'সদর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, সদর', NULL, NULL, '056161856', NULL, 'useothakurgaonsadar@gamil.com', 'https://seo.thakurgaonsadar.thakurgaon.gov.bd', 'https://seo.thakurgaonsadar.thakurgaon.gov.bd/pages/officers', TRUE),
  (55, 'upazila', 'ঠাকুরগাঁও', 'পীরগঞ্জ', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, পীরগঞ্জ', NULL, NULL, '০৫৬২৪-৫৬২০ / 0562456388', NULL, 'useopirganj@gmail.com', 'https://seo.pirganj.thakurgaon.gov.bd', 'https://seo.pirganj.thakurgaon.gov.bd/pages/officers', TRUE),
  (56, 'upazila', 'ঠাকুরগাঁও', 'রানীশংকৈল', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, রানীশংকৈল', NULL, NULL, '0562556042', NULL, 'ranisankailuseo@gmail.com', 'https://seo.ranisankail.thakurgaon.gov.bd', 'https://seo.ranisankail.thakurgaon.gov.bd/pages/officers', TRUE),
  (57, 'upazila', 'ঠাকুরগাঁও', 'বালিয়াডাঙ্গী', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, বালিয়াডাঙ্গী', NULL, NULL, '0562256062', NULL, 'useobaliadangi@gmail.com', 'https://seo.baliadangi.thakurgaon.gov.bd', 'https://seo.baliadangi.thakurgaon.gov.bd/pages/officers', TRUE),
  (58, 'upazila', 'ঠাকুরগাঁও', 'হরিপুর', 'উপজেলা মাধ্যমিক শিক্ষা অফিস, হরিপুর', NULL, NULL, '0562356023', NULL, 'useoharipur@gmail.com', 'https://seo.haripur.thakurgaon.gov.bd', 'https://seo.haripur.thakurgaon.gov.bd/pages/officers', TRUE)
ON CONFLICT (office_type, district, COALESCE(upazila, '')) DO NOTHING;
