import { MONTHS } from '../constants';
import type { MonthKey, PayLine, PaymentIndex, Property, Settings } from '../types';

export interface DueLine {
  line: PayLine;
  label: string; // "Landlord" | "Tenants" | "Establishment"
  due: number; // per month
}

/** Every category is just 1 or 2 monthly "lines". All totals are built from this one function. */
export function dueLines(p: Property, s: Pick<Settings, 'landlordRate' | 'tenantRate' | 'establishmentRate'>): DueLine[] {
  switch (p.category) {
    case 'LANDLORD':
      return [{ line: 'LANDLORD', label: 'Landlord', due: s.landlordRate }];
    case 'LANDLORD_TENANTS':
      return [
        { line: 'LANDLORD', label: 'Landlord', due: s.landlordRate },
        { line: 'TENANTS', label: 'Tenants', due: p.tenantCount * s.tenantRate },
      ];
    case 'TENANTS_ONLY':
      return [{ line: 'TENANTS', label: 'Tenants', due: p.tenantCount * s.tenantRate }];
    case 'ESTABLISHMENT':
      return [{ line: 'ESTABLISHMENT', label: p.establishmentType || 'Establishment', due: p.monthlyDue ?? s.establishmentRate }];
  }
}

export const payKey = (propertyId: string, line: PayLine, month: MonthKey) => `${propertyId}|${line}|${month}`;

export function paidAmount(pay: PaymentIndex, propertyId: string, line: PayLine, month: MonthKey): number {
  return pay[payKey(propertyId, line, month)] || 0;
}

export function monthlyDue(p: Property, s: Settings): number {
  return dueLines(p, s).reduce((a, l) => a + l.due, 0);
}

export interface PropertyStats {
  monthlyDue: number;
  annualDue: number;
  totalPaid: number;
  /** months in which every line of this property is paid */
  monthsFullyPaid: number;
  balance: number;
}

export function propertyStats(p: Property, pay: PaymentIndex, s: Settings): PropertyStats {
  const lines = dueLines(p, s);
  const md = lines.reduce((a, l) => a + l.due, 0);
  let totalPaid = 0;
  let monthsFullyPaid = 0;
  for (const m of MONTHS) {
    let all = lines.length > 0;
    for (const l of lines) {
      const a = paidAmount(pay, p.id, l.line, m.key);
      totalPaid += a;
      if (a <= 0) all = false;
    }
    if (all) monthsFullyPaid += 1;
  }
  return { monthlyDue: md, annualDue: md * 12, totalPaid, monthsFullyPaid, balance: Math.max(0, md * 12 - totalPaid) };
}
