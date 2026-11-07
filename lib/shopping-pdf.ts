import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { AppData } from './types';
import { getShoppingList } from './domain';
import { dateKey, dateLabel } from './format';

/** The PDF is generated on demand; no customer or salon data leaves the browser. */
export async function generateShoppingPdf(data: AppData, from: string, to: string): Promise<Uint8Array> {
 const rows = getShoppingList(data, from, to);
 const pdf = await PDFDocument.create();
 const regular = await pdf.embedFont(StandardFonts.Helvetica);
 const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
 pdf.setTitle('Divas Black - Lista de compras'); pdf.setAuthor('Divas Black');
 const ink = rgb(.067, .067, .067), pink = rgb(1, .078, .576), muted = rgb(.36, .35, .34);
 const pageWidth = 595.28, pageHeight = 841.89, left = 40, tableWidth = pageWidth - 80;
 const qty = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value);
 const safe = (text: string, font = regular) => Array.from(text.replace(/\s+/g, ' ')).map(char => { try { font.encodeText(char); return char; } catch { return '-'; } }).join('');
 const text = (page: PDFPage, value: string, x: number, y: number, size = 11, font: PDFFont = regular, color = ink) => page.drawText(safe(value, font), { x, y, size, font, color });
 const wrap = (value: string, maxWidth: number, size = 12, font: PDFFont = regular) => {
  const result: string[] = []; let line = '';
  for (const char of safe(value, font)) {
   if (font.widthOfTextAtSize(line + char, size) > maxWidth && line) {
    const split = line.lastIndexOf(' ');
    if (split > 0) { result.push(line.slice(0, split).trim()); line = line.slice(split + 1); }
    else { result.push(line.trim()); line = ''; }
   }
   line += char;
  }
  if (line) result.push(line.trim());
  return result;
 };
 let page: PDFPage, y = 0;
 function newPage() {
  page = pdf.addPage([pageWidth, pageHeight]);
  page.drawRectangle({ x: 0, y: pageHeight - 80, width: pageWidth, height: 80, color: ink });
  text(page, 'divas black.', left, pageHeight - 51, 26, bold, rgb(1, 1, 1));
  page.drawRectangle({ x: left, y: pageHeight - 81, width: tableWidth, height: 4, color: pink });
  text(page, 'Lista de compras', left, 721, 25, bold);
  text(page, `${dateLabel(from, { day: '2-digit', month: '2-digit', year: 'numeric' })} a ${dateLabel(to, { day: '2-digit', month: '2-digit', year: 'numeric' })}`, left, 696, 11, regular, muted);
  text(page, 'Agenda + demanda extra + estoque mínimo', left, 677, 10, regular, muted);
  page.drawRectangle({ x: left, y: 625, width: tableWidth, height: 30, color: rgb(1, .86, .93) });
  text(page, 'Material', left + 12, 636, 11, bold);
  text(page, 'Tenho', 293, 636, 11, bold);
  text(page, 'Demanda', 365, 636, 11, bold);
  text(page, 'Comprar', 456, 636, 11, bold);
  y = 625;
 }
 newPage();
 if (!rows.length) { text(page!, 'Nenhum material faltando neste período.', left + 12, y - 35, 13); y -= 65; }
 for (const [index, row] of rows.entries()) {
  const nameLines = wrap(row.material.name, 222, 12, bold);
  const details = `${row.material.unit}${row.material.alwaysOnShoppingList ? ' | Item fixo' : ''}${row.material.manualDemand ? ` | Extra manual: ${qty(row.material.manualDemand)}` : ''}`;
  const detailLines = wrap(details, 222, 9);
  const height = Math.max(62, 24 + nameLines.length * 15 + detailLines.length * 12);
  if (y - height < 98) newPage();
  if (index % 2 === 0) page!.drawRectangle({ x: left, y: y - height, width: tableWidth, height, color: rgb(.965, .961, .949) });
  let lineY = y - 21;
  for (const line of nameLines) { text(page!, line, left + 12, lineY, 12, bold); lineY -= 15; }
  for (const line of detailLines) { text(page!, line, left + 12, lineY - 1, 9, regular, muted); lineY -= 12; }
  text(page!, qty(row.material.quantity), 293, y - 23, 11);
  text(page!, qty(row.demand), 365, y - 23, 11);
  text(page!, qty(row.shortage), 456, y - 23, 12, bold);
  if (row.shortage === 0) text(page!, 'Em estoque', 456, y - 40, 8, regular, muted);
  page!.drawLine({ start: { x: left, y: y - height }, end: { x: pageWidth - left, y: y - height }, thickness: .5, color: rgb(.87, .86, .84) });
  y -= height;
 }
 if (y < 145) newPage();
 text(page!, 'Comprar = demanda da agenda + extra + mínimo - estoque (nunca abaixo de zero).', left, y - 28, 9, regular, muted);
 text(page!, 'Pomada e Mousse ficam na lista mesmo quando o estoque é suficiente.', left, y - 44, 9, regular, muted);
 const pages = pdf.getPages();
 for (const [index, current] of pages.entries()) {
  text(current, `Divas Black | Gerado em ${dateLabel(dateKey(), { day: '2-digit', month: '2-digit', year: 'numeric' })}`, left, 39, 9, regular, muted);
  text(current, `${index + 1} / ${pages.length}`, pageWidth - 65, 39, 9, regular, muted);
 }
 return pdf.save();
}

export async function downloadShoppingPdf(data: AppData, from: string, to: string): Promise<void> {
 const bytes = await generateShoppingPdf(data, from, to);
 const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' }));
 const anchor = document.createElement('a');
 anchor.href = url; anchor.download = `divas-black-lista-${from}-${to}.pdf`;
 document.body.appendChild(anchor); anchor.click(); anchor.remove();
 window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
