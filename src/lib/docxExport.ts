import {
  AlignmentType, BorderStyle, Document, Footer, LevelFormat, Packer, PageNumber, PageOrientation,
  Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType,
} from 'docx';
import { ESTATE_NAME, MONTHS } from '../constants';
import { MONTH_COL_WIDTH, tableWidth } from './report';
import type { ColumnDef, ReportModel, ReportSection, SummaryRow } from './report';
import { num } from './format';

const BLUE = '2E75B6';
const NAVY = '1F4E78';
const PALE = 'D9E1F2';
const GREY = 'B7B7B7';
const FONT = 'Arial';
const SZ = 15; // 7.5 pt, same as the original tracker

const border = { style: BorderStyle.SINGLE, size: 2, color: GREY };
const borders = { top: border, bottom: border, left: border, right: border };
const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT } as const;

interface CellOpts {
  width: number;
  align?: keyof typeof ALIGN;
  fill?: string;
  bold?: boolean;
  color?: string;
  span?: number;
  size?: number;
}

function cell(text: string, o: CellOpts) {
  return new TableCell({
    width: { size: o.width, type: WidthType.DXA },
    columnSpan: o.span,
    borders,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 30, bottom: 30, left: 60, right: 60 },
    shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
    children: [
      new Paragraph({
        alignment: ALIGN[o.align ?? 'left'],
        children: [new TextRun({ text, font: FONT, size: o.size ?? SZ, bold: o.bold, color: o.color })],
      }),
    ],
  });
}

function sectionTable(sec: ReportSection): Table {
  const cols: ColumnDef[] = sec.columns;
  const totalCols = cols.length + 12 + 1;
  const widths = [...cols.map((c) => c.width), ...MONTHS.map(() => MONTH_COL_WIDTH), sec.annualCol.width];

  const header = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      ...cols.map((c) => cell(c.header, { width: c.width, align: 'center', fill: BLUE, bold: true, color: 'FFFFFF' })),
      ...MONTHS.map((m) => cell(m.label, { width: MONTH_COL_WIDTH, align: 'center', fill: BLUE, bold: true, color: 'FFFFFF' })),
      cell(sec.annualCol.header, { width: sec.annualCol.width, align: 'center', fill: BLUE, bold: true, color: 'FFFFFF' }),
    ],
  });

  const rows: TableRow[] = [header];
  for (const g of sec.groups) {
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [cell(g.label, { width: widths.reduce((a, b) => a + b, 0), span: totalCols, fill: PALE, bold: true, color: NAVY, size: 16 })],
      }),
    );
    for (const r of g.rows) {
      rows.push(
        new TableRow({
          cantSplit: true,
          children: [
            ...cols.map((c) => cell(r.cells[c.key] ?? '', { width: c.width, align: c.align })),
            ...r.months.map((m) => cell(m.text, { width: MONTH_COL_WIDTH, align: 'center', bold: m.paid })),
            cell(r.cells.annual ?? '', { width: sec.annualCol.width, align: 'right' }),
          ],
        }),
      );
    }
  }

  return new Table({
    width: { size: tableWidth(sec), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows,
  });
}

function summaryTable(rows: SummaryRow[], filled: boolean): Table {
  const L = 3400;
  const M = 900;
  const A = 1400;
  const head = new TableRow({
    tableHeader: true,
    children: [
      cell('', { width: L, fill: BLUE }),
      ...MONTHS.map((m) => cell(m.label, { width: M, align: 'center', fill: BLUE, bold: true, color: 'FFFFFF' })),
      cell('Annual', { width: A, align: 'center', fill: BLUE, bold: true, color: 'FFFFFF' }),
    ],
  });
  const body = rows.map(
    (r) =>
      new TableRow({
        cantSplit: true,
        children: [
          cell(r.label, { width: L, bold: true, fill: r.total ? PALE : undefined, color: r.total ? NAVY : undefined }),
          ...r.months.map((v) => cell(v === null ? '' : num(v), { width: M, align: 'right', fill: r.total ? PALE : undefined, bold: r.total })),
          cell(r.annual === null ? '' : num(r.annual), { width: A, align: 'right', bold: true, fill: r.total ? PALE : undefined }),
        ],
      }),
  );
  void filled;
  return new Table({
    width: { size: L + 12 * M + A, type: WidthType.DXA },
    columnWidths: [L, ...MONTHS.map(() => M), A],
    layout: TableLayoutType.FIXED,
    rows: [head, ...body],
  });
}

const p = (text: string, o: { size?: number; bold?: boolean; color?: string; align?: keyof typeof ALIGN; before?: number; after?: number; pageBreak?: boolean } = {}) =>
  new Paragraph({
    alignment: ALIGN[o.align ?? 'left'],
    pageBreakBefore: o.pageBreak,
    spacing: { before: o.before ?? 0, after: o.after ?? 80 },
    children: [new TextRun({ text, font: FONT, size: o.size ?? 18, bold: o.bold, color: o.color })],
  });

export async function buildDocx(model: ReportModel): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];

  // Cover + how to use (page 1)
  children.push(p(model.title, { size: 36, bold: true, color: NAVY, align: 'center', before: 200, after: 60 }));
  children.push(p(model.subtitle, { size: 28, bold: true, color: BLUE, align: 'center', after: 240 }));
  children.push(p('How to use this tracker:', { bold: true, size: 18, after: 100 }));
  for (const line of model.howTo) {
    children.push(
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { after: 60 },
        children: [new TextRun({ text: line, font: FONT, size: 16 })],
      }),
    );
  }
  children.push(p(`Scope: ${model.scope}  ·  Generated: ${model.generatedOn}  ·  ${model.filled ? 'Shows payments recorded in the register' : 'Blank collection sheet'}`, { size: 14, color: '595959', before: 200 }));

  // Each section on its own page, street by street
  for (const sec of model.sections) {
    children.push(p(sec.heading, { size: 24, bold: true, color: NAVY, pageBreak: true, after: 60 }));
    if (sec.note) children.push(p(sec.note, { size: 15, color: '404040', after: 100 }));
    children.push(sectionTable(sec));
  }

  // Summary page
  children.push(p(model.summaryHeading, { size: 24, bold: true, color: NAVY, pageBreak: true, after: 100 }));
  children.push(p('Expected (fixed, assumes full payment)', { size: 18, bold: true, color: BLUE, after: 60 }));
  children.push(summaryTable(model.expected, model.filled));
  children.push(p(model.filled ? 'Actual Collected (from recorded payments)' : 'Actual Collected (fill in monthly)', { size: 18, bold: true, color: BLUE, before: 240, after: 60 }));
  children.push(summaryTable(model.collected, model.filled));
  children.push(p(model.summaryNote, { size: 15, color: '404040', before: 160 }));

  const doc = new Document({
    creator: ESTATE_NAME,
    title: `${model.title} — ${model.subtitle}`,
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            // A4 landscape (Nigerian printers use A4). Pass portrait size + orientation; docx swaps.
            size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
            margin: { top: 500, bottom: 560, left: 500, right: 500 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${ESTATE_NAME} · ${model.subtitle} · Page `, font: FONT, size: 14, color: '7F7F7F' }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14, color: '7F7F7F' }),
                  new TextRun({ text: ' of ', font: FONT, size: 14, color: '7F7F7F' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 14, color: '7F7F7F' }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}
