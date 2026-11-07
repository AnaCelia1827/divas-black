import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { mkdir, writeFile } from 'node:fs/promises';
import { buildFinancialWorkbook, generateFinancialSpreadsheet } from '../lib/financial-xlsx';
import { createSeedData } from '../lib/seed';
import type { AppData, Appointment, CashMovement } from '../lib/types';

const now = new Date('2026-11-07T15:00:00Z');
const filters = { from: '2026-10-01', to: '2027-01-31', direction: 'all' as const, category: 'all', mode: 'demo' as const };
function fixture(): AppData {
  const data = createSeedData(now);
  data.clients[0].name = '=2+2'; data.clients[0].phone = '0011999990000';
  const booking = (id: string, startAt: string, priceCents: number, status: Appointment['status'] = 'confirmed', costCents?: number): Appointment => ({ id, startAt, priceCents, status, ...(costCents === undefined ? {} : { costCents }), clientId: data.clients[0].id, serviceId: 'svc-box', serviceName: 'Box Braids', serviceColor: '#F4B6DA', durationMinutes: 90, notes: '=HYPERLINK("https://example.com")' });
  data.appointments = [
    booking('a', '2026-11-01T01:30:00Z', 30000), // 31 October, 22:30 in São Paulo.
    booking('b', '2026-11-15T12:00:00-03:00', 20000, 'completed', 5000),
    booking('c', '2026-11-20T12:00:00-03:00', 10000, 'cancelled', 0),
    booking('d', '2026-11-21T12:00:00-03:00', 5000, 'noshow'),
    booking('e', '2026-12-05T12:00:00-03:00', 100, 'confirmed', 0),
  ];
  const movement = (id: string, date: string, direction: CashMovement['direction'], amountCents: number, appointmentId?: string, category = 'Serviços'): CashMovement => ({ id, date, direction, amountCents, ...(appointmentId ? { appointmentId } : {}), category, description: '=2+2', origin: direction === 'out' && appointmentId ? 'refund' : appointmentId ? 'payment' : 'manual', createdAt: '2026-11-07T15:00:00Z' });
  data.cashMovements = [
    movement('before', '2026-09-30', 'in', 5000, 'a'),
    movement('a-pay', '2026-11-01', 'in', 10000, 'a'),
    movement('a-refund', '2026-11-02', 'out', 2000, 'a'),
    movement('b-paid', '2026-11-15', 'in', 20000, 'b'),
    movement('cancel-deposit', '2026-10-05', 'in', 3000, 'c'),
    movement('bill', '2026-11-10', 'out', 5000, undefined, 'Contas'),
    movement('cents-a', '2026-12-01', 'in', 10, undefined, 'Outros'),
    movement('cents-b', '2026-12-02', 'in', 20, undefined, 'Outros'),
    movement('cents-out', '2026-12-03', 'out', 5, undefined, 'Outros'),
  ];
  return data;
}
function result(sheet: ExcelJS.Worksheet, address: string) {
  const cell = sheet.getCell(address);
  return cell.type === ExcelJS.ValueType.Formula ? cell.result : cell.value;
}
function rowById(sheet: ExcelJS.Worksheet, column: number, id: string) {
  let found = 0;
  sheet.eachRow((row, number) => { if (row.getCell(column).value === id) found = number; });
  expect(found).toBeGreaterThan(0);
  return found;
}

