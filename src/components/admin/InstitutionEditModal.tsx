import React, { useState } from 'react';
import { ArchiveRestore, Save, Trash2, X } from 'lucide-react';
import {
  INSTITUTION_CATEGORIES,
  type Institution,
  type VerificationStatus,
} from '../../types/institution';
import {
  createInstitutionAdmin,
  deleteInstitutionHardAdmin,
  setInstitutionActiveAdmin,
  updateInstitutionAdmin,
} from '../../services/institutions';
import {
  normalizeMobileForStorage,
  sanitizeEiin,
  sanitizeHeadName,
  sanitizeMpoCode,
} from '../../utils/validators';

interface InstitutionEditModalProps {
  institution: Institution | null; // null = create new
  readOnlyPreview: boolean;
  onClose: () => void;
  onSaved: (saved: Institution | null) => void;
}

export function InstitutionEditModal({
  institution,
  readOnlyPreview,
  onClose,
  onSaved,
}: InstitutionEditModalProps) {
  const isNew = institution === null;

  const [form, setForm] = useState({
    name_bn: institution?.name_bn ?? '',
    name_en: institution?.name_en ?? '',
    eiin: institution?.eiin ?? '',
    mpo_code: institution?.mpo_code ?? '',
    original_type: institution?.original_type ?? '',
    refined_category: institution?.refined_category ?? '',
    management: institution?.management ?? 'Non-Govt.',
    region: institution?.region ?? 'RANGPUR',
    district: institution?.district ?? '',
    upazila: institution?.upazila ?? '',
    head_name: institution?.head_name ?? '',
    head_designation: institution?.head_designation ?? '',
    phone_raw: institution?.phone_raw ?? '',
    mobile_raw: institution?.mobile_raw ?? '',
    email: institution?.email ?? '',
    mpo_status: institution?.mpo_status ?? '',
    verification_status: (institution?.verification_status ?? 'pending') as VerificationStatus,
    admin_notes: institution?.admin_notes ?? '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnlyPreview) {
      setError('Supabase সংযুক্ত না থাকায় রিড-অনলি প্রিভিউ মোডে পরিবর্তন ডাটাবেসে সংরক্ষণ করা যাবে না।');
      return;
    }

    if (!form.name_en.trim() || !form.district.trim() || !form.upazila.trim()) {
      setError('প্রতিষ্ঠানের ইংরেজি নাম, জেলা এবং উপজেলা/থানা বাধ্যতামূলক।');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: Partial<Institution> = {
        name_bn: form.name_bn.trim() || null,
        name_en: form.name_en.trim(),
        eiin: form.eiin.trim() ? sanitizeEiin(form.eiin) : null,
        mpo_code: form.mpo_code.trim() ? sanitizeMpoCode(form.mpo_code) : null,
        // Preserve existing original_type untouched when editing
        ...(isNew ? { original_type: form.original_type.trim() || null } : {}),
        refined_category: form.refined_category || null,
        management: form.management.trim() || null,
        region: form.region.trim() || 'RANGPUR',
        district: form.district.trim(),
        upazila: form.upazila.trim(),
        head_name: sanitizeHeadName(form.head_name),
        head_designation: form.head_designation.trim() || null,
        phone_raw: normalizeMobileForStorage(form.phone_raw),
        mobile_raw: normalizeMobileForStorage(form.mobile_raw),
        email: form.email.trim() || null,
        mpo_status: form.mpo_status.trim() || null,
        verification_status: form.verification_status,
        admin_notes: form.admin_notes.trim() || null,
      };

      const saved = isNew
        ? await createInstitutionAdmin({
            ...(payload as Omit<Institution, 'id' | 'created_at' | 'updated_at'>),
            serial_no: null,
            is_active: true,
            original_type: form.original_type.trim() || null,
            refined_category: form.refined_category || null,
          })
        : await updateInstitutionAdmin(institution.id, payload);

      onSaved(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!institution || readOnlyPreview) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await setInstitutionActiveAdmin(institution.id, !institution.is_active);
      onSaved(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'স্ট্যাটাস পরিবর্তন করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleHardDelete = async () => {
    if (!institution || readOnlyPreview) return;
    setSaving(true);
    setError(null);
    try {
      await deleteInstitutionHardAdmin(institution.id);
      onSaved(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'স্থায়ীভাবে মুছে ফেলা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              {isNew ? 'নতুন শিক্ষা প্রতিষ্ঠান যুক্ত করুন' : 'প্রতিষ্ঠানের তথ্য সম্পাদনা'}
            </h2>
            {!isNew && (
              <p className="text-xs text-slate-500 font-mono-tabular">
                ID: {institution.id} · মূল ধরন (সুরক্ষিত): {institution.original_type || 'উল্লেখ নেই'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                প্রতিষ্ঠানের নাম (বাংলায়)
              </label>
              <input
                type="text"
                value={form.name_bn}
                onChange={(e) => setForm((f) => ({ ...f, name_bn: e.target.value }))}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                প্রতিষ্ঠানের নাম (ইংরেজিতে) *
              </label>
              <input
                type="text"
                required
                value={form.name_en}
                onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                EIIN নম্বর (৫–৮ সংখ্যা)
              </label>
              <input
                type="text"
                value={form.eiin}
                onChange={(e) => setForm((f) => ({ ...f, eiin: e.target.value }))}
                placeholder="যেমন: 120801"
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                পরিশোধিত ক্যাটাগরি (Refined Category)
              </label>
              <select
                value={form.refined_category}
                onChange={(e) => setForm((f) => ({ ...f, refined_category: e.target.value }))}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">-- শ্রেণিবিভাগ নির্বাচন করুন --</option>
                {INSTITUTION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                মূল উৎস ধরন (Original Institution Type)
              </label>
              <input
                type="text"
                disabled={!isNew}
                value={form.original_type}
                onChange={(e) => setForm((f) => ({ ...f, original_type: e.target.value }))}
                placeholder="যেমন: College - কলেজ"
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100 disabled:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ব্যবস্থাপনা (Management)
              </label>
              <select
                value={form.management}
                onChange={(e) => setForm((f) => ({ ...f, management: e.target.value }))}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="Govt.">Govt. (সরকারি)</option>
                <option value="Non-Govt.">Non-Govt. (বেসরকারি)</option>
                <option value="Autonomous">Autonomous (স্বায়ত্তশাসিত)</option>
                <option value="Local Govt.">Local Govt. (স্থানীয় সরকার)</option>
                <option value="Others">Others (অন্যান্য)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                অঞ্চল (Region)
              </label>
              <input
                type="text"
                value={form.region}
                onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  জেলা *
                </label>
                <input
                  type="text"
                  required
                  value={form.district}
                  onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  উপজেলা/থানা *
                </label>
                <input
                  type="text"
                  required
                  value={form.upazila}
                  onChange={(e) => setForm((f) => ({ ...f, upazila: e.target.value }))}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                প্রতিষ্ঠান প্রধানের নাম
              </label>
              <input
                type="text"
                value={form.head_name}
                onChange={(e) => setForm((f) => ({ ...f, head_name: e.target.value }))}
                placeholder="প্রকৃত নাম লিখুন (প্লেসহোল্ডার নয়)"
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                প্রধানের পদবি
              </label>
              <input
                type="text"
                value={form.head_designation}
                onChange={(e) => setForm((f) => ({ ...f, head_designation: e.target.value }))}
                placeholder="অধ্যক্ষ / প্রধান শিক্ষক / সুপার"
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                প্রতিষ্ঠানের মোবাইল
              </label>
              <input
                type="text"
                value={form.mobile_raw}
                onChange={(e) => setForm((f) => ({ ...f, mobile_raw: e.target.value }))}
                placeholder="যেমন: 01711000000"
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                প্রতিষ্ঠানের ফোন
              </label>
              <input
                type="text"
                value={form.phone_raw}
                onChange={(e) => setForm((f) => ({ ...f, phone_raw: e.target.value }))}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ইমেইল ঠিকানা
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  এমপিও কোড
                </label>
                <input
                  type="text"
                  value={form.mpo_code}
                  onChange={(e) => setForm((f) => ({ ...f, mpo_code: e.target.value }))}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  এমপিওভুক্ত কি না
                </label>
                <select
                  value={form.mpo_status}
                  onChange={(e) => setForm((f) => ({ ...f, mpo_status: e.target.value }))}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="">-- নির্বাচন করুন --</option>
                  <option value="Yes - হ্যাঁ">Yes - হ্যাঁ</option>
                  <option value="No - না">No - না</option>
                  <option value="N/A - প্রযোজ্য নয়">N/A - প্রযোজ্য নয়</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                যাচাইয়ের অবস্থা
              </label>
              <select
                value={form.verification_status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    verification_status: e.target.value as VerificationStatus,
                  }))
                }
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="verified">যাচাইকৃত (Verified)</option>
                <option value="pending">যাচাই বাকি (Pending)</option>
                <option value="needs_review">সংশোধন প্রয়োজন (Needs Review)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Notes
              </label>
              <input
                type="text"
                value={form.admin_notes}
                onChange={(e) => setForm((f) => ({ ...f, admin_notes: e.target.value }))}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            {!isNew ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={saving || readOnlyPreview}
                  onClick={handleToggleActive}
                  className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50"
                >
                  <ArchiveRestore className="w-4 h-4" />
                  <span>
                    {institution.is_active ? 'নিষ্ক্রিয় করুন (Archive)' : 'পুনরুদ্ধার করুন (Restore)'}
                  </span>
                </button>

                {!confirmDelete ? (
                  <button
                    type="button"
                    disabled={saving || readOnlyPreview}
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>স্থায়ীভাবে মুছুন</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving || readOnlyPreview}
                    onClick={handleHardDelete}
                    className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-800"
                  >
                    <span>নিশ্চিত — স্থায়ী ডিলিট</span>
                  </button>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 min-h-[42px] rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 min-h-[42px] rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
