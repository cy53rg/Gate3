import { CATEGORY_CHOICES, CATEGORY_LABEL, CATEGORY_ORDER, ESTABLISHMENT_TYPES, UNSPECIFIED_STREET } from '../constants';
import type { ProposedProperty } from '../types';
import { inputCls, labelCls } from './ui';

export const emptyProposed = (street = ''): ProposedProperty => ({
  name: '', houseNo: '', street, phone: '', category: 'LANDLORD', tenantCount: 0, establishmentType: null,
});

/** Shared by the resident "update / add" request form and the admin edit form. */
export function PropertyFields({
  value, onChange, streets, admin,
}: { value: ProposedProperty; onChange: (v: ProposedProperty) => void; streets: string[]; admin?: boolean }) {
  const set = (patch: Partial<ProposedProperty>) => onChange({ ...value, ...patch });
  const isEst = value.category === 'ESTABLISHMENT';
  const hasTenants = value.category === 'LANDLORD_TENANTS' || value.category === 'TENANTS_ONLY';

  const setCategory = (c: ProposedProperty['category']) =>
    set({
      category: c,
      tenantCount: c === 'LANDLORD_TENANTS' || c === 'TENANTS_ONLY' ? Math.max(1, value.tenantCount) : 0,
      establishmentType: c === 'ESTABLISHMENT' ? value.establishmentType || ESTABLISHMENT_TYPES[0] : null,
    });

  return (
    <div className="space-y-4">
      <div>
        <span className={labelCls}>{admin ? 'Category' : 'Which one describes you?'}</span>
        {admin ? (
          <select className={inputCls} value={value.category} onChange={(e) => setCategory(e.target.value as ProposedProperty['category'])}>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        ) : (
          <div className="space-y-2">
            {CATEGORY_CHOICES.map((c) => (
              <label key={c.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-base ${value.category === c.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white'}`}>
                <input type="radio" name="category" className="mt-1 h-4 w-4" checked={value.category === c.value} onChange={() => setCategory(c.value)} />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {isEst && (
        <div>
          <label className={labelCls} htmlFor="esttype">What kind of establishment?</label>
          <select id="esttype" className={inputCls} value={value.establishmentType ?? ''} onChange={(e) => set({ establishmentType: e.target.value })}>
            {ESTABLISHMENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelCls} htmlFor="pname">{isEst ? 'Name of church / establishment *' : hasTenants && value.category === 'TENANTS_ONLY' ? "Landlord's full name *" : 'Full name *'}</label>
        <input id="pname" required className={inputCls} value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder={isEst ? 'e.g. Harvester Church' : 'e.g. Mr. Adamu Mathew'} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="phouse">House number</label>
          <input id="phouse" className={inputCls} value={value.houseNo} onChange={(e) => set({ houseNo: e.target.value })} placeholder="e.g. 12 or 11A" />
        </div>
        <div>
          <label className={labelCls} htmlFor="pstreet">Street *</label>
          <select id="pstreet" required className={inputCls} value={value.street} onChange={(e) => set({ street: e.target.value })}>
            <option value="" disabled>Choose street…</option>
            {streets.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            {admin && <option value={UNSPECIFIED_STREET}>{UNSPECIFIED_STREET}</option>}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="pphone">Phone number</label>
        <input id="pphone" inputMode="tel" className={inputCls} value={value.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="08012345678" />
        <p className="mt-1 text-xs text-slate-500">11 digits. Two numbers can be separated with “ / ”.</p>
      </div>

      {hasTenants && (
        <div>
          <label className={labelCls} htmlFor="pten">How many tenants live in the house? *</label>
          <input id="pten" type="number" min={1} max={99} required className={inputCls} value={value.tenantCount || ''} onChange={(e) => set({ tenantCount: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
        </div>
      )}
    </div>
  );
}
