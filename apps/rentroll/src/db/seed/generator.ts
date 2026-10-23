import type { InferInsertModel, Table } from 'drizzle-orm';
import {
  announcement,
  building,
  contract,
  contractRenter,
  docSequence,
  invoice,
  invoiceLine,
  meterReading,
  payment,
  paymentAllocation,
  ratePlan,
  renter,
  repairTicket,
  room,
  roomType,
  ticketMessage,
} from '../schema';

type Row<T extends Table> = InferInsertModel<T>;

/** The apartment template tenant (01 §9). Template rows use relative dates; see migrations/0001. */
export const TEMPLATE_TENANT_ID = '00000000-0000-0000-0000-00000000a001';

export const TEMPLATE_TENANTS: Record<string, string> = {
  apartment: TEMPLATE_TENANT_ID,
};

export type SeedData = {
  tenantId: string;
  buildings: Row<typeof building>[];
  ratePlans: Row<typeof ratePlan>[];
  roomTypes: Row<typeof roomType>[];
  rooms: Row<typeof room>[];
  renters: Row<typeof renter>[];
  contracts: Row<typeof contract>[];
  contractRenters: Row<typeof contractRenter>[];
  meterReadings: Row<typeof meterReading>[];
  invoices: Row<typeof invoice>[];
  invoiceLines: Row<typeof invoiceLine>[];
  payments: Row<typeof payment>[];
  paymentAllocations: Row<typeof paymentAllocation>[];
  repairTickets: Row<typeof repairTicket>[];
  ticketMessages: Row<typeof ticketMessage>[];
  announcements: Row<typeof announcement>[];
  docSequences: Row<typeof docSequence>[];
};

const DAY = 86_400_000;
/** Reference "today" for template dates. Clone recomputes everything from days_ago, so this only fixes the template. */
const ANCHOR = Date.UTC(2026, 9, 23);

const at = (daysAgo: number) => new Date(ANCHOR - daysAgo * DAY);
const dateAgo = (daysAgo: number) => at(daysAgo).toISOString().slice(0, 10);
const pad = (n: number, width = 2) => String(n).padStart(width, '0');
/** Template period tag: `~mNN` = NN months before the current month (resolved by rentroll.period_for). */
const periodTag = (k: number) => `~m${pad(k)}`;
const uuid = (kind: number, n: number) =>
  `00000000-0000-4000-8000-${pad(kind, 4)}${pad(n, 8)}`;

/** Calendar month (1-12) of the period k months before October 2026. */
const monthOf = (k: number) => (((9 - k) % 12) + 12) % 12 + 1;
const season = (month: number) =>
  month >= 3 && month <= 5 ? 1.3 : month >= 11 || month <= 2 ? 0.85 : 1;

/** Deterministic PRNG (mulberry32): the same seed always gives the same apartment. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUILDINGS = [
  {
    code: 'A',
    nameTh: 'บ้านสวนอพาร์ตเมนต์ อาคาร A',
    nameEn: 'Baan Suan Apartment, Building A',
    floors: 4,
    perFloor: 8,
    water: 'per_person' as const,
  },
  {
    code: 'B',
    nameTh: 'บ้านสวนอพาร์ตเมนต์ อาคาร B',
    nameEn: 'Baan Suan Apartment, Building B',
    floors: 2,
    perFloor: 6,
    water: 'per_unit' as const,
  },
];

const TYPES = [
  { nameTh: 'ห้องพัดลม', nameEn: 'Fan room', rent: 350_000 },
  { nameTh: 'ห้องแอร์', nameEn: 'Air-con room', rent: 450_000 },
  { nameTh: 'ห้องแอร์ใหญ่', nameEn: 'Large air-con room', rent: 600_000 },
];

const ELEC_RATE = 800; // 8 baht per unit
const WATER_PER_PERSON = 10_000; // 100 baht per occupant
const WATER_PER_UNIT = 2_500; // 25 baht per unit
const COMMON_FEE = 10_000; // 100 baht per room

/** Room indices (01 §9): 6 empty rooms (3 vacant, 2 maintenance, 1 reserved). Two notice-given tenants. */
const EMPTY = new Set([5, 15, 25, 10, 30, 42]);
const RESERVED = 42;
const NOTICE = new Set([7, 33]);
/** A-305: its current bill is due in 4 days (issued 3 days ago, 7-day terms). */
const DUE_SOON = 20;
/**
 * Four overdue invoices (01 §9): three one month back, one two months back (past 40 days). `slip` marks the
 * one-month-back invoices that already have a PromptPay slip waiting for review.
 */
