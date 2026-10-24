import type { Locale } from '@peera/i18n';
import { invoiceDocument } from '@/src/client-store/selectors/billing';
import type { Data } from '@/src/client-store/schema';
import { encodeInvoiceLink } from '@/src/domain/invoice-link';

/**
 * The public link for an invoice. A template invoice (from the snapshot) links by its token to `/i/[token]`. An
 * invoice the visitor made links to `/i/local`, with the invoice itself in the fragment, so it works on any device and
 * nothing reaches the server.
 */
export async function publicLinkFor(
  data: Data,
  invoiceId: string,
  publicToken: string,
  visitor: boolean,
  locale: Locale,
): Promise<string | null> {
  const origin = window.location.origin;
  if (!visitor) return `${origin}/i/${publicToken}?lang=${locale}`;
  const document = invoiceDocument(data, invoiceId);
  if (!document) return null;
  return `${origin}/i/local?lang=${locale}#${await encodeInvoiceLink(document)}`;
}
