import { AlertTriangle, Check, Pencil, Search } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { CATEGORY_LABEL, CATEGORY_ORDER, MONTHS, UNSPECIFIED_STREET } from '../constants';
import { dueLines, paidAmount, propertyStats } from '../lib/dues';
import { compareProps, displayName, naira, needsVerify, num } from '../lib/format';
import type { Category, Property } from '../types';
import type { AdminData } from './useAdminData';

type View = 'CATEGORY' | 'STREET';
const COLS = 4 + 1 + 12 + 2; // no, house, name, phone | line | months | paid, edit

export function RegisterTab({ data, canEdit, onEdit }: { data: AdminData; canEdit: boolean; onEdit: (p: Property) => void }) {
  const { snap, streetOrder } = data;
  const [view, setView] = useState<View>('CATEGORY');
  const [q, setQ] = useState('');
  const [street, setStreet] = useState('ALL');
  const [cat, setCat] = useState<'ALL' | Category>('ALL');
  const [issuesOnly, setIssuesOnly] = useState(false);

  const list = useMemo(() => {
    if (!snap) return [];
    const needle = q.trim().toLowerCase();
    return snap.properties
      .filter((p) => street === 'ALL' || p.street === street)
      .filter((p) => cat === 'ALL' || p.category === cat)
      .filter((p) => !issuesOnly || needsVerify(p).any)
      .filter((p) => !needle || [p.name, p.houseNo, p.street, p.phone, p.establishmentType ?? ''].some((v) => v.toLowerCase().includes(needle)))
      .sort(compareProps(streetOrder));
  }, [snap, q, street, cat, issuesOnly, streetOrder]);

  if (!snap) return null;
  const { settings, payments } = snap;

  type Block = { key: string; title: string; level: 'cat' | 'street'; props?: Property[] };
  const blocks: Block[] = [];
  const splitByStreet = (props: Property[]) => {
    const out: Property[][] = [];
    for (const p of props) {
      const last = out[out.length - 1];
      if (last && last[0].street === p.street) last.push(p);
      else out.push([p]);
    }
    return out;
  };
  if (view === 'CATEGORY') {
    for (const c of CATEGORY_ORDER) {
      const inCat = list.filter((p) => p.category === c);
      if (!inCat.length) continue;
      blocks.push({ key: c, title: `${CATEGORY_LABEL[c]} (${inCat.length})`, level: 'cat' });
      for (const g of splitByStreet(inCat)) blocks.push({ key: c + g[0].street, title: g[0].street, level: 'street', props: g });
    }
  } else {
    for (const g of splitByStreet(list)) blocks.push({ key: g[0].street, title: g[0].street, level: 'street', props: g });
  }

  const streetStats = (props: Property[]) => {
    let due = 0, paid = 0;
    props.forEach((p) => { const s = propertyStats(p, payments, settings); due += s.monthlyDue; paid += s.totalPaid; });
    return `${props.length} ${props.length === 1 ? 'entry' : 'entries'} · ${naira(due)}/month · ${naira(paid)} collected`;
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, house, phone…" aria-label="Search" className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-2 text-sm" />
        </div>
        <select value={street} onChange={(e) => setStreet(e.target.value)} aria-label="Street" className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-semibold">
          <option value="ALL">All streets</option>
          {streetOrder.map((s) => <option key={s}>{s}</option>)}
          <option value={UNSPECIFIED_STREET}>{UNSPECIFIED_STREET}</option>
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value as 'ALL' | Category)} aria-label="Category" className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-semibold">
          <option value="ALL">All categories</option>
          {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} /> Needs verifying only
        </label>
        <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-slate-300 text-sm font-bold">
          <button onClick={() => setView('CATEGORY')} aria-pressed={view === 'CATEGORY'} className={`px-3 py-2 ${view === 'CATEGORY' ? 'bg-slate-900 text-white' : 'bg-white'}`}>By category</button>
          <button onClick={() => setView('STREET')} aria-pressed={view === 'STREET'} className={`px-3 py-2 ${view === 'STREET' ? 'bg-slate-900 text-white' : 'bg-white'}`}>By street</button>
        </div>
      </div>
      <p className="mb-2 text-xs text-slate-500">Tap a month box to mark it paid (full amount) or unpaid. Names are always arranged street by street.</p>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[1150px] border-collapse text-xs">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-2 py-2 text-center">#</th>
              <th className="px-2 py-2 text-left">House</th>
              <th className="px-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-left">Phone</th>
              <th className="px-2 py-2 text-left">Line · Due</th>
              {MONTHS.map((m) => <th key={m.key} className="px-1 py-2 text-center">{m.label}</th>)}
              <th className="px-2 py-2 text-right">Paid / Year</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {blocks.length === 0 && <tr><td colSpan={COLS} className="p-8 text-center text-slate-500">Nothing matches these filters.</td></tr>}
            {blocks.map((b) => (
              <Fragment key={b.key}>
                {b.level === 'cat' ? (
                  <tr><td colSpan={COLS} className="bg-slate-700 px-3 py-2 text-sm font-extrabold uppercase tracking-wide text-white">{b.title}</td></tr>
                ) : (
                  <tr><td colSpan={COLS} className="bg-indigo-50 px-3 py-1.5 font-bold text-indigo-900">
                    {b.title === UNSPECIFIED_STREET ? 'Street not yet confirmed' : b.title} <span className="ml-2 font-semibold text-indigo-700/80">{streetStats(b.props!)}</span>
                  </td></tr>
                )}
                {b.props?.map((p, idx) => {
                  const lines = dueLines(p, settings);
                  const st = propertyStats(p, payments, settings);
                  const issue = needsVerify(p);
                  return lines.map((l, i) => (
                    <tr key={p.id + l.line} className={`border-b border-slate-200 ${i < lines.length - 1 ? 'border-b-slate-100' : ''}`}>
                      {i === 0 && (
                        <>
                          <td rowSpan={lines.length} className="px-2 py-1.5 text-center text-slate-400">{idx + 1}</td>
                          <td rowSpan={lines.length} className="whitespace-nowrap px-2 py-1.5 font-bold">{p.houseNo}</td>
                          <td rowSpan={lines.length} className="px-2 py-1.5">
                            <div className="font-semibold">{displayName(p)}</div>
                            {view === 'STREET' && <div className="text-[11px] text-slate-500">{p.category === 'ESTABLISHMENT' ? p.establishmentType : CATEGORY_LABEL[p.category]}</div>}
                            {issue.any && <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"><AlertTriangle className="h-3 w-3" />{[issue.missingHouse && 'house no.', issue.missingStreet && 'street', issue.missingPhone && 'phone', issue.missingName && 'name'].filter(Boolean).join(', ')}</span>}
                          </td>
                          <td rowSpan={lines.length} className="whitespace-nowrap px-2 py-1.5 font-mono text-[11px]">{p.phone}</td>
                        </>
                      )}
                      <td className="whitespace-nowrap px-2 py-1.5 text-slate-700">
                        {l.line === 'TENANTS' ? `Tenants ×${p.tenantCount}` : p.category === 'ESTABLISHMENT' ? l.label : 'Landlord'} · <strong>{num(l.due)}</strong>
                      </td>
                      {MONTHS.map((m) => {
                        const amt = paidAmount(payments, p.id, l.line, m.key);
                        return (
                          <td key={m.key} className="p-0 text-center">
                            <button
                              onClick={() => void data.togglePayment(p, l.line, m.key)}
                              aria-label={`${displayName(p)} ${l.label} ${m.label}: ${amt ? 'paid' : 'unpaid'}. Click to change.`}
                              aria-pressed={amt > 0}
                              className={`h-9 w-full min-w-9 text-[11px] font-bold ${amt ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'text-slate-300 hover:bg-slate-100'}`}
                            >
                              {amt ? <span className="inline-flex flex-col items-center leading-none"><Check className="h-3 w-3" /><span className="text-[9px] font-semibold">{amt >= 1000 ? `${amt / 1000}k` : amt}</span></span> : '☐'}
                            </button>
                          </td>
                        );
                      })}
                      {i === 0 && (
                        <>
                          <td rowSpan={lines.length} className="whitespace-nowrap px-2 py-1.5 text-right">
                            <span className={st.totalPaid ? 'font-bold text-emerald-700' : 'text-slate-500'}>{num(st.totalPaid)}</span>
                            <span className="text-slate-400"> / {num(st.annualDue)}</span>
                          </td>
                          <td rowSpan={lines.length} className="px-1 text-center">
                            {canEdit && <button onClick={() => onEdit(p)} aria-label={`Edit ${displayName(p)}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Pencil className="h-4 w-4" /></button>}
                          </td>
                        </>
                      )}
                    </tr>
                  ));
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
