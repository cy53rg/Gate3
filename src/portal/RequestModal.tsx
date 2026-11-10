import { CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { submitRequest } from '../api/publicApi';
import { emptyProposed, PropertyFields } from '../components/PropertyFields';
import { inputCls, labelCls, Modal } from '../components/ui';
import { NO_VALUE, UNSPECIFIED_STREET } from '../constants';
import type { ProposedProperty, PublicRow } from '../types';

interface Props {
  row: PublicRow | null; // null = add a missing house / establishment
  streets: string[];
  onClose: () => void;
}

export function RequestModal({ row, streets, onClose }: Props) {
  const isNew = row === null;
  const [proposed, setProposed] = useState<ProposedProperty>(
    row
      ? {
          name: /^—|unlisted|refused/i.test(row.name) ? '' : row.name,
          houseNo: row.houseNo === NO_VALUE ? '' : row.houseNo,
          street: row.street === UNSPECIFIED_STREET ? '' : row.street,
          phone: '', // the register only shows a masked number, so ask for the full one
          category: row.category,
          tenantCount: row.tenantCount,
          establishmentType: row.establishmentType,
        }
      : emptyProposed(),
  );
  const [submittedBy, setSubmittedBy] = useState('');
  const [submitterPhone, setSubmitterPhone] = useState('');
  const [reason, setReason] = useState('');
  const [trap, setTrap] = useState(''); // honeypot: real people never see or fill this
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (trap) return setDone(true); // bot: pretend it worked
    if (!/^0\d{10}$/.test(submitterPhone.replace(/\s/g, ''))) return setError('Please enter your own phone number (11 digits) so the admin can confirm it is you.');
    setBusy(true);
    try {
      await submitRequest({
        type: isNew ? 'NEW' : 'UPDATE',
        propertyId: row?.id ?? null,
        submittedBy: submittedBy.trim(),
        submitterPhone: submitterPhone.replace(/\s/g, ''),
        reason: reason.trim() || (isNew ? 'New house / establishment not on the register' : 'Correction of my details'),
        proposed: { ...proposed, name: proposed.name.trim(), houseNo: proposed.houseNo.trim(), phone: proposed.phone.trim() },
      });
      setDone(true);
    } catch {
      setError('Sorry, we could not send this right now. Please check your network and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Modal title="Thank you!" onClose={onClose}>
        <div className="space-y-4 p-6 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
          <p className="text-lg font-semibold">Your details have been sent to the estate admin.</p>
          <p className="text-base text-slate-600">They will check and approve them. The register will update after approval — you do not need to send it again.</p>
          <button onClick={onClose} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-bold text-white">Close</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={isNew ? 'Add a missing house or establishment' : 'Update my information'}
      subtitle={isNew ? 'Not on the list? Fill this in — the admin will check it before it appears.' : 'Your correction is sent to the estate admin for approval.'}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-5 p-5">
        <PropertyFields value={proposed} onChange={setProposed} streets={streets} />

        <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <legend className="px-1 text-sm font-bold text-slate-700">About you (so the admin can confirm)</legend>
          <div>
            <label className={labelCls} htmlFor="by">Your name *</label>
            <input id="by" required minLength={2} className={inputCls} value={submittedBy} onChange={(e) => setSubmittedBy(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="byphone">Your phone number *</label>
            <input id="byphone" required inputMode="tel" className={inputCls} value={submitterPhone} onChange={(e) => setSubmitterPhone(e.target.value)} placeholder="08012345678" />
          </div>
          <div>
            <label className={labelCls} htmlFor="why">Anything the admin should know? (optional)</label>
            <textarea id="why" rows={2} maxLength={400} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </fieldset>

        {/* honeypot */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
          <label>Website <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}
        <button disabled={busy || !proposed.street} className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-base font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
          {busy ? 'Sending…' : 'Send to estate admin'}
        </button>
      </form>
    </Modal>
  );
}
