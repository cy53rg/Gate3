import { CATEGORY_LABEL, MONTHS } from '../constants';
import type { PaymentIndex, Property, Settings } from '../types';
import { dueLines, paidAmount } from './dues';
import { compareProps } from './format';

const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** Excel-friendly CSV (UTF-8 with BOM so ₦ and apostrophes open correctly). One line per payment line. */
export function buildCsv(properties: Property[], payments: PaymentIndex, settings: Settings, streets: string[], street: string): Blob {
  const head = ['Category', 'Street', 'House No', 'Name', 'Phone', 'Line', 'Tenants', 'Due/Month (NGN)', ...MONTHS.map((m) => m.label), 'Paid YTD (NGN)', 'Annual Due (NGN)', 'Notes'];
  const rows: string[] = [head.map(q).join(',')];
  const list = properties.filter((p) => street === 'ALL' || p.street === street);
  const order = ['LANDLORD', 'LANDLORD_TENANTS', 'TENANTS_ONLY', 'ESTABLISHMENT'];
  list
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || compareProps(streets)(a, b))
    .forEach((p) => {
      for (const l of dueLines(p, settings)) {
        const vals = MONTHS.map((m) => paidAmount(payments, p.id, l.line, m.key));
        rows.push(
          [
            CATEGORY_LABEL[p.category], p.street, p.houseNo, p.name, p.phone, l.label,
            l.line === 'TENANTS' ? p.tenantCount : '', l.due, ...vals,
            vals.reduce((a, b) => a + b, 0), l.due * 12, p.notes,
          ]
            .map(q)
            .join(','),
        );
      }
    });
  return new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
}
