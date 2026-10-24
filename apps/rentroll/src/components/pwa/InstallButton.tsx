'use client';

import type { Locale } from '@peera/i18n';
import { Button } from '@peera/ui';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { translator } from '@/src/i18n';
import { IosInstallSheet } from './IosInstallSheet';

type InstallPrompt = Event & { prompt: () => Promise<void> };

/**
 * Installs the app (SPEC §6). Chrome and Edge give a prompt, which the button triggers; iOS gets the three-step sheet;
 * in the website frame the button opens the app in a new tab instead, since install needs the top window. Hidden once
 * the app runs as an installed app.
 */
export function InstallButton({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const p = m.pwa;
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [mode, setMode] = useState<'hidden' | 'prompt' | 'ios' | 'frame'>(
    'hidden',
  );
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (window.top !== window.self) {
      setMode('frame');
      return;
    }
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) setMode('ios');
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setMode('prompt');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (mode === 'hidden') return null;

  if (mode === 'frame') {
    const url = new URL(window.location.href);
    url.searchParams.delete('embed');
    return (
      <a
        href={url.toString()}
        target="_blank"
        rel="noopener"
        lang={locale}
        className="inline-flex min-h-11 items-center text-ink underline-offset-4 hover:underline"
      >
        {p.openNewTab}
      </a>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        locale={locale}
        onClick={() => {
          if (mode === 'ios') return setSheet(true);
          void prompt?.prompt();
        }}
      >
        <Download aria-hidden size={18} strokeWidth={1.75} />
        {p.install}
      </Button>
      {mode === 'ios' ? (
        <IosInstallSheet locale={locale} open={sheet} onOpenChange={setSheet} />
      ) : null}
    </>
  );
}
