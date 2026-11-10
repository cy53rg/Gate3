import { MONTHS } from '../constants';
import { maskPhone, phoneOk } from '../lib/format';
import { dueLines } from '../lib/dues';
import type { Category, MonthKey, NewRequestInput, PublicRow, PublicSnapshot } from '../types';
import { loadDb, saveDb } from './demoStore';
import { isDemo, sb } from './supabase';

export { isDemo };

/** Everything the resident portal can ever read. Phones are masked by the database, not by the browser. */
export async function fetchPublicSnapshot(): Promise<PublicSnapshot> {
  if (isDemo) {
    const db = loadDb();
    const rows: PublicRow[] = db.properties.map((p) => {
      const lines = dueLines(p, db.settings);
      const paidMonths: MonthKey[] = db.settings.showPaymentsPublicly
        ? MONTHS.filter((m) => lines.every((l) => (db.payments[`${p.id}|${l.line}|${m.key}`] || 0) > 0)).map((m) => m.key)
        : [];
      return {
        id: p.id, category: p.category, name: p.name, houseNo: p.houseNo, street: p.street,
        phoneMasked: maskPhone(p.phone), phoneOk: phoneOk(p.phone), tenantCount: p.tenantCount,
        establishmentType: p.establishmentType, paidMonths,
      };
    });
    const { year, landlordRate, tenantRate, establishmentRate, showPaymentsPublicly } = db.settings;
    return {
      rows,
      streets: db.streets.sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.name),
      settings: { year, landlordRate, tenantRate, establishmentRate, showPaymentsPublicly },
    };
  }

  const c = sb();
  const [reg, set, st] = await Promise.all([
    c.rpc('public_register'),
    c.rpc('public_settings'),
    c.from('streets').select('name, sort_order').order('sort_order'),
  ]);
  if (reg.error) throw reg.error;
  if (set.error) throw set.error;
  if (st.error) throw st.error;
  const s = (Array.isArray(set.data) ? set.data[0] : set.data) as Record<string, number | boolean>;
  const monthKeys = MONTHS.map((m) => m.key);
  return {
    rows: (reg.data as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      category: r.category as Category,
      name: r.name as string,
      houseNo: r.house_no as string,
      street: r.street as string,
      phoneMasked: r.phone_masked as string,
      phoneOk: r.phone_ok as boolean,
      tenantCount: r.tenant_count as number,
      establishmentType: (r.establishment_type as string | null) ?? null,
      paidMonths: ((r.paid_months as number[] | null) ?? []).map((n) => monthKeys[n - 1]),
    })),
    streets: (st.data as { name: string }[]).map((x) => x.name),
    settings: {
      year: s.year as number,
      landlordRate: s.landlord_rate as number,
      tenantRate: s.tenant_rate as number,
      establishmentRate: s.establishment_rate as number,
      showPaymentsPublicly: s.show_payments_publicly as boolean,
    },
  };
}

/** Residents can only ADD a pending request. They can never change the register directly. */
export async function submitRequest(input: NewRequestInput): Promise<void> {
  if (isDemo) {
    const db = loadDb();
    db.requests.unshift({
      id: `REQ-${Date.now()}`, ...input, status: 'pending', createdAt: new Date().toISOString(),
    });
    saveDb(db);
    return;
  }
  const { error } = await sb().from('change_requests').insert({
    type: input.type,
    property_id: input.propertyId,
    submitted_by: input.submittedBy,
    submitter_phone: input.submitterPhone,
    reason: input.reason,
    proposed: input.proposed,
  });
  if (error) throw error;
}