const OVERDUE = [
  { idx: 0, k: 1 },
  { idx: 1, k: 1 },
  { idx: 2, k: 1 },
  { idx: 3, k: 2 },
];
const OVERDUE_SLIPS = [
  { idx: 0, k: 1 },
  { idx: 1, k: 1 },
];
/** Occupied rooms whose current-period meters were not read yet (the billing run is still pending). */
const MISSING_CURRENT = new Set([3, 9, 21, 27, 33, 39]);
const FIRST = ['สมชาย', 'สมหญิง', 'วรรณา', 'ประเสริฐ', 'กนกพร', 'อนุชา', 'ปิยะ', 'สุนิสา', 'ธนพล', 'มาลี', 'ชัยวัฒน์', 'นภา'];
const LAST = ['ใจดี', 'มีสุข', 'รักษ์ไทย', 'ทองดี', 'สว่าง', 'แสงทอง', 'พงษ์พานิช', 'ศรีสุข'];

type RoomSpec = { idx: number; b: number; number: string; floor: number; t: number };

const ROOMS: RoomSpec[] = BUILDINGS.flatMap((bld, b) =>
  Array.from({ length: bld.floors }, (_, f) =>
    Array.from({ length: bld.perFloor }, (_, n) => ({
      b,
      floor: f + 1,
      number: `${bld.code}-${f + 1}${pad(n + 1)}`,
      t: (f + 1 + (n + 1)) % 3,
    })),
  ).flat(),
).map((r, idx) => ({ ...r, idx }));

const CONTRACTED = ROOMS.filter((r) => !EMPTY.has(r.idx) || r.idx === RESERVED);

