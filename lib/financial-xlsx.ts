import ExcelJS from 'exceljs';
import type { AppData, Appointment } from './types';
import { localDate } from './domain';
import { dateSchema } from './validation';

export interface FinancialExportFilters {
  from: string;
  to: string;
  direction?: 'all' | 'in' | 'out';
  category?: string;
  mode?: 'demo' | 'supabase';
}

const FIRST = 8;
const MONEY = '"R$" #,##0.00;[Red]("R$" #,##0.00);"R$" 0.00';
const INK = 'FF111111';
const PINK = 'FFFF1493';
const MUTED = 'FF665D64';
const PALE = 'FFFFF3F9';
const statusLabels = { confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado', noshow: 'Não compareceu' };
const originLabels = { manual: 'Manual', payment: 'Pagamento', purchase: 'Compra', refund: 'Reembolso' };
const units = (cents: number) => cents / 100;
const formula = (value: string, result: number | string): ExcelJS.CellFormulaValue => ({ formula: value, result });
const dayValue = (day: string) => new Date(`${day}T00:00:00Z`);
const labelDate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
const sheetRef = (name: string, cell: string) => `'${name}'!${cell}`;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const endRow = (count: number) => Math.max(FIRST, FIRST + count - 1);
const totalRow = (count: number) => endRow(count) + 2;
const range = (sheet: string, column: string, count: number) => sheetRef(sheet, `$${column}$${FIRST}:$${column}$${endRow(count)}`);
const exactCriteria = (cell: string) => `"="&SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(${cell},"~","~~"),"*","~*"),"?","~?")`;
const totalFormula = (column: string, count: number, cached: number) => formula(count ? `ROUND(SUM(${column}${FIRST}:${column}${endRow(count)}),2)` : 'ROUND(0,2)', cached);

function validateFilters(filters: FinancialExportFilters) {
  if (!dateSchema.safeParse(filters.from).success || !dateSchema.safeParse(filters.to).success || filters.from > filters.to) throw new Error('Confira o período da exportação: informe datas válidas em ordem.');
  if (filters.direction && !['all', 'in', 'out'].includes(filters.direction)) throw new Error('Tipo de movimentação inválido.');
  if (filters.category !== undefined && typeof filters.category !== 'string') throw new Error('Categoria inválida.');
}

function localTime(value: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0);
  return (hour * 60 + minute) / 1440;
}

function createSheet(workbook: ExcelJS.Workbook, name: string, headers: string[], widths: number[], filters: FinancialExportFilters, now: Date, note: string, freezeColumns = 0) {
  const sheet = workbook.addWorksheet(name, { properties: { defaultRowHeight: 22, tabColor: { argb: PINK } }, views: [{ state: 'frozen', ySplit: 7, xSplit: freezeColumns, showGridLines: false, activeCell: 'A8' }] });
  sheet.columns = widths.map(width => ({ width }));
  sheet.getCell('A2').value = `Divas Black · ${name === 'Resumo' ? 'Resumo financeiro' : name}`;
  sheet.getCell('A2').font = { name: 'Arial', size: 17, bold: true, color: { argb: INK } };
  sheet.getRow(2).height = 30;
  sheet.getCell('A3').value = `Exportado em ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(now)} · ${filters.mode === 'supabase' ? 'Banco conectado' : filters.mode === 'demo' ? 'Dados de demonstração' : 'Origem do aplicativo'}`;
  sheet.getCell('A4').value = `Período: ${labelDate(filters.from)} a ${labelDate(filters.to)}`;
  sheet.getCell('A5').value = `Caixa: ${filters.direction === 'in' ? 'somente entradas' : filters.direction === 'out' ? 'somente saídas' : 'entradas e saídas'}. Categoria: ${filters.category || 'todas'}.`;
  sheet.getCell('A6').value = note;
  for (const row of [3, 4, 5, 6]) sheet.getCell(`A${row}`).font = { name: 'Arial', size: 11, color: { argb: MUTED } };
  sheet.getRow(7).values = headers;
  sheet.getRow(7).height = 40;
  sheet.getRow(7).eachCell(cell => {
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: PINK } } };
  });
  sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '7:7', margins: { left: .3, right: .3, top: .4, bottom: .4, header: .2, footer: .2 } };
  sheet.headerFooter.oddFooter = '&LDivas Black&R&P / &N';
  return sheet;
}

