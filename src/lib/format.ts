import { NO_VALUE, UNSPECIFIED_STREET } from '../constants';
import type { Property } from '../types';

export const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');
export const num = (n: number) => Math.round(n || 0).toLocaleString('en-NG');

/** 0803 *** 951 style masking for the public portal (demo adapter mirrors the SQL function). */
export function maskPhone(phone: string): string {
  const parts = (phone || '').split('/').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return NO_VALUE;
  return parts.map((p) => (p.length >= 7 ? `${p.slice(0, 4)}***${p.slice(-3)}` : p)).join(' / ');
}

/** Valid Nigerian mobile format: 11 digits starting with 0, optionally two numbers separated by "/". */
export function phoneOk(phone: string): boolean {
  return /^0\d{10}(\s*\/\s*0\d{10})*$/.test((phone || '').trim());
}

export function houseSortValue(houseNo: string): number {
  if (!houseNo || houseNo === NO_VALUE) return 99999;
  const m = String(houseNo).match(/\d+/);
  return m ? parseInt(m[0], 10) : 99998;
}

export function houseSuffix(houseNo: string): string {
  const m = String(houseNo).match(/\d+(.*)$/);
  return m ? m[1] : '';
}

export function streetRank(street: string, streets: string[]): number {
  if (street === UNSPECIFIED_STREET || !street) return 9999;
  const i = streets.indexOf(street);
  return i === -1 ? 9000 : i;
}

/** The one ordering used everywhere: street (admin-defined order) -> house number -> name. */
export function compareProps(streets: string[]) {
  return (a: Pick<Property, 'street' | 'houseNo' | 'name'>, b: Pick<Property, 'street' | 'houseNo' | 'name'>) => {
    const sa = streetRank(a.street, streets);
    const sb = streetRank(b.street, streets);
    if (sa !== sb) return sa - sb;
    const ha = houseSortValue(a.houseNo);
    const hb = houseSortValue(b.houseNo);
    if (ha !== hb) return ha - hb;
    const sfx = houseSuffix(a.houseNo).localeCompare(houseSuffix(b.houseNo));
    if (sfx !== 0) return sfx;
    return a.name.localeCompare(b.name);
  };
}

export function displayName(p: Pick<Property, 'name' | 'category'>): string {
  if (/^—|unlisted|refused/i.test(p.name.trim())) {
    return p.category === 'TENANTS_ONLY' ? 'Landlord name not yet recorded' : 'Name not yet recorded';
  }
  return p.name;
}

export function addressOf(p: Pick<Property, 'houseNo' | 'street'>): string {
  const h = p.houseNo && p.houseNo !== NO_VALUE ? p.houseNo : '';
  const s = p.street === UNSPECIFIED_STREET ? '' : p.street;
  const a = `${h} ${s}`.trim();
  return a || NO_VALUE;
}

export function needsVerify(p: Pick<Property, 'houseNo' | 'street' | 'name' | 'phone' | 'category'>) {
  const missingHouse = !p.houseNo || p.houseNo === NO_VALUE || p.houseNo.includes('*');
  const missingStreet = p.street === UNSPECIFIED_STREET;
  const missingPhone = !phoneOk(p.phone);
  const missingName = /^—|unlisted|refused/i.test(p.name.trim());
  return { any: missingHouse || missingStreet || missingPhone || missingName, missingHouse, missingStreet, missingPhone, missingName };
}

export function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
