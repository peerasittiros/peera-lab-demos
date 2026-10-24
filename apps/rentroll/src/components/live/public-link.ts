import type { Locale } from '@peera/i18n';
import { invoiceDocument } from '@/src/client-store/selectors/billing';
import { creditedOn } from '@/src/client-store/settlement';
import type { Data } from '@/src/client-store/schema';
import { encodeInvoiceLink } from '@/src/domain/invoice-link';

/**
 * The public link for an invoice. A template invoice (from the snapshot) links by its token to `/i/[token]`, which
 * shows the snapshot as it was. An invoice the visitor made, or a template invoice the visitor has since paid, credited
 * or changed, links to `/i/local` with the invoice itself in the fragment, so the link shows what the browser knows
 * and nothing reaches the server.
 */
export async function publicLinkFor(
  data: Data,
  invoiceId: string,
  publicToken: string,
  visitor: boolean,
  locale: Locale,
): Promise<string | null> {
  const origin = window.location.origin;
  const invoice = data.invoice.find((i) => i.id === invoiceId);
  const changed =
    !invoice ||
    invoice.status !== 'sent' ||
    invoice.paidSatang > 0 ||
    creditedOn(data, invoiceId) > 0;
  if (!visitor && !changed) return `${origin}/i/${publicToken}?lang=${locale}`;
  const document = invoiceDocument(data, invoiceId);
  if (!document) return null;
  return `${origin}/i/local?lang=${locale}#${await encodeInvoiceLink(document)}`;
}
