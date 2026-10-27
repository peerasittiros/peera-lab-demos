'use client';

import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { Role } from '../domain/stock';

// The demo role (owner or staff) lives in this browser (SPEC §2.3): localStorage, or `?role=` when a link carries it.
// No server session or database row is involved, so a visit writes nothing. The DemoBar switch calls `setRole`.

const KEY = 'stockline.role';
const DEFAULT: Role = 'owner';
const listeners = new Set<() => void>();

function isRole(value: unknown): value is Role {
  return value === 'owner' || value === 'staff';
}

function readStored(): Role {
  try {
    const value = localStorage.getItem(KEY);
    return isRole(value) ? value : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function writeStored(role: Role) {
  try {
    localStorage.setItem(KEY, role);
  } catch {
    // Storage blocked: the role lasts for this page only.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** The role on the server is always the default; the browser reads its own choice after hydration. */
function getServerSnapshot(): Role {
  return DEFAULT;
}

/** Applies a `?role=` in the link (it wins, and is remembered). Runs once, after the page mounts. */
export function RoleProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get('role');
    if (isRole(fromLink)) writeStored(fromLink);
  }, []);
  return <>{children}</>;
}

export function useRole(): Role {
  return useSyncExternalStore(subscribe, readStored, getServerSnapshot);
}

export function useRoleControl(): { role: Role; setRole: (role: Role) => void } {
  const role = useRole();
  const setRole = useCallback((next: Role) => writeStored(next), []);
  return { role, setRole };
}
