import React, { useState } from 'react';
import { Check, Copy, Mail, MessageCircle, Phone } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import type { Institution } from '../types/institution';
import { getBestContactInfo } from '../utils/validators';

interface ContactActionsProps {
  institution: Institution;
  compact?: boolean;
}

export function ContactActions({ institution, compact = false }: ContactActionsProps) {
  const { lang } = useLanguage();
  const contact = getBestContactInfo(institution);
  const [copiedKey, setCopiedKey] = useState<'phone' | 'email' | null>(null);

  const handleCopy = async (text: string, key: 'phone' | 'email') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback ignored gracefully
    }
  };

  const hasAny =
    contact.primaryTelHref ||
    contact.primaryWhatsAppHref ||
    contact.email;

  if (!hasAny) {
    return (
      <p className="text-xs text-slate-500">
        {lang === 'bn'
          ? 'বৈধ ফোন, মোবাইল বা ইমেইল তথ্য এখনো যুক্ত করা হয়নি।'
          : 'No verified phone, mobile, or email contact available yet.'}
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {contact.primaryTelHref && (
          <a
            href={contact.primaryTelHref}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold transition-colors ${
              compact ? 'px-3 min-h-[38px] text-xs' : 'px-4 min-h-[44px] text-sm'
            }`}
          >
            <Phone className="w-4 h-4 shrink-0" />
            <span>{lang === 'bn' ? 'কল করুন' : 'Call'}</span>
          </a>
        )}

        {contact.primaryWhatsAppHref && (
          <a
            href={contact.primaryWhatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition-colors ${
              compact ? 'px-3 min-h-[38px] text-xs' : 'px-4 min-h-[44px] text-sm'
            }`}
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>{lang === 'bn' ? 'WhatsApp চ্যাট' : 'WhatsApp Chat'}</span>
          </a>
        )}

        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold transition-colors ${
              compact ? 'px-3 min-h-[38px] text-xs' : 'px-4 min-h-[44px] text-sm'
            }`}
          >
            <Mail className="w-4 h-4 shrink-0 text-blue-700" />
            <span>{lang === 'bn' ? 'ইমেইল পাঠান' : 'Send Email'}</span>
          </a>
        )}

        {contact.primaryDisplayNumber && (
          <button
            type="button"
            onClick={() => handleCopy(contact.primaryDisplayNumber!, 'phone')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium transition-colors ${
              compact ? 'px-2.5 min-h-[38px] text-xs' : 'px-3.5 min-h-[44px] text-sm'
            }`}
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
        )}

        {!compact && contact.email && (
          <button
            type="button"
            onClick={() => handleCopy(contact.email!, 'email')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium px-3.5 min-h-[44px] text-sm transition-colors"
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
        )}
      </div>

      {!compact && contact.primaryWhatsAppHref && (
        <p className="text-xs text-slate-500">
          {lang === 'bn'
            ? 'দ্রষ্টব্য: ওয়েব ব্রাউজার থেকে সরাসরি WhatsApp ভয়েস কল শুরু করা সম্ভব নয়; "WhatsApp চ্যাট" বাটনে ক্লিক করলে সরাসরি চ্যাট স্ক্রিন খুলবে এবং সেখান থেকে কল করা যাবে।'
            : 'Note: Web browsers cannot directly initiate WhatsApp voice calls; clicking "WhatsApp Chat" opens the chat window where you can call.'}
        </p>
      )}
    </div>
  );
}
