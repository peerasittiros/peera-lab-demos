'use client';

import { Button } from '@peera/ui';

/** Opens the browser's print dialog. The invoice's print rules (paper size, hidden controls) live in the document. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="secondary" locale="th" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
