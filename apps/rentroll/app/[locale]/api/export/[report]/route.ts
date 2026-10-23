import { translator } from '@/src/i18n';
import { loadDepositsReport, loadRentRoll, loadUtilitiesReport } from '@/src/db/queries/reports';
import { baht, toCsv } from '@/src/domain/csv';
import { bangkokDate } from '@/src/domain/dates';
import { getContext } from '@/src/server/context';
import { isLocale } from '@peera/i18n';

const REPORTS = ['rent-roll', 'utilities', 'deposits'] as const;
type Report = (typeof REPORTS)[number];

/**
 * CSV export of the owner's reports (01 §3.1 G.21). Lives under `[locale]` so the proxy attaches the owner's session.
 * Headers follow the visitor's language, and the file is Thai-safe in Excel (byte-order mark).
 */
export async function GET(request: Request, { params }: { params: Promise<{ locale: string; report: string }> }) {
  const { locale: rawLocale, report: rawReport } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : 'th';
  if (!REPORTS.includes(rawReport as Report)) return new Response('Not found', { status: 404 });
  const report = rawReport as Report;
  const url = new URL(request.url);
  const period = url.searchParams.get('period') ?? bangkokDate(new Date()).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(period)) return new Response('Bad period', { status: 400 });

  const { db, tenantId } = await getContext();
  const { m } = translator(locale);
  const c = m.reports.cols;
  const today = bangkokDate(new Date());
  let header: string[];
  let rows: (string | number | null)[][];

  if (report === 'rent-roll') {
    const data = await loadRentRoll(db, tenantId, period, today);
    header = [c.room, c.tenant, c.status, c.rent, c.utilities, c.billed, c.paid, c.outstanding];
    rows = data.map((r) => [r.roomNumber, r.renterName, m.property.status[r.status], baht(r.rentSatang), baht(r.utilitiesSatang), baht(r.billedSatang), baht(r.paidSatang), baht(r.outstandingSatang)]);
    rows.push([m.reports.total, '', '', baht(data.reduce((s, r) => s + r.rentSatang, 0)), baht(data.reduce((s, r) => s + r.utilitiesSatang, 0)), baht(data.reduce((s, r) => s + r.billedSatang, 0)), baht(data.reduce((s, r) => s + r.paidSatang, 0)), baht(data.reduce((s, r) => s + r.outstandingSatang, 0))]);
  } else if (report === 'utilities') {
    const data = await loadUtilitiesReport(db, tenantId, period);
    header = [c.room, c.electricityUnits, c.electricity, c.waterUnits, c.water];
    rows = data.map((r) => [r.roomNumber, r.electricityUnits, baht(r.electricitySatang), r.waterUnits, baht(r.waterSatang)]);
  } else {
    const data = await loadDepositsReport(db, tenantId);
    header = [c.room, c.tenant, c.deposit, c.received, c.settled, c.refund];
    rows = data.map((r) => [r.roomNumber, r.renterName, baht(r.depositSatang), baht(r.receivedSatang), r.settled ? m.reports.yes : m.reports.no, r.refundSatang === null ? null : baht(r.refundSatang)]);
  }

  return new Response(toCsv(header, rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${report}-${period}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
