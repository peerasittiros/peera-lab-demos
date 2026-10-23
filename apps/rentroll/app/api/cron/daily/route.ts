import { createDailyCronRoute } from '@peera/db';
import { demoApp } from '@/src/db/demo-app';
import { runOverdueReminders } from '@/src/db/jobs/overdue';
import { bangkokDate } from '@/src/domain/dates';
import { env } from '@/src/env';
import { getDb } from '@/src/server/db';

/**
 * The one daily cron (Spec corrections 7): tenant cleanup, then the app's own daily jobs. The overdue reminders
 * (01 §6.1) run here as a job, not as a separate cron.
 */
export const GET = createDailyCronRoute({
  config: demoApp,
  getDb,
  secret: () => env.CRON_SECRET,
  jobs: [
    {
      name: 'overdue-reminders',
      run: (db) => runOverdueReminders(db, bangkokDate(new Date())),
    },
  ],
});