export function buildSeed(): SeedData {
  const tenantId = TEMPLATE_TENANT_ID;
  const data: SeedData = {
    tenantId,
    buildings: [],
    ratePlans: [],
    roomTypes: [],
    rooms: [],
    renters: [],
    contracts: [],
    contractRenters: [],
    meterReadings: [],
    invoices: [],
    invoiceLines: [],
    payments: [],
    paymentAllocations: [],
    repairTickets: [],
    ticketMessages: [],
    announcements: [],
    docSequences: [],
  };

  BUILDINGS.forEach((bld, b) => {
    const buildingId = uuid(1, b + 1);
    data.buildings.push({
      id: buildingId,
      tenantId,
      nameTh: bld.nameTh,
      nameEn: bld.nameEn,
      addressTh: 'ถนนตัวอย่าง แขวงทดลอง กรุงเทพฯ',
      addressEn: 'Example Road, Bangkok',
      promptpayId: `DEMO-PROMPTPAY-${bld.code}`,
      bankName: 'ธนาคารตัวอย่าง',
      bankAccountMasked: 'XXX-X-X1234-X',
      billingDay: 25,
      dueDay: 5,
      invoiceYearStyle: 'be',
    });
    data.ratePlans.push({
      id: uuid(2, b + 1),
      tenantId,
      buildingId,
      validFrom: '2026-01-01',
      elecRateSatang: ELEC_RATE,
      elecMinSatang: 0,
      waterMode: bld.water,
      waterRateSatang: bld.water === 'per_unit' ? WATER_PER_UNIT : 0,
      waterMinSatang: 0,
      waterPerPersonSatang: bld.water === 'per_person' ? WATER_PER_PERSON : 0,
      commonFeeSatang: COMMON_FEE,
      lateFeeRule: { kind: 'per_day', amountSatang: 2_000, capSatang: 100_000 },
    });
    TYPES.forEach((type, t) =>
      data.roomTypes.push({
        id: uuid(3, b * 3 + t + 1),
        tenantId,
        buildingId,
        nameTh: type.nameTh,
        nameEn: type.nameEn,
        monthlyRentSatang: type.rent,
        depositSatang: type.rent * 2,
        advanceMonths: 1,
      }),
    );
  });

  for (const r of ROOMS) {
    const buildingId = uuid(1, r.b + 1);
    data.rooms.push({
      id: uuid(4, r.idx + 1),
      tenantId,
      buildingId,
      number: r.number,
      floor: r.floor,
      roomTypeId: uuid(3, r.b * 3 + r.t + 1),
      sizeSqm: 24 + r.t * 6,
      maintenance: r.idx === 10 || r.idx === 30,
      sort: r.idx,
    });
  }

  for (const r of CONTRACTED) {
    const rent = TYPES[r.t]!.rent;
    const reserved = r.idx === RESERVED;
    const notice = NOTICE.has(r.idx);
    const startAgo = reserved ? -20 : 400 + ((r.idx * 7) % 150);
    const occupants = 1 + (r.idx % 3);
    const contractId = uuid(6, r.idx + 1);
    const renterId = uuid(5, r.idx + 1);
    data.renters.push({
      id: renterId,
      tenantId,
      name: `${FIRST[r.idx % FIRST.length]} ${LAST[(r.idx * 5) % LAST.length]}`,
      phone: `+6681000${pad(r.idx + 1, 3)}`,
      preferredLocale: 'th',
    });
    data.contracts.push({
      id: contractId,
      tenantId,
      roomId: uuid(4, r.idx + 1),
      startDate: dateAgo(startAgo),
      startDaysAgo: startAgo,
      endDate: notice ? dateAgo(-10) : null,
      endDaysAgo: notice ? -10 : null,
      noticeDate: notice ? dateAgo(20) : null,
      noticeDaysAgo: notice ? 20 : null,
      status: notice ? 'notice_given' : 'active',
      monthlyRentSatang: rent,
      depositSatang: rent * 2,
      depositReceivedSatang: rent * 2,
      occupants,
      extras: {},
    });
    data.contractRenters.push({
      tenantId,
      contractId,
      renterId,
      isPrimary: true,
    });
    if (!reserved) addBilling(data, r, contractId, occupants, rent);
  }

  addTickets(data);
  addAnnouncementsAndSequences(data);
  return data;
}

