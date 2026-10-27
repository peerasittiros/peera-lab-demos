import type { ItemStatus, MovementType } from './stock';

// Read-model types the screens share. The browser store builds them (`client-store/views.ts`); the types live here so
// the components do not depend on any server module.

export type Unit = {
  id: string;
  nameTh: string;
  nameEn: string | null;
  symbol: string;
};

export type Pack = { unitId: string; factor: number; unit: Unit };

export type Named = { id: string; nameTh: string; nameEn: string | null };

export type SupplierRef = { id: string; name: string; leadTimeDays: number };

export type ItemView = {
  id: string;
  sku: string;
  barcode: string | null;
  nameTh: string;
  nameEn: string | null;
  categoryId: string | null;
  supplierId: string | null;
  location: string | null;
  imageUrl: string | null;
  active: boolean;
  minQty: number;
  reorderQty: number;
  onHand: number;
  status: ItemStatus;
  baseUnit: Unit;
  packs: Pack[];
  /** Owner only: absent (not null) for staff. */
  costSatang?: number | null;
  priceSatang?: number | null;
};

export type MovementView = {
  id: string;
  occurredAt: Date;
  type: MovementType;
  reason: string;
  quantityBase: number;
  enteredQty: number | null;
  enteredUnit: Unit | null;
  balanceAfter: number;
  reference: string | null;
  note: string | null;
  userName: string | null;
  item: {
    id: string;
    sku: string;
    nameTh: string;
    nameEn: string | null;
    baseUnit: Unit;
  };
  /** Owner only. */
  unitCostSatang?: number | null;
};

export type CountStatus = 'open' | 'submitted' | 'approved';

export type OrderStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';
