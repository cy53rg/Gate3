import { SEED_PAYMENTS, SEED_PROPERTIES, SEED_STREETS } from '../data/seed';
import { payKey } from '../lib/dues';
import type { ChangeRequest, PaymentIndex, Property, Settings, Street } from '../types';

/**
 * DEMO MODE ONLY. Used when no Supabase project is configured.
 * Everything lives in this browser's localStorage - it is NOT shared with other people
 * and NOT secure. Real hosting uses Supabase (see README).
 */
export interface DemoDb {
  properties: Property[];
  payments: PaymentIndex;
  streets: Street[];
  settings: Settings;
  requests: ChangeRequest[];
}

const KEY = 'estate-demo-db-v1';
let memory: DemoDb | null = null;

function seed(): DemoDb {
  const payments: PaymentIndex = {};
  SEED_PAYMENTS.forEach((p) => (payments[payKey(p.propertyId, p.line, p.month)] = p.amount));
  return {
    properties: SEED_PROPERTIES.map((p) => ({ ...p })),
    payments,
    streets: SEED_STREETS.map((name, i) => ({ name, sortOrder: i + 1 })),
    settings: { year: 2026, landlordRate: 2000, tenantRate: 1000, establishmentRate: 2000, showPaymentsPublicly: true },
    requests: [],
  };
}

export function loadDb(): DemoDb {
  if (memory) return structuredClone(memory);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      memory = JSON.parse(raw) as DemoDb;
      return structuredClone(memory);
    }
  } catch {
    /* storage blocked - fall through to in-memory */
  }
  memory = seed();
  return structuredClone(memory);
}

export function saveDb(db: DemoDb) {
  memory = structuredClone(db);
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}

export function resetDemo() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
