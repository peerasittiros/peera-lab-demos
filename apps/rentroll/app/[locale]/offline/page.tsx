import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { translator } from '@/src/i18n';

/** Shown when a page is not cached and there is no connection (SPEC §6). The service worker caches it. */
export default async function OfflinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { m } = translator(locale);
  return (
    <main className="mx-auto flex max-w-[40rem] flex-col gap-4 px-4 py-10">
      <h1 className="text-ink">{m.pwa.offlineTitle}</h1>
      <p className="text-ink-muted">{m.pwa.offlineBody}</p>
      <div>
        <a
          href={`/${locale}`}
          className="inline-flex min-h-11 items-center rounded-sm border border-line-strong px-4 text-ink"
        >
          {m.pwa.offlineRetry}
        </a>
      </div>
    </main>
  );
}
