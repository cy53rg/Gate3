import { MONTHS } from '../constants';
import { payKey } from '../lib/dues';
import type {
  AdminRole, AdminSnapshot, AdminUser, ChangeRequest, MonthKey, PayLine, Property, RequestStatus, Settings, Street,
} from '../types';
import { loadDb, resetDemo, saveDb } from './demoStore';
import { isDemo, sb } from './supabase';

export { isDemo };

const DEMO_PASSWORD = 'demo1234';
const SESSION_KEY = 'estate-demo-admin';
const monthNo = (m: MonthKey) => MONTHS.findIndex((x) => x.key === m) + 1;
const monthKey = (n: number) => MONTHS[n - 1].key;

// ---------- session ----------
export async function getSession(): Promise<AdminUser | null> {
  if (isDemo) {
    try {
      return sessionStorage.getItem(SESSION_KEY) ? { id: 'demo', email: 'demo@admin', role: 'admin' } : null;
    } catch {
      return null;
    }
  }
  const { data } = await sb().auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  const { data: row, error } = await sb().from('admins').select('role').eq('user_id', u.id).maybeSingle();
  if (error || !row) {
    await sb().auth.signOut();
    return null;
  }
  return { id: u.id, email: u.email ?? '', role: row.role as AdminRole };
}

export async function signIn(email: string, password: string): Promise<AdminUser> {
  if (isDemo) {
    if (password !== DEMO_PASSWORD) throw new Error(`Demo mode: the password is "${DEMO_PASSWORD}".`);
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
    return { id: 'demo', email: email || 'demo@admin', role: 'admin' };
  }
  const { error } = await sb().auth.signInWithPassword({ email, password });
  if (error) throw new Error('Wrong email or password.');
  const u = await getSession();
  if (!u) throw new Error('This account is not registered as an estate admin.');
  return u;
}

export async function signOut(): Promise<void> {
  if (isDemo) {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  await sb().auth.signOut();
}

// ---------- row mapping ----------
type Row = Record<string, unknown>;
const toProperty = (r: Row): Property => ({
  id: r.id as string,
  category: r.category as Property['category'],
  name: r.name as string,
  houseNo: r.house_no as string,
  street: r.street as string,
  phone: r.phone as string,
  tenantCount: r.tenant_count as number,
  establishmentType: (r.establishment_type as string | null) ?? null,
  monthlyDue: (r.monthly_due as number | null) ?? null,
  notes: (r.notes as string) ?? '',
});
const fromProperty = (p: Property) => ({
  id: p.id,
  category: p.category,
  name: p.name,
  house_no: p.houseNo,
  street: p.street,
  phone: p.phone,
  tenant_count: p.tenantCount,
  establishment_type: p.establishmentType,
  monthly_due: p.monthlyDue,
  notes: p.notes,
});
const toRequest = (r: Row): ChangeRequest => ({
  id: r.id as string,
  type: r.type as ChangeRequest['type'],
  propertyId: (r.property_id as string | null) ?? null,
  submittedBy: r.submitted_by as string,
  submitterPhone: (r.submitter_phone as string) ?? '',
  reason: (r.reason as string) ?? '',
  proposed: r.proposed as ChangeRequest['proposed'],
  status: r.status as RequestStatus,
  createdAt: r.created_at as string,
});

// ---------- load ----------
export async function loadAdminSnapshot(): Promise<AdminSnapshot> {
  if (isDemo) {
    const db = loadDb();
    return { ...db, streets: db.streets.sort((a, b) => a.sortOrder - b.sortOrder) };
  }
  const c = sb();
  const [set, st, props, reqs] = await Promise.all([
    c.from('settings').select('*').eq('id', 1).single(),
    c.from('streets').select('name, sort_order').order('sort_order'),
    c.from('properties').select('*').order('created_at'),
    c.from('change_requests').select('*').order('created_at', { ascending: false }).limit(500),
  ]);
  for (const r of [set, st, props, reqs]) if (r.error) throw r.error;
  const s = set.data as Row;
  const settings: Settings = {
    year: s.year as number,
    landlordRate: s.landlord_rate as number,
    tenantRate: s.tenant_rate as number,
    establishmentRate: s.establishment_rate as number,
    showPaymentsPublicly: s.show_payments_publicly as boolean,
  };

  // payments: page through results (the API returns at most 1000 rows per request)
  const payments: AdminSnapshot['payments'] = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await c
      .from('payments')
      .select('property_id, line, month, amount')
      .eq('year', settings.year)
      .order('property_id')
      .order('line')
      .order('month')
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data as Row[]) payments[payKey(r.property_id as string, r.line as PayLine, monthKey(r.month as number))] = r.amount as number;
    if (!data || data.length < 1000) break;
  }

  return {
    properties: (props.data as Row[]).map(toProperty),
    payments,
    streets: (st.data as Row[]).map((r) => ({ name: r.name as string, sortOrder: r.sort_order as number })),
    settings,
    requests: (reqs.data as Row[]).map(toRequest),
  };
}

