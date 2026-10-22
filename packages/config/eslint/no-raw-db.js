// Flags raw Drizzle queries on `db` / `tx` in app code. Tenant tables must be queried through
// `withTenant(db, tenantId)` from @peera/db, which always adds `tenant_id = $tenantId`.
// Allowed without a flag: `src/db/**` (schema, seed, clone, migrations), scripts and tests (see base.js).
// A deliberate raw query (a join, a platform table) takes `// eslint-disable-next-line @peera/no-raw-db -- why`.
const QUERY_METHODS = new Set([
  'select',
  'selectDistinct',
  'selectDistinctOn',
  'insert',
  'update',
  'delete',
  'execute',
]);
const HANDLES = new Set(['db', 'tx']);

const noRawDb = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require tenant-scoped queries (withTenant) instead of raw db/tx queries in apps.',
    },
    schema: [],
    messages: {
      raw: 'Raw `{{handle}}.{{method}}()` in app code. Use withTenant(db, tenantId) so the query is tenant-scoped.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          HANDLES.has(callee.object.name) &&
          callee.property.type === 'Identifier' &&
          QUERY_METHODS.has(callee.property.name)
        ) {
          context.report({
            node,
            messageId: 'raw',
            data: { handle: callee.object.name, method: callee.property.name },
          });
        }
      },
    };
  },
};

export default noRawDb;