function bodyRow(sheet: ExcelJS.Worksheet, rowNumber: number, values: ExcelJS.CellValue[], moneyColumns: number[] = [], idColumns: number[] = []) {
  const row = sheet.getRow(rowNumber);
  row.values = values;
  let lines = 1;
  for (let column = 1; column <= values.length; column++) {
    const cell = row.getCell(column);
    cell.font = { name: 'Arial', size: idColumns.includes(column) ? 10 : 11, color: { argb: idColumns.includes(column) ? MUTED : INK } };
    cell.alignment = { vertical: 'top', wrapText: true };
    if (rowNumber % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALE } };
    if (moneyColumns.includes(column)) { cell.numFmt = MONEY; cell.alignment = { vertical: 'top', horizontal: 'right' }; }
    const value = values[column - 1];
    if (typeof value === 'string') lines = Math.max(lines, Math.ceil(value.length / Math.max(8, (sheet.getColumn(column).width ?? 20) - 2)));
  }
  row.height = Math.min(409, Math.max(28, lines * 15 + 8));
}

function finish(sheet: ExcelJS.Worksheet, count: number, values: Record<number, ExcelJS.CellValue>, label = 'Total') {
  const row = sheet.getRow(totalRow(count));
  row.getCell(1).value = label;
  for (const [column, value] of Object.entries(values)) { row.getCell(Number(column)).value = value; row.getCell(Number(column)).numFmt = MONEY; }
  for (let column = 1; column <= sheet.columnCount; column++) {
    const cell = row.getCell(column);
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: INK } };
    cell.border = { top: { style: 'thin', color: { argb: PINK } } };
    cell.alignment = { vertical: 'middle', horizontal: column === 1 ? 'left' : 'right', wrapText: true };
  }
  row.height = 35;
  sheet.autoFilter = { from: { row: 7, column: 1 }, to: { row: Math.max(7, count + 7), column: sheet.columnCount } };
}

