import { Download, ExternalLink, KeyRound, LogOut, Plus, Shield } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import * as api from '../api/adminApi';
import { DemoBanner, inputCls, labelCls, Toast } from '../components/ui';
import { ESTATE_NAME } from '../constants';
import { propertyStats } from '../lib/dues';
import { naira, needsVerify } from '../lib/format';
import type { AdminUser, Property } from '../types';
import { ExportModal } from './ExportModal';
import { PropertyModal } from './PropertyModal';
import { RegisterTab } from './RegisterTab';
import { RequestsTab } from './RequestsTab';
import { SettingsTab } from './SettingsTab';
import { SummaryTab } from './SummaryTab';
import { blankProperty, useAdminData } from './useAdminData';

type Tab = 'REGISTER' | 'SUMMARY' | 'REQUESTS' | 'SETTINGS';

export function AdminApp() {
  const [user, setUser] = useState<AdminUser | null | undefined>(undefined); // undefined = still checking
  useEffect(() => {
    api.getSession().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <p className="p-10 text-center text-slate-500">Checking sign-in…</p>;
  if (!user) return <Login onDone={setUser} />;
  return <Dashboard user={user} onSignOut={async () => { await api.signOut(); setUser(null); }} />;
}

function Login({ onDone }: { onDone: (u: AdminUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(await api.signIn(email.trim(), password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-h-screen">
      {api.isDemo && <DemoBanner />}
      <div className="mx-auto mt-16 w-full max-w-sm px-4">
        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-emerald-400"><KeyRound className="h-6 w-6" /></div>
            <div>
              <h1 className="text-lg font-bold">Admin sign-in</h1>
              <p className="text-sm text-slate-500">{ESTATE_NAME}</p>
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="em">Email</label>
            <input id="em" type="email" autoComplete="username" required={!api.isDemo} className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pw">Password</label>
            <input id="pw" type="password" autoComplete="current-password" required className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {api.isDemo && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Demo mode: any email, password <strong>demo1234</strong>.</p>}
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button>
          <a href="/" className="block text-center text-sm text-indigo-700 hover:underline">← Back to the resident portal</a>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ user, onSignOut }: { user: AdminUser; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>('REGISTER');
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ p: Property; isNew: boolean } | null>(null);
  const [exporting, setExporting] = useState(false);

  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };
  const data = useAdminData(notify);
  const { snap } = data;
  const canEdit = user.role === 'admin';

  const kpi = useMemo(() => {
    if (!snap) return null;
    let monthly = 0, paid = 0, issues = 0;
    for (const p of snap.properties) {
      const s = propertyStats(p, snap.payments, snap.settings);
      monthly += s.monthlyDue;
      paid += s.totalPaid;
      if (needsVerify(p).any) issues += 1;
    }
    return { monthly, annual: monthly * 12, paid, issues, pending: snap.requests.filter((r) => r.status === 'pending').length };
  }, [snap]);

  const tabs: { key: Tab; label: string; badge?: number; hidden?: boolean }[] = [
    { key: 'REGISTER', label: 'Register' },
    { key: 'SUMMARY', label: 'Summary' },
    { key: 'REQUESTS', label: 'Requests', badge: kpi?.pending },
    { key: 'SETTINGS', label: 'Settings', hidden: !canEdit },
  ];

  return (
    <div className="min-h-screen">
      {api.isDemo && <DemoBanner />}
      <header className="sticky top-0 z-30 bg-slate-900 text-white print:hidden">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-300"><Shield className="h-5 w-5" /></div>
            <div>
              <h1 className="text-base font-bold leading-tight sm:text-lg">{ESTATE_NAME} <span className="ml-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-bold text-amber-300">ADMIN</span></h1>
              <p className="text-xs text-slate-400">{user.email} · {user.role === 'admin' ? 'Administrator' : 'Collector (payments only)'}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setExporting(true)} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-extrabold text-slate-950 hover:bg-amber-300" disabled={!snap}>
              <Download className="h-4 w-4" /> Download / Print forms
            </button>
            {canEdit && (
              <button onClick={() => setEditing({ p: blankProperty(), isNew: true })} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-bold hover:bg-emerald-500" disabled={!snap}>
                <Plus className="h-4 w-4" /> Add
              </button>
            )}
            <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold hover:bg-slate-700"><ExternalLink className="h-4 w-4" /> Resident view</a>
            <button onClick={onSignOut} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold hover:bg-slate-700"><LogOut className="h-4 w-4" /> Sign out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 pb-16 pt-4 print:hidden">
        {data.error && (
          <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700" role="alert">
            {data.error} <button className="ml-2 underline" onClick={() => void data.reload()}>Retry</button>
          </div>
        )}
        {!snap && !data.error && <p className="py-16 text-center text-slate-500">Loading register…</p>}

        {snap && kpi && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kpi label="Entries" value={String(snap.properties.length)} />
              <Kpi label="Expected / month" value={naira(kpi.monthly)} />
              <Kpi label={`Collected ${snap.settings.year}`} value={naira(kpi.paid)} sub={`${kpi.annual ? ((kpi.paid / kpi.annual) * 100).toFixed(1) : 0}% of ${naira(kpi.annual)}`} tone="emerald" />
              <Kpi label="Pending requests" value={String(kpi.pending)} tone={kpi.pending ? 'amber' : undefined} onClick={() => setTab('REQUESTS')} />
              <Kpi label="Need verifying" value={String(kpi.issues)} sub="missing house, street, phone or name" onClick={() => { setTab('REGISTER'); }} />
            </div>

            <nav className="mb-4 flex gap-1 border-b border-slate-300" aria-label="Sections">
              {tabs.filter((t) => !t.hidden).map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)} aria-current={tab === t.key} className={`-mb-px rounded-t-lg border border-b-0 px-4 py-2.5 text-sm font-bold ${tab === t.key ? 'border-slate-300 bg-white text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  {t.label}
                  {!!t.badge && <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs text-slate-900">{t.badge}</span>}
                </button>
              ))}
            </nav>

            {tab === 'REGISTER' && <RegisterTab data={data} canEdit={canEdit} onEdit={(p) => setEditing({ p, isNew: false })} />}
            {tab === 'SUMMARY' && <SummaryTab data={data} notify={notify} />}
            {tab === 'REQUESTS' && <RequestsTab data={data} canEdit={canEdit} />}
            {tab === 'SETTINGS' && canEdit && <SettingsTab data={data} notify={notify} />}
          </>
        )}
      </main>

      {editing && snap && (
        <PropertyModal
          initial={editing.p}
          isNew={editing.isNew}
          streets={data.streetOrder}
          settings={snap.settings}
          hasPayments={Object.keys(snap.payments).some((k) => k.startsWith(editing.p.id + '|'))}
          canDelete={canEdit && !editing.isNew}
          onClose={() => setEditing(null)}
          onSave={async (p) => { if (await data.saveProperty(p, editing.isNew)) setEditing(null); }}
          onDelete={async () => { if (await data.removeProperty(editing.p.id)) setEditing(null); }}
        />
      )}
      {exporting && snap && <ExportModal data={data} onClose={() => setExporting(false)} />}
      <Toast message={toast} />
    </div>
  );
}

function Kpi({ label, value, sub, tone, onClick }: { label: string; value: string; sub?: string; tone?: 'emerald' | 'amber'; onClick?: () => void }) {
  const ring = tone === 'emerald' ? 'ring-emerald-300' : tone === 'amber' ? 'ring-amber-300 bg-amber-50' : 'ring-slate-200';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`rounded-xl bg-white p-3.5 text-left shadow-sm ring-1 ${ring} ${onClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold sm:text-2xl ${tone === 'emerald' ? 'text-emerald-700' : ''}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </Tag>
  );
}
