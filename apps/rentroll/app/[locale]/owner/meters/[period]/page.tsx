import { PageHeader } from '@/src/components/PageHeader';
import { MeterRound } from '@/src/components/meters/MeterRound';
import { loadMeterRound } from '@/src/db/queries/meters';
import { loadProperty } from '@/src/db/queries/property';
import { bangkokDate } from '@/src/domain/dates';
import type { MeterKind } from '@/src/domain/meter-queue';
import { pageContext, param, type SearchParams } from '@/src/server/page';
import { cn, focusRing } from '@peera/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';

/** Caretaker landing (01 §3.1 C.8). `/owner/meters/current` is the current Bangkok month. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; period: string }>;
  searchParams: SearchParams;
}) {
  const { period: requested } = await params;
  const { locale, db, tenantId, m } = await pageContext(params);
  const today = bangkokDate(new Date());
  const period = requested === 'current' ? today.slice(0, 7) : requested;
  if (!/^\d{4}-\d{2}$/.test(period)) notFound();

  const query = await searchParams;
  const { buildings } = await loadProperty(db, tenantId, today);
  const building = buildings.find((b) => b.id === param(query.b)) ?? buildings[0];
  if (!building) notFound();
  const kind: MeterKind = param(query.k) === 'water' ? 'water' : 'electricity';

  const all = await loadMeterRound(db, tenantId, { buildingId: building.id, kind, period });
  const floors = [...new Set(all.map((r) => r.floor))].sort((a, b) => a - b);
  const floorParam = Number(param(query.f));
  const floor = floors.includes(floorParam) ? floorParam : null;
  const rows = floor === null ? all : all.filter((r) => r.floor === floor);

  const href = (next: { b?: string; k?: MeterKind; f?: number | null }) => {
    const qs = new URLSearchParams();
    qs.set('b', next.b ?? building.id);
    qs.set('k', next.k ?? kind);
    const f = next.f === undefined ? floor : next.f;
    if (f !== null) qs.set('f', String(f));
    return `/${locale}/owner/meters/${period}?${qs.toString()}`;
  };
  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-[44px] items-center rounded-sm border px-4 text-ink',
      active ? 'border-ink bg-surface-sunken' : 'border-line bg-surface-raised',
      focusRing,
    );
  const buildingName = (b: (typeof buildings)[number]) => (locale === 'th' ? b.nameTh : (b.nameEn ?? b.nameTh));

  return (
    <>
      <PageHeader locale={locale} title={m.meters.title} description={m.meters.intro} />
      <p className="mb-4 tabular-nums text-ink-muted">{period}</p>
      <nav aria-label={m.meters.building} className="mb-3 flex flex-wrap gap-2">
        {buildings.map((b) => (
          <Link key={b.id} href={href({ b: b.id, f: null })} aria-current={b.id === building.id ? 'page' : undefined} className={chip(b.id === building.id)}>
            {buildingName(b)}
          </Link>
        ))}
      </nav>
      <nav aria-label={m.meters.kind.electricity} className="mb-3 flex flex-wrap gap-2">
        <Link href={href({ k: 'electricity' })} aria-current={kind === 'electricity' ? 'page' : undefined} className={chip(kind === 'electricity')}>
          {m.meters.kind.electricity}
        </Link>
        <Link href={href({ k: 'water' })} aria-current={kind === 'water' ? 'page' : undefined} className={chip(kind === 'water')}>
          {m.meters.kind.water}
        </Link>
      </nav>
      <nav aria-label={m.meters.floor} className="mb-6 flex flex-wrap gap-2">
        <Link href={href({ f: null })} aria-current={floor === null ? 'page' : undefined} className={chip(floor === null)}>
          {m.meters.all}
        </Link>
        {floors.map((f) => (
          <Link key={f} href={href({ f })} aria-current={floor === f ? 'page' : undefined} className={chip(floor === f)}>
            <span>{m.meters.floor}</span> <span className="tabular-nums">{f}</span>
          </Link>
        ))}
      </nav>
      <MeterRound key={`${building.id}-${kind}-${floor ?? 'all'}`} locale={locale} period={period} kind={kind} rows={rows} />
    </>
  );
}
