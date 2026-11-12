import {
  settingsView,
  type SettingsView,
} from '@/src/client-store/selectors/settings';
import type { StoreState } from '@/src/client-store/store';

/**
 * Module-level selectors for the settings pages. `useStore` caches by selector identity, so these are defined once here
 * rather than inline in a component.
 */

export const buildingsView = (state: StoreState) => state.data.building;

export const settingsValuesView = (state: StoreState): SettingsView =>
  settingsView(state.data);

/** The day the snapshot was taken, as an ISO date. Empty until the snapshot has loaded. */
export const snapshotDateView = (state: StoreState) => state.snapshotDate ?? '';
