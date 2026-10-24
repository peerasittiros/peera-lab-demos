'use client';

import { isLocale, type Locale } from '@peera/i18n';
import { cn, focusRing } from '@peera/ui';
import { useEffect, useState } from 'react';
import { InvoiceDocument } from '@/src/components/billing/InvoiceDocument';
import { PrintButton } from '@/src/components/billing/PrintButton';
import {
  decodeInvoiceLink,
  type LinkedInvoice,
} from '@/src/domain/invoice-link';
import { translator } from '@/src/i18n';

type State =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; invoice: LinkedInvoice };

/**
 * The public view of an invoice made on this device (SPEC §5). The invoice is in the URL fragment, which the browser
 * never sends, so the page decodes it here. Print and the paper size work as on the template link.
 */
export function LocalInvoiceView() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [locale, setLocale] = useState<Locale>('th');
  const [size, setSize] = useState<'a4' | 'a5'>('a4');
  const [bilingual, setBilingual] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get('lang') ?? 'th';
    if (isLocale(lang)) setLocale(lang);
    const fragment = window.location.hash.slice(1);
    void decodeInvoiceLink(fragment).then((invoice) =>
      setState(invoice ? { status: 'ready', invoice } : { status: 'missing' }),
    );
  }, []);

  const { m } = translator(locale);
  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-[44px] items-center rounded-sm border px-3 text-ink',
      active ? 'border-ink bg-surface-sunken' : 'border-line bg-surface-raised',
      focusRing,
    );

  if (state.status === 'loading')
    return <p className="text-ink-muted">{m.tenant.live.loading}</p>;
  if (state.status === 'missing') {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-ink">{m.ownerLive.localTitle}</h1>
        <p className="text-ink-muted">{m.ownerLive.localMissing}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label={m.billing.public.size}
        className="no-print flex flex-wrap items-center gap-2"
      >
        <button
          type="button"
          aria-pressed={size === 'a4'}
          onClick={() => setSize('a4')}
          className={chip(size === 'a4')}
        >
          {m.billing.public.a4}
        </button>
        <button
          type="button"
          aria-pressed={size === 'a5'}
          onClick={() => setSize('a5')}
          className={chip(size === 'a5')}
        >
          {m.billing.public.a5}
        </button>
        <button
          type="button"
          aria-pressed={bilingual}
          onClick={() => setBilingual((v) => !v)}
          className={chip(bilingual)}
        >
          {m.billing.public.bilingual}
        </button>
        <PrintButton label={m.billing.public.print} />
      </nav>
      <p className="no-print text-ink-muted">{m.ownerLive.localHint}</p>
      <InvoiceDocument
        locale={locale}
        bilingual={bilingual}
        size={size}
        invoice={state.invoice}
      />
    </div>
  );
}
