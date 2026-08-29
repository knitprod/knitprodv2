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
  { id: 'unit-ekl', unitName: 'EKL', productionCapacity: 7500, totalMachine: 29, avgProdPerMachine: 230 },
  { id: 'unit-efl', unitName: 'EFL', productionCapacity: 12500, totalMachine: 40, avgProdPerMachine: 230 },
  { id: 'unit-efl2', unitName: 'EFL-2', productionCapacity: 12000, totalMachine: 35, avgProdPerMachine: 280 },
  { id: 'unit-autostripe', unitName: 'Auto Stripe', productionCapacity: 4000, totalMachine: 20, avgProdPerMachine: 120 },
  { id: 'unit-eflext', unitName: 'EFL-Extension', productionCapacity: 8000, totalMachine: 25, avgProdPerMachine: 180 },
  { id: 'unit-eslext', unitName: 'ESL-Extension', productionCapacity: 6000, totalMachine: 16, avgProdPerMachine: 200 },
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
        // Sanitize any outdated cached EKL count of 30 to the correct 29
        return parsed.map((item: UnitThresholdConfig) => {
          if (item.unitName.toUpperCase() === 'EKL') {
            return { ...item, totalMachine: 29 };
          }
          return item;
        });
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
    const sanitized = configs.map(c => c.unitName.toUpperCase() === 'EKL' ? { ...c, totalMachine: 29 } : c);
    localStorage.setItem(UNIT_STORAGE_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent('unit_configs_updated', { detail: sanitized }));
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

export function getTotalMachinesForUnit(unitName: string, defaultVal?: number): number {
  const normalized = (unitName || '').trim().toLowerCase();
  if (normalized === 'ekl') return 29;
  
  const config = getUnitConfigByName(unitName);
  if (config && config.totalMachine !== undefined && config.totalMachine !== null) {
    const val = Number(config.totalMachine);
    if (!isNaN(val) && val > 0) return val;
  }
  if (defaultVal !== undefined && defaultVal > 0) return defaultVal;
  
  if (normalized === 'efl') return 40;
  if (normalized === 'efl-2' || normalized === 'efl2') return 35;
  if (normalized.includes('stripe')) return 20;
  if (normalized.includes('efl-ext') || normalized === 'extension') return 25;
  if (normalized.includes('esl-ext')) return 16;
  if (normalized.includes('sub')) return 153;
  return 29;
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

export function getProductionCapacityForUnit(unitName: string, defaultVal: number = 10000): number {
  const config = getUnitConfigByName(unitName);
  return config ? Number(config.productionCapacity) : defaultVal;
}

export function getInHouseTotalDailyCapacity(): number {
  const configs = getUnitConfigs();
  const inHouseConfigs = configs.filter(u => !u.unitName.toLowerCase().includes('sub'));
  const sum = inHouseConfigs.reduce((acc, u) => acc + (Number(u.productionCapacity) || 0), 0);
  return sum > 0 ? sum : 50000;
}

export function getEffectiveDailyCapacity(unitFilter?: string): number {
  if (unitFilter && unitFilter !== 'all' && !unitFilter.toLowerCase().includes('in-house')) {
    return getProductionCapacityForUnit(unitFilter, 10000);
  }
  return getInHouseTotalDailyCapacity();
}