describe('exportação financeira completa', () => {
  it('gera sete abas, concilia centavos, parcela/reembolso e preserva os dados', () => {
    const data = fixture(); const original = structuredClone(data);
    const workbook = buildFinancialWorkbook(data, filters, now);
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(['Resumo', 'Movimentações', 'Atendimentos', 'A receber', 'Serviços', 'Categorias', 'Fluxo mensal']);
    expect(workbook.calcProperties.fullCalcOnLoad).toBe(true);
    const summary = workbook.getWorksheet('Resumo')!;
    expect(result(summary, 'B8')).toBe(330.3);
    expect(result(summary, 'B9')).toBe(70.05);
    expect(result(summary, 'B10')).toBe(260.25);
    expect(result(summary, 'B17')).toBe(171);
    expect(summary.getCell('B10').formula).toContain('ROUND');
    const agenda = workbook.getWorksheet('Atendimentos')!;
    const row = rowById(agenda, 18, 'a');
    expect(result(agenda, `J${row}`)).toBe(130);
    expect(result(agenda, `K${row}`)).toBe(170);
    expect(agenda.getCell(`N${row}`).value).toBe(150);
    expect(agenda.getCell(`O${row}`).value).toBe(20);
    expect(agenda.getCell(`J${row}`).formula).toBe(`ROUND(N${row}-O${row},2)`);
    expect(data).toEqual(original);
  });

  it('default categoria all não zera o caixa e todos os filtros afetam só o caixa', () => {
    const data = fixture();
    const workbook = buildFinancialWorkbook(data, { ...filters, from: '2026-11-01', to: '2026-11-30', direction: 'out', category: 'Serviços' }, now);
    const summary = workbook.getWorksheet('Resumo')!;
    expect(result(summary, 'B8')).toBe(0);
    expect(result(summary, 'B9')).toBe(20);
    expect(result(summary, 'B10')).toBe(-20);
    expect(result(summary, 'B12')).toBe(3); // November São Paulo excludes booking a.
    expect(result(summary, 'B17')).toBe(0); // b is paid; c and d are inactive.
    expect(workbook.getWorksheet('Movimentações')!.getCell('L8').value).toBe('a-refund');
    expect(workbook.getWorksheet('Movimentações')!.getCell('L9').value).toBeNull();
    expect(summary.getCell('A5').value).toContain('somente saídas');
    expect(workbook.getWorksheet('Atendimentos')!.getCell('A6').value).toContain('somente o caixa');
    const all = buildFinancialWorkbook(data, filters, now);
    expect(result(all.getWorksheet('Resumo')!, 'B8')).toBe(330.3);
    expect(all.getWorksheet('Resumo')!.getCell('A5').value).toContain('Categoria: todas');
  });

  it('usa data/hora de São Paulo, meses vazios e custos desconhecidos sem inventar zero', () => {
    const workbook = buildFinancialWorkbook(fixture(), filters, now);
    const agenda = workbook.getWorksheet('Atendimentos')!;
    const first = rowById(agenda, 18, 'a');
    expect((agenda.getCell(`A${first}`).value as Date).toISOString()).toBe('2026-10-31T00:00:00.000Z');
    expect(agenda.getCell(`B${first}`).value).toBeCloseTo(22.5 / 24);
    expect(agenda.getCell(`A${first}`).numFmt).toBe('dd/mm/yyyy');
    expect(agenda.getCell(`B${first}`).numFmt).toBe('h:mm');
    expect(agenda.getCell(`H${first}`).value).toBeNull();
    expect(agenda.getCell(`I${first}`).value).toBe('Não informado');
    expect(result(agenda, `S${first}`)).toBe(0);
    expect(agenda.getCell(`S${first}`).formula).toBe(`IF(ISNUMBER(H${first}),1,0)`);
    const zeroCost = rowById(agenda, 18, 'e');
    expect(agenda.getCell(`H${zeroCost}`).value).toBe(0);
    expect(result(agenda, `S${zeroCost}`)).toBe(1);
    expect(result(agenda, `I${zeroCost}`)).toBe(1);
    const monthly = workbook.getWorksheet('Fluxo mensal')!;
    expect((monthly.getCell('A11').value as Date).toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(result(monthly, 'B11')).toBe(0);
    expect(result(monthly, 'C11')).toBe(0);
    expect(result(monthly, 'D10')).toBe(.25);
    expect(monthly.getCell('D10').formula).toBe('ROUND(B10-C10,2)');
  });

  it('exclui cancelados/ausências de saldo e estimativas ativas sem apagar recebimentos', () => {
    const workbook = buildFinancialWorkbook(fixture(), filters, now);
    const agenda = workbook.getWorksheet('Atendimentos')!;
    const cancelled = rowById(agenda, 18, 'c');
    const noshow = rowById(agenda, 18, 'd');
    expect(result(agenda, `K${cancelled}`)).toBe(0);
    expect(result(agenda, `J${cancelled}`)).toBe(30);
    expect(agenda.getCell(`L${cancelled}`).value).toBe('Parcial');
    expect(result(agenda, `K${noshow}`)).toBe(0);
    const pending = workbook.getWorksheet('A receber')!;
    const ids: unknown[] = []; pending.eachRow(row => { if (row.number >= 8) ids.push(row.getCell(10).value); });
    expect(ids).toContain('a'); expect(ids).toContain('e'); expect(ids).not.toContain('c'); expect(ids).not.toContain('d');
    expect(pending.getCell('H8').formula).toContain("'Atendimentos'!");
    const summary = workbook.getWorksheet('Resumo')!;
    expect(result(summary, 'B13')).toBe(501);
    expect(result(summary, 'B14')).toBe(50);
    expect(result(summary, 'B15')).toBe(1);
    expect(result(summary, 'B16')).toBe(151);
    const services = workbook.getWorksheet('Serviços')!;
    expect(result(services, 'B8')).toBe(5);
    expect(result(services, 'E8')).toBe(1);
    expect(result(services, 'F8')).toBe(1);
    expect(result(services, 'L8')).toBe(171);
    expect(services.getCell('I8').formula).toContain("'Atendimentos'!$S$8:$S$12,0");
    expect(summary.getCell('B15').formula).toBe("'Serviços'!I10");
  });

  it('escapa curingas e comparação nos critérios de categoria/IDs e mantém textos literais', () => {
    const data = fixture();
    data.cashMovements[1].category = '=Material*?~';
    const workbook = buildFinancialWorkbook(data, { ...filters, category: '=Material*?~' }, now);
    const cash = workbook.getWorksheet('Movimentações')!;
    expect(cash.getCell('C8').value).toBe('=Material*?~');
    expect(cash.getCell('C8').type).toBe(ExcelJS.ValueType.String);
    expect(cash.getCell('D8').type).toBe(ExcelJS.ValueType.String);
    expect(cash.getCell('D8').value).toBe('=2+2');
    const categories = workbook.getWorksheet('Categorias')!;
    expect(categories.getCell('B8').formula).toContain('SUBSTITUTE');
    expect(categories.getCell('B8').formula).toContain('"~","~~"');
    expect(categories.getCell('B8').formula).toContain('"*","~*"');
    expect(categories.getCell('B8').formula).toContain('"?","~?"');
    expect(result(categories, 'B8')).toBe(100);
    expect(workbook.getWorksheet('Serviços')!.getCell('B8').formula).toContain('COUNTIFS(');
  });

  it('gera arquivo vazio utilizável, com cabeçalhos, zeros e sem referências invertidas', () => {
    const data = fixture(); data.appointments = []; data.cashMovements = [];
    const workbook = buildFinancialWorkbook(data, filters, now);
    for (const sheet of workbook.worksheets) {
      expect(sheet.getCell('A7').value).toBeTruthy();
      expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 7, showGridLines: false });
      sheet.eachRow(row => row.eachCell(cell => {
        if (cell.type === ExcelJS.ValueType.Formula) {
          expect(cell.formula).not.toMatch(/8:\$?[A-Z]+\$?7/);
          expect(cell.result).toBeDefined();
          expect(String(cell.result)).not.toMatch(/#REF!|#DIV\/0!|#VALUE!|#NAME\?|#NUM!/);
        }
      }));
    }
    expect(result(workbook.getWorksheet('Resumo')!, 'B8')).toBe(0);
    expect(result(workbook.getWorksheet('Resumo')!, 'B17')).toBe(0);
    expect(workbook.getWorksheet('Movimentações')!.autoFilter).toBeTruthy();
  });

  it('valida datas, ordem e tipo de movimentação', () => {
    const data = fixture();
    expect(() => buildFinancialWorkbook(data, { from: '2026-02-30', to: '2026-03-01' })).toThrow(/período/);
    expect(() => buildFinancialWorkbook(data, { from: '2026-11-20', to: '2026-11-01' })).toThrow(/período/);
    expect(() => buildFinancialWorkbook(data, { ...filters, direction: 'bad' as 'in' })).toThrow(/Tipo/);
  });

  it('faz roundtrip XLSX com datas, filtros, cached values e fórmulas preservados', async () => {
    const bytes = await generateFinancialSpreadsheet(fixture(), filters, now);
    expect(bytes[0]).toBe(0x50); expect(bytes[1]).toBe(0x4b);
    const copy = new ExcelJS.Workbook();
    const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes);
    await copy.xlsx.load(buffer);
    expect(copy.worksheets).toHaveLength(7);
    const summary = copy.getWorksheet('Resumo')!;
    expect(result(summary, 'B10')).toBe(260.25);
    const cash = copy.getWorksheet('Movimentações')!;
    expect(cash.getCell('A8').value).toBeInstanceOf(Date);
    expect(cash.getCell('D8').value).toBe('=2+2');
    expect(cash.getCell('H8').formula).toContain('ROUND');
    expect(cash.autoFilter).toBeTruthy();
    expect(cash.getCell('G8').numFmt).toContain('R$');
    const agenda = copy.getWorksheet('Atendimentos')!;
    expect(agenda.getCell('D8').value).toBe('0011999990000');
    expect(agenda.getCell('C8').value).toBe('=2+2');
    expect(agenda.getCell('M8').type).toBe(ExcelJS.ValueType.String);
    expect(result(copy.getWorksheet('Fluxo mensal')!, 'B11')).toBe(0);
    if (process.env.GENERATE_XLSX_QA === '1') {
      await mkdir('.cache/xlsx', { recursive: true });
      await writeFile('.cache/xlsx/financeiro.xlsx', bytes);
    }
  });
});
