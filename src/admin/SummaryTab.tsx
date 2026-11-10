import { Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ESTATE_NAME, MONTHS, UNSPECIFIED_STREET } from '../constants';
import { propertyStats } from '../lib/dues';
import { compareProps, naira, num } from '../lib/format';
import { buildReport } from '../lib/report';
import type { AdminData } from './useAdminData';

export function SummaryTab({ data, notify }: { data: AdminData; notify: (m: string) => void }) {
  const { snap, streetOrder } = data;
  const [waStreet, setWaStreet] = useState('ALL');
  const [waStyle, setWaStyle] = useState<'TOTALS' | 'LIST'>('TOTALS');

  const model = useMemo(
    () => (snap ? buildReport(snap.properties, snap.payments, snap.settings, streetOrder, { filled: true, street: 'ALL' }) : null),
    [snap, streetOrder],
  );

  const byStreet = useMemo(() => {
    if (!snap) return [];
    const names = [...streetOrder, UNSPECIFIED_STREET];
    return names
      .map((name) => {
        const props = snap.properties.filter((p) => p.street === name);
        let annual = 0, paid = 0;
        props.forEach((p) => { const s = propertyStats(p, snap.payments, snap.settings); annual += s.annualDue; paid += s.totalPaid; });
        return { name, count: props.length, annual, paid };
      })
      .filter((s) => s.count > 0);
  }, [snap, streetOrder]);

  const wa = useMemo(() => {
    if (!snap) return '';
    const { settings } = snap;
    const lines = [`*🛡️ ${ESTATE_NAME.toUpperCase()} — ${settings.year} PAYMENT UPDATE*`, `*📍 ${waStreet === 'ALL' ? 'Whole estate' : waStreet}* · ${new Date().toLocaleDateString('en-GB')}`, ''];
    const names = waStreet === 'ALL' ? [...streetOrder, UNSPECIFIED_STREET] : [waStreet];
    let gDue = 0, gPaid = 0;
    for (const name of names) {
      const props = snap.properties.filter((p) => p.street === name).sort(compareProps(streetOrder));
      if (!props.length) continue;
      let due = 0, paid = 0;
      const rows: string[] = [];
      for (const p of props) {
        const s = propertyStats(p, snap.payments, settings);
        due += s.annualDue; paid += s.totalPaid;
        rows.push(`${s.monthsFullyPaid >= 10 ? '✅' : s.totalPaid > 0 ? '🟡' : '⚪'} ${p.houseNo !== '—' ? '#' + p.houseNo : '[no #]'} ${p.name} — ${naira(s.totalPaid)} (${s.monthsFullyPaid}/12 mo)`);
      }
      gDue += due; gPaid += paid;
      lines.push(`*🏘️ ${name === UNSPECIFIED_STREET ? 'STREET TO BE CONFIRMED' : name.toUpperCase()}* — ${naira(paid)} of ${naira(due)} (${due ? Math.round((paid / due) * 100) : 0}%)`);
      if (waStyle === 'LIST') lines.push(...rows, '');
    }
    lines.push('', `*TOTAL: ${naira(gPaid)} of ${naira(gDue)} (${gDue ? Math.round((gPaid / gDue) * 100) : 0}%)*`, '', `Check your house or update your details: ${location.origin}/`);
    return lines.join('\n');
  }, [snap, streetOrder, waStreet, waStyle]);

  if (!snap || !model) return null;
  const th = 'px-2 py-2 text-right font-bold';
  const table = (title: string, rows: typeof model.expected) => (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-800">{title}</div>
      <table className="w-full min-w-[900px] border-collapse text-xs">
        <thead><tr className="bg-slate-800 text-white"><th className="px-3 py-2 text-left" />{MONTHS.map((m) => <th key={m.key} className={th}>{m.label}</th>)}<th className={th}>Annual</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={`border-b border-slate-100 ${r.total ? 'bg-indigo-50 font-extrabold' : ''}`}>
              <td className="px-3 py-1.5 font-semibold">{r.label}</td>
              {r.months.map((v, i) => <td key={i} className="px-2 py-1.5 text-right">{v === null ? '' : num(v)}</td>)}
              <td className="px-2 py-1.5 text-right font-bold">{r.annual === null ? '' : num(r.annual)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-5">
      {table(`Expected — ${snap.settings.year} (assumes everyone pays every month)`, model.expected)}
      {table(`Collected — ${snap.settings.year} (from recorded payments)`, model.collected)}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-800">By street — who is ahead and who is behind</div>
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="bg-slate-100 text-left text-xs uppercase text-slate-600"><th className="px-3 py-2">Street</th><th className="px-3 py-2 text-right">Entries</th><th className="px-3 py-2 text-right">Expected / year</th><th className="px-3 py-2 text-right">Collected</th><th className="px-3 py-2 text-right">Balance</th><th className="w-44 px-3 py-2">Progress</th></tr></thead>
          <tbody>
            {byStreet.map((s) => {
              const pct = s.annual ? Math.round((s.paid / s.annual) * 100) : 0;
              return (
                <tr key={s.name} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{s.name === UNSPECIFIED_STREET ? 'Street not yet confirmed' : s.name}</td>
                  <td className="px-3 py-2 text-right">{s.count}</td>
                  <td className="px-3 py-2 text-right">{naira(s.annual)}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-700">{naira(s.paid)}</td>
                  <td className="px-3 py-2 text-right">{naira(s.annual - s.paid)}</td>
                  <td className="px-3 py-2"><div className="h-2.5 rounded-full bg-slate-200"><div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, pct)}%` }} /></div><div className="mt-0.5 text-[11px] text-slate-500">{pct}%</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-slate-800">WhatsApp update (copy &amp; paste into the estate group)</h3>
          <select value={waStreet} onChange={(e) => setWaStreet(e.target.value)} aria-label="Street" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
            <option value="ALL">Whole estate</option>
            {streetOrder.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={waStyle} onChange={(e) => setWaStyle(e.target.value as 'TOTALS' | 'LIST')} aria-label="Style" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
            <option value="TOTALS">Street totals only (more private)</option>
            <option value="LIST">Every house and amount</option>
          </select>
        </div>
        <textarea readOnly rows={9} value={wa} className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs" />
        <button onClick={() => { void navigator.clipboard.writeText(wa).then(() => notify('Copied — paste it into WhatsApp.'), () => notify('Could not copy — select the text and copy manually.')); }} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"><Copy className="h-4 w-4" /> Copy message</button>
      </div>
    </div>
  );
}
