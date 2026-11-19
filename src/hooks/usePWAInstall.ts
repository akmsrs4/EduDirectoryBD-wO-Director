import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

const DISMISS_KEY = 'edudirectory_pwa_banner_dismissed_at';
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      const ts = localStorage.getItem(DISMISS_KEY);
      if (!ts) return false;
      return Date.now() - Number(ts) < DISMISS_TTL_MS;
    } catch {
      return false;
    }
  });
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);

  const isIos =
    typeof navigator !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setIsInstalled(true);
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const canPromptNative = Boolean(deferredPrompt);
  const shouldShowBanner = !isInstalled && !isDismissed && (canPromptNative || isIos);

  async function triggerInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }
    if (isIos) {
      setShowIosGuide(true);
    }
  }

  function dismissBanner() {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignore
    }
  }

  return {
    isInstalled,
    isIos,
    canPromptNative,
    shouldShowBanner,
    showIosGuide,
    setShowIosGuide,
    triggerInstall,
    dismissBanner,
  };
}
