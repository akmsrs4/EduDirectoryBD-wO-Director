import React, { useState } from 'react';
import { Save, X } from 'lucide-react';
import { updateEducationOfficeAdmin } from '../../services/offices';
import type { EducationOffice } from '../../types/institution';
import { normalizeMobileForStorage } from '../../utils/validators';

interface OfficeEditModalProps {
  office: EducationOffice;
  onClose: () => void;
  onSaved: (updated: EducationOffice) => void;
}

export function OfficeEditModal({ office, onClose, onSaved }: OfficeEditModalProps) {
  const [form, setForm] = useState({
    office_name: office.office_name,
    officer_name: office.officer_name ?? '',
    officer_designation: office.officer_designation ?? '',
    phone_raw: office.phone_raw ?? '',
    mobile_raw: office.mobile_raw ?? '',
    email: office.email ?? '',
    portal_url: office.portal_url ?? '',
    officers_url: office.officers_url ?? '',
    is_active: office.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.office_name.trim()) {
      setError('অফিসের নাম বাধ্যতামূলক।');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const cleanedPortal = form.portal_url.trim().replace(/\/+$/, '') || null;
      const cleanedOfficersUrl =
        form.officers_url.trim() || (cleanedPortal ? `${cleanedPortal}/pages/officers` : null);

      const updated = await updateEducationOfficeAdmin(office.id, {
        office_name: form.office_name.trim(),
        officer_name:
          office.office_type === 'district' ? form.officer_name.trim() || null : null,
        officer_designation:
          office.office_type === 'district' ? form.officer_designation.trim() || null : null,
        phone_raw: form.phone_raw.trim() || null,
        mobile_raw:
          office.office_type === 'district'
            ? normalizeMobileForStorage(form.mobile_raw)
            : null,
        email: form.email.trim() || null,
        portal_url: cleanedPortal,
        officers_url: cleanedOfficersUrl,
        is_active: form.is_active,
      });
      onSaved(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              শিক্ষা অফিসের তথ্য সম্পাদনা
            </h2>
            <p className="text-xs text-slate-500">
              {office.upazila ? `${office.upazila}, ` : ''}
              {office.district} ·{' '}
              {office.office_type === 'district'
                ? 'জেলা শিক্ষা অফিস'
                : 'উপজেলা মাধ্যমিক শিক্ষা অফিস'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                অফিসের নাম *
              </label>
              <input
                type="text"
                required
                value={form.office_name}
                onChange={(e) => setForm((f) => ({ ...f, office_name: e.target.value }))}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            {office.office_type === 'district' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    জেলা শিক্ষা অফিসারের নাম
                  </label>
                  <input
                    type="text"
                    value={form.officer_name}
                    onChange={(e) => setForm((f) => ({ ...f, officer_name: e.target.value }))}
                    className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    পদবি
                  </label>
                  <input
                    type="text"
                    value={form.officer_designation}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, officer_designation: e.target.value }))
                    }
                    className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                অফিস ফোন (T&T)
              </label>
              <input
                type="text"
                value={form.phone_raw}
                onChange={(e) => setForm((f) => ({ ...f, phone_raw: e.target.value }))}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm font-mono-tabular"
              />
            </div>

            {office.office_type === 'district' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  অফিসিয়াল মোবাইল নম্বর
                </label>
                <input
                  type="text"
                  value={form.mobile_raw}
                  onChange={(e) => setForm((f) => ({ ...f, mobile_raw: e.target.value }))}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                />
              </div>
            )}

            <div className={office.office_type === 'upazila' ? '' : 'sm:col-span-2'}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                অফিসিয়াল ইমেইল
              </label>
              <input
                type="text"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ওয়েব পোর্টাল (.gov.bd)
              </label>
              <input
                type="url"
                value={form.portal_url}
                onChange={(e) => setForm((f) => ({ ...f, portal_url: e.target.value }))}
                placeholder="https://deo.rangpur.gov.bd"
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                কর্মকর্তাদের তালিকা পেজ (/pages/officers)
              </label>
              <input
                type="url"
                value={form.officers_url}
                onChange={(e) => setForm((f) => ({ ...f, officers_url: e.target.value }))}
                placeholder="ফাঁকা রাখলে পোর্টাল + /pages/officers স্বয়ংক্রিয়ভাবে ব্যবহৃত হবে"
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
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
        </form>
      </div>
    </div>
  );
}
