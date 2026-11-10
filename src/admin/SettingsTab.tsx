import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { isDemo, resetDemo } from '../api/adminApi';
import { inputCls, labelCls } from '../components/ui';
import { naira } from '../lib/format';
import type { Settings, Street } from '../types';
import type { AdminData } from './useAdminData';

export function SettingsTab({ data, notify }: { data: AdminData; notify: (m: string) => void }) {
  const { snap } = data;
  const [s, setS] = useState<Settings | null>(snap?.settings ?? null);
  const [streets, setStreets] = useState<Street[]>(snap?.streets ?? []);
  const [newStreet, setNewStreet] = useState('');
  if (!snap || !s) return null;

  const used = (name: string) => snap.properties.filter((p) => p.street === name).length;
  const move = (i: number, d: -1 | 1) => {
    const a = [...streets];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setStreets(a.map((x, k) => ({ ...x, sortOrder: k + 1 })));
  };
  const add = () => {
    const name = newStreet.trim();
    if (!name || streets.some((x) => x.name.toLowerCase() === name.toLowerCase())) return notify('Enter a new street name.');
    setStreets([...streets, { name, sortOrder: streets.length + 1 }]);
    setNewStreet('');
  };
  const num = (v: string) => Math.max(0, parseInt(v, 10) || 0);
  const saveRates = (e: FormEvent) => { e.preventDefault(); void data.saveSettings(s); };
  const streetsChanged = JSON.stringify(streets) !== JSON.stringify(snap.streets);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={saveRates} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="text-base font-bold">Monthly rates — {s.year}</h3>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={labelCls} htmlFor="lr">Landlord</label><input id="lr" type="number" min={0} className={inputCls} value={s.landlordRate} onChange={(e) => setS({ ...s, landlordRate: num(e.target.value) })} /></div>
          <div><label className={labelCls} htmlFor="tr">Per tenant</label><input id="tr" type="number" min={0} className={inputCls} value={s.tenantRate} onChange={(e) => setS({ ...s, tenantRate: num(e.target.value) })} /></div>
          <div><label className={labelCls} htmlFor="er">Establishment (default)</label><input id="er" type="number" min={0} className={inputCls} value={s.establishmentRate} onChange={(e) => setS({ ...s, establishmentRate: num(e.target.value) })} /></div>
        </div>
        <p className="text-xs text-slate-500">Currently {naira(s.landlordRate)} / {naira(s.tenantRate)} / {naira(s.establishmentRate)}. Changing a rate changes the “Expected” figures for the whole year. Payments already ticked keep the amount they were recorded at. A single establishment can have its own rate (edit it in the Register).</p>
        <label className="flex items-start gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="mt-1" checked={s.showPaymentsPublicly} onChange={(e) => setS({ ...s, showPaymentsPublicly: e.target.checked })} />
          <span>Let residents see the paid / not-paid months on the public portal<br /><span className="font-normal text-slate-500">Untick to show only the directory (name, house, street) — no payment information.</span></span>
        </label>
        <button className="rounded-xl bg-slate-900 px-5 py-2.5 font-bold text-white hover:bg-slate-800">Save settings</button>
      </form>

      <div className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="text-base font-bold">Streets (this order is used everywhere, including the printed forms)</h3>
        <ol className="space-y-1.5">
          {streets.map((st, i) => (
            <li key={st.name} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <span className="w-5 text-slate-400">{i + 1}</span>
              <span className="flex-1 font-semibold">{st.name}</span>
              <span className="text-xs text-slate-500">{used(st.name)} entries</span>
              <button type="button" aria-label={`Move ${st.name} up`} onClick={() => move(i, -1)} className="rounded p-1 hover:bg-slate-100"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" aria-label={`Move ${st.name} down`} onClick={() => move(i, 1)} className="rounded p-1 hover:bg-slate-100"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" aria-label={`Remove ${st.name}`} disabled={used(st.name) > 0} title={used(st.name) ? 'Move or delete its entries first' : 'Remove street'} onClick={() => setStreets(streets.filter((x) => x.name !== st.name).map((x, k) => ({ ...x, sortOrder: k + 1 })))} className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ol>
        <div className="flex gap-2">
          <input value={newStreet} onChange={(e) => setNewStreet(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder="New street name" aria-label="New street name" className={inputCls} />
          <button type="button" onClick={add} className="rounded-xl border border-slate-300 px-4 font-bold hover:bg-slate-50">Add</button>
        </div>
        <button disabled={!streetsChanged} onClick={() => void data.saveStreets(streets)} className="rounded-xl bg-slate-900 px-5 py-2.5 font-bold text-white hover:bg-slate-800 disabled:opacity-40">Save streets</button>
      </div>

      {isDemo && (
        <div className="rounded-xl bg-amber-50 p-5 ring-1 ring-amber-200 lg:col-span-2">
          <h3 className="text-base font-bold text-amber-900">Demo data</h3>
          <p className="text-sm text-amber-900">Reset everything in this browser back to the original 53 entries.</p>
          <button onClick={() => { if (confirm('Reset all demo data in this browser?')) { resetDemo(); location.reload(); } }} className="mt-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white">Reset demo data</button>
        </div>
      )}
    </div>
  );
}
