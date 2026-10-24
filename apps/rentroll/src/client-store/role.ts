'use client';

import { useSyncExternalStore } from 'react';
import type { Role } from './schema';

/**
 * The demo role (SPEC §2.3). It lives in localStorage, so every tab of the browser shares it. The owner is the default,
 * as on the server (`DEFAULT_ROLE`).
 */
const KEY = 'rentroll.role';
const EVENT = 'rentroll:role';
const ROLES: readonly Role[] = ['owner', 'caretaker', 'tenant'];
const DEFAULT_ROLE: Role = 'owner';

export function readRole(): Role {
  try {
    const value = globalThis.localStorage.getItem(KEY);
    return ROLES.find((role) => role === value) ?? DEFAULT_ROLE;
  } catch {
    return DEFAULT_ROLE;
  }
}

export function writeRole(role: Role): void {
  try {
    globalThis.localStorage.setItem(KEY, role);
  } catch {
    // Private windows can block storage; the role then lasts for this page only.
  }
  globalThis.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  globalThis.addEventListener('storage', onChange);
  globalThis.addEventListener(EVENT, onChange);
  return () => {
    globalThis.removeEventListener('storage', onChange);
    globalThis.removeEventListener(EVENT, onChange);
  };
}

export function useRole(): Role {
  return useSyncExternalStore(subscribe, readRole, () => DEFAULT_ROLE);
}
