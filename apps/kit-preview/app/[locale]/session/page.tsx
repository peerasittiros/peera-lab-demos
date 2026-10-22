import { readDemoHeaders } from '@peera/demo-kit/proxy';
import { isLocale } from '@peera/i18n';
import { ts } from '@peera/ui';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { messages } from '@/messages';
import { AgainLink } from './AgainLink';

/** E2E page for the session transport: shows the session the proxy resolved and how it arrived. */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = messages[locale].session;
  const session = readDemoHeaders(await headers());

  return (
    <main
      lang={locale}
      className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8"
    >
      <h1 className={ts('headline-md', locale)}>{m.title}</h1>
      <dl
        className={`${ts('body', locale)} grid grid-cols-[auto_1fr] gap-x-4 gap-y-2`}
      >
        <dt className="text-ink-muted">{m.sid}</dt>
        <dd data-testid="sid" className="m-0 font-mono">
          {session?.sid}
        </dd>
        <dt className="text-ink-muted">{m.via}</dt>
        <dd data-testid="via" className="m-0 font-mono">
          {session?.via}
        </dd>
      </dl>
      <AgainLink label={m.again} />
    </main>
  );
}
