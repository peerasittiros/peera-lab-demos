import { z } from 'zod';

export const sharedEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  DB_SCHEMA: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  DEMO_SESSION_SECRET: z.string().min(1),
  ALLOWED_FRAME_ANCESTORS: z.string().min(1),
  PEERA_LAB_URL: z.string().url(),
  CRON_SECRET: z.string().min(1),
});

/** Parse and validate environment variables, reporting every invalid name at once. */
export function defineEnv<const Schema extends z.ZodType>(
  schema: Schema,
  source: Record<string, string | undefined> = process.env,
): z.output<Schema> {
  const result = schema.safeParse(source);

  if (!result.success) {
    const invalidNames = [
      ...new Set(result.error.issues.map((issue) => issue.path.join('.'))),
    ];
    throw new Error(
      `Invalid environment variables:\n${invalidNames.map((name) => `- ${name}`).join('\n')}`,
    );
  }

  return result.data;
}
