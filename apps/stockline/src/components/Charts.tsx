'use client';

import {
  formatDate,
  formatMoney,
  formatNumber,
  type Locale,
} from '@peera/i18n';
import { Button, cn, Table, ts } from '@peera/ui';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { translator } from '../i18n';

// Small dependency-free charts for the dashboard: one series each, in the product accent, with a hover/keyboard
// read-out and a table view (platform §5.5: every chart has a data-table alternative).

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry!.contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find(
    (candidate) => candidate * magnitude >= value,
  )!;
  return step * magnitude;
}

/** Compact baht for axis ticks: ฿12k, ฿1.2M. */
function compactMoney(satang: number, locale: Locale): string {
  return `฿${formatNumber(satang / 100, locale, { notation: 'compact', maximumFractionDigits: 1 })}`;
}

export function ChartCard({
  locale,
  title,
  table,
  children,
  id,
}: {
  locale: Locale;
  title: string;
  table: ReactNode;
  children: ReactNode;
  id: string;
}) {
  const { m } = translator(locale);
  const [asTable, setAsTable] = useState(false);
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex min-w-0 flex-col gap-3 rounded-sm border border-line bg-surface-raised p-4 md:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2
          id={`${id}-title`}
          className={cn(ts('title', locale), 'm-0 text-ink')}
        >
          {title}
        </h2>
        <Button
          locale={locale}
          size="sm"
          variant="ghost"
          aria-pressed={asTable}
          onClick={() => setAsTable((value) => !value)}
        >
          {asTable ? m.dashboard.showChart : m.dashboard.showTable}
        </Button>
      </div>
      {asTable ? table : children}
    </section>
  );
}

export function ValueLineChart({
  locale,
  points,
}: {
  locale: Locale;
  points: { date: string; value: number }[];
}) {
  const { m } = translator(locale);
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const height = 220;
  const pad = { top: 12, right: 12, bottom: 28, left: 56 };
  const max = niceMax(Math.max(...points.map((point) => point.value), 0));
  const plotWidth = Math.max(0, width - pad.left - pad.right);
  const plotHeight = height - pad.top - pad.bottom;
  const x = (index: number) =>
    pad.left +
    (points.length <= 1 ? 0 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) =>
    pad.top + plotHeight - (value / max) * plotHeight;
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`,
    )
    .join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((share) => share * max);
  const labels = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const current = active === null ? null : points[active];
  const last = points.at(-1);

  const pick = (clientX: number, element: Element) => {
    const box = element.getBoundingClientRect();
    const share = (clientX - box.left - pad.left) / Math.max(1, plotWidth);
    setActive(
      Math.min(
        points.length - 1,
        Math.max(0, Math.round(share * (points.length - 1))),
      ),
    );
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setActive((value) => {
      const start = value ?? points.length - 1;
      return Math.min(
        points.length - 1,
        Math.max(0, start + (event.key === 'ArrowLeft' ? -1 : 1)),
      );
    });
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          tabIndex={0}
          aria-label={`${m.dashboard.valueChart}: ${last ? `${formatDate(last.date, locale)} ${formatMoney(last.value, locale)}` : ''}`}
          onPointerMove={(event) => pick(event.clientX, event.currentTarget)}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          className="block touch-pan-y rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text
                x={pad.left - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                fontSize={12}
                fill="var(--ink-muted)"
              >
                {compactMoney(tick, locale)}
              </text>
            </g>
          ))}
          {labels.map((index) =>
            points[index] ? (
              <text
                key={index}
                x={x(index)}
                y={height - 8}
                textAnchor={
                  index === 0
                    ? 'start'
                    : index === points.length - 1
                      ? 'end'
                      : 'middle'
                }
                fontSize={12}
                fill="var(--ink-muted)"
              >
                {formatDate(points[index]!.date, locale)}
              </text>
            ) : null,
          )}
          <path
            d={path}
            fill="none"
            stroke="var(--product-accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {current && active !== null ? (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={pad.top}
                y2={pad.top + plotHeight}
                stroke="var(--line-strong)"
                strokeWidth={1}
              />
              <circle
                cx={x(active)}
                cy={y(current.value)}
                r={5}
                fill="var(--product-accent)"
                stroke="var(--surface-raised)"
                strokeWidth={2}
              />
            </g>
          ) : null}
        </svg>
      ) : null}
      {current && active !== null ? (
        <div
          role="status"
          className={cn(
            ts('body-sm', locale),
            'pointer-events-none absolute top-0 rounded-sm border border-line bg-surface-raised px-2 py-1 text-ink shadow-sm',
          )}
          style={{
            left: Math.min(
              Math.max(0, x(active) - 70),
              Math.max(0, width - 140),
            ),
          }}
        >
          <span className="block text-ink-muted">
            {formatDate(current.date, locale)}
          </span>
          <span className="block tabular-nums">
            {formatMoney(current.value, locale)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function ValueTable({
  locale,
  points,
}: {
  locale: Locale;
  points: { date: string; value: number }[];
}) {
  const { m } = translator(locale);
  return (
    <div className="max-h-72 overflow-y-auto">
      <Table
        locale={locale}
        rows={[...points].reverse()}
        rowKey={(row) => row.date}
        columns={[
          {
            key: 'date',
            header: m.dashboard.columns.date,
            cell: (row) => formatDate(row.date, locale),
          },
          {
            key: 'value',
            header: m.dashboard.columns.value,
            numeric: true,
            cell: (row) => formatMoney(row.value, locale),
          },
        ]}
      />
    </div>
  );
}

export type OutflowBar = {
  id: string;
  label: string;
  quantityLabel: string;
  value: number;
};

/** Horizontal bars: long Thai item names wrap beside their bar instead of crowding an axis. */
export function OutflowBars({
  locale,
  bars,
}: {
  locale: Locale;
  bars: OutflowBar[];
}) {
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {bars.map((bar) => (
        <li
          key={bar.id}
          className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3"
          title={bar.quantityLabel}
        >
          <span className={cn(ts('body-sm', locale), 'text-ink')}>
            {bar.label}
          </span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="block h-3 rounded-r-sm bg-product-accent"
              style={{
                width: `${Math.max(2, (bar.value / max) * 100) * 0.7}%`,
              }}
            />
            <span
              className={cn(
                ts('body-sm', locale),
                'shrink-0 tabular-nums text-ink-muted',
              )}
            >
              {formatMoney(bar.value, locale)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function OutflowTable({
  locale,
  bars,
}: {
  locale: Locale;
  bars: OutflowBar[];
}) {
  const { m } = translator(locale);
  return (
    <Table
      locale={locale}
      rows={bars}
      rowKey={(row) => row.id}
      columns={[
        {
          key: 'item',
          header: m.dashboard.columns.item,
          cell: (row) => row.label,
        },
        {
          key: 'qty',
          header: m.dashboard.columns.outflow,
          numeric: true,
          cell: (row) => row.quantityLabel,
        },
        {
          key: 'value',
          header: m.dashboard.columns.value,
          numeric: true,
          cell: (row) => formatMoney(row.value, locale),
        },
      ]}
    />
  );
}
