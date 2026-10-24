/**
 * The public invoice link for invoices the visitor made (SPEC §5): the invoice as JSON, deflated and base64url-encoded
 * into the URL fragment. The fragment is never sent to a server, so nothing leaves the browser.
 */

export type LinkedLine = {
  id: string;
  labelTh: string;
  labelEn: string;
  amountSatang: number;
  meta: Record<string, unknown>;
};

export type LinkedInvoice = {
  number: string;
  status: string;
  period: string | null;
  issueDate: string;
  dueDate: string;
  totalSatang: number;
  paidSatang: number;
  buildingNameTh: string;
  buildingNameEn: string | null;
  bankName: string | null;
  bankAccountMasked: string | null;
  roomNumber: string;
  renterName: string | null;
  lines: LinkedLine[];
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(text.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(Uint8Array.from(bytes));
  void writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

/** The fragment (without the `#`) for an invoice. */
export async function encodeInvoiceLink(
  invoice: LinkedInvoice,
): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(invoice));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

/** Reads a fragment back. Null when it is not a valid link. */
export async function decodeInvoiceLink(
  fragment: string,
): Promise<LinkedInvoice | null> {
  try {
    const bytes = await pipe(
      fromBase64Url(fragment),
      new DecompressionStream('deflate-raw'),
    );
    return JSON.parse(new TextDecoder().decode(bytes)) as LinkedInvoice;
  } catch {
    return null;
  }
}
