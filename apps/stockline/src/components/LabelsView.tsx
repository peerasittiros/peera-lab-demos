'use client';

import type { Locale } from '@peera/i18n';
import { cn, Skeleton, ts } from '@peera/ui';
import { useItemViews, useStoreState } from '../client-store/hooks';
import { useRole } from '../client-store/role';
import { ean13Bars } from '../lib/ean13';
import { nameIn, translator } from '../i18n';
import { PageHeader } from './PageHeader';
import { PrintButton } from './PrintButton';

/**
 * One EAN-13 symbol as SVG: quiet zones, longer guard bars, digits under the bars. Black on white in both themes on
 * purpose (the one place raw colors are used): scanners need that contrast, and the sheet is meant for paper.
 */
function Barcode({ code, label }: { code: string; label: string }) {
  const bars = ean13Bars(code);
  if (!bars) return <p className="code m-0 text-ink">{code}</p>;
  const moduleWidth = 2;
  const quiet = 11;
  const width = (95 + quiet * 2) * moduleWidth;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} 96`}
      width={width}
      height={96}
      className="h-auto max-w-full"
    >
      <rect width={width} height={96} fill="#ffffff" />
      {bars.map((bar) => (
        <rect
          key={bar.x}
          x={(quiet + bar.x) * moduleWidth}
          y={6}
          width={bar.width * moduleWidth}
          height={bar.guard ? 76 : 68}
          fill="#000000"
        />
      ))}
      <text
        x={width / 2}
        y={92}
        textAnchor="middle"
        fontSize={14}
        fontFamily="ui-monospace, monospace"
        fill="#000000"
      >
        {code}
      </text>
    </svg>
  );
}

/** The labels sheet (02 §8 screen 4): one printable EAN-13 label per item with a barcode. */
export function LabelsView({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const role = useRole();
  const { status, ledger } = useStoreState();
  const items = useItemViews(role).filter((item) => item.barcode);

  if (!ledger || status === 'loading') return <Skeleton locale={locale} lines={6} />;
  return (
    <>
      <PageHeader
        locale={locale}
        title={m.items.labelsTitle}
        description={m.items.labelsBody}
        actions={<PrintButton locale={locale} label={m.common.print} />}
        className="print:hidden"
      />
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-3 print:gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex break-inside-avoid flex-col items-center gap-2 rounded-sm border border-line bg-surface-raised p-3 text-center print:border-black"
          >
            <span className={cn(ts('ui', locale), 'text-ink')}>{nameIn(item, locale)}</span>
            <Barcode code={item.barcode!} label={`${nameIn(item, locale)} ${item.barcode}`} />
            <span className="code text-ink-muted">{item.sku}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
