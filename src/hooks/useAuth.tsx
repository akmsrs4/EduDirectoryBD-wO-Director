import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import type { AdminUser } from '../types/institution';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  adminProfile: AdminUser | null;
  isAdmin: boolean;
  supabaseConfigured: boolean;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabaseConfigured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(supabaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);

  async function verifyAdminProfile(currentSession: Session | null) {
    const supabase = getSupabaseClient();
    if (!supabase || !currentSession?.user) {
      setAdminProfile(null);
      return;
    }

    try {
      const { data: isAdminFlag, error: rpcErr } = await supabase.rpc('is_admin');
      if (rpcErr || !isAdminFlag) {
        setAdminProfile(null);
        setAuthError('আপনার অ্যাকাউন্টটি অ্যাডমিন হিসেবে অনুমোদিত নয়।');
        return;
      }

      const { data: profile } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', currentSession.user.id)
        .maybeSingle();

      setAdminProfile(
        (profile as AdminUser | null) ?? {
          id: currentSession.user.id,
          user_id: currentSession.user.id,
          email: currentSession.user.email ?? '',
          full_name: 'Administrator',
          role: 'admin',
          is_active: true,
        }
      );
      setAuthError(null);
    } catch {
      setAdminProfile(null);
    }
  }

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await verifyAdminProfile(data.session);
      if (mounted) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void verifyAdminProfile(nextSession);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabaseConfigured]);

  async function signIn(email: string, password: string) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        error: 'এই মুহূর্তে সার্ভার অথেনটিকেশন সক্রিয় নয়। অনুগ্রহ করে পরে চেষ্টা করুন।',
      };
    }

    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return { ok: false, error: error.message };
    }

    const { data: isAdminFlag, error: rpcErr } = await supabase.rpc('is_admin');
    if (rpcErr || !isAdminFlag) {
      await supabase.auth.signOut();
      return {
        ok: false,
        error: 'এই ইমেইলটি অনুমোদিত অ্যাডমিন তালিকায় যুক্ত নেই।',
      };
    }

    setSession(data.session);
    await verifyAdminProfile(data.session);
    return { ok: true };
  }

  async function signOut() {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setAdminProfile(null);
  }

  async function sendPasswordReset(email: string) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'এই মুহূর্তে পাসওয়ার্ড রিসেট সেবা উপলব্ধ নয়।' };
    }
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function updatePassword(newPassword: string) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'সার্ভার সংযোগ উপলব্ধ নয়।' };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  // Strictly require verified Supabase Auth session & active admin_users record — never auto-login
  const isAdmin = Boolean(supabaseConfigured && session?.user && adminProfile?.is_active);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        adminProfile,
        isAdmin,
        supabaseConfigured,
        loading,
        authError,
        signIn,
        signOut,
        sendPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
