'use client';

import type { Locale } from '@peera/i18n';
import { Skeleton } from '@peera/ui';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useRole } from '@/src/client-store/role';

/**
 * Settings are the owner's alone (ux-v2/rentroll.md › Settings). The role is read in the browser, so the first paint of
 * a settings page shows the skeleton until the role is known; a caretaker or the tenant is sent to their home.
 */
export function OwnerOnly({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const role = useRole();
  const router = useRouter();
  const allowed = role === 'owner';

  useEffect(() => {
    if (!allowed) router.replace(`/${locale}`);
  }, [allowed, locale, router]);

  if (!allowed) return <Skeleton locale={locale} lines={4} />;
  return <>{children}</>;
}