// ---------- writes ----------
export async function setPayment(year: number, propertyId: string, line: PayLine, month: MonthKey, amount: number): Promise<void> {
  if (isDemo) {
    const db = loadDb();
    const k = payKey(propertyId, line, month);
    if (amount > 0) db.payments[k] = amount;
    else delete db.payments[k];
    saveDb(db);
    return;
  }
  const c = sb();
  if (amount > 0) {
    const { error } = await c
      .from('payments')
      .upsert({ property_id: propertyId, line, year, month: monthNo(month), amount }, { onConflict: 'property_id,line,year,month' });
    if (error) throw error;
  } else {
    const { error } = await c.from('payments').delete().match({ property_id: propertyId, line, year, month: monthNo(month) });
    if (error) throw error;
  }
}

/** Insert or update. For a new property pass a temporary id; the saved row (with its real id) is returned. */
export async function saveProperty(p: Property, isNew: boolean): Promise<Property> {
  if (isDemo) {
    const db = loadDb();
    if (isNew) {
      const created = { ...p, id: `P-${Date.now()}` };
      db.properties.push(created);
      saveDb(db);
      return created;
    }
    db.properties = db.properties.map((x) => (x.id === p.id ? p : x));
    saveDb(db);
    return p;
  }
  const row = fromProperty(p);
  if (isNew) {
    const { id: _omit, ...insertRow } = row;
    void _omit;
    const { data, error } = await sb().from('properties').insert(insertRow).select('*').single();
    if (error) throw error;
    return toProperty(data as Row);
  }
  const { data, error } = await sb().from('properties').update(row).eq('id', p.id).select('*').single();
  if (error) throw error;
  return toProperty(data as Row);
}

export async function deleteProperty(id: string): Promise<void> {
  if (isDemo) {
    const db = loadDb();
    db.properties = db.properties.filter((p) => p.id !== id);
    Object.keys(db.payments).filter((k) => k.startsWith(id + '|')).forEach((k) => delete db.payments[k]);
    saveDb(db);
    return;
  }
  const { error } = await sb().from('properties').delete().eq('id', id);
  if (error) throw error;
}

export async function setRequestStatus(id: string, status: RequestStatus): Promise<void> {
  if (isDemo) {
    const db = loadDb();
    db.requests = db.requests.map((r) => (r.id === id ? { ...r, status } : r));
    saveDb(db);
    return;
  }
  const { error } = await sb().from('change_requests').update({ status, resolved_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function saveSettings(s: Settings): Promise<void> {
  if (isDemo) {
    const db = loadDb();
    db.settings = s;
    saveDb(db);
    return;
  }
  const { error } = await sb()
    .from('settings')
    .update({
      landlord_rate: s.landlordRate,
      tenant_rate: s.tenantRate,
      establishment_rate: s.establishmentRate,
      show_payments_publicly: s.showPaymentsPublicly,
    })
    .eq('id', 1);
  if (error) throw error;
}

export async function saveStreets(streets: Street[]): Promise<void> {
  if (isDemo) {
    const db = loadDb();
    db.streets = streets;
    saveDb(db);
    return;
  }
  const c = sb();
  const { error } = await c.from('streets').upsert(streets.map((s) => ({ name: s.name, sort_order: s.sortOrder })), { onConflict: 'name' });
  if (error) throw error;
  const keep = streets.map((s) => s.name);
  const { data } = await c.from('streets').select('name');
  const remove = ((data ?? []) as { name: string }[]).map((r) => r.name).filter((n) => !keep.includes(n));
  if (remove.length) {
    const { error: e2 } = await c.from('streets').delete().in('name', remove);
    if (e2) throw e2;
  }
}

export { resetDemo };
