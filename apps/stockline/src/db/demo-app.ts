import type { DemoAppConfig } from '@peera/db';
import { TEMPLATE_TENANTS } from './seed/generator';

/** How Stockline plugs into the demo sandbox (`?variant=minimart|cafe|hardware`). */
export const demoApp = {
  app: 'stockline',
  schema: 'stockline',
  templates: TEMPLATE_TENANTS,
  defaultVariant: 'minimart',
} satisfies DemoAppConfig;
