import { ESLint, RuleTester } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import noRawDb from './no-raw-db.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

tester.run('no-raw-db', noRawDb, {
  valid: [
    'const t = withTenant(db, tenantId); await t.select(item);',
    'await t.insert(item, { name: "x" });',
    'db.transaction(async (tx) => withTenant(tx, id).delete(item));',
    'const rows = await query.select();',
  ],
  invalid: [
    { code: 'await db.select().from(item);', errors: [{ messageId: 'raw' }] },
    {
      code: 'await tx.insert(item).values(row);',
      errors: [{ messageId: 'raw' }],
    },
    {
      code: 'await db.update(item).set({ name: "x" });',
      errors: [{ messageId: 'raw' }],
    },
    {
      code: 'await db.execute(sql`select 1`);',
      errors: [{ messageId: 'raw' }],
    },
  ],
});

describe('base config wiring', () => {
  it('flags raw queries in app code but not in src/db or tests', async () => {
    const eslint = new ESLint({
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    });
    const code =
      'export async function load(db: any, item: any) { return db.select().from(item); }\n';
    const ruleIds = async (filePath: string) =>
      (await eslint.lintText(code, { filePath }))[0]!.messages.map(
        (message) => message.ruleId,
      );

    expect(await ruleIds('apps/sample/src/app/page.ts')).toContain(
      '@peera/no-raw-db',
    );
    expect(await ruleIds('apps/sample/src/db/seed.ts')).not.toContain(
      '@peera/no-raw-db',
    );
    expect(await ruleIds('apps/sample/src/app/page.test.ts')).not.toContain(
      '@peera/no-raw-db',
    );
  });
});
