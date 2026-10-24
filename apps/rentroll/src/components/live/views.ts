import {
  feedCounts,
  loadPayableContracts,
  ownerFeed,
  tenantMessages,
} from '@/src/client-store/selectors/live';
import { loadBillsFor } from '@/src/client-store/selectors/live';
import { loadTenantHome } from '@/src/client-store/selectors/tenant';
import { loadReviewQueue } from '@/src/client-store/selectors/payments';
import type { StoreState } from '@/src/client-store/store';

/**
 * Module-level selectors for the live screens. `useStore` caches by selector identity, so these are defined once here
 * and never built inline in a component.
 */

/** Before the snapshot has loaded there is no date, so the views read nothing. */
export const homeView = (s: StoreState) =>
  s.snapshotDate ? loadTenantHome(s.data, s.snapshotDate) : null;

export const billsView = (s: StoreState) =>
  s.snapshotDate ? loadBillsFor(s.data, s.snapshotDate) : null;

export const messagesView = (s: StoreState) =>
  s.snapshotDate ? tenantMessages(s.data, s.snapshotDate, s.ops) : [];

export const reviewQueueView = (s: StoreState) => loadReviewQueue(s.data);

export const payableContractsView = (s: StoreState) =>
  s.snapshotDate ? loadPayableContracts(s.data, s.snapshotDate) : [];

export const feedView = (s: StoreState) => ({
  ...feedCounts(s.data),
  events: ownerFeed(s.ops),
});

/** The building's name for the shop side of the chat. */
export const buildingView = (s: StoreState) => s.data.building[0] ?? null;
