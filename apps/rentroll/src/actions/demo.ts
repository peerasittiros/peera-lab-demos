'use server';

import { resetDemoTenant, setSessionRole } from '@peera/db';
import { z } from 'zod';
import { demoApp } from '../db/demo-app';
import { getContext } from '../server/context';

/** DemoBar role switcher: no password (platform §6.4). Returns the role's landing path. */
export async function switchRole(input: { role: 'owner' | 'caretaker' | 'tenant' }) {
  const { role } = z
    .object({ role: z.enum(['owner', 'caretaker', 'tenant']) })
    .parse(input);
  const { db, sid } = await getContext();
  await setSessionRole(db, demoApp, { sid, role });
  return { landing: role === 'tenant' ? '/t/bills' : '/owner/dashboard' };
}

/** DemoBar reset: deletes the visitor's changes and clones the template again. */
export async function resetDemo() {
  const { db, sid } = await getContext();
  await resetDemoTenant(db, demoApp, { sid });
  return { reset: true };
}
