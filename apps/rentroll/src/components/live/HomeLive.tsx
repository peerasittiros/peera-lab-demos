'use client';

import { DemoSplit } from '@peera/demo-kit';
import type { Locale } from '@peera/i18n';
import { useStore } from '@/src/client-store/hooks';
import { OwnerFeed } from '@/src/components/tenant/TenantViews';
import { ReadyGate } from './ReadyGate';
import { TenantHomeLive } from './TenantHomeLive';
import { feedView } from './views';

/**
 * The split view (SPEC §3 and "The live loop"): the tenant's phone on one side, the owner's feed on the other. Both read
 * one store, so a slip or a payment appears on both sides at once.
 */
export function HomeLive({
  locale,
  labels,
}: {
  locale: Locale;
  labels: { customer: string; shop: string };
}) {
  return (
    <DemoSplit
      locale={locale}
      labels={labels}
      customer={<TenantHomeLive locale={locale} />}
      shop={<OwnerFeedLive locale={locale} />}
    />
  );
}

function OwnerFeedLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <OwnerFeedBody locale={locale} />
    </ReadyGate>
  );
}

function OwnerFeedBody({ locale }: { locale: Locale }) {
  const feed = useStore(feedView);
  return (
    <OwnerFeed
      locale={locale}
      slipsWaiting={feed.slipsWaiting}
      openRepairs={feed.openRepairs}
      events={feed.events}
    />
  );
}
