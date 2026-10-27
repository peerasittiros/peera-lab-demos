import { suggestReorderQty } from '../../domain/stock';
import { catalogs, type CatalogItem, type ShopCatalog } from './catalog';

// Deterministic template data for the three shops (02 §9). Nothing here reads the clock or Math.random: dates are
// relative (`daysAgo` + `minuteOfDay`, turned into timestamps by clone_demo_tenant) and randomness comes from a
// seeded generator, so every run produces the same rows.

export const STOCKLINE_VARIANTS = ['minimart', 'cafe', 'hardware'] as const;
export type StocklineVariant = (typeof STOCKLINE_VARIANTS)[number];

/** Template tenant per variant (platform §6.1: the first is ...0001). */
export const TEMPLATE_TENANTS: Record<StocklineVariant, string> = {
  minimart: '00000000-0000-0000-0000-000000000001',
  cafe: '00000000-0000-0000-0000-000000000002',
  hardware: '00000000-0000-0000-0000-000000000003',
};

const HISTORY_DAYS = 60;
/** Weekly order rounds (days ago). The next round is today, so the reorder list is due. */
const ORDER_ROUNDS = [56, 49, 42, 35, 28, 21, 14, 7];
const COUNT_DAYS_AGO = 10;
const OPEN_ORDER_DAYS_AGO = 2;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable UUIDs per variant and kind, so template ids are readable and unique across variants. */
function stableId(variantIndex: number, kind: number, index: number): string {
  const hex = (value: number, width: number) =>
    value.toString(16).padStart(width, '0');
  return `${hex(0x10000000 + variantIndex * 0x100000 + kind, 8)}-0000-4000-8000-${hex(index, 12)}`;
}

/** EAN-13 in the in-store range (prefix 2), so no sample code belongs to a real product. */
export function ean13(variantIndex: number, index: number): string {
  const body = `2${variantIndex + 1}${String(index + 1).padStart(10, '0')}`;
  const sum = [...body].reduce(
    (total, digit, position) =>
      total + Number(digit) * (position % 2 === 0 ? 1 : 3),
    0,
  );
  return `${body}${(10 - (sum % 10)) % 10}`;
}

const locations: Record<StocklineVariant, Record<string, string>> = {
  minimart: {
    drinks: 'ตู้แช่ 1',
    snacks: 'ชั้น B',
    dry: 'ชั้น C',
    dairy: 'ตู้แช่ 2',
    household: 'ชั้น D',
    personal: 'ชั้น E',
  },
  cafe: {
    coffee: 'ชั้นแห้ง บน',
    dairy: 'ตู้เย็นหลังร้าน',
    syrup: 'บาร์',
    bakery: 'ชั้นแห้ง ล่าง',
    packaging: 'ห้องเก็บของ',
  },
  hardware: {
    cement: 'ลานหลังร้าน',
    steel: 'โกดัง 1',
    paint: 'ชั้นสี',
    plumbing: 'ชั้น P',
    electric: 'ชั้น E',
    fasteners: 'ตู้ลิ้นชัก',
    tools: 'หน้าร้าน',
  },
};

const countCategory: Record<StocklineVariant, string> = {
  minimart: 'drinks',
  cafe: 'dairy',
  hardware: 'fasteners',
};

export type SeedMovement = {
  id: string;
  tenantId: string;
  itemId: string;
  type: 'in' | 'out' | 'adjust';
  reason: string;
  quantityBase: number;
  enteredQty: number;
  enteredUnitId: string;
  unitCostSatang: number | null;
  reference: string | null;
  purchaseOrderId: string | null;
  countSessionId: string | null;
  note: string | null;
  userId: string;
  occurredAt: Date;
  balanceAfter: number;
  daysAgo: number;
  minuteOfDay: number;
};

type MovementInput = Pick<
  SeedMovement,
  'type' | 'reason' | 'quantityBase' | 'userId' | 'daysAgo' | 'minuteOfDay'
> &
  Partial<
    Pick<
      SeedMovement,
      | 'enteredQty'
      | 'enteredUnitId'
      | 'unitCostSatang'
      | 'purchaseOrderId'
      | 'countSessionId'
      | 'note'
      | 'reference'
    >
  >;

export type SeedData = ReturnType<typeof buildSeedVariant>;

/**
 * `reference` only fills the absolute timestamp columns of the template rows (never shown: visitors see clones,
 * whose dates come from the relative columns). It defaults to a fixed date so the output is deterministic.
 */
