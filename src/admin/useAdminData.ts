import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../api/adminApi';
import { NO_VALUE, UNSPECIFIED_STREET } from '../constants';
import { dueLines, payKey } from '../lib/dues';
import type { AdminSnapshot, ChangeRequest, MonthKey, PayLine, Property, ProposedProperty, Settings, Street } from '../types';

/** Keeps tenant count / establishment fields consistent with the category. */
export function normalizeProperty(p: Property): Property {
  const hasTenants = p.category === 'LANDLORD_TENANTS' || p.category === 'TENANTS_ONLY';
  return {
    ...p,
    name: p.name.trim() || '— (Unlisted Landlord)',
    houseNo: p.houseNo.trim() || NO_VALUE,
    phone: p.phone.trim() || NO_VALUE,
    street: p.street || UNSPECIFIED_STREET,
    tenantCount: hasTenants ? Math.max(1, p.tenantCount) : 0,
    establishmentType: p.category === 'ESTABLISHMENT' ? p.establishmentType || 'Church' : null,
    monthlyDue: p.category === 'ESTABLISHMENT' ? p.monthlyDue : null,
  };
}

export function blankProperty(street = ''): Property {
  return { id: '', category: 'LANDLORD', name: '', houseNo: '', street, phone: '', tenantCount: 0, establishmentType: null, monthlyDue: null, notes: '' };
}

export function useAdminData(notify: (m: string) => void) {
  const [snap, setSnap] = useState<AdminSnapshot | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setSnap(await api.loadAdminSnapshot());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load data');
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const streetOrder = useMemo(() => (snap ? [...snap.streets].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.name) : []), [snap]);

  const fail = (e: unknown) => notify(`Could not save: ${e instanceof Error ? e.message : 'unknown error'}`);

  const togglePayment = async (p: Property, line: PayLine, month: MonthKey) => {
    if (!snap) return;
    const due = dueLines(p, snap.settings).find((l) => l.line === line)?.due ?? 0;
    if (due <= 0) return;
    const k = payKey(p.id, line, month);
    const next = (snap.payments[k] || 0) > 0 ? 0 : due;
    const before = snap.payments;
    const after = { ...before };
    if (next > 0) after[k] = next;
    else delete after[k];
    setSnap({ ...snap, payments: after }); // instant feedback, rolled back if saving fails
    try {
      await api.setPayment(snap.settings.year, p.id, line, month, next);
    } catch (e) {
      setSnap((s) => (s ? { ...s, payments: before } : s));
      fail(e);
    }
  };

  const saveProperty = async (p: Property, isNew: boolean): Promise<boolean> => {
    try {
      const saved = await api.saveProperty(normalizeProperty(p), isNew);
      setSnap((s) => (s ? { ...s, properties: isNew ? [...s.properties, saved] : s.properties.map((x) => (x.id === saved.id ? saved : x)) } : s));
      notify(isNew ? 'Added to the register.' : 'Saved.');
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const removeProperty = async (id: string): Promise<boolean> => {
    try {
      await api.deleteProperty(id);
      setSnap((s) => (s ? { ...s, properties: s.properties.filter((p) => p.id !== id) } : s));
      notify('Removed from the register.');
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const mark = (id: string, status: ChangeRequest['status']) =>
    setSnap((s) => (s ? { ...s, requests: s.requests.map((r) => (r.id === id ? { ...r, status } : r)) } : s));

  const approve = async (req: ChangeRequest) => {
    if (!snap) return;
    try {
      const pr: ProposedProperty = req.proposed;
      if (req.type === 'NEW') {
        const created = await api.saveProperty(
          normalizeProperty({ ...blankProperty(), ...pr, notes: `Added via resident portal (${req.submittedBy}, ${req.submitterPhone})` }),
          true,
        );
        setSnap((s) => (s ? { ...s, properties: [...s.properties, created] } : s));
      } else {
        const existing = snap.properties.find((p) => p.id === req.propertyId);
        if (!existing) throw new Error('The property no longer exists');
        // blank fields from the resident never wipe existing values (e.g. the full phone number they cannot see)
        const merged = normalizeProperty({
          ...existing,
          name: pr.name || existing.name,
          houseNo: pr.houseNo || existing.houseNo,
          street: pr.street || existing.street,
          phone: pr.phone || existing.phone,
          category: pr.category,
          tenantCount: pr.tenantCount,
          establishmentType: pr.establishmentType,
          notes: `${existing.notes ? existing.notes + ' | ' : ''}Updated via portal by ${req.submittedBy}`,
        });
        const saved = await api.saveProperty(merged, false);
        setSnap((s) => (s ? { ...s, properties: s.properties.map((x) => (x.id === saved.id ? saved : x)) } : s));
      }
      await api.setRequestStatus(req.id, 'approved');
      mark(req.id, 'approved');
      notify('Approved and applied to the register.');
    } catch (e) {
      fail(e);
    }
  };

  const reject = async (req: ChangeRequest) => {
    try {
      await api.setRequestStatus(req.id, 'rejected');
      mark(req.id, 'rejected');
      notify('Request rejected.');
    } catch (e) {
      fail(e);
    }
  };

  const saveSettings = async (s: Settings) => {
    try {
      await api.saveSettings(s);
      setSnap((x) => (x ? { ...x, settings: s } : x));
      notify('Settings saved.');
    } catch (e) {
      fail(e);
    }
  };

  const saveStreets = async (list: Street[]) => {
    try {
      await api.saveStreets(list);
      setSnap((x) => (x ? { ...x, streets: list } : x));
      notify('Streets saved.');
    } catch (e) {
      fail(e);
    }
  };

  return { snap, error, reload, streetOrder, togglePayment, saveProperty, removeProperty, approve, reject, saveSettings, saveStreets };
}

export type AdminData = ReturnType<typeof useAdminData>;
