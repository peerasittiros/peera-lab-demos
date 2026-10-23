import type { DemoAppConfig } from '@peera/db';
import { TEMPLATE_TENANTS } from './seed/generator';

/** How Rentroll plugs into the demo sandbox. One variant for now: the apartment building in 01 §9. */
export const demoApp = {
  app: 'rentroll',
  schema: 'rentroll',
  templates: TEMPLATE_TENANTS,
  defaultVariant: 'apartment',
} satisfies DemoAppConfig;
