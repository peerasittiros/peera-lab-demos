import type { Metadata } from 'next';
import { LocalInvoiceView } from '@/src/components/live/LocalInvoiceView';

// An invoice made on this device, opened from its link (SPEC §5). Everything is in the URL fragment: nothing is stored.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LocalInvoicePage() {
  return (
    <main className="mx-auto flex max-w-[60rem] flex-col gap-4 px-4 py-6 print:p-0">
      <LocalInvoiceView />
    </main>
  );
}
