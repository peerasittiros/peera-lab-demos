'use client';

import type { Locale } from '@peera/i18n';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { readRole } from '@/src/client-store/role';
import { homePath } from './nav-config';

/** Replaces `/{locale}` with the start page of the role stored in this browser, keeping the query (embed, theme). */
export function RoleHome({ locale }: { locale: Locale }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(
      `/${locale}${homePath(readRole())}${window.location.search}`,
    );
  }, [locale, router]);
  return null;
}
