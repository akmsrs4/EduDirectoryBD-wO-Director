import React from 'react';
import { Facebook, MessageCircle, MessageSquare, Phone } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

interface FooterProps {
  onNavigate: (path: string) => void;
}

const WHATSAPP_PREFILLED_TEXT = encodeURIComponent(
  'আসসালামু আলাইকুম, আপনার সেবা সম্পর্কে জানতে চাই।'
);
const WHATSAPP_SUPPORT_URL = `https://wa.me/8801717850780?text=${WHATSAPP_PREFILLED_TEXT}`;

export function Footer({ onNavigate }: FooterProps) {
  const { lang } = useLanguage();

  return (
    <footer className="no-print border-t border-slate-200 bg-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="font-display font-bold text-lg text-slate-900">
              EduDirectory <span className="text-blue-700">BD</span>
            </div>
            <p className="text-sm font-medium text-slate-700">
              বাংলাদেশের শিক্ষা প্রতিষ্ঠানের স্মার্ট ডিজিটাল ডিরেক্টরি।
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              {lang === 'bn'
                ? 'রংপুর অঞ্চলের শিক্ষাপ্রতিষ্ঠান এবং জেলা ও উপজেলা শিক্ষা অফিসের যোগাযোগ তথ্য সহজে খুঁজে পাওয়ার সহায়ক ডিজিটাল ডিরেক্টরি।'
                : 'A helpful digital directory for locating educational institutions and education offices.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="hover:text-blue-700 transition-colors"
            >
              {lang === 'bn' ? 'শিক্ষাপ্রতিষ্ঠানসমূহ' : 'Institutions'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/offices')}
              className="hover:text-blue-700 transition-colors"
            >
              {lang === 'bn' ? 'শিক্ষা অফিসসমূহ' : 'Education Offices'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/about')}
              className="hover:text-blue-700 transition-colors"
            >
              {lang === 'bn' ? 'তথ্যসূত্র ও নিয়ম' : 'About & Guide'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="hover:text-blue-700 transition-colors"
            >
              {lang === 'bn' ? 'অ্যাডমিন প্যানেল' : 'Admin'}
            </button>
          </div>
        </div>

        {/* Custom Developer & Support Branding Section */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              কারিগরি সহযোগিতায়
            </div>
            <div className="font-display text-base sm:text-lg font-bold text-slate-900">
              Developed by A K M Saidur Rahman
            </div>
            <div className="text-xs sm:text-sm font-medium text-slate-700">
              Assistant Programmer, DSHE, Rangpur
            </div>
            <div className="text-xs sm:text-sm text-slate-600 flex items-center gap-2 pt-0.5">
              <Phone className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span>সাপোর্ট হটলাইন / হোয়াটসঅ্যাপ:</span>
              <a
                href="tel:+8801717850780"
                className="font-mono-tabular font-semibold text-slate-900 hover:text-blue-700"
              >
                01717850780
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={WHATSAPP_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 min-h-[42px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold transition-colors"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>WhatsApp সাপোর্ট</span>
            </a>

            <a
              href="https://www.facebook.com/akmsrs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 min-h-[42px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold transition-colors"
            >
              <Facebook className="w-4 h-4 shrink-0" />
              <span>Facebook</span>
            </a>

            <a
              href="https://m.me/akmsrs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 min-h-[42px] rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-semibold transition-colors"
            >
              <MessageSquare className="w-4 h-4 shrink-0 text-blue-700" />
              <span>Messenger</span>
            </a>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">
            © 2026 EduDirectory BD All Rights Reserved.
          </span>
          <span>
            {lang === 'bn'
              ? 'সর্বশেষ প্রাপ্ত তথ্যের ভিত্তিতে সংকলিত · পর্যায়ক্রমে হালনাগাদযোগ্য'
              : 'Compiled from latest available records · Periodically updated'}
          </span>
        </div>
      </div>
    </footer>
  );
}
