import { AlertTriangle, MapPin, Pencil, Plus, Search, Shield } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchPublicSnapshot, isDemo } from '../api/publicApi';
import { DemoBanner } from '../components/ui';
import { ESTATE_NAME, MONTHS, NO_VALUE, UNSPECIFIED_STREET } from '../constants';
import { compareProps, displayName, naira } from '../lib/format';
import type { PublicRow, PublicSnapshot } from '../types';
import { RequestModal } from './RequestModal';

function describe(r: PublicRow): string {
  switch (r.category) {
    case 'LANDLORD': return 'Landlord';
    case 'LANDLORD_TENANTS': return `Landlord + ${r.tenantCount} tenant${r.tenantCount === 1 ? '' : 's'}`;
    case 'TENANTS_ONLY': return `${r.tenantCount} tenant${r.tenantCount === 1 ? '' : 's'} (landlord lives elsewhere)`;
    case 'ESTABLISHMENT': return r.establishmentType || 'Establishment';
  }
}

function incomplete(r: PublicRow): boolean {
  return !r.phoneOk || r.houseNo === NO_VALUE || r.houseNo.includes('*') || r.street === UNSPECIFIED_STREET || /^—|unlisted|refused/i.test(r.name);
}

export function PortalApp() {
  const [snap, setSnap] = useState<PublicSnapshot | null>(null);
  const [error, setError] = useState('');
  const [street, setStreet] = useState('ALL');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<{ row: PublicRow | null } | null>(null);

  useEffect(() => {
    fetchPublicSnapshot().then(setSnap).catch(() => setError('Could not load the register. Please check your network and refresh.'));
  }, []);

  const groups = useMemo(() => {
    if (!snap) return [];
    const q = query.trim().toLowerCase();
    const list = snap.rows
      .filter((r) => street === 'ALL' || r.street === street)
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.houseNo.toLowerCase().includes(q) || r.street.toLowerCase().includes(q))
      .sort(compareProps(snap.streets));
    const out: { street: string; rows: PublicRow[] }[] = [];
    for (const r of list) {
      const last = out[out.length - 1];
      if (last && last.street === r.street) last.rows.push(r);
      else out.push({ street: r.street, rows: [r] });
    }
    return out;
  }, [snap, street, query]);

  const allStreets = snap ? [...snap.streets, ...(snap.rows.some((r) => r.street === UNSPECIFIED_STREET) ? [UNSPECIFIED_STREET] : [])] : [];
  const countFor = (s: string) => snap?.rows.filter((r) => r.street === s).length ?? 0;
  const s = snap?.settings;

  return (
    <div className="min-h-screen text-slate-900">
      {isDemo && <DemoBanner />}
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-300">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight sm:text-xl">{ESTATE_NAME}</h1>
            {s && (
              <p className="text-sm text-slate-300">
                {s.year} dues · Landlords {naira(s.landlordRate)}/month · Tenants {naira(s.tenantRate)}/month each
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-5">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-extrabold sm:text-2xl">Find your house</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-base text-slate-700">
            <li>Tap your <strong>street</strong> below.</li>
            <li>Find your name or house number.</li>
            <li>If something is wrong, tap <strong>“Update my info”</strong>. If you are not on the list, tap <strong>“Add my house”</strong>.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => setModal({ row: null })} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-bold text-white hover:bg-emerald-500">
              <Plus className="h-5 w-5" /> Add my house / church / business
            </button>
          </div>

          <div className="mt-5 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-500">
            <MapPin className="h-4 w-4 text-indigo-600" /> Your street
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill active={street === 'ALL'} onClick={() => setStreet('ALL')}>All streets ({snap?.rows.length ?? 0})</Pill>
            {allStreets.map((st) => (
              <Pill key={st} active={street === st} onClick={() => setStreet(st)}>
                {st === UNSPECIFIED_STREET ? 'Street not yet confirmed' : st} ({countFor(st)})
              </Pill>
            ))}
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or house number…"
              aria-label="Search by name or house number"
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </section>

        {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-base font-semibold text-red-700" role="alert">{error}</p>}
        {!snap && !error && <p className="mt-8 text-center text-slate-500">Loading register…</p>}

        {groups.map((g) => (
          <section key={g.street} className="mt-6">
            <h3 className="mb-2 flex items-center justify-between px-1 text-lg font-extrabold">
              <span>{g.street === UNSPECIFIED_STREET ? 'Street not yet confirmed' : g.street}</span>
              <span className="text-sm font-semibold text-slate-500">{g.rows.length} {g.rows.length === 1 ? 'entry' : 'entries'}</span>
            </h3>
            <ul className="space-y-2">
              {g.rows.map((r) => (
                <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-bold">
                        <span className="mr-2 inline-block min-w-8 rounded-md bg-slate-100 px-2 py-0.5 text-center text-sm text-slate-700">
                          {r.houseNo === NO_VALUE ? 'No #' : `#${r.houseNo}`}
                        </span>
                        {displayName(r)}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">{describe(r)} · {r.phoneMasked}</div>
                      {incomplete(r) && (
                        <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
                          <AlertTriangle className="h-3.5 w-3.5" /> Some details are missing — please help
                        </div>
                      )}
                    </div>
                    <button onClick={() => setModal({ row: r })} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50 px-3.5 py-2.5 text-sm font-bold text-indigo-800 hover:bg-indigo-100">
                      <Pencil className="h-4 w-4" /> Update my info
                    </button>
                  </div>
                  {s?.showPaymentsPublicly && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex gap-1" aria-hidden="true">
                        {MONTHS.map((m) => (
                          <span key={m.key} title={`${m.label}: ${r.paidMonths.includes(m.key) ? 'paid' : 'not yet paid'}`} className={`h-3 w-3 rounded-sm sm:h-3.5 sm:w-3.5 ${r.paidMonths.includes(m.key) ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-slate-600">{r.paidMonths.length} of 12 months paid in {s.year}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {snap && groups.length === 0 && (
          <p className="mt-8 rounded-xl bg-white p-6 text-center text-base text-slate-600 ring-1 ring-slate-200">
            No match found. Try another street or spelling — or tap “Add my house” if you are not on the list.
          </p>
        )}

        <p className="mt-10 text-center text-xs text-slate-500">
          Phone numbers are partly hidden to protect your privacy. Changes you send are checked by the estate admin before they appear.
        </p>
      </main>

      {modal && snap && <RequestModal row={modal.row} streets={snap.streets} onClose={() => setModal(null)} />}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border px-4 py-2.5 text-base font-bold transition-colors ${active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400 hover:bg-indigo-50'}`}
    >
      {children}
    </button>
  );
}
