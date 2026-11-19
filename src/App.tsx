import React, { useEffect, useState } from 'react';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { AuthProvider } from './hooks/useAuth';
import { LanguageProvider } from './hooks/useLanguage';
import { AboutPage } from './pages/AboutPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { DirectoryPage } from './pages/DirectoryPage';
import { InstitutionProfilePage } from './pages/InstitutionProfilePage';
import { LoginPage } from './pages/LoginPage';
import { OfficesPage } from './pages/OfficesPage';

function AppRouter() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname || '/');
  const [searchParams, setSearchParams] = useState<string>(() => window.location.search || '');
  const [directoryPreset, setDirectoryPreset] = useState<{
    district?: string;
    category?: string;
  }>({});

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname || '/');
      setSearchParams(window.location.search || '');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (to: string) => {
    const [pathOnly, queryOnly] = to.split('?');
    const nextSearch = queryOnly ? `?${queryOnly}` : '';
    window.history.pushState({}, '', to);
    setPathname(pathOnly || '/');
    setSearchParams(nextSearch);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const params = new URLSearchParams(searchParams);
  const initialDistrict = directoryPreset.district ?? params.get('district') ?? '';
  const initialCategory = directoryPreset.category ?? params.get('category') ?? '';
  const initialEditId = params.get('edit') ?? undefined;

  let content: React.ReactNode;
  if (pathname.startsWith('/institution/')) {
    const slug = decodeURIComponent(pathname.replace('/institution/', ''));
    content = <InstitutionProfilePage slugOrId={slug} onNavigate={navigate} />;
  } else if (pathname === '/offices') {
    content = <OfficesPage onNavigate={navigate} />;
  } else if (pathname === '/about') {
    content = <AboutPage />;
  } else if (pathname === '/login') {
    content = <LoginPage mode="login" onNavigate={navigate} />;
  } else if (pathname === '/reset-password') {
    content = <LoginPage mode="reset-password" onNavigate={navigate} />;
  } else if (pathname.startsWith('/admin')) {
    content = <AdminDashboardPage onNavigate={navigate} initialEditId={initialEditId} />;
  } else {
    content = (
      <DirectoryPage
        key={`${initialDistrict}-${initialCategory}`}
        onNavigate={navigate}
        initialDistrict={initialDistrict}
        initialCategory={initialCategory}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar
        currentPath={pathname}
        onNavigate={(path) => {
          if (path === '/') setDirectoryPreset({});
          navigate(path);
        }}
      />
      <main className="flex-1">{content}</main>
      <Footer onNavigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </LanguageProvider>
  );
}
