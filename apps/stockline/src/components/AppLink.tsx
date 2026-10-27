'use client';

import { useDemoHref } from '@peera/demo-kit';
import Link from 'next/link';
import type { ComponentProps } from 'react';

/**
 * next/link that keeps the demo session on the URL when the cookie isn't stored (platform §6.2). Prefetch is off
 * by default: every page is rendered per visitor, so prefetching a list of 80 item links would mean 80 server
 * renders (Vercel Hobby CPU is shared by all demos). The loading skeleton covers the wait instead.
 */
export function AppLink({
  href,
  prefetch = false,
  ...props
}: ComponentProps<typeof Link> & { href: string }) {
  const withSession = useDemoHref();
  return <Link href={withSession(href)} prefetch={prefetch} {...props} />;
}
