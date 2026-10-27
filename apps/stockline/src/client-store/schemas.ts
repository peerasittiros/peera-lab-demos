import { z } from 'zod';
import {
  createItemInput,
  namedFields,
  settingsFields,
  supplierFields,
  unitFields,
  userFields,
} from '../domain/master-input';
import { movementSchema } from '../domain/movement-input';

// Every Zod schema the browser's commands check input with. Commands load this module on first use
// (`loadSchemas`), so Zod (about 100 KB) is not parsed and evaluated on page load, only before the first save.

export const itemInput = createItemInput.and(
  z.object({ id: z.uuid().optional() }),
);
export const supplierInput = supplierFields.and(
  z.object({ id: z.uuid().optional() }),
);
// Categories and units: an id edits that row, no id adds one.
export const categoryInput = namedFields.and(
  z.object({ id: z.uuid().optional() }),
);
export const unitInput = unitFields.and(z.object({ id: z.uuid().optional() }));
export { movementSchema, namedFields, settingsFields, unitFields, userFields };
