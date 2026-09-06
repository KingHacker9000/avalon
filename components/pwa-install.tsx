'use client';

import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform: string };

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

export function PwaInstall() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }

    const onBeforeInstall = (event: Event) => {
      const prompt = event as BeforeInstallPromptEvent;
      prompt.preventDefault();
      setInstallPrompt(prompt);
    };
    const onInstalled = () => setInstallPrompt(null);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!installPrompt) return null;

  const install = async () => {
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <button
      type="button"
      className="pwa-install"
      onClick={() => void install()}
      aria-label="Install Avalon as an app"
    >
      <Download aria-hidden="true" />
      <span>Install Avalon</span>
    </button>
  );
}