/** Meter readings for 12 months plus the current month, and the invoices and payments for the 12 closed months. */
function addBilling(
  data: SeedData,
  r: RoomSpec,
  contractId: string,
  occupants: number,
  rent: number,
) {
  const tenantId = data.tenantId;
  const bld = BUILDINGS[r.b]!;
  const roomId = uuid(4, r.idx + 1);
  const rnd = rng(1000 + r.idx);
  const elec: number[] = [];
  const water: number[] = [];
  for (let k = 0; k <= 12; k++) {
    elec[k] = Math.round(120 * season(monthOf(k)) * (0.8 + 0.4 * rnd()));
    water[k] = Math.round(8 * (0.8 + 0.4 * rnd()));
  }
  const elecReading: number[] = [];
  const waterReading: number[] = [];
  elecReading[13] = 1000 + r.idx * 50;
  waterReading[13] = 200 + r.idx * 10;
  for (let k = 12; k >= 0; k--) {
    elecReading[k] = elecReading[k + 1]! + elec[k]!;
    waterReading[k] = waterReading[k + 1]! + water[k]!;
  }

  for (let k = 0; k <= 12; k++) {
    if (k === 0 && MISSING_CURRENT.has(r.idx)) continue;
    const readDaysAgo = k === 0 ? 2 : 30 * k + 2;
    for (const [kind, readings, units] of [
      ['electricity', elecReading, elec],
      ['water', waterReading, water],
    ] as const) {
      data.meterReadings.push({
        tenantId,
        roomId,
        kind,
        period: periodTag(k),
        reading: readings[k]!,
        unitsUsed: units[k]!,
        readBy: 'caretaker',
        readAt: at(readDaysAgo),
        daysAgo: readDaysAgo,
      });
    }
  }

  // Invoices for the 12 closed months. The current month's bills wait for the billing run, except A-305's (01 §9).
  const firstPeriod = r.idx === DUE_SOON ? 0 : 1;
  for (let k = firstPeriod; k <= 12; k++) {
    const issueAgo = k === 0 ? 3 : 30 * k + 2;
    const dueAgo = issueAgo - 7;
    const invoiceId = uuid(7, r.idx * 13 + k);
    const number = `INV-${r.number}-${k}`;
    const lines = [
      { kind: 'rent', th: 'ค่าเช่า', en: 'Rent', qty: 1, unit: rent },
      {
        kind: 'electricity',
        th: 'ค่าไฟฟ้า',
        en: 'Electricity',
        qty: elec[k]!,
        unit: ELEC_RATE,
      },
      bld.water === 'per_person'
        ? { kind: 'water', th: 'ค่าน้ำ (ตามจำนวนคน)', en: 'Water (per person)', qty: occupants, unit: WATER_PER_PERSON }
        : { kind: 'water', th: 'ค่าน้ำ (ตามหน่วย)', en: 'Water (per unit)', qty: water[k]!, unit: WATER_PER_UNIT },
      { kind: 'common', th: 'ค่าส่วนกลาง', en: 'Common area fee', qty: 1, unit: COMMON_FEE },
    ];
    const total = lines.reduce((sum, l) => sum + l.qty * l.unit, 0);
    const current = k === 0;
    const overdue = OVERDUE.some((o) => o.idx === r.idx && o.k === k);
    const late = r.idx % 11 === 5;
    if (current && !(r.idx === DUE_SOON)) continue;
    data.invoices.push({
      id: invoiceId,
      tenantId,
      buildingId: uuid(1, r.b + 1),
      contractId,
      number,
      type: 'monthly',
      period: periodTag(k),
      issueDate: dateAgo(issueAgo),
      dueDate: dateAgo(dueAgo),
      status: overdue || current ? 'sent' : 'paid',
      subtotalSatang: total,
      totalSatang: total,
      paidSatang: overdue || current ? 0 : total,
      sentAt: at(issueAgo),
      publicToken: `tpl-${number}`,
      daysAgo: issueAgo,
    });
    lines.forEach((l, i) =>
      data.invoiceLines.push({
        id: uuid(12, r.idx * 100 + k * 5 + i),
        tenantId,
        invoiceId,
        kind: l.kind,
        labelTh: l.th,
        labelEn: l.en,
        qty: l.qty,
        unitPriceSatang: l.unit,
        amountSatang: l.qty * l.unit,
      }),
    );
    if (current) continue;
    if (overdue) {
      const slip = OVERDUE_SLIPS.some((o) => o.idx === r.idx && o.k === k);
      if (slip)
        data.payments.push({
          id: uuid(8, r.idx * 13 + k),
          tenantId,
          contractId,
          amountSatang: total,
          method: 'promptpay',
          paidAt: at(1),
          slipUrl: 'demo/slip-placeholder.png',
          status: 'pending_review',
          daysAgo: 1,
          minuteOfDay: 900,
        });
      continue;
    }
    const paidAgo = late ? dueAgo - 3 : issueAgo - 3;
    const paymentId = uuid(8, r.idx * 13 + k);
    data.payments.push({
      id: paymentId,
      tenantId,
      contractId,
      amountSatang: total,
      method: k % 2 === 0 ? 'transfer' : 'promptpay',
      paidAt: at(paidAgo),
      status: 'approved',
      receiptNumber: `RC-${r.number}-${k}`,
      daysAgo: paidAgo,
      minuteOfDay: 600,
    });
    data.paymentAllocations.push({
      tenantId,
      paymentId,
      invoiceId,
      amountSatang: total,
    });
  }
}

