'use client';

import type { Locale } from '@peera/i18n';
import { useEffect } from 'react';

/** Keeps `<html lang>` in step with the route, since the root layout is shared by every locale. */
export function LangSync({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
