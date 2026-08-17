/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const DEFAULT_BUYERS: string[] = [
  'M&S',
  'G-Star',
  'Tommy Hilfiger',
  'Carhartt',
  'S.Oliver',
  'Varner',
  'Country Road',
  'Express',
  'Ralph Lauren',
  'Target Australia',
  'C&A',
  'Next',
  'Stanley Stella',
  'Calvin Klein',
  'J.Crew',
  'Puma',
  'Champion',
  'Klattermusen',
  'Bonds',
  'RAW-ASOS',
  'Lands End',
  'Obey'
];

let memoryBuyers: string[] = [...DEFAULT_BUYERS];

export function getBuyers(): string[] {
  return [...memoryBuyers];
}

export function saveBuyers(buyers: string[]): void {
  try {
    memoryBuyers = [...buyers];
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('buyers_updated', { detail: buyers }));
    }
  } catch (e) {
    console.error('Failed to update buyers list in memory', e);
  }
}

export function addBuyer(newBuyer: string): string[] {
  const trimmed = newBuyer.trim();
  if (!trimmed) return getBuyers();
  const current = getBuyers();
  if (!current.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
    const updated = [...current, trimmed];
    saveBuyers(updated);
    return updated;
  }
  return current;
}

export function removeBuyer(buyerToRemove: string): string[] {
  const current = getBuyers();
  const updated = current.filter(b => b !== buyerToRemove);
  saveBuyers(updated);
  return updated;
}

export function renameBuyerInStore(oldName: string, newName: string): string[] {
  const trimmed = newName.trim();
  if (!trimmed || !oldName) return getBuyers();
  const current = getBuyers();
  const updated = current.map(b => b === oldName ? trimmed : b);
  saveBuyers(updated);
  return updated;
}

export function resetBuyersToDefault(): string[] {
  saveBuyers([...DEFAULT_BUYERS]);
  return [...DEFAULT_BUYERS];
}
