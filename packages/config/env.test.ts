import { describe, expect, it } from 'vitest';
import { defineEnv } from './env';
import { z } from 'zod';

const testSchema = z.object({
  SERVICE_URL: z.url(),
  API_TOKEN: z.string().min(1),
});

describe('defineEnv', () => {
  it('throws a readable error naming missing and invalid variables', () => {
    expect(() => defineEnv(testSchema, { SERVICE_URL: 'not-a-url' })).toThrow(
      /SERVICE_URL/,
    );
    expect(() => defineEnv(testSchema, { SERVICE_URL: 'not-a-url' })).toThrow(
      /API_TOKEN/,
    );
  });

  it('returns parsed values with the schema-inferred type', () => {
    const env = defineEnv(testSchema, {
      SERVICE_URL: 'https://api.example.test',
      API_TOKEN: 'secret',
    });

    expect(env).toEqual({
      SERVICE_URL: 'https://api.example.test',
      API_TOKEN: 'secret',
    });
  });
});
