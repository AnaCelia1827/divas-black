import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mkdir, writeFile } from 'node:fs/promises';
import { generateShoppingPdf } from '../lib/shopping-pdf';
import { createSeedData } from '../lib/seed';

describe('PDF da lista de compras',()=>{
 it('gera PDF A4 válido da lista com itens fixos e demanda manual',async()=>{
  const data=createSeedData(new Date('2026-11-07T15:00:00Z'));
  data.materials[0].manualDemand=2;
  const bytes=await generateShoppingPdf(data,'2026-11-07','2026-11-13');
  expect(new TextDecoder().decode(bytes.slice(0,5))).toBe('%PDF-');
  const pdf=await PDFDocument.load(bytes);
  expect(pdf.getTitle()).toBe('Divas Black - Lista de compras');
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28,1);
  await mkdir('.cache/pdf',{recursive:true});await writeFile('.cache/pdf/lista-compras.pdf',bytes);
 });
 it('pagina uma lista longa com nomes grandes sem perder materiais',async()=>{
  const data=createSeedData();
  for(let i=0;i<70;i++) data.materials.push({id:`pdf-item-${i}`,name:`Material ${i} - fibra castanha, comprimento longo e acabamento para tranças`,unit:'pacote',quantity:0,minimum:0,manualDemand:3,active:true});
  const bytes=await generateShoppingPdf(data,'2026-11-07','2026-11-13');
  const pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBeGreaterThan(4);
  await writeFile('.cache/pdf/lista-longa.pdf',bytes);
 });
});
