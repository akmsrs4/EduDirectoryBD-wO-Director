import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { updatePageMeta } from '../utils/seo';

interface LoginPageProps {
  mode: 'login' | 'reset-password';
  onNavigate: (path: string) => void;
}

export function LoginPage({ mode, onNavigate }: LoginPageProps) {
  const {
    isAdmin,
    signIn,
    sendPasswordReset,
    updatePassword,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [view, setView] = useState<'login' | 'forgot' | 'update'>(
    mode === 'reset-password' ? 'update' : 'login'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    updatePageMeta({
      title: 'অ্যাডমিন লগইন — EduDirectory BD',
      description: 'EduDirectory BD অ্যাডমিনিস্ট্রেটর প্যানেল লগইন।',
      noIndex: true,
    });
  }, []);

  useEffect(() => {
    if (isAdmin && mode !== 'reset-password') {
      onNavigate('/admin');
    }
  }, [isAdmin, mode, onNavigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    const res = await signIn(email, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'লগইন ব্যর্থ হয়েছে।');
      return;
    }
    onNavigate('/admin');
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    const res = await sendPasswordReset(email);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'পাসওয়ার্ড রিসেট ইমেইল পাঠানো যায়নি।');
      return;
    }
    setMessage('পাসওয়ার্ড রিসেট লিঙ্ক আপনার ইমেইলে পাঠানো হয়েছে। ইনবক্স বা স্প্যাম ফোল্ডার দেখুন।');
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await updatePassword(newPassword);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'পাসওয়ার্ড আপডেট করা যায়নি।');
      return;
    }
    setMessage('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে।');
    setTimeout(() => onNavigate('/admin'), 1200);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>ডিরেক্টরিতে ফিরে যান</span>
          </button>
          <div className="flex items-center gap-2.5 pt-1">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900">
                {view === 'login'
                  ? 'অ্যাডমিন লগইন'
                  : view === 'forgot'
                  ? 'পাসওয়ার্ড রিসেট'
                  : 'নতুন পাসওয়ার্ড সেট করুন'}
              </h1>
              <p className="text-xs text-slate-500">
                শুধুমাত্র অনুমোদিত EduDirectory BD অ্যাডমিনিস্ট্রেটরদের জন্য
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 font-medium">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-medium flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                অ্যাডমিন ইমেইল
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full min-h-[44px] pl-10 pr-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                পাসওয়ার্ড
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[44px] pl-10 pr-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[46px] rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-400 text-white text-sm font-semibold transition-colors"
            >
              {submitting ? 'যাচাই করা হচ্ছে...' : 'লগইন করুন'}
            </button>

            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setView('forgot');
                }}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                পাসওয়ার্ড ভুলে গেছেন?
              </button>
            </div>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                নিবন্ধিত অ্যাডমিন ইমেইল
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[46px] rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-400 text-white text-sm font-semibold"
            >
              {submitting ? 'পাঠানো হচ্ছে...' : 'রিসেট লিঙ্ক পাঠান'}
            </button>
            <button
              type="button"
              onClick={() => setView('login')}
              className="w-full text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              লগইনে ফিরে যান
            </button>
          </form>
        )}

        {view === 'update' && (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[46px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold"
            >
              {submitting ? 'সংরক্ষণ হচ্ছে...' : 'নতুন পাসওয়ার্ড সংরক্ষণ করুন'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
