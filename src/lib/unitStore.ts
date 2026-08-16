/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UnitThresholdConfig {
  id: string;
  unitName: string;
  productionCapacity: number; // Target KG / Capacity
  avgProdPerMachine: number;  // Avg Prod / Machine (Kg)
  totalMachine: number;       // Total Machines
}

export const INITIAL_UNIT_CONFIGS: UnitThresholdConfig[] = [
  { id: 'unit-ekl', unitName: 'EKL', productionCapacity: 7500, totalMachine: 29, avgProdPerMachine: 258.62 },
  { id: 'unit-efl', unitName: 'EFL', productionCapacity: 15000, totalMachine: 40, avgProdPerMachine: 375 },
  { id: 'unit-efl2', unitName: 'EFL-2', productionCapacity: 15000, totalMachine: 35, avgProdPerMachine: 428.57 },
  { id: 'unit-autostripe', unitName: 'Auto Stripe', productionCapacity: 12000, totalMachine: 20, avgProdPerMachine: 600 },
  { id: 'unit-eflext', unitName: 'EFL-Extension', productionCapacity: 15000, totalMachine: 25, avgProdPerMachine: 600 },
  { id: 'unit-eslext', unitName: 'ESL-Extension', productionCapacity: 10000, totalMachine: 16, avgProdPerMachine: 625 },
  { id: 'unit-subcontact', unitName: 'Sub-Contact', productionCapacity: 25000, totalMachine: 153, avgProdPerMachine: 163.4 }
];

const UNIT_STORAGE_KEY = 'knitprod_unit_configs';

export function getUnitConfigs(): UnitThresholdConfig[] {
  if (typeof window === 'undefined') return INITIAL_UNIT_CONFIGS;
  try {
    const raw = localStorage.getItem(UNIT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading unit configs from storage:', err);
  }
  return INITIAL_UNIT_CONFIGS;
}

export function saveUnitConfigs(configs: UnitThresholdConfig[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(UNIT_STORAGE_KEY, JSON.stringify(configs));
    window.dispatchEvent(new CustomEvent('unit_configs_updated', { detail: configs }));
  } catch (err) {
    console.warn('Error saving unit configs to storage:', err);
  }
}

export function getUnitConfigByName(unitName: string): UnitThresholdConfig | undefined {
  const configs = getUnitConfigs();
  const normalized = (unitName || '').trim().toLowerCase();
  
  // Exact or normalized match
  return configs.find(u => u.unitName.toLowerCase() === normalized || 
    (normalized === 'sub-contact' && u.unitName.toLowerCase().includes('sub')) ||
    (normalized === 'extension' && u.unitName.toLowerCase().includes('extension'))
  );
}

export function getTargetKgForUnit(unitName: string, defaultVal: number = 15000): number {
  const config = getUnitConfigByName(unitName);
  return config ? Number(config.productionCapacity) : defaultVal;
}

export function getTotalMachinesForUnit(unitName: string, defaultVal: number = 30): number {
  const config = getUnitConfigByName(unitName);
  return config ? Number(config.totalMachine) : defaultVal;
}

export function getAvgProdPerMachineForUnit(unitName: string, defaultVal: number = 350): number {
  const config = getUnitConfigByName(unitName);
  if (config) {
    if (config.avgProdPerMachine > 0) return Number(config.avgProdPerMachine);
    if (config.totalMachine > 0 && config.productionCapacity > 0) {
      return Number((config.productionCapacity / config.totalMachine).toFixed(2));
    }
  }
  return defaultVal;
}

export function getProductionCapacityForUnit(unitName: string, defaultVal: number = 15000): number {
  const config = getUnitConfigByName(unitName);
  return config ? Number(config.productionCapacity) : defaultVal;
}
