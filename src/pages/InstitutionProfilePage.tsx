import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Check,
  Edit3,
  MapPin,
  Share2,
  UserCheck,
} from 'lucide-react';
import { ContactActions } from '../components/ContactActions';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { getInstitutionById } from '../services/institutions';
import {
  CATEGORY_LABELS_EN,
  type Institution,
  type InstitutionCategoryName,
} from '../types/institution';
import {
  extractIdFromSlug,
  translateManagement,
  translateMpoStatus,
  translateOriginalType,
  translateVerification,
} from '../utils/bangla';
import {
  buildInstitutionJsonLd,
  setDynamicJsonLd,
  updatePageMeta,
} from '../utils/seo';
import {
  UNASSIGNED_CATEGORY_MESSAGE_BN,
  UNASSIGNED_CATEGORY_MESSAGE_EN,
  UNASSIGNED_HEAD_MESSAGE_BN,
  UNASSIGNED_HEAD_MESSAGE_EN,
  getBestContactInfo,
  isCategoryUnassigned,
  sanitizeHeadName,
} from '../utils/validators';

interface InstitutionProfilePageProps {
  slugOrId: string;
  onNavigate: (path: string) => void;
}

export function InstitutionProfilePage({
  slugOrId,
  onNavigate,
}: InstitutionProfilePageProps) {
  const { lang } = useLanguage();
  const { isAdmin } = useAuth();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let mounted = true;
    const id = extractIdFromSlug(slugOrId);
    setLoading(true);
    getInstitutionById(id)
      .then(({ institution: found }) => {
        if (!mounted) return;
        setInstitution(found);
        if (found) {
          const displayName = found.name_bn
            ? `${found.name_bn} (${found.name_en})`
            : found.name_en;
          updatePageMeta({
            title: `${displayName} — EduDirectory BD`,
            description: `${displayName}, ${found.upazila}, ${found.district}। EIIN: ${found.eiin ?? 'N/A'}, ব্যবস্থাপনা: ${translateManagement(found.management, 'bn')}।`,
            canonicalPath: `/institution/${slugOrId}`,
          });
          setDynamicJsonLd(
            'institution-jsonld',
            buildInstitutionJsonLd(found, window.location.href)
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      setDynamicJsonLd('institution-jsonld', null);
    };
  }, [slugOrId]);

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-64 bg-white border border-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">
          {lang === 'bn' ? 'প্রতিষ্ঠানটি পাওয়া যায়নি' : 'Institution not found'}
        </h1>
        <p className="text-sm text-slate-600">
          {lang === 'bn'
            ? 'অনুরোধকৃত শিক্ষা প্রতিষ্ঠানের রেকর্ডটি সক্রিয় নয় অথবা ঠিকানাটি সঠিক নয়।'
            : 'The requested institution record is unavailable or inactive.'}
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-2 px-5 min-h-[44px] rounded-xl bg-blue-700 text-white text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{lang === 'bn' ? 'ডিরেক্টরিতে ফিরে যান' : 'Back to Directory'}</span>
        </button>
      </div>
    );
  }

  const headName = sanitizeHeadName(institution.head_name);
  const contact = getBestContactInfo(institution);
  const unassignedCat = isCategoryUnassigned(institution.refined_category);

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Breadcrumb & Top Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 text-blue-700 font-semibold hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{lang === 'bn' ? 'ডিরেক্টরি' : 'Directory'}</span>
          </button>
          <span>/</span>
          <span>{institution.district}</span>
          <span>/</span>
          <span className="text-slate-700 font-medium">{institution.upazila}</span>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-emerald-700">
                  {lang === 'bn' ? 'লিঙ্ক কপি হয়েছে' : 'Link Copied'}
                </span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'লিঙ্ক শেয়ার' : 'Share Link'}</span>
              </>
            )}
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => onNavigate(`/admin?edit=${institution.id}`)}
              className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-blue-700"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'সম্পাদনা করুন' : 'Edit'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Profile Header Card */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
            <span className="font-mono-tabular font-semibold text-blue-700">
              EIIN: {institution.eiin ?? (lang === 'bn' ? 'তথ্য নেই' : 'Not available')}
            </span>
            <span>·</span>
            <span>{translateManagement(institution.management, lang)}</span>
            <span>·</span>
            <span
              className={
                institution.verification_status === 'verified'
                  ? 'text-emerald-700 font-semibold'
                  : 'text-amber-700 font-semibold'
              }
            >
              {translateVerification(institution.verification_status, lang)}
            </span>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
            {institution.name_bn || institution.name_en}
          </h1>
          {institution.name_bn && (
            <p className="text-base text-slate-600 font-medium">{institution.name_en}</p>
          )}

          <div className="flex items-center gap-1.5 text-sm text-slate-600 pt-1">
            <MapPin className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              {institution.upazila}, {institution.district} ({institution.region})
            </span>
          </div>
        </div>

        {/* Contact Action Bar */}
        <div className="pt-5 border-t border-slate-100 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {lang === 'bn' ? 'সরাসরি যোগাযোগ' : 'Direct Contact Actions'}
          </h2>
          <ContactActions institution={institution} />
        </div>
      </section>

      {/* Structured Metadata Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Building2 className="w-4 h-4 text-blue-700" />
            <span>{lang === 'bn' ? 'প্রাতিষ্ঠানিক শ্রেণিবিভাগ ও এমপিও' : 'Classification & MPO'}</span>
          </div>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">
                {lang === 'bn' ? 'পরিশোধিত ক্যাটাগরি' : 'Refined Institution Category'}
              </dt>
              <dd
                className={`font-semibold mt-0.5 ${
                  unassignedCat ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {institution.refined_category
                  ? lang === 'bn'
                    ? institution.refined_category
                    : CATEGORY_LABELS_EN[
                        institution.refined_category as InstitutionCategoryName
                      ] ?? institution.refined_category
                  : lang === 'bn'
                  ? UNASSIGNED_CATEGORY_MESSAGE_BN
                  : UNASSIGNED_CATEGORY_MESSAGE_EN}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-slate-500">
                {lang === 'bn' ? 'মূল প্রতিষ্ঠানের ধরন (উৎস)' : 'Original Institution Type (Source)'}
              </dt>
              <dd className="font-medium text-slate-800 mt-0.5">
                {translateOriginalType(institution.original_type, lang)}
              </dd>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <dt className="text-xs text-slate-500">
                  {lang === 'bn' ? 'এমপিও অবস্থা' : 'MPO Status'}
                </dt>
                <dd className="font-medium text-slate-800 mt-0.5">
                  {translateMpoStatus(institution.mpo_status, lang)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">
                  {lang === 'bn' ? 'এমপিও কোড' : 'MPO Code'}
                </dt>
                <dd className="font-mono-tabular text-slate-800 mt-0.5">
                  {institution.mpo_code ?? '—'}
                </dd>
              </div>
            </div>
          </dl>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <UserCheck className="w-4 h-4 text-blue-700" />
            <span>{lang === 'bn' ? 'প্রতিষ্ঠান প্রধান ও যোগাযোগ তথ্য' : 'Head & Contact Details'}</span>
          </div>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">
                {lang === 'bn' ? 'প্রতিষ্ঠান প্রধানের নাম' : 'Head of Institution'}
              </dt>
              <dd
                className={`mt-0.5 font-medium ${
                  headName ? 'text-slate-900' : 'text-amber-700'
                }`}
              >
                {headName ??
                  (lang === 'bn'
                    ? UNASSIGNED_HEAD_MESSAGE_BN
                    : UNASSIGNED_HEAD_MESSAGE_EN)}
              </dd>
              {institution.head_designation && (
                <dd className="text-xs text-slate-500 mt-0.5">
                  {institution.head_designation}
                </dd>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-slate-500">
                  {lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile'}
                </dt>
                <dd className="font-mono-tabular text-slate-800 mt-0.5">
                  {contact.mobile.displayList[0] ?? institution.mobile_raw ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">
                  {lang === 'bn' ? 'প্রতিষ্ঠানের ফোন' : 'Phone'}
                </dt>
                <dd className="font-mono-tabular text-slate-800 mt-0.5">
                  {contact.phone.displayList[0] ?? institution.phone_raw ?? '—'}
                </dd>
              </div>
            </div>

            <div>
              <dt className="text-xs text-slate-500">
                {lang === 'bn' ? 'ইমেইল ঠিকানা' : 'Email Address'}
              </dt>
              <dd className="text-slate-800 mt-0.5 break-all">
                {contact.email ?? (lang === 'bn' ? 'বৈধ ইমেইল যুক্ত নেই' : 'Not available')}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </article>
  );
}
