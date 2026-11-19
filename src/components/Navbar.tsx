import React, { useState } from 'react';
import {
  Download,
  GraduationCap,
  Lock,
  Menu,
  Share,
  ShieldCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Navbar({ currentPath, onNavigate }: NavbarProps) {
  const { lang, toggleLang } = useLanguage();
  const { isAdmin } = useAuth();
  const isOnline = useOnlineStatus();
  const {
    shouldShowBanner,
    showIosGuide,
    setShowIosGuide,
    triggerInstall,
    dismissBanner,
  } = usePWAInstall();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { path: '/', labelBn: 'শিক্ষাপ্রতিষ্ঠানসমূহ', labelEn: 'Institutions' },
    { path: '/offices', labelBn: 'শিক্ষা অফিসসমূহ', labelEn: 'Education Offices' },
    { path: '/about', labelBn: 'তথ্যসূত্র ও নিয়ম', labelEn: 'About & Guide' },
  ];

  const handleNav = (path: string) => {
    setMobileMenuOpen(false);
    onNavigate(path);
  };

  return (
    <>
      {shouldShowBanner && (
        <div className="no-print bg-blue-900 text-white border-b border-blue-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <Download className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate font-medium">
                {lang === 'bn'
                  ? 'মোবাইলে অ্যাপ হিসেবে ব্যবহার করুন'
                  : 'Install EduDirectory BD as a mobile app'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={triggerInstall}
                className="px-3 py-1.5 rounded-md bg-white text-blue-900 font-semibold text-xs hover:bg-blue-50 transition-colors whitespace-nowrap"
              >
                {lang === 'bn' ? 'ইনস্টল করুন' : 'Install'}
              </button>
              <button
                type="button"
                onClick={dismissBanner}
                aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                className="p-1.5 rounded-md text-blue-200 hover:text-white hover:bg-blue-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {!isOnline && (
        <div className="no-print bg-amber-50 border-b border-amber-200 text-amber-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex items-center gap-2 text-xs font-medium">
            <WifiOff className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>
              {lang === 'bn'
                ? 'আপনি এখন অফলাইনে আছেন — সংরক্ষিত ক্যাশ থেকে তথ্য দেখানো হচ্ছে।'
                : 'You are currently offline — showing locally cached directory data.'}
            </span>
          </div>
        </div>
      )}

      <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
          {/* Left: Clean Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleNav('/')}
            className="flex items-center gap-2.5 text-left shrink-0 focus:outline-none group"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0 group-hover:bg-blue-800 transition-colors">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-slate-900 whitespace-nowrap">
              EduDirectory <span className="text-blue-700">BD</span>
            </span>
          </button>

          {/* Center: Single-line Navigation Links */}
          <nav
            aria-label="প্রধান নেভিগেশন"
            className="hidden md:flex items-center gap-1"
          >
            {navLinks.map((item) => {
              const active =
                item.path === '/'
                  ? currentPath === '/' || currentPath.startsWith('/institution/')
                  : currentPath.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNav(item.path)}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'text-blue-700 bg-blue-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {lang === 'bn' ? item.labelBn : item.labelEn}
                </button>
              );
            })}
          </nav>

          {/* Right: Language toggle + Single Primary Admin Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleLang}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
              title="ভাষা পরিবর্তন করুন"
            >
              {lang === 'bn' ? 'EN' : 'বাংলা'}
            </button>

            <button
              type="button"
              onClick={() => handleNav(isAdmin ? '/admin' : '/login')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold whitespace-nowrap transition-colors"
            >
              {isAdmin ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'অ্যাডমিন প্যানেল' : 'Admin Panel'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'অ্যাডমিন লগইন' : 'Admin Login'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="মেনু খুলুন"
              className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Compact Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1.5">
            {navLinks.map((item) => {
              const active =
                item.path === '/'
                  ? currentPath === '/'
                  : currentPath.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNav(item.path)}
                  className={`w-full text-left px-3.5 min-h-[44px] rounded-lg text-sm font-medium flex items-center justify-between ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{lang === 'bn' ? item.labelBn : item.labelEn}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => handleNav(isAdmin ? '/admin' : '/login')}
              className="w-full min-h-[44px] px-3.5 rounded-lg bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 mt-2"
            >
              {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>
                {isAdmin
                  ? lang === 'bn'
                    ? 'অ্যাডমিন প্যানেল'
                    : 'Admin Panel'
                  : lang === 'bn'
                  ? 'অ্যাডমিন লগইন'
                  : 'Admin Login'}
              </span>
            </button>
          </div>
        )}
      </header>

      {/* iOS Safari Add-to-Home-Screen Guide Modal */}
      {showIosGuide && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">
                iPhone / iPad-এ অ্যাপ ইনস্টল করার নিয়ম
              </h2>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-slate-700 list-decimal pl-5">
              <li>
                Safari ব্রাউজারের নিচে বা উপরে{' '}
                <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                  <Share className="w-4 h-4" /> Share
                </span>{' '}
                আইকনে ট্যাপ করুন।
              </li>
              <li>
                তালিকা থেকে <strong>“Add to Home Screen”</strong> নির্বাচন করুন।
              </li>
              <li>
                ডানদিকের <strong>“Add”</strong> বাটনে ট্যাপ করলেই হোম স্ক্রিনে EduDirectory BD যুক্ত হবে।
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full min-h-[44px] rounded-lg bg-blue-700 text-white font-semibold text-sm hover:bg-blue-800"
            >
              বুঝেছি
            </button>
          </div>
        </div>
      )}
    </>
  );
}