export function buildSeedVariant(
  variant: StocklineVariant,
  reference: Date = new Date('2026-10-22T03:00:00.000Z'),
) {
  const variantIndex = STOCKLINE_VARIANTS.indexOf(variant);
  const catalog: ShopCatalog = catalogs[variant];
  const tenantId = TEMPLATE_TENANTS[variant];
  const random = mulberry32(0x5eed + variantIndex * 7919);
  const between = (min: number, max: number) => min + random() * (max - min);
  const int = (min: number, max: number) => Math.floor(between(min, max + 1));
  const at = (daysAgo: number, minuteOfDay: number) => {
    const day = new Date(reference);
    day.setUTCHours(0, 0, 0, 0);
    // minute_of_day is Bangkok local time (UTC+7).
    return new Date(
      day.getTime() - daysAgo * 86_400_000 + (minuteOfDay - 7 * 60) * 60_000,
    );
  };

  let counter = 0;
  const id = (kind: number) => stableId(variantIndex, kind, ++counter);

  const shopSettings = {
    tenantId,
    shopNameTh: catalog.shop.th,
    shopNameEn: catalog.shop.en,
    lowStockRule: 'at_or_below_min',
    reorderWeekday: 1,
  };
  const units = catalog.units.map((entry) => ({
    id: id(1),
    tenantId,
    nameTh: entry.th,
    nameEn: entry.en,
    symbol: entry.symbol,
    key: entry.key,
  }));
  const unitId = (key: string) => {
    const found = units.find((entry) => entry.key === key);
    if (!found) throw new Error(`[seed] ${variant}: unknown unit ${key}`);
    return found.id;
  };
  const categories = catalog.categories.map((entry, index) => ({
    id: id(2),
    tenantId,
    nameTh: entry.th,
    nameEn: entry.en,
    sort: index,
    key: entry.key,
  }));
  const categoryId = (key: string) => {
    const found = categories.find((entry) => entry.key === key);
    if (!found) throw new Error(`[seed] ${variant}: unknown category ${key}`);
    return found.id;
  };
  const suppliers = catalog.suppliers.map((entry) => ({
    id: id(3),
    tenantId,
    name: entry.name,
    contactName: entry.contact,
    phone: entry.phone,
    lineId: entry.line,
    leadTimeDays: entry.leadTime,
    note: entry.note ?? null,
  }));
  const owner = {
    id: id(4),
    tenantId,
    displayName: catalog.people.owner,
    role: 'owner',
  };
  const staff = {
    id: id(4),
    tenantId,
    displayName: catalog.people.staff,
    role: 'staff',
  };

  type Plan = {
    source: CatalogItem;
    row: {
      id: string;
      tenantId: string;
      sku: string;
      barcode: string;
      nameTh: string;
      nameEn: string;
      categoryId: string;
      baseUnitId: string;
      costSatang: number;
      priceSatang: number | null;
      minQty: number;
      reorderQty: number;
      supplierId: string;
      location: string;
      imageUrl: null;
      active: boolean;
    };
    orderFactor: number;
    orderUnitId: string;
    leadTime: number;
    onHand: number;
    pending: number;
  };

  const busy = new Set(
    [...catalog.items].sort((a, b) => b.rate - a.rate).slice(0, 12),
  );

  const plans: Plan[] = catalog.items.map((source, index) => {
    const supplierRow = suppliers[source.supplier]!;
    const [orderUnitKey, orderFactor] = source.packs?.at(-1) ?? [
      source.unit,
      1,
    ];
    const roundUp = (value: number) =>
      Math.max(orderFactor, Math.ceil(value / orderFactor) * orderFactor);
    return {
      source,
      row: {
        id: id(5),
        tenantId,
        sku: `STK-${String(index + 1).padStart(4, '0')}`,
        barcode: ean13(variantIndex, index),
        nameTh: source.th,
        nameEn: source.en,
        categoryId: categoryId(source.category),
        baseUnitId: unitId(source.unit),
        costSatang: Math.max(1, Math.round(source.cost * 100)),
        priceSatang:
          source.price === undefined ? null : Math.round(source.price * 100),
        minQty: Math.max(
          1,
          Math.round(source.rate * (supplierRow.leadTimeDays + 3)),
        ),
        reorderQty: roundUp(source.rate * 8),
        supplierId: supplierRow.id,
        location: locations[variant][source.category] ?? 'หน้าร้าน',
        imageUrl: null,
        active: true,
      },
      orderFactor,
      orderUnitId: unitId(orderUnitKey),
      leadTime: supplierRow.leadTimeDays,
      onHand: 0,
      pending: 0,
    };
  });
  const itemUnits = plans.flatMap((plan) =>
    (plan.source.packs ?? []).map(([key, factor]) => ({
      id: id(6),
      tenantId,
      itemId: plan.row.id,
      unitId: unitId(key),
      factor,
    })),
  );

  const movements: SeedMovement[] = [];
  const move = (plan: Plan, entry: MovementInput) => {
    plan.onHand += entry.quantityBase;
    movements.push({
      id: id(7),
      tenantId,
      itemId: plan.row.id,
      enteredQty: Math.abs(entry.quantityBase),
      enteredUnitId: plan.row.baseUnitId,
      unitCostSatang: null,
      purchaseOrderId: null,
      countSessionId: null,
      note: null,
      reference: null,
      ...entry,
      occurredAt: at(entry.daysAgo, entry.minuteOfDay),
      balanceAfter: plan.onHand,
    });
  };
  const usage = (plan: Plan) =>
    plan.source.price === undefined ? 'used' : 'sold';

  // Opening balances 60 days ago: min plus about two weeks of sales.
  for (const plan of plans) {
    const opening =
      Math.ceil(
        (plan.row.minQty + plan.source.rate * between(9, 16)) /
          plan.orderFactor,
      ) * plan.orderFactor;
    move(plan, {
      type: 'in',
      reason: 'opening',
      quantityBase: opening,
      enteredQty: opening / plan.orderFactor,
      enteredUnitId: plan.orderUnitId,
      unitCostSatang: plan.row.costSatang,
      userId: owner.id,
      daysAgo: HISTORY_DAYS - 1,
      minuteOfDay: 540,
    });
  }

  type OrderRow = {
    id: string;
    tenantId: string;
    number: string;
    supplierId: string;
    status: 'ordered' | 'received';
    orderedDaysAgo: number;
    expectedDaysAgo: number;
    receivedDaysAgo: number | null;
    note: string | null;
    createdBy: string;
  };
  const orders: OrderRow[] = [];
  const orderLines: {
    id: string;
    tenantId: string;
    purchaseOrderId: string;
    itemId: string;
    qtyBase: number;
    receivedBase: number;
  }[] = [];
  const arrivals = new Map<
    number,
    { plan: Plan; qty: number; order: OrderRow }[]
  >();
  const placeOrder = (
    supplierIndex: number,
    daysAgo: number,
    lines: { plan: Plan; qty: number }[],
    received: boolean,
  ) => {
    const supplierRow = suppliers[supplierIndex]!;
    const arrivesDaysAgo = daysAgo - supplierRow.leadTimeDays;
    const order: OrderRow = {
      id: id(8),
      tenantId,
      number: `PO-${String(orders.length + 1).padStart(4, '0')}`,
      supplierId: supplierRow.id,
      status: received ? 'received' : 'ordered',
      orderedDaysAgo: daysAgo,
      expectedDaysAgo: arrivesDaysAgo,
      receivedDaysAgo: received ? arrivesDaysAgo : null,
      note: null,
      createdBy: owner.id,
    };
    orders.push(order);
    for (const line of lines) {
      orderLines.push({
        id: id(9),
        tenantId,
        purchaseOrderId: order.id,
        itemId: line.plan.row.id,
        qtyBase: line.qty,
        receivedBase: received ? line.qty : 0,
      });
      if (received) {
        arrivals.set(arrivesDaysAgo, [
          ...(arrivals.get(arrivesDaysAgo) ?? []),
          { plan: line.plan, qty: line.qty, order },
        ]);
        line.plan.pending += 1;
      }
    }
    return order;
  };

  // One approved count with a little shrinkage (02 §9).
  const countSessionId = id(10);
  const countLines: {
    id: string;
    tenantId: string;
    countSessionId: string;
    itemId: string;
    expected: number;
    counted: number;
    countedAt: Date;
  }[] = [];

  const lastOutDay = new Map<Plan, number>();
  for (let daysAgo = HISTORY_DAYS - 2; daysAgo >= 0; daysAgo -= 1) {
    // Deliveries arrive in the morning; staff receive them against the PO.
    for (const arrival of arrivals.get(daysAgo) ?? []) {
      move(arrival.plan, {
        type: 'in',
        reason: 'received',
        quantityBase: arrival.qty,
        enteredQty: arrival.qty / arrival.plan.orderFactor,
        enteredUnitId: arrival.plan.orderUnitId,
        unitCostSatang: arrival.plan.row.costSatang,
        reference: arrival.order.number,
        purchaseOrderId: arrival.order.id,
        userId: staff.id,
        daysAgo,
        minuteOfDay: int(570, 640),
      });
      arrival.plan.pending -= 1;
    }

    // The count (before the day's sales): expected = on hand at 11:00, adjustments approved at 17:00.
    if (daysAgo === COUNT_DAYS_AGO) {
      plans
        .filter((plan) => plan.source.category === countCategory[variant])
        .forEach((plan, index) => {
          const shrink =
            index % 4 === 1
              ? Math.max(1, Math.round(plan.source.rate * between(0.1, 0.3)))
              : index === 2
                ? -Math.max(1, Math.round(plan.source.rate * 0.05))
                : 0;
          const expected = plan.onHand;
          const counted = Math.max(0, expected - shrink);
          countLines.push({
            id: id(11),
            tenantId,
            countSessionId,
            itemId: plan.row.id,
            expected,
            counted,
            countedAt: at(daysAgo, 660),
          });
          if (counted !== expected)
            move(plan, {
              type: 'adjust',
              reason: 'count',
              quantityBase: counted - expected,
              countSessionId,
              reference: 'CNT-0001',
              userId: owner.id,
              daysAgo,
              minuteOfDay: 1020,
            });
        });
    }

    // Outflow, recorded every 3 days for the busiest items and weekly for the rest.
    plans.forEach((plan, index) => {
      const every = busy.has(plan.source) ? 3 : 7;
      if ((daysAgo + index) % every !== 0) return;
      const since = lastOutDay.get(plan) ?? HISTORY_DAYS - 1;
      lastOutDay.set(plan, daysAgo);
      const wanted = Math.round(
        plan.source.rate * Math.max(1, since - daysAgo) * between(0.65, 1.35),
      );
      const quantity = Math.min(wanted, plan.onHand);
      if (quantity <= 0) return;
      move(plan, {
        type: 'out',
        reason: usage(plan),
        quantityBase: -quantity,
        userId: staff.id,
        daysAgo,
        minuteOfDay:
          daysAgo === 0
            ? int(480, 580)
            : daysAgo === COUNT_DAYS_AGO
              ? int(1030, 1170)
              : int(660, 1170),
      });
    });

    // A few damaged or expired write-offs.
    if (daysAgo % 9 === 4) {
      const plan = plans[int(0, plans.length - 1)]!;
      const quantity = Math.max(1, Math.round(plan.source.rate * 0.4));
      if (plan.onHand > quantity) {
        const expired = variant !== 'hardware' && daysAgo % 2 === 0;
        move(plan, {
          type: 'out',
          reason: expired ? 'expired' : 'damaged',
          quantityBase: -quantity,
          note: expired ? 'หมดอายุก่อนขาย' : 'บรรจุภัณฑ์เสียหาย',
          userId: staff.id,
          daysAgo,
          minuteOfDay: int(1175, 1185),
        });
      }
    }

    // Weekly order round: whatever would reach min before the next delivery after this one.
    if (ORDER_ROUNDS.includes(daysAgo)) {
      suppliers.forEach((_, supplierIndex) => {
        const lines = plans
          .filter(
            (plan) =>
              plan.source.supplier === supplierIndex &&
              plan.pending === 0 &&
              plan.onHand - plan.source.rate * (plan.leadTime + 7) <=
                plan.row.minQty,
          )
          .map((plan) => ({
            plan,
            qty: suggestReorderQty({
              onHand: Math.max(
                0,
                Math.round(plan.onHand - plan.source.rate * plan.leadTime),
              ),
              minQty: plan.row.minQty,
              reorderQty: plan.row.reorderQty,
              packFactor: plan.orderFactor,
            }),
          }));
        if (lines.length > 0) placeOrder(supplierIndex, daysAgo, lines, true);
      });
    }
  }

  // Make the reorder list due: 8–12 items at or under min, one or two of them out of stock. These rows are this
  // morning, after the regular entries above.
  const isLow = (plan: Plan) => plan.onHand <= plan.row.minQty;
  const target = 8 + variantIndex * 2;
  for (const plan of [...plans].sort((a, b) => b.source.rate - a.source.rate)) {
    if (plans.filter(isLow).length >= target) break;
    if (isLow(plan)) continue;
    const down = plan.onHand - Math.max(1, Math.floor(plan.row.minQty * 0.6));
    if (down > 0)
      move(plan, {
        type: 'out',
        reason: usage(plan),
        quantityBase: -down,
        userId: staff.id,
        daysAgo: 0,
        minuteOfDay: 595,
      });
  }
  for (const plan of plans.filter(isLow).slice(target)) {
    const quantity =
      Math.ceil(
        (plan.row.minQty + plan.row.reorderQty - plan.onHand) /
          plan.orderFactor,
      ) * plan.orderFactor;
    move(plan, {
      type: 'in',
      reason: 'received',
      quantityBase: quantity,
      enteredQty: quantity / plan.orderFactor,
      enteredUnitId: plan.orderUnitId,
      unitCostSatang: plan.row.costSatang,
      reference: `INV-${String(int(1000, 9999))}`,
      userId: staff.id,
      daysAgo: 0,
      minuteOfDay: 600,
    });
  }
  for (const plan of plans.filter(isLow).slice(0, variantIndex === 1 ? 1 : 2)) {
    if (plan.onHand > 0)
      move(plan, {
        type: 'out',
        reason: usage(plan),
        quantityBase: -plan.onHand,
        userId: staff.id,
        daysAgo: 0,
        minuteOfDay: 605,
      });
  }

  // One order placed two days ago and not delivered yet (02 §9), from the supplier with the longest lead time.
  const slowest = suppliers.reduce(
    (best, entry, index) =>
      entry.leadTimeDays > suppliers[best]!.leadTimeDays ? index : best,
    0,
  );
  const openOrder = placeOrder(
    slowest,
    OPEN_ORDER_DAYS_AGO,
    plans
      .filter((plan) => plan.source.supplier === slowest && !isLow(plan))
      .slice(0, 3)
      .map((plan) => ({ plan, qty: plan.row.reorderQty })),
    false,
  );
  openOrder.note = 'โทรยืนยันแล้ว รอของเข้า';

  const countSession = {
    id: countSessionId,
    tenantId,
    number: 'CNT-0001',
    scope: {
      kind: 'category' as const,
      categoryId: categoryId(countCategory[variant]),
    },
    status: 'approved',
    blind: true,
    startedBy: staff.id,
    startedAt: at(COUNT_DAYS_AGO, 540),
    submittedAt: at(COUNT_DAYS_AGO, 660),
    approvedBy: owner.id,
    approvedAt: at(COUNT_DAYS_AGO, 1020),
    daysAgo: COUNT_DAYS_AGO,
  };

  type Diff = Record<string, { before: unknown; after: unknown }>;
  const auditEvents = [
    ...plans.slice(0, 3).map((plan, index) => {
      const daysAgo = 20 - index * 6;
      const diff: Diff =
        plan.row.priceSatang === null
          ? {
              minQty: {
                before: Math.round(plan.row.minQty * 0.8),
                after: plan.row.minQty,
              },
            }
          : {
              priceSatang: {
                before: plan.row.priceSatang - 100 * (index + 1),
                after: plan.row.priceSatang,
              },
            };
      return {
        id: id(12),
        tenantId,
        userId: owner.id,
        action: 'update',
        entity: 'item',
        entityId: plan.row.id,
        diff,
        at: at(daysAgo, 1110),
        daysAgo,
        minuteOfDay: 1110,
      };
    }),
    {
      id: id(12),
      tenantId,
      userId: owner.id,
      action: 'update',
      entity: 'supplier',
      entityId: suppliers[0]!.id,
      diff: {
        leadTimeDays: {
          before: suppliers[0]!.leadTimeDays + 1,
          after: suppliers[0]!.leadTimeDays,
        },
      } as Diff,
      at: at(30, 1000),
      daysAgo: 30,
      minuteOfDay: 1000,
    },
  ];

  return {
    variant,
    tenantId,
    shopSettings,
    units: units.map(({ key: _key, ...row }) => row),
    categories: categories.map(({ key: _key, ...row }) => row),
    suppliers,
    users: [owner, staff],
    items: plans.map((plan) => plan.row),
    itemUnits,
    orders: orders.map((order) => ({
      ...order,
      orderedAt: at(order.orderedDaysAgo, 600),
      expectedAt: at(order.expectedDaysAgo, 600),
      receivedAt:
        order.receivedDaysAgo === null ? null : at(order.receivedDaysAgo, 660),
    })),
    orderLines,
    countSessions: [countSession],
    countLines,
    movements,
    balances: plans.map((plan) => ({
      itemId: plan.row.id,
      tenantId,
      onHand: plan.onHand,
    })),
    auditEvents,
  };
}
