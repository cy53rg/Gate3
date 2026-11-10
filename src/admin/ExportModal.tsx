import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Modal } from '../components/ui';
import { PrintPortal, ReportSheet } from '../components/ReportSheet';
import { UNSPECIFIED_STREET } from '../constants';
import { buildCsv } from '../lib/csv';
import { download } from '../lib/format';
import { buildReport } from '../lib/report';
import type { AdminData } from './useAdminData';

export function ExportModal({ data, onClose }: { data: AdminData; onClose: () => void }) {
  const { snap, streetOrder } = data;
  const [filled, setFilled] = useState(false);
  const [street, setStreet] = useState('ALL');
  const [busy, setBusy] = useState(false);

  const model = useMemo(
    () => buildReport(snap!.properties, snap!.payments, snap!.settings, streetOrder, { filled, street }),
    [snap, streetOrder, filled, street],
  );
  if (!snap) return null;

  const base = `Estate_Register_${snap.settings.year}_${filled ? 'with_payments' : 'blank_sheet'}${street === 'ALL' ? '' : '_' + street.replace(/[^\w]+/g, '_')}`;
  const count = model.sections.reduce((a, s) => a + s.propertyCount, 0);

  const toWord = async () => {
    setBusy(true);
    try {
      const { buildDocx } = await import('../lib/docxExport'); // loaded only when needed
      download(`${base}.docx`, await buildDocx(model));
    } finally {
      setBusy(false);
    }
  };

  const optCls = (on: boolean) => `flex-1 cursor-pointer rounded-xl border p-3 text-sm ${on ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white'}`;

  return (
    <Modal
      wide
      title="Download / print the register"
      subtitle="Same layout as the original Word tracker — Landlords, Landlords & Tenants, Tenants Only, Establishments, Summary — with every section arranged street by street."
      onClose={onClose}
    >
      <div className="space-y-3 border-b border-slate-200 bg-slate-50 p-4 print:hidden">
        <div className="flex flex-wrap gap-3">
          <label className={optCls(!filled)}>
            <input type="radio" name="f" className="mr-2" checked={!filled} onChange={() => setFilled(false)} />
            <strong>Blank collection sheet</strong> — every box empty, to tick by hand
          </label>
          <label className={optCls(filled)}>
            <input type="radio" name="f" className="mr-2" checked={filled} onChange={() => setFilled(true)} />
            <strong>Current status</strong> — shows the payments recorded so far
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-bold text-slate-700">
            Street:{' '}
            <select value={street} onChange={(e) => setStreet(e.target.value)} className="ml-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-semibold">
              <option value="ALL">All streets</option>
              {streetOrder.map((s) => <option key={s}>{s}</option>)}
              <option value={UNSPECIFIED_STREET}>{UNSPECIFIED_STREET}</option>
            </select>
          </label>
          <span className="text-sm text-slate-600">{count} entries in {model.sections.length} sections</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={() => void toWord()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-60"><FileText className="h-4 w-4" />{busy ? 'Preparing…' : 'Download Word (.docx)'}</button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-amber-300"><Printer className="h-4 w-4" />Print / Save as PDF</button>
            <button onClick={() => download(`${base}.csv`, buildCsv(snap.properties, snap.payments, snap.settings, streetOrder, street))} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"><FileSpreadsheet className="h-4 w-4" />Excel (.csv)</button>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><Download className="h-3.5 w-3.5" /> For PDF choose “Save as PDF” in the print window, landscape, margins “Default”. Full phone numbers appear on these forms — keep them for admins only.</p>
      </div>
      <div className="preview bg-slate-200 p-4">
        <div className="mx-auto max-w-[1200px] bg-white p-4 shadow"><ReportSheet model={model} /></div>
      </div>
      <PrintPortal model={model} />
    </Modal>
  );
}
