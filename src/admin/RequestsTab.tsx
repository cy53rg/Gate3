import { Check, Phone, X } from 'lucide-react';
import { CATEGORY_LABEL, NO_VALUE } from '../constants';
import { displayName } from '../lib/format';
import type { ChangeRequest, Property, ProposedProperty } from '../types';
import type { AdminData } from './useAdminData';

const FIELDS: { key: keyof ProposedProperty; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'houseNo', label: 'House no.' },
  { key: 'street', label: 'Street' },
  { key: 'phone', label: 'Phone' },
  { key: 'category', label: 'Category' },
  { key: 'tenantCount', label: 'Tenants' },
  { key: 'establishmentType', label: 'Establishment type' },
];

const show = (k: keyof ProposedProperty, v: unknown) => (k === 'category' ? CATEGORY_LABEL[v as Property['category']] ?? String(v) : v === null || v === '' || v === undefined ? NO_VALUE : String(v));

export function RequestsTab({ data, canEdit }: { data: AdminData; canEdit: boolean }) {
  const { snap } = data;
  if (!snap) return null;
  const pending = snap.requests.filter((r) => r.status === 'pending');
  const done = snap.requests.filter((r) => r.status !== 'pending').slice(0, 20);

  const card = (r: ChangeRequest) => {
    const current = r.propertyId ? snap.properties.find((p) => p.id === r.propertyId) : undefined;
    return (
      <div key={r.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${r.type === 'NEW' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>{r.type === 'NEW' ? 'NEW ENTRY' : 'UPDATE'}</span>
            <span className="ml-2 text-sm font-semibold">{r.type === 'UPDATE' && current ? displayName(current) : r.proposed.name}</span>
            <div className="mt-1 text-sm text-slate-600">
              From <strong>{r.submittedBy}</strong>
              {r.submitterPhone && <> · <a className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline" href={`tel:${r.submitterPhone}`}><Phone className="h-3.5 w-3.5" />{r.submitterPhone}</a></>}
              <> · {new Date(r.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</>
            </div>
            {r.reason && <div className="mt-1 text-sm italic text-slate-600">“{r.reason}”</div>}
          </div>
          {r.status === 'pending' && (
            canEdit ? (
              <div className="flex gap-2">
                <button onClick={() => void data.approve(r)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"><Check className="h-4 w-4" /> Approve</button>
                <button onClick={() => void data.reject(r)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50"><X className="h-4 w-4" /> Reject</button>
              </div>
            ) : <span className="text-xs text-slate-500">Only administrators can approve.</span>
          )}
          {r.status !== 'pending' && <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${r.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{r.status.toUpperCase()}</span>}
        </div>
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1 pr-3">Field</th>{current && <th className="py-1 pr-3">Now on register</th>}<th className="py-1">Proposed</th></tr></thead>
          <tbody>
            {FIELDS.map((f) => {
              const now = current ? show(f.key, current[f.key]) : '';
              const next = show(f.key, r.proposed[f.key]);
              const changed = !current || now !== next;
              if (!changed && f.key !== 'name') return null;
              return (
                <tr key={f.key} className="border-t border-slate-100">
                  <td className="py-1 pr-3 text-slate-500">{f.label}</td>
                  {current && <td className="py-1 pr-3 text-slate-600">{now}</td>}
                  <td className={`py-1 ${changed ? 'font-bold text-indigo-800' : ''}`}>{next}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Updates sent from the resident portal wait here. Nothing changes in the register until you approve it. Call the sender if you are unsure.</p>
      {pending.length === 0 && <p className="rounded-xl bg-white p-8 text-center text-slate-500 ring-1 ring-slate-200">No pending requests.</p>}
      {pending.map(card)}
      {done.length > 0 && (
        <details className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">Recently handled ({done.length})</summary>
          <div className="mt-3 space-y-3">{done.map(card)}</div>
        </details>
      )}
    </div>
  );
}
