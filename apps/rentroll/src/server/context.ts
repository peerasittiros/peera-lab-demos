import { getDemoTenant, type Db } from '@peera/db';
import { readDemoHeaders, readDemoVariant } from '@peera/demo-kit/proxy';
import { headers } from 'next/headers';
import { cache } from 'react';
import { demoApp } from '../db/demo-app';
import { getDb } from './db';

export type Role = 'owner' | 'caretaker' | 'tenant';

export type RentrollContext = {
  db: Db;
  sid: string;
  tenantId: string;
  variant: string;
  role: Role;
  ip: string | null;
};

/** The visitor's role until they pick one in the DemoBar: the owner sees every feature. */
export const DEFAULT_ROLE: Role = 'owner';

const ROLES: readonly Role[] = ['owner', 'caretaker', 'tenant'];

/**
 * Everything a page or action needs about the visitor, once per request: the session from proxy.ts, the sandbox
 * tenant (cloned on first use) and the demo role.
 */
export const getContext = cache(async (): Promise<RentrollContext> => {
  const requestHeaders = await headers();
  const session = readDemoHeaders(requestHeaders);
  if (!session)
    throw new Error(
      '[rentroll] no demo session: is proxy.ts matching this route?',
    );
  const db = getDb();
  const tenant = await getDemoTenant(db, demoApp, {
    sid: session.sid,
    variant: readDemoVariant(requestHeaders),
  });
  const role = ROLES.find((r) => r === tenant.role) ?? DEFAULT_ROLE;
  const forwarded = requestHeaders.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip');
  return { db, sid: session.sid, tenantId: tenant.tenantId, variant: tenant.variant, role, ip };
});
