'use client';

import type { Locale } from '@peera/i18n';
import { Skeleton } from '@peera/ui';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useRole } from '../client-store/role';

/**
 * Owner-only pages (SPEC §3): staff are sent to their landing page. The role is read in the browser, so the first
 * paint of an owner page can show the skeleton until the role is known.
 */
export function OwnerOnly({ locale, children }: { locale: Locale; children: ReactNode }) {
  const role = useRole();
  const router = useRouter();
  const allowed = role === 'owner';

  useEffect(() => {
    if (!allowed) router.replace(`/${locale}`);
  }, [allowed, locale, router]);

  if (!allowed) return <Skeleton locale={locale} lines={4} />;
  return <>{children}</>;
}
