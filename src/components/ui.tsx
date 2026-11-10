import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

export const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500';
export const labelCls = 'mb-1 block text-sm font-bold text-slate-700';

export function Modal({
  title, subtitle, onClose, children, wide, footer,
}: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? 'sm:max-w-6xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-start justify-between gap-3 bg-slate-900 px-5 py-4 text-white">
          <div>
            <h3 className="text-lg font-bold">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-slate-300">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-2xl print:hidden" role="status">
      {message}
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900 print:hidden sm:text-sm">
      DEMO MODE — data is stored only in this browser and is not shared or secure. Connect Supabase (see README) to go live.
    </div>
  );
}