/** Read-only browser export. Cached results are calculated from integer cents; Excel recalculates on open. */
export function buildFinancialWorkbook(data: AppData, filters: FinancialExportFilters, now = new Date()): ExcelJS.Workbook {
  validateFilters(filters);
  filters = { ...filters, category: filters.category === 'all' ? undefined : filters.category };
  if (!Number.isFinite(now.getTime())) throw new Error('Data de exportação inválida.');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Divas Black'; workbook.created = new Date(now); workbook.modified = new Date(now);
  workbook.title = 'Divas Black · Financeiro'; workbook.subject = 'Caixa filtrado e atendimentos do período';
  workbook.calcProperties.fullCalcOnLoad = true;
  const movements = data.cashMovements.filter(item => item.date >= filters.from && item.date <= filters.to && (!filters.direction || filters.direction === 'all' || item.direction === filters.direction) && (!filters.category || item.category === filters.category)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const appointments = data.appointments.filter(item => localDate(item.startAt) >= filters.from && localDate(item.startAt) <= filters.to).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt) || a.id.localeCompare(b.id));
  const clients = new Map(data.clients.map(item => [item.id, item]));
  const stock = new Map(data.stockMovements.map(item => [item.id, item]));
  const materials = new Map(data.materials.map(item => [item.id, item]));
  const appointmentMap = new Map(data.appointments.map(item => [item.id, item]));
  const history = new Map<string, { incoming: number; refunded: number }>();
  for (const movement of data.cashMovements) {
    if (!movement.appointmentId) continue;
    const value = history.get(movement.appointmentId) ?? { incoming: 0, refunded: 0 };
    if (movement.direction === 'in') value.incoming += movement.amountCents; else value.refunded += movement.amountCents;
    history.set(movement.appointmentId, value);
  }
  const paid = (appointment: Appointment) => { const item = history.get(appointment.id); return (item?.incoming ?? 0) - (item?.refunded ?? 0); };
  const remaining = (appointment: Appointment) => Math.max(0, appointment.priceCents - paid(appointment));
  const isActive = (appointment: Appointment) => appointment.status === 'confirmed' || appointment.status === 'completed';
  const pending = appointments.filter(item => isActive(item) && remaining(item) > 0);
  const received = sum(movements.filter(item => item.direction === 'in').map(item => item.amountCents));
  const spent = sum(movements.filter(item => item.direction === 'out').map(item => item.amountCents));
  const agendaNote = 'Agenda por data de atendimento. Filtros de tipo e categoria afetam somente o caixa.';
  const summary = createSheet(workbook, 'Resumo', ['Indicador', 'Valor', 'Como ler'], [42, 24, 89], filters, now, 'Caixa filtrado e agenda do período são apresentados separadamente.');
  const cash = createSheet(workbook, 'Movimentações', ['Data', 'Tipo', 'Categoria', 'Descrição', 'Cliente', 'Serviço / material', 'Valor', 'Efeito no caixa', 'Origem', 'ID atendimento', 'ID compra', 'ID movimento'], [15, 15, 21, 43, 26, 28, 19, 21, 17, 38, 38, 38], filters, now, 'Somente movimentações que atendem a todos os filtros. Reembolso é saída.', 1);
  const agenda = createSheet(workbook, 'Atendimentos', ['Data', 'Horário', 'Cliente', 'Telefone', 'Serviço', 'Situação', 'Valor combinado', 'Custo estimado', 'Sobra estimada', 'Recebido acumulado', 'Saldo atual', 'Pagamento', 'Observações', 'Entradas acumuladas', 'Reembolsos acumulados', 'ID serviço', 'ID cliente', 'ID atendimento', 'Custo informado'], [15, 13, 27, 21, 27, 21, 21, 21, 22, 23, 21, 18, 48, 23, 24, 38, 38, 38, 21], filters, now, agendaNote, 3);
  const receivables = createSheet(workbook, 'A receber', ['Data', 'Horário', 'Cliente', 'Telefone', 'Serviço', 'Valor combinado', 'Recebido acumulado', 'Saldo a receber', 'Pagamento', 'ID atendimento'], [15, 13, 27, 21, 27, 21, 23, 22, 18, 38], filters, now, 'Atendimentos ativos do período com saldo atual. Recebimentos incluem todas as datas.', 3);
  const services = createSheet(workbook, 'Serviços', ['Serviço', 'Agendamentos', 'Confirmados', 'Concluídos', 'Cancelados', 'Não compareceu', 'Valor combinado', 'Custos informados', 'Sem custo informado', 'Sobra estimada parcial', 'Recebido acumulado', 'Saldo a receber', 'ID serviço'], [28, 19, 17, 17, 17, 22, 22, 23, 24, 26, 24, 23, 38], filters, now, agendaNote, 1);
  const categories = createSheet(workbook, 'Categorias', ['Categoria', 'Entradas', 'Saídas', 'Saldo'], [31, 23, 23, 24], filters, now, 'Totais das movimentações filtradas. Saldo de caixa não é lucro.');
  const monthly = createSheet(workbook, 'Fluxo mensal', ['Mês', 'Entradas', 'Saídas', 'Saldo'], [24, 23, 23, 24], filters, now, 'Meses do período, inclusive sem movimento. Valores seguem todos os filtros do caixa.');

  movements.forEach((item, index) => {
    const row = FIRST + index;
    const linked = item.appointmentId ? appointmentMap.get(item.appointmentId) : undefined;
    const purchase = item.stockMovementId ? stock.get(item.stockMovementId) : undefined;
    bodyRow(cash, row, [dayValue(item.date), item.direction === 'in' ? 'Entrada' : 'Saída', item.category, item.description, linked ? clients.get(linked.clientId)?.name ?? 'Cliente não encontrada' : '', linked?.serviceName ?? (purchase ? materials.get(purchase.materialId)?.name ?? '' : ''), units(item.amountCents), formula(`ROUND(IF(B${row}="Entrada",G${row},-G${row}),2)`, units(item.direction === 'in' ? item.amountCents : -item.amountCents)), originLabels[item.origin], item.appointmentId ?? '', item.stockMovementId ?? '', item.id], [7, 8], [10, 11, 12]);
    cash.getCell(row, 1).numFmt = 'dd/mm/yyyy';
  });
  finish(cash, movements.length, { 7: totalFormula('G', movements.length, units(received + spent)), 8: totalFormula('H', movements.length, units(received - spent)) }, 'Totais filtrados');

  const appointmentRows = new Map<string, number>();
  appointments.forEach((item, index) => {
    const row = FIRST + index; appointmentRows.set(item.id, row);
    const historyItem = history.get(item.id) ?? { incoming: 0, refunded: 0 };
    const balance = isActive(item) ? remaining(item) : 0;
    bodyRow(agenda, row, [dayValue(localDate(item.startAt)), localTime(item.startAt), clients.get(item.clientId)?.name ?? 'Cliente não encontrada', clients.get(item.clientId)?.phone ?? '', item.serviceName, statusLabels[item.status], units(item.priceCents), item.costCents === undefined ? null : units(item.costCents), item.costCents === undefined ? 'Não informado' : formula(`ROUND(G${row}-H${row},2)`, units(item.priceCents - item.costCents)), formula(`ROUND(N${row}-O${row},2)`, units(paid(item))), formula(`IF(OR(F${row}="Cancelado",F${row}="Não compareceu"),0,MAX(0,ROUND(G${row}-J${row},2)))`, units(balance)), remaining(item) === 0 ? 'Pago' : paid(item) === 0 ? 'Não pago' : 'Parcial', item.notes, units(historyItem.incoming), units(historyItem.refunded), item.serviceId, item.clientId, item.id, formula(`IF(ISNUMBER(H${row}),1,0)`, item.costCents === undefined ? 0 : 1)], [7, 8, 9, 10, 11, 14, 15], [16, 17, 18]);
    agenda.getCell(row, 1).numFmt = 'dd/mm/yyyy'; agenda.getCell(row, 2).numFmt = 'h:mm';
  });
  const totalBooked = sum(appointments.map(item => item.priceCents));
  const knownCost = sum(appointments.map(item => item.costCents ?? 0));
  const knownRemainder = sum(appointments.filter(item => item.costCents !== undefined).map(item => item.priceCents - item.costCents!));
  finish(agenda, appointments.length, { 7: totalFormula('G', appointments.length, units(totalBooked)), 8: totalFormula('H', appointments.length, units(knownCost)), 9: totalFormula('I', appointments.length, units(knownRemainder)), 10: totalFormula('J', appointments.length, units(sum(appointments.map(paid)))), 11: totalFormula('K', appointments.length, units(sum(appointments.filter(isActive).map(remaining)))) }, 'Totais dos registros');
  const agendaEnd = totalRow(appointments.length);
  agenda.getCell(agendaEnd + 2, 1).value = 'Recebido = entradas − reembolsos de todas as datas, inclusive fora do filtro de caixa.';
  agenda.getCell(agendaEnd + 3, 1).value = 'Custo em branco não foi informado. Sobra é parcial e não equivale a lucro.';
  agenda.getCell(agendaEnd + 4, 1).value = 'Histórico inclui cancelados e ausências. Estimativas ativas estão em Serviços.';

  pending.forEach((item, index) => {
    const row = FIRST + index, source = appointmentRows.get(item.id)!;
    const ref = (column: string, cached: number | string) => formula(sheetRef('Atendimentos', `${column}${source}`), cached);
    bodyRow(receivables, row, [dayValue(localDate(item.startAt)), localTime(item.startAt), ref('C', clients.get(item.clientId)?.name ?? ''), clients.get(item.clientId)?.phone ?? '', ref('E', item.serviceName), ref('G', units(item.priceCents)), ref('J', units(paid(item))), ref('K', units(remaining(item))), remaining(item) === item.priceCents ? 'Não pago' : 'Parcial', item.id], [6, 7, 8], [10]);
    receivables.getCell(row, 1).numFmt = 'dd/mm/yyyy'; receivables.getCell(row, 2).numFmt = 'h:mm';
  });
  const totalPending = sum(pending.map(remaining));
  finish(receivables, pending.length, { 6: totalFormula('F', pending.length, units(sum(pending.map(item => item.priceCents)))), 7: totalFormula('G', pending.length, units(sum(pending.map(paid)))), 8: totalFormula('H', pending.length, units(totalPending)) });

  const groupedServices = [...new Set(appointments.map(item => item.serviceId))].map(id => ({ id, items: appointments.filter(item => item.serviceId === id) })).sort((a, b) => a.items[0].serviceName.localeCompare(b.items[0].serviceName));
  const activeAppointments = appointments.filter(isActive);
  const activeBooked = sum(activeAppointments.map(item => item.priceCents));
  const activeCost = sum(activeAppointments.map(item => item.costCents ?? 0));
  const activeRemainder = sum(activeAppointments.filter(item => item.costCents !== undefined).map(item => item.priceCents - item.costCents!));
  services.getCell('A6').value = 'Todos os estados nas contagens. Valores/custos/sobra estimados somente de ativos.';
  groupedServices.forEach(({ id, items }, index) => {
    const row = FIRST + index;
    const serviceRange = range('Atendimentos', 'P', appointments.length);
    const statesRange = range('Atendimentos', 'F', appointments.length);
    const criterion = exactCriteria(`M${row}`);
    const activeItems = items.filter(isActive);
    const byStatus = (status: Appointment['status']) => formula(`COUNTIFS(${serviceRange},${criterion},${statesRange},"${statusLabels[status]}")`, items.filter(item => item.status === status).length);
    const byService = (column: string, cents: number, activeOnly = false) => {
      const values = range('Atendimentos', column, appointments.length);
      const expression = activeOnly ? `SUMIFS(${values},${serviceRange},${criterion},${statesRange},"Confirmado")+SUMIFS(${values},${serviceRange},${criterion},${statesRange},"Concluído")` : `SUMIFS(${values},${serviceRange},${criterion})`;
      return formula(`ROUND(${expression},2)`, units(cents));
    };
    const missingFormula = `COUNTIFS(${serviceRange},${criterion},${range('Atendimentos', 'S', appointments.length)},0,${statesRange},"Confirmado")+COUNTIFS(${serviceRange},${criterion},${range('Atendimentos', 'S', appointments.length)},0,${statesRange},"Concluído")`;
    bodyRow(services, row, [items[0].serviceName, formula(`COUNTIFS(${serviceRange},${criterion})`, items.length), byStatus('confirmed'), byStatus('completed'), byStatus('cancelled'), byStatus('noshow'), byService('G', sum(activeItems.map(item => item.priceCents)), true), byService('H', sum(activeItems.map(item => item.costCents ?? 0)), true), formula(missingFormula, activeItems.filter(item => item.costCents === undefined).length), byService('I', sum(activeItems.filter(item => item.costCents !== undefined).map(item => item.priceCents - item.costCents!)), true), byService('J', sum(items.map(paid))), byService('K', sum(activeItems.map(remaining)), true), id], [7, 8, 10, 11, 12], [13]);
  });
  finish(services, groupedServices.length, { 7: totalFormula('G', groupedServices.length, units(activeBooked)), 8: totalFormula('H', groupedServices.length, units(activeCost)), 10: totalFormula('J', groupedServices.length, units(activeRemainder)), 11: totalFormula('K', groupedServices.length, units(sum(appointments.map(paid)))), 12: totalFormula('L', groupedServices.length, units(totalPending)) }, 'Totais dos atendimentos');
  for (const column of [2, 3, 4, 5, 6, 9]) { const cached = column === 9 ? activeAppointments.filter(item => item.costCents === undefined).length : column === 2 ? appointments.length : appointments.filter(item => item.status === (['confirmed', 'completed', 'cancelled', 'noshow'] as const)[column - 3]).length; services.getCell(totalRow(groupedServices.length), column).value = totalFormula(services.getColumn(column).letter, groupedServices.length, cached); services.getCell(totalRow(groupedServices.length), column).numFmt = '#,##0'; }

  const categoryNames = [...new Set(movements.map(item => item.category))].sort((a, b) => a.localeCompare(b));
  categoryNames.forEach((category, index) => {
    const row = FIRST + index;
    const items = movements.filter(item => item.category === category);
    const incoming = sum(items.filter(item => item.direction === 'in').map(item => item.amountCents));
    const outgoing = sum(items.filter(item => item.direction === 'out').map(item => item.amountCents));
    bodyRow(categories, row, [category, formula(`ROUND(SUMIFS(${range('Movimentações', 'G', movements.length)},${range('Movimentações', 'C', movements.length)},${exactCriteria(`A${row}`)},${range('Movimentações', 'B', movements.length)},"Entrada"),2)`, units(incoming)), formula(`ROUND(SUMIFS(${range('Movimentações', 'G', movements.length)},${range('Movimentações', 'C', movements.length)},${exactCriteria(`A${row}`)},${range('Movimentações', 'B', movements.length)},"Saída"),2)`, units(outgoing)), formula(`ROUND(B${row}-C${row},2)`, units(incoming - outgoing))], [2, 3, 4]);
  });
  finish(categories, categoryNames.length, { 2: totalFormula('B', categoryNames.length, units(received)), 3: totalFormula('C', categoryNames.length, units(spent)), 4: totalFormula('D', categoryNames.length, units(received - spent)) }, 'Total filtrado');

  const months: string[] = [];
  let cursor = filters.from.slice(0, 7);
  while (cursor <= filters.to.slice(0, 7)) { months.push(cursor); const [year, month] = cursor.split('-').map(Number); cursor = month === 12 ? `${String(year + 1).padStart(4, '0')}-01` : `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}`; }
  months.forEach((month, index) => {
    const row = FIRST + index;
    const items = movements.filter(item => item.date.startsWith(month));
    const incoming = sum(items.filter(item => item.direction === 'in').map(item => item.amountCents));
    const outgoing = sum(items.filter(item => item.direction === 'out').map(item => item.amountCents));
    const monthSum = (direction: 'Entrada' | 'Saída', cached: number) => formula(`ROUND(SUMIFS(${range('Movimentações', 'G', movements.length)},${range('Movimentações', 'A', movements.length)},">="&A${row},${range('Movimentações', 'A', movements.length)},"<"&DATE(YEAR(A${row}),MONTH(A${row})+1,1),${range('Movimentações', 'B', movements.length)},"${direction}"),2)`, units(cached));
    bodyRow(monthly, row, [dayValue(`${month}-01`), monthSum('Entrada', incoming), monthSum('Saída', outgoing), formula(`ROUND(B${row}-C${row},2)`, units(incoming - outgoing))], [2, 3, 4]); monthly.getCell(row, 1).numFmt = 'mmm/yyyy';
  });
  finish(monthly, months.length, { 2: totalFormula('B', months.length, units(received)), 3: totalFormula('C', months.length, units(spent)), 4: totalFormula('D', months.length, units(received - spent)) }, 'Total filtrado');

  const summaryRows: [string, ExcelJS.CellValue, string, boolean][] = [
    ['Recebi no caixa filtrado', formula(sheetRef('Categorias', `B${totalRow(categoryNames.length)}`), units(received)), 'Entradas efetivamente registradas que atendem aos filtros.', true],
    ['Gastei no caixa filtrado', formula(sheetRef('Categorias', `C${totalRow(categoryNames.length)}`), units(spent)), 'Saídas efetivas, incluindo reembolsos e compras pagas.', true],
    ['Saldo do caixa filtrado', formula(`ROUND(B8-B9,2)`, units(received - spent)), 'Entradas menos saídas filtradas. Não representa lucro.', true],
    ['Movimentações filtradas', formula(movements.length ? `COUNT(${range('Movimentações', 'G', movements.length)})` : '0', movements.length), 'Quantidade de registros na aba Movimentações.', false],
    ['Atendimentos no período', formula(appointments.length ? `COUNT(${range('Atendimentos', 'G', appointments.length)})` : '0', appointments.length), 'Todos os tipos/categorias; considera a data do atendimento em São Paulo.', false],
    ['Valor combinado dos ativos', formula(sheetRef('Serviços', `G${totalRow(groupedServices.length)}`), units(activeBooked)), 'Confirmados e concluídos do período; exclui cancelamentos e ausências.', true],
    ['Custos estimados informados', formula(sheetRef('Serviços', `H${totalRow(groupedServices.length)}`), units(activeCost)), 'Custos conhecidos dos ativos. Estimativa não gera despesa no caixa.', true],
    ['Ativos sem custo informado', formula(sheetRef('Serviços', `I${totalRow(groupedServices.length)}`), activeAppointments.filter(item => item.costCents === undefined).length), 'Célula de custo em branco é informação ausente, não custo zero.', false],
    ['Sobra estimada dos custos informados', formula(sheetRef('Serviços', `J${totalRow(groupedServices.length)}`), units(activeRemainder)), 'Somente ativos com custo conhecido; não equivale a lucro.', true],
    ['Saldo atual a receber', formula(sheetRef('A receber', `H${totalRow(pending.length)}`), units(totalPending)), 'Ativos do período, com recebimentos/reembolsos acumulados de todas as datas.', true],
  ];
  summaryRows.forEach(([label, value, note, monetary], index) => { bodyRow(summary, FIRST + index, [label, value, note], monetary ? [2] : []); if (!monetary) summary.getCell(FIRST + index, 2).numFmt = '#,##0'; });
  summary.getRow(10).eachCell(cell => { cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: INK } }; cell.border = { top: { style: 'thin', color: { argb: PINK } }, bottom: { style: 'thin', color: { argb: PINK } } }; });
  summary.getCell('A20').value = 'Fonte: registros do aplicativo no momento da exportação. Esta planilha não altera o salão.';
  summary.getCell('A21').value = 'Atendimentos e valores a receber usam todas as categorias/tipos, dentro das datas selecionadas.';
  summary.getCell('A22').value = 'Saldos de atendimento são atuais; não são uma fotografia histórica do último dia do filtro.';
  for (const row of [20, 21, 22]) summary.getCell(`A${row}`).font = { name: 'Arial', size: 11, color: { argb: MUTED } };
  return workbook;
}

export async function generateFinancialSpreadsheet(data: AppData, filters: FinancialExportFilters, now = new Date()): Promise<Uint8Array> {
  const workbook = buildFinancialWorkbook(data, filters, now);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function downloadFinancialSpreadsheet(data: AppData, filters: FinancialExportFilters): Promise<void> {
  if (typeof document === 'undefined') throw new Error('Baixe a planilha pelo navegador.');
  const bytes = await generateFinancialSpreadsheet(data, filters);
  const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `divas-black-financeiro-${filters.from}-a-${filters.to}.xlsx`;
  try { document.body.appendChild(anchor); anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
