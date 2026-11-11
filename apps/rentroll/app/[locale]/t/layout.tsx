import type { ReactNode } from 'react';

/**
 * The tenant's pages are a phone app opened from LINE (ux-v2/rentroll.md › Tenant view): on a wide screen they stay a
 * centred column instead of stretching to the owner's layout.
 */
export default function TenantLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-xl">{children}</div>;
}
