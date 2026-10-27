import { createDailyCronRoute } from '@peera/db';
import { demoApp } from '@/src/db/demo-app';
import { balanceDrift } from '@/src/db/queries/maintenance';
import { env } from '@/src/env';
import { getDb } from '@/src/server/db';

/**
 * The one daily cron (Spec corrections 7): tenant cleanup, then the nightly ledger check (02 §4). The check
 * repairs nothing; it logs any item whose balance drifted from its ledger so it shows in the Vercel logs.
 */
export const GET = createDailyCronRoute({
  config: demoApp,
  getDb,
  secret: () => env.CRON_SECRET,
  jobs: [
    {
      name: 'verify-balances',
      run: async (db) => {
        const rows = await balanceDrift(db);
        if (rows.length > 0)
          console.error('[cron] stockline balance drift', rows.slice(0, 20));
        return { drift: rows.length };
      },
    },
  ],
});