function addTickets(data: SeedData) {
  const tenantId = data.tenantId;
  const open = [
    { room: 20, cat: 'aircon', status: 'new', desc: 'แอร์ไม่เย็น มีเสียงดังผิดปกติ', ago: 1 },
    { room: 0, cat: 'plumbing', status: 'scheduled', desc: 'ก๊อกน้ำในห้องน้ำรั่ว', ago: 3 },
    { room: 33, cat: 'electrical', status: 'in_progress', desc: 'ปลั๊กไฟในห้องนอนไม่ทำงาน', ago: 4 },
    { room: 8, cat: 'internet', status: 'new', desc: 'อินเทอร์เน็ตช้าตั้งแต่เมื่อคืน', ago: 2 },
    { room: 12, cat: 'furniture', status: 'in_progress', desc: 'ตู้เสื้อผ้าประตูหลุดราง', ago: 6 },
    { room: 20, cat: 'plumbing', status: 'done', desc: 'ท่อระบายน้ำอ่างล้างจานอุดตัน', ago: 12 },
  ] as const;
  open.forEach((t, i) => {
    const ticketId = uuid(9, i + 1);
    const renterId = uuid(5, t.room + 1);
    data.repairTickets.push({
      id: ticketId,
      tenantId,
      roomId: uuid(4, t.room + 1),
      renterId: CONTRACTED.some((r) => r.idx === t.room) ? renterId : null,
      category: t.cat,
      description: t.desc,
      preferredTime: 'weekday-morning',
      allowEntry: true,
      status: t.status,
      assignee: 'ช่างประจำอาคาร',
      scheduledAt: t.status === 'scheduled' ? at(-2) : null,
      closedAt: t.status === 'done' ? at(5) : null,
      costSatang: t.status === 'done' ? 150_000 : null,
      daysAgo: t.ago,
      minuteOfDay: 540,
    });
    data.ticketMessages.push({
      id: uuid(10, i * 2 + 1),
      tenantId,
      ticketId,
      authorRole: 'tenant',
      body: t.desc,
      daysAgo: t.ago,
      minuteOfDay: 540,
    });
    if (t.status === 'done')
      data.ticketMessages.push({
        id: uuid(10, i * 2 + 2),
        tenantId,
        ticketId,
        authorRole: 'owner',
        body: 'ซ่อมเรียบร้อยแล้วค่ะ',
        daysAgo: 5,
        minuteOfDay: 900,
      });
  });
}

function addAnnouncementsAndSequences(data: SeedData) {
  const tenantId = data.tenantId;
  const buildingA = uuid(1, 1);
  data.announcements.push(
    {
      id: uuid(11, 1),
      tenantId,
      buildingId: buildingA,
      titleTh: 'ปิดน้ำชั่วคราว',
      titleEn: 'Water shut-off',
      bodyTh: 'วันเสาร์นี้จะปิดน้ำช่วง 09:00-12:00 น. เพื่อซ่อมท่อหลัก',
      bodyEn: 'Water will be off this Saturday, 09:00-12:00, for main pipe repairs.',
      publishedAt: at(3),
      daysAgo: 3,
      minuteOfDay: 480,
    },
    {
      id: uuid(11, 2),
      tenantId,
      buildingId: buildingA,
      titleTh: 'ทำความสะอาดลานจอดรถ',
      titleEn: 'Parking lot cleaning',
      bodyTh: 'ฝ่ายดูแลจะทำความสะอาดลานจอดรถวันพฤหัสบดี กรุณาย้ายรถก่อน 08:00 น.',
      bodyEn: 'Parking lot cleaning on Thursday. Please move your car before 08:00.',
      publishedAt: at(6),
      daysAgo: 6,
      minuteOfDay: 480,
    },
  );
  BUILDINGS.forEach((_, b) => {
    const count = data.invoices.filter(
      (i) => i.buildingId === uuid(1, b + 1),
    ).length;
    data.docSequences.push({
      tenantId,
      buildingId: uuid(1, b + 1),
      docType: 'invoice',
      year: 2026,
      nextNo: count + 1,
    });
  });
}
