export type Category = 'LANDLORD' | 'LANDLORD_TENANTS' | 'TENANTS_ONLY' | 'ESTABLISHMENT';
export type PayLine = 'LANDLORD' | 'TENANTS' | 'ESTABLISHMENT';
export type MonthKey =
  | 'jan' | 'feb' | 'mar' | 'apr' | 'may' | 'jun'
  | 'jul' | 'aug' | 'sep' | 'oct' | 'nov' | 'dec';

export interface Property {
  id: string;
  category: Category;
  name: string;
  houseNo: string; // '—' when unknown
  street: string; // UNSPECIFIED_STREET when unknown
  phone: string; // '—' when unknown; may hold two numbers separated by " / "
  tenantCount: number; // only used by LANDLORD_TENANTS and TENANTS_ONLY
  establishmentType: string | null; // only used by ESTABLISHMENT
  monthlyDue: number | null; // ESTABLISHMENT only: custom monthly due (null = use default rate)
  notes: string;
}

export interface SeedPayment {
  propertyId: string;
  line: PayLine;
  month: MonthKey;
  amount: number;
}

/** key = `${propertyId}|${line}|${month}` -> amount paid (only paid cells are present) */
export type PaymentIndex = Record<string, number>;

export interface Settings {
  year: number;
  landlordRate: number;
  tenantRate: number;
  establishmentRate: number;
  /** if false, residents only see the directory - no payment status */
  showPaymentsPublicly: boolean;
}

export interface Street {
  name: string;
  sortOrder: number;
}

export type ProposedProperty = Pick<
  Property,
  'name' | 'houseNo' | 'street' | 'phone' | 'category' | 'tenantCount' | 'establishmentType'
>;

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface ChangeRequest {
  id: string;
  type: 'NEW' | 'UPDATE';
  propertyId: string | null;
  submittedBy: string;
  submitterPhone: string;
  reason: string;
  proposed: ProposedProperty;
  status: RequestStatus;
  createdAt: string; // ISO
}

export interface NewRequestInput {
  type: 'NEW' | 'UPDATE';
  propertyId: string | null;
  submittedBy: string;
  submitterPhone: string;
  reason: string;
  proposed: ProposedProperty;
}

/** What a resident is allowed to see (phones masked server-side). */
export interface PublicRow {
  id: string;
  category: Category;
  name: string;
  houseNo: string;
  street: string;
  phoneMasked: string;
  phoneOk: boolean;
  tenantCount: number;
  establishmentType: string | null;
  /** months fully paid; empty when the estate hides payment status */
  paidMonths: MonthKey[];
}

export interface PublicSnapshot {
  rows: PublicRow[];
  streets: string[];
  settings: Pick<Settings, 'year' | 'landlordRate' | 'tenantRate' | 'establishmentRate' | 'showPaymentsPublicly'>;
}

export type AdminRole = 'admin' | 'collector';
export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
}

export interface AdminSnapshot {
  properties: Property[];
  payments: PaymentIndex;
  streets: Street[];
  settings: Settings;
  requests: ChangeRequest[];
}
