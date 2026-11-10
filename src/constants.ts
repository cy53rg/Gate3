import type { Category, MonthKey, PayLine } from './types';

export const ESTATE_NAME: string = (import.meta as any).env?.VITE_ESTATE_NAME || 'Estate Security Register';

export const MONTHS: { key: MonthKey; label: string }[] = [
  { key: 'jan', label: 'Jan' }, { key: 'feb', label: 'Feb' }, { key: 'mar', label: 'Mar' },
  { key: 'apr', label: 'Apr' }, { key: 'may', label: 'May' }, { key: 'jun', label: 'Jun' },
  { key: 'jul', label: 'Jul' }, { key: 'aug', label: 'Aug' }, { key: 'sep', label: 'Sep' },
  { key: 'oct', label: 'Oct' }, { key: 'nov', label: 'Nov' }, { key: 'dec', label: 'Dec' },
];

export const UNSPECIFIED_STREET = 'Unspecified / Verify';
export const NO_VALUE = '—';

export const ESTABLISHMENT_TYPES = [
  'Church',
  'Mosque',
  'School',
  'Shop / Business',
  'Clinic / Pharmacy',
  'Hotel / Guest house',
  'Association / Other',
];

/** Order of the sections in every list and in the printed form. */
export const CATEGORY_ORDER: Category[] = [
  'LANDLORD',
  'LANDLORD_TENANTS',
  'TENANTS_ONLY',
  'ESTABLISHMENT',
];

export const CATEGORY_LABEL: Record<Category, string> = {
  LANDLORD: 'Landlords',
  LANDLORD_TENANTS: 'Landlords & Tenants',
  TENANTS_ONLY: 'Tenants Only',
  ESTABLISHMENT: 'Churches & Other Establishments',
};

/** Plain-language choices shown to residents on the "add / update my house" form. */
export const CATEGORY_CHOICES: { value: Category; label: string; hint: string }[] = [
  { value: 'LANDLORD', label: 'I own and live in the house (no tenants)', hint: 'Landlord only' },
  { value: 'LANDLORD_TENANTS', label: 'I own and live in the house, and I have tenants', hint: 'Landlord + tenants' },
  { value: 'TENANTS_ONLY', label: 'I own the house but do not live there (tenants only)', hint: 'Tenants only' },
  { value: 'ESTABLISHMENT', label: 'Church, school, shop or other establishment', hint: 'Establishment' },
];

export const LINE_LABEL: Record<PayLine, string> = {
  LANDLORD: 'Landlord',
  TENANTS: 'Tenants',
  ESTABLISHMENT: 'Establishment',
};
