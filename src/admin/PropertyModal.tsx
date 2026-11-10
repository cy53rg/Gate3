import { useState, type FormEvent } from 'react';
import { PropertyFields } from '../components/PropertyFields';
import { inputCls, labelCls, Modal } from '../components/ui';
import { naira } from '../lib/format';
import type { Property, Settings } from '../types';

interface Props {
  initial: Property;
  isNew: boolean;
  streets: string[];
  settings: Settings;
  hasPayments: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSave: (p: Property) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}

export function PropertyModal({ initial, isNew, streets, settings, hasPayments, canDelete, onClose, onSave, onDelete }: Props) {
  const [p, setP] = useState<Property>(initial);
  const [due, setDue] = useState(initial.monthlyDue ? String(initial.monthlyDue) : '');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await onSave({ ...p, monthlyDue: p.category === 'ESTABLISHMENT' && due ? Math.max(0, parseInt(due, 10) || 0) : null });
    setBusy(false);
  };

  return (
    <Modal title={isNew ? 'Add to register' : `Edit — ${initial.name}`} subtitle="Changes apply to the live register immediately." onClose={onClose}>
      <form onSubmit={submit} className="space-y-5 p-5">
        <PropertyFields
          admin
          streets={streets}
          value={{ name: p.name, houseNo: p.houseNo === '—' ? '' : p.houseNo, street: p.street, phone: p.phone === '—' ? '' : p.phone, category: p.category, tenantCount: p.tenantCount, establishmentType: p.establishmentType }}
          onChange={(v) => setP({ ...p, ...v })}
        />
        {p.category === 'ESTABLISHMENT' && (
          <div>
            <label className={labelCls} htmlFor="due">Agreed monthly due (₦)</label>
            <input id="due" type="number" min={0} className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} placeholder={`Leave empty for the default ${naira(settings.establishmentRate)}`} />
          </div>
        )}
        <div>
          <label className={labelCls} htmlFor="notes">Notes (admin only — never shown to residents)</label>
          <textarea id="notes" rows={2} className={inputCls} value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} />
        </div>
        {!isNew && hasPayments && p.category !== initial.category && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Heads-up: this entry already has payments recorded. Changing its category can leave some of them uncounted — check the month boxes afterwards.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {canDelete ? (
            confirmDel ? (
              <span className="flex items-center gap-2 text-sm">
                <strong className="text-red-700">Delete this and its payments?</strong>
                <button type="button" onClick={() => void onDelete()} className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white">Yes, delete</button>
                <button type="button" onClick={() => setConfirmDel(false)} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold">No</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDel(true)} className="rounded-lg px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50">Delete…</button>
            )
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2.5 font-semibold">Cancel</button>
            <button disabled={busy || !p.name.trim() || !p.street} className="rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white hover:bg-emerald-500 disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
