'use client';

import type { Locale } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';
import {
  ChevronLeft,
  ChevronRight,
  Droplets,
  FileText,
  PiggyBank,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { translator } from '@/src/i18n';

type Entry = { path: string; icon: LucideIcon; title: string; intro: string };

/**
 * Reports is one sidebar entry; its index lists the reports (one row per report, with what it holds), and each report
 * starts with a way back. Settings has its own grouped pages under `components/settings`.
 */
function entries(locale: Locale): Entry[] {
  const { m } = translator(locale);
  return [
    {
      path: '/owner/reports/rent-roll',
      icon: FileText,
      ...m.reports.rentRoll,
    },
    {
      path: '/owner/reports/utilities',
      icon: Droplets,
      ...m.reports.utilities,
    },
    {
      path: '/owner/reports/deposits',
      icon: PiggyBank,
      ...m.reports.deposits,
    },
  ];
}

export function SectionIndex({ locale }: { locale: Locale }) {
  return (
    <ul className="grid max-w-[40rem] overflow-hidden rounded-md border border-line bg-surface-raised">
      {entries(locale).map(({ path, icon: Icon, title, intro }) => (
        <li key={path} className="border-b border-line last:border-b-0">
          <Link
            prefetch={false}
            href={`/${locale}${path}`}
            className={cn(
              'flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-surface-sunken',
              focusRing,
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-product-accent-soft text-product-accent">
              <Icon aria-hidden size={20} strokeWidth={1.75} />
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className={cn(ts('ui', locale), 'font-medium text-ink')}>
                {title}
              </span>
              <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
                {intro}
              </span>
            </span>
            <ChevronRight
              aria-hidden
              size={18}
              strokeWidth={1.75}
              className="shrink-0 text-ink-muted"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "‹ Reports" above a report; nothing on the index itself. */
export function SectionBack({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const pathname = usePathname();
  const index = `/${locale}/owner/reports`;
  if (pathname === index) return null;
  return (
    <Link
      prefetch={false}
      href={index}
      className={cn(
        ts('ui', locale),
        '-ml-2 mb-3 inline-flex min-h-11 items-center gap-1 rounded-sm px-2 text-ink-muted hover:text-ink',
        focusRing,
      )}
    >
      <ChevronLeft aria-hidden size={18} strokeWidth={1.75} />
      {m.nav.reports}
    </Link>
  );
}
