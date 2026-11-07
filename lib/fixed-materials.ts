import type { Material } from './types';

const fixedMaterials: Material[] = [
  { id: 'mat-pomada', name: 'Pomada', unit: 'pote', quantity: 0, minimum: 1, active: true, alwaysOnShoppingList: true },
  { id: 'mat-mousse', name: 'Mousse', unit: 'frasco', quantity: 0, minimum: 1, active: true, alwaysOnShoppingList: true },
];

/** Additive normalization for existing demos: never replace user balances or IDs. */
export function ensureFixedMaterials(materials: Material[]): Material[] {
  const result = materials.map(material => ({ ...material }));
  for (const fixed of fixedMaterials) {
    const existing = result.find(material => material.name.trim().toLocaleLowerCase('pt-BR') === fixed.name.toLocaleLowerCase('pt-BR'));
    if (existing) {
      existing.active = true;
      existing.alwaysOnShoppingList = true;
      continue;
    }
    let id = fixed.id;
    for (let suffix = 1; result.some(material => material.id === id); suffix++) id = `${fixed.id}-fixed-${suffix}`;
    result.push({ ...fixed, id });
  }
  return result;
}
