import { CATEGORY_ORDER, MONTHS, NO_VALUE, UNSPECIFIED_STREET } from '../constants';
import type { Category, PaymentIndex, Property, Settings } from '../types';
import { dueLines, paidAmount } from './dues';
import { addressOf, compareProps, displayName, maskPhone, naira, num } from './format';

/**
 * ONE report model feeds the on-screen/print sheet, the Word file and the CSV,
 * so all three always show exactly the same structure as the original Word tracker:
 *   cover + how-to  ->  Landlords  ->  Landlords & Tenants  ->  Tenants Only
 *   ->  Churches & Other Establishments  ->  Summary (Expected / Collected)
 * with names arranged street-by-street inside every section.
 */

export type ColKey = 'no' | 'name' | 'address' | 'phone' | 'type' | 'tenants' | 'estType' | 'due' | 'annual';

export interface ColumnDef {
  key: ColKey;
  header: string;
  width: number; // twips (dxa)
  align: 'left' | 'center' | 'right';
}

export interface ReportRow {
  cells: Partial<Record<ColKey, string>>;
  months: { text: string; paid: boolean }[];
}

export interface ReportGroup {
  street: string;
  label: string; // e.g. "IDI TUNGA CLOSE · 17 houses · ₦34,000/month"
  rows: ReportRow[];
}

export interface ReportSection {
  category: Category;
  heading: string;
  note?: string;
  columns: ColumnDef[]; // fixed columns before the months; month + annual added by renderers
  annualCol: ColumnDef;
  groups: ReportGroup[];
  propertyCount: number;
}

export interface SummaryRow {
  label: string;
  months: (number | null)[];
  annual: number | null;
  total?: boolean;
}

export interface ReportModel {
  title: string;
  subtitle: string;
  howTo: string[];
  sections: ReportSection[];
  expected: SummaryRow[];
  collected: SummaryRow[];
  summaryHeading: string;
  summaryNote: string;
  filled: boolean;
  scope: string;
  generatedOn: string;
}

export interface ReportOptions {
  /** true = show recorded payments; false = blank collection sheet with every box unticked */
  filled: boolean;
  /** 'ALL' or a street name */
  street: string;
  /** default true: show 0803***951 instead of the full number */
  maskPhones?: boolean;
}

const MONTH_W = 500;
const NO: ColumnDef = { key: 'no', header: 'No.', width: 420, align: 'center' };
const PHONE: ColumnDef = { key: 'phone', header: 'Phone No.', width: 1750, align: 'center' };
const DUE: ColumnDef = { key: 'due', header: 'Due (₦)', width: 780, align: 'right' };
const ANNUAL: ColumnDef = { key: 'annual', header: 'Annual (₦)', width: 950, align: 'right' };

export const MONTH_COL_WIDTH = MONTH_W;

const COLUMNS: Record<Category, ColumnDef[]> = {
  LANDLORD: [
    NO,
    { key: 'name', header: 'Name', width: 2800, align: 'left' },
    { key: 'address', header: 'Address', width: 2800, align: 'left' },
    PHONE,
    DUE,
  ],
  LANDLORD_TENANTS: [
    NO,
    { key: 'name', header: 'Name', width: 2100, align: 'left' },
    { key: 'address', header: 'Address', width: 2100, align: 'left' },
    PHONE,
    { key: 'type', header: 'Type', width: 800, align: 'center' },
    { key: 'tenants', header: 'Tenants', width: 780, align: 'center' },
    DUE,
  ],
  TENANTS_ONLY: [
    NO,
    { key: 'name', header: 'Landlord Name', width: 2500, align: 'left' },
    { key: 'address', header: 'Address', width: 2300, align: 'left' },
    PHONE,
    { key: 'tenants', header: 'Tenants', width: 700, align: 'center' },
    DUE,
  ],
  ESTABLISHMENT: [
    NO,
    { key: 'name', header: 'Name', width: 2400, align: 'left' },
    { key: 'estType', header: 'Type', width: 1400, align: 'left' },
    { key: 'address', header: 'Address', width: 2100, align: 'left' },
    PHONE,
    DUE,
  ],
};

const SUMMARY_LABEL: Record<Category, string> = {
  LANDLORD: 'Landlords',
  LANDLORD_TENANTS: 'Landlords & Tenants',
  TENANTS_ONLY: 'Tenants Only',
  ESTABLISHMENT: 'Establishments',
};

