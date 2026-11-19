import React, { useState } from 'react';
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import type { EducationOffice } from '../types/institution';
import { normalizeBangladeshiPhone, sanitizeEmail } from '../utils/validators';

interface OfficeDetailModalProps {
  office: EducationOffice;
  onClose: () => void;
}

function splitTokens(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[/,;]+/)
    .map((s) => s.trim())
    .filter((s) => s && s !== '-');
}

export function OfficeDetailModal({ office, onClose }: OfficeDetailModalProps) {
  const { lang } = useLanguage();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const phoneTokens = splitTokens(office.phone_raw);
  const mobileTokens = splitTokens(office.mobile_raw);
  const emailTokens = splitTokens(office.email)
    .map((e) => sanitizeEmail(e) ?? e)
    .filter(Boolean);

  const primaryPhone = normalizeBangladeshiPhone(phoneTokens[0] ?? office.phone_raw);
  const primaryMobile = normalizeBangladeshiPhone(mobileTokens[0] ?? office.mobile_raw);
  const primaryEmail = emailTokens[0] ?? null;

  const isDistrictOffice = office.office_type === 'district';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="office-detail-title"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0 bg-slate-50/70">
          <div className="space-y-1.5 min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                isDistrictOffice
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>
                {isDistrictOffice
                  ? lang === 'bn'
                    ? 'জেলা শিক্ষা অফিস'
                    : 'District Education Office'
                  : lang === 'bn'
                  ? 'উপজেলা মাধ্যমিক শিক্ষা অফিস'
                  : 'Upazila Secondary Education Office'}
              </span>
            </span>
            <h2
              id="office-detail-title"
              className="font-display text-lg sm:text-xl font-bold text-slate-900 leading-snug"
            >
              {office.office_name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                {office.upazila ? `${office.upazila}, ` : ''}
                {office.district}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/70 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          {/* District Officer Info (Shown ONLY for District Education Offices as requested) */}
          {isDistrictOffice && office.officer_name && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 flex items-start gap-3">
              <UserCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-blue-800">
                  {office.officer_designation ||
                    (lang === 'bn' ? 'জেলা শিক্ষা অফিসার' : 'District Education Officer')}
                </div>
                <div className="text-sm sm:text-base font-bold text-slate-900">
                  {office.officer_name}
                </div>
              </div>
            </div>
          )}

          {/* Location Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
              <div className="text-[11px] font-medium text-slate-500">
                {lang === 'bn' ? 'জেলার নাম' : 'District'}
              </div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">{office.district}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
              <div className="text-[11px] font-medium text-slate-500">
                {lang === 'bn' ? 'উপজেলার নাম' : 'Upazila'}
              </div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                {office.upazila || (lang === 'bn' ? 'জেলা পর্যায়' : 'District Level')}
              </div>
            </div>
          </div>

          {/* Official T&T Phone */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600">
                {lang === 'bn' ? 'অফিসিয়াল টিএনটি (T&T) / ফোন নম্বর' : 'Official T&T Phone'}
              </span>
            </div>

            {phoneTokens.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm sm:text-base font-semibold text-slate-900 font-mono-tabular">
                  {office.phone_raw}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {primaryPhone.primaryTelHref && (
                    <a
                      href={primaryPhone.primaryTelHref}
                      className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold transition-colors"
                    >
                      <Phone className="w-4 h-4 shrink-0" />
                      <span>{lang === 'bn' ? 'কল করুন' : 'Call'}</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        primaryPhone.displayList[0] ?? phoneTokens[0] ?? office.phone_raw!,
                        'phone'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-medium transition-colors"
                  >
                    {copiedKey === 'phone' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-700" />
                        <span className="text-emerald-700">
                          {lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'নম্বর কপি' : 'Copy Number'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {lang === 'bn' ? 'অফিস টিএনটি নম্বর সংযুক্ত নেই।' : 'Official T&T phone not listed.'}
              </p>
            )}
          </div>

          {/* Official Mobile (Shown for District Offices if available) */}
          {isDistrictOffice && mobileTokens.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
              <div className="text-xs font-semibold text-slate-600">
                {lang === 'bn' ? 'অফিসিয়াল মোবাইল নম্বর' : 'Official Mobile Number'}
              </div>
              <div className="text-sm sm:text-base font-semibold text-slate-900 font-mono-tabular">
                {office.mobile_raw}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {primaryMobile.primaryTelHref && (
                  <a
                    href={primaryMobile.primaryTelHref}
                    className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold transition-colors"
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{lang === 'bn' ? 'কল করুন' : 'Call'}</span>
                  </a>
                )}
                {primaryMobile.primaryWhatsAppHref && (
                  <a
                    href={primaryMobile.primaryWhatsAppHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>{lang === 'bn' ? 'WhatsApp' : 'WhatsApp'}</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      primaryMobile.displayList[0] ?? mobileTokens[0] ?? office.mobile_raw!,
                      'mobile'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-medium transition-colors"
                >
                  {copiedKey === 'mobile' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-700" />
                      <span className="text-emerald-700">
                        {lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? 'মোবাইল কপি' : 'Copy Mobile'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Official Email */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
            <div className="text-xs font-semibold text-slate-600">
              {lang === 'bn' ? 'অফিসিয়াল ইমেইল আইডি' : 'Official Email Address'}
            </div>
            {primaryEmail ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-900 break-all">{office.email}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`mailto:${primaryEmail}`}
                    className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold transition-colors"
                  >
                    <Mail className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>{lang === 'bn' ? 'ইমেইল পাঠান' : 'Send Email'}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(primaryEmail, 'email')}
                    className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-medium transition-colors"
                  >
                    {copiedKey === 'email' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-700" />
                        <span className="text-emerald-700">
                          {lang === 'bn' ? 'ইমেইল কপি হয়েছে' : 'Copied'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'ইমেইল কপি' : 'Copy Email'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {lang === 'bn' ? 'অফিসিয়াল ইমেইল সংযুক্ত নেই।' : 'Official email not listed.'}
              </p>
            )}
          </div>

          {/* Portal & Officers List External Links (Mobile & Android WebView compatible) */}
          <div className="pt-1 space-y-2.5">
            {office.officers_url && (
              <a
                href={office.officers_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 min-h-[46px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors"
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>
                  {lang === 'bn' ? 'কর্মকর্তাদের তালিকা দেখুন' : 'View Officers List'}
                </span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
              </a>
            )}

            {office.portal_url && (
              <a
                href={office.portal_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 min-h-[46px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors"
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span>
                  {lang === 'bn' ? 'অফিসের ওয়েব পোর্টাল দেখুন' : 'Visit Official Web Portal'}
                </span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
