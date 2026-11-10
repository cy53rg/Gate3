import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MONTHS } from '../constants';
import { MONTH_COL_WIDTH, tableWidth } from '../lib/report';
import type { ReportModel, ReportSection, SummaryRow } from '../lib/report';
import { num } from '../lib/format';

function SectionTable({ sec }: { sec: ReportSection }) {
  const total = tableWidth(sec);
  const pct = (w: number) => `${((w / total) * 100).toFixed(3)}%`;
  const colSpan = sec.columns.length + 13;
  return (
    <table>
      <colgroup>
        {sec.columns.map((c) => <col key={c.key} style={{ width: pct(c.width) }} />)}
        {MONTHS.map((m) => <col key={m.key} style={{ width: pct(MONTH_COL_WIDTH) }} />)}
        <col style={{ width: pct(sec.annualCol.width) }} />
      </colgroup>
      <thead>
        <tr>
          {sec.columns.map((c) => <th key={c.key}>{c.header}</th>)}
          {MONTHS.map((m) => <th key={m.key}>{m.label}</th>)}
          <th>{sec.annualCol.header}</th>
        </tr>
      </thead>
      <tbody>
        {sec.groups.map((g) => (
          <GroupRows key={g.street} sec={sec} g={g} colSpan={colSpan} />
        ))}
      </tbody>
    </table>
  );
}

function GroupRows({ sec, g, colSpan }: { sec: ReportSection; g: ReportSection['groups'][number]; colSpan: number }) {
  return (
    <>
      <tr className="grp"><td colSpan={colSpan}>{g.label}</td></tr>
      {g.rows.map((r, i) => (
        <tr key={i}>
          {sec.columns.map((c) => <td key={c.key} className={c.align[0]}>{r.cells[c.key] ?? ''}</td>)}
          {r.months.map((m, j) => <td key={j} className={`c ${m.paid ? 'paid' : ''}`}>{m.text}</td>)}
          <td className="r">{r.cells.annual}</td>
        </tr>
      ))}
    </>
  );
}

function SummaryTable({ rows }: { rows: SummaryRow[] }) {
  return (
    <table>
      <colgroup>
        <col style={{ width: '22%' }} />
        {MONTHS.map((m) => <col key={m.key} />)}
        <col style={{ width: '9%' }} />
      </colgroup>
      <thead><tr><th></th>{MONTHS.map((m) => <th key={m.key}>{m.label}</th>)}<th>Annual</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className={r.total ? 'tot' : ''}>
            <td className="l" style={{ fontWeight: 700 }}>{r.label}</td>
            {r.months.map((v, i) => <td key={i} className="r">{v === null ? '' : num(v)}</td>)}
            <td className="r" style={{ fontWeight: 700 }}>{r.annual === null ? '' : num(r.annual)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The on-screen / printed version of the register - identical structure to the Word file. */
export function ReportSheet({ model }: { model: ReportModel }) {
  return (
    <div className="rs">
      <div className="sec" style={{ breakBefore: 'auto' }}>
        <div className="cover-title">{model.title}</div>
        <div className="cover-sub">{model.subtitle}</div>
        <div style={{ fontWeight: 700, fontSize: '9pt', marginBottom: '2mm' }}>How to use this tracker:</div>
        <ul className="howto" style={{ listStyle: 'disc' }}>
          {model.howTo.map((h) => <li key={h}>{h}</li>)}
        </ul>
        <div className="meta">
          Scope: {model.scope} · Generated: {model.generatedOn} · {model.filled ? 'Shows payments recorded in the register' : 'Blank collection sheet'}
        </div>
      </div>
      {model.sections.map((sec) => (
        <div className="sec" key={sec.category}>
          <h2>{sec.heading}</h2>
          {sec.note && <p className="note">{sec.note}</p>}
          <SectionTable sec={sec} />
        </div>
      ))}
      <div className="sec">
        <h2>{model.summaryHeading}</h2>
        <div className="sumlabel">Expected (fixed, assumes full payment)</div>
        <SummaryTable rows={model.expected} />
        <div className="sumlabel">{model.filled ? 'Actual Collected (from recorded payments)' : 'Actual Collected (fill in monthly)'}</div>
        <SummaryTable rows={model.collected} />
        <p className="note" style={{ marginTop: '4mm' }}>{model.summaryNote}</p>
      </div>
    </div>
  );
}

/** Renders the same sheet into #print-root, which is the only thing visible when the browser prints. */
export function PrintPortal({ model }: { model: ReportModel }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let el = document.getElementById('print-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'print-root';
      document.body.appendChild(el);
    }
    setHost(el);
  }, []);
  return host ? createPortal(<ReportSheet model={model} />, host) : null;
}