const NOUN: Record<Category, [string, string]> = {
  LANDLORD: ['house', 'houses'],
  LANDLORD_TENANTS: ['property', 'properties'],
  TENANTS_ONLY: ['property', 'properties'],
  ESTABLISHMENT: ['establishment', 'establishments'],
};

const SHORT: Record<Category, string> = {
  LANDLORD: 'LANDLORDS',
  LANDLORD_TENANTS: 'LANDLORDS & TENANTS',
  TENANTS_ONLY: 'TENANTS ONLY',
  ESTABLISHMENT: 'CHURCHES & OTHER ESTABLISHMENTS',
};

export function tableWidth(sec: ReportSection): number {
  return sec.columns.reduce((a, c) => a + c.width, 0) + MONTH_W * 12 + sec.annualCol.width;
}

export function buildReport(
  properties: Property[],
  payments: PaymentIndex,
  settings: Settings,
  streetOrder: string[],
  opts: ReportOptions,
): ReportModel {
  const { year } = settings;
  const cmp = compareProps(streetOrder);
  const scoped = properties.filter((p) => opts.street === 'ALL' || p.street === opts.street);

  const sections: ReportSection[] = [];
  const expectedRows: SummaryRow[] = [];
  const collectedRows: SummaryRow[] = [];

  for (const cat of CATEGORY_ORDER) {
    const props = scoped.filter((p) => p.category === cat).sort(cmp);
    if (props.length === 0) continue;

    const groups: ReportGroup[] = [];
    let no = 0;
    let cur: { street: string; props: Property[] } | null = null;
    const buckets: { street: string; props: Property[] }[] = [];
    for (const p of props) {
      if (!cur || cur.street !== p.street) {
        cur = { street: p.street, props: [] };
        buckets.push(cur);
      }
      cur.props.push(p);
    }

    for (const b of buckets) {
      const rows: ReportRow[] = [];
      let streetDue = 0;
      for (const p of b.props) {
        no += 1;
        const lines = dueLines(p, settings);
        streetDue += lines.reduce((a, l) => a + l.due, 0);
        for (const l of lines) {
          const cells: ReportRow['cells'] = {
            no: String(no),
            name: displayName(p) !== p.name ? NO_VALUE : p.name,
            address: addressOf(p),
            phone: opts.maskPhones === false ? (p.phone || NO_VALUE) : maskPhone(p.phone),
            due: num(l.due),
            annual: num(l.due * 12),
          };
          if (cat === 'LANDLORD_TENANTS') {
            cells.type = l.line === 'LANDLORD' ? 'Landlord' : 'Tenants';
            cells.tenants = l.line === 'LANDLORD' ? NO_VALUE : String(p.tenantCount);
          }
          if (cat === 'TENANTS_ONLY') cells.tenants = String(p.tenantCount);
          if (cat === 'ESTABLISHMENT') cells.estType = p.establishmentType || NO_VALUE;
          rows.push({
            cells,
            months: MONTHS.map((m) => {
              const amt = opts.filled ? paidAmount(payments, p.id, l.line, m.key) : 0;
              return { text: amt > 0 ? String(amt) : '☐', paid: amt > 0 };
            }),
          });
        }
      }
      const [one, many] = NOUN[cat];
      const streetName = b.street === UNSPECIFIED_STREET ? 'STREET NOT YET CONFIRMED' : b.street.toUpperCase();
      groups.push({
        street: b.street,
        label: `${streetName}  ·  ${b.props.length} ${b.props.length === 1 ? one : many}  ·  ${naira(streetDue)}/month`,
        rows,
      });
    }

    const [, many] = NOUN[cat];
    const countText = `${props.length} ${props.length === 1 ? NOUN[cat][0] : many}`;
    let heading = '';
    let note: string | undefined;
    switch (cat) {
      case 'LANDLORD':
        heading = `${SHORT[cat]} — ${year} Payment Tracker  (${naira(settings.landlordRate)}/month · no tenants · ${props.length} ${props.length === 1 ? 'landlord' : 'landlords'})`;
        break;
      case 'LANDLORD_TENANTS':
        heading = `${SHORT[cat]} — ${year} Payment Tracker  (landlord ${naira(settings.landlordRate)}/month + tenants ${naira(settings.tenantRate)}/month each · ${countText})`;
        note = `Each property has two rows: the resident landlord's own due, and the collective tenants' due (Tenants × ${naira(settings.tenantRate)}). Individual tenant names were not listed in the source register.`;
        break;
      case 'TENANTS_ONLY':
        heading = `${SHORT[cat]} — ${year} Payment Tracker  (non-resident landlords · tenants ${naira(settings.tenantRate)}/month each · ${countText})`;
        note = `One line per property (the landlord does not reside there). Amount = Tenants × ${naira(settings.tenantRate)}. Individual tenant names were not listed in the source register.`;
        break;
      case 'ESTABLISHMENT':
        heading = `${SHORT[cat]} — ${year} Payment Tracker  (agreed monthly due · default ${naira(settings.establishmentRate)}/month · ${countText})`;
        note = 'One line per establishment (church, school, shop, clinic, etc.). The monthly due is shown in the Due column.';
        break;
    }

    sections.push({ category: cat, heading, note, columns: COLUMNS[cat], annualCol: ANNUAL, groups, propertyCount: props.length });

    const monthlyExpected = props.reduce((a, p) => a + dueLines(p, settings).reduce((x, l) => x + l.due, 0), 0);
    const collectedByMonth = MONTHS.map((m) =>
      props.reduce((a, p) => a + dueLines(p, settings).reduce((x, l) => x + paidAmount(payments, p.id, l.line, m.key), 0), 0),
    );
    const label = (suffix: string) => `${SUMMARY_LABEL[cat]} — ${suffix}`;
    expectedRows.push({ label: label('Expected'), months: MONTHS.map(() => monthlyExpected), annual: monthlyExpected * 12 });
    collectedRows.push({
      label: label('Collected'),
      months: opts.filled ? collectedByMonth : MONTHS.map(() => null),
      annual: opts.filled ? collectedByMonth.reduce((a, b) => a + b, 0) : null,
    });
  }

  const sum = (rows: SummaryRow[], i: number) => rows.reduce((a, r) => a + (r.months[i] ?? 0), 0);
  expectedRows.push({
    label: 'TOTAL — Expected',
    months: MONTHS.map((_, i) => sum(expectedRows, i)),
    annual: expectedRows.reduce((a, r) => a + (r.annual ?? 0), 0),
    total: true,
  });
  collectedRows.push({
    label: 'TOTAL — Collected',
    months: MONTHS.map((_, i) => (opts.filled ? sum(collectedRows, i) : null)),
    annual: opts.filled ? collectedRows.reduce((a, r) => a + (r.annual ?? 0), 0) : null,
    total: true,
  });

  const scope = opts.street === 'ALL' ? 'All streets' : opts.street;
  const howTo = [
    'Tick (✓) the box for a name/property in the column for the month payment is received.',
    `Landlords pay ${naira(settings.landlordRate)} per month. Tenants pay ${naira(settings.tenantRate)} per month each.`,
    'Names are arranged street by street in every section. Each street starts with a shaded heading row showing the number of houses and the amount expected per month from that street.',
    'In the “Landlords & Tenants” section, each property has two lines: the resident landlord’s own due, and a combined line for that property’s tenants.',
    'In the “Tenants Only” section, the landlord does not live on the premises — the amount shown is for all tenants at that property combined (individual tenant names were not listed in the source register).',
    `In the “Churches & Other Establishments” section, each church, school, shop or other establishment pays its own agreed monthly due (default ${naira(settings.establishmentRate)}), shown in the Due column.`,
    'Use the Summary page at the end to record total ₦ collected each month against what was expected.',
  ];

  return {
    title: 'LANDLORDS & TENANTS REGISTER',
    subtitle: `Full-Year Payment Tracker — ${year}${opts.street === 'ALL' ? '' : ` · ${opts.street}`}`,
    howTo: sections.some((s) => s.category === 'ESTABLISHMENT') ? howTo : howTo.filter((h) => !h.includes('Churches & Other')),
    sections,
    expected: expectedRows,
    collected: collectedRows,
    summaryHeading: `PAYMENT SUMMARY ${year} — Expected vs Collected (₦)`,
    summaryNote:
      '"Expected" assumes every landlord, tenant and establishment pays every month at the fixed rates. ' +
      (opts.filled
        ? '"Collected" shows the payments recorded so far in the register.'
        : 'Fill in "Collected" by hand as dues come in.'),
    filled: opts.filled,
    scope,
    generatedOn: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  };
}
