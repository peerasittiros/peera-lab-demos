import { createDb, type Db } from '@peera/db';
import { env } from '../env';

/** One pool per server process (survives dev reloads). */
export function getDb(): Db {
  return createDb({ url: env.DATABASE_URL });
}
