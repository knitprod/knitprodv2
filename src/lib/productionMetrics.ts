/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LedgerRecord } from '../types';
import { 
  getUnitConfigs, 
  getProductionCapacityForUnit, 
  getAvgProdPerMachineForUnit, 
  getTotalMachinesForUnit 
} from './unitStore';

// In-House Floor standard multipliers fallback (Kg / Machine / Day)
export const FLOOR_MULTIPLIERS: Record<string, number> = {
  ekl: 230,
  efl: 230,
  efl2: 280,
  autostripe: 120,
  eflextension: 180,
  extension: 180,
  eslextension: 200,
};

export const getFloorMultiplier = (fName: string): number => {
  const clean = (fName || '').trim().toLowerCase().replace(/[-\s_]/g, '');
  if (FLOOR_MULTIPLIERS[clean] !== undefined) return FLOOR_MULTIPLIERS[clean];
  return getAvgProdPerMachineForUnit(fName, 230);
};

export function isSubContactRecord(r: LedgerRecord): boolean {
  if (!r) return false;
  const unit = (r.unit || '').trim().toLowerCase();
  const floor = (r.floor || '').trim().toLowerCase();
  const remarks = (r.remarks || '').trim().toLowerCase();
  return unit === 'sub-contact' || floor === 'sub-contact' || remarks.includes('sub-contact');
}

/**
 * Calculates effective days in the given period matching Production Ledger logic:
 * - Single Date: 1 day
 * - Date Range: (to - from) in days + 1
 * - Month Scope / Default: Latest day of the month with data (e.g. 26 for Aug 26), or distinct dates count
 */
export function calculateEffectiveDays(
  records: LedgerRecord[],
  filterState?: { dateMode?: string; singleDate?: string; dateFrom?: string; dateTo?: string; month?: string; year?: string }
): number {
  if (filterState) {
    if (filterState.dateMode === 'single' || (filterState.singleDate && !filterState.dateFrom && !filterState.dateTo)) {
      return 1;
    }
    if (filterState.dateMode === 'range' && filterState.dateFrom && filterState.dateTo) {
      const d1 = new Date(filterState.dateFrom).getTime();
      const d2 = new Date(filterState.dateTo).getTime();
      if (!isNaN(d1) && !isNaN(d2)) {
        return Math.max(1, Math.round((d2 - d1) / (1000 * 3600 * 24)) + 1);
      }
    }
  }

  const datesInPeriod = records.map(r => r.date).filter(Boolean) as string[];
  if (datesInPeriod.length === 0) return 1;

  const maxDay = datesInPeriod.reduce((max, d) => {
    const parts = d.split('-');
    const day = parts.length === 3 ? parseInt(parts[2], 10) : 0;
    return Math.max(max, isNaN(day) ? 0 : day);
  }, 0);

  return maxDay > 0 ? maxDay : Math.max(1, new Set(datesInPeriod).size);
}

/**
 * Calculates Efficiency % identical to Production Ledger:
 * Formula: (Total In-House Bulk Production / Total In-House Target Bulk) * 100
 * With individual row override if single record has pre-calculated efficiency.
 */
export function calculateLedgerEfficiency(
  inHouseRecords: LedgerRecord[],
  subContactRecords: LedgerRecord[] = [],
  appliedUnit: string = 'all'
): number {
  // If explicitly filtered to Sub-Contact or only sub-contact records exist:
  const isOnlySubContact = appliedUnit.toLowerCase().includes('sub') || (inHouseRecords.length === 0 && subContactRecords.length > 0);
  if (isOnlySubContact) {
    const scTarget = subContactRecords.reduce((sum, r) => {
      const b = r.targetBulk !== undefined && r.targetBulk !== null && Number(r.targetBulk) > 0 
        ? Number(r.targetBulk) 
        : (Number(r.target) || 0);
      return sum + (Number.isNaN(b) ? 0 : b);
    }, 0);
    const scBulk = subContactRecords.reduce((sum, r) => {
      const b = r.bulkProd !== undefined && r.bulkProd !== null ? Number(r.bulkProd) : (Number(r.totalProduction) || 0);
      return sum + (Number.isNaN(b) ? 0 : b);
    }, 0);
    return scTarget > 0 ? parseFloat(((scBulk / scTarget) * 100).toFixed(2)) : 0;
  }

  if (inHouseRecords.length === 0) return 0;

  // Single record pre-calculated efficiency priority
  if (inHouseRecords.length === 1 && inHouseRecords[0].efficiency !== undefined && inHouseRecords[0].efficiency !== null && Number(inHouseRecords[0].efficiency) > 0) {
    return parseFloat(Number(inHouseRecords[0].efficiency).toFixed(2));
  }

  let totalInHouseBulkProd = 0;
  let totalInHouseTargetBulk = 0;

  inHouseRecords.forEach((r) => {
    const b = r.bulkProd !== undefined && r.bulkProd !== null 
      ? Number(r.bulkProd) 
      : Math.max(0, Number(r.totalProduction || 0) - Number(r.sampleProd || 0));
    totalInHouseBulkProd += (Number.isNaN(b) ? 0 : b);

    let tBulk = 0;
    if (r.targetBulk !== undefined && r.targetBulk !== null && Number(r.targetBulk) > 0) {
      tBulk = Number(r.targetBulk);
    } else {
      const mult = getFloorMultiplier(r.floor || r.unit || '');
      const rBulk = r.runningBulk !== undefined && r.runningBulk !== null 
        ? Number(r.runningBulk) 
        : Math.max(0, (Number(r.runningMachine) || 0) - (Number(r.runningSample) || 0));
      tBulk = rBulk * mult;
    }
    totalInHouseTargetBulk += (Number.isNaN(tBulk) ? 0 : tBulk);
  });

  if (totalInHouseTargetBulk > 0) {
    return parseFloat(((totalInHouseBulkProd / totalInHouseTargetBulk) * 100).toFixed(2));
  }
  return 0;
}

/**
 * Calculates Capacity Utilization % identical to Production Ledger:
 * Formula: (Total In-House Production / (Active Unit(s) Daily Capacity * Effective Days)) * 100
 * With individual row override if single record has pre-calculated capacityUtilization.
 */
export function calculateLedgerCapacityUtilization(
  inHouseRecords: LedgerRecord[],
  appliedUnit: string = 'all',
  effectiveDays: number = 1
): number {
  if (inHouseRecords.length === 0) return 0;

  if (inHouseRecords.length === 1 && inHouseRecords[0].capacityUtilization !== undefined && inHouseRecords[0].capacityUtilization !== null && Number(inHouseRecords[0].capacityUtilization) > 0) {
    return parseFloat(Number(inHouseRecords[0].capacityUtilization).toFixed(2));
  }

  const totalInHouseProd = inHouseRecords.reduce((sum, r) => {
    const t = r.totalProduction !== undefined && r.totalProduction !== null && Number(r.totalProduction) > 0 
      ? Number(r.totalProduction) 
      : ((Number(r.shiftA) || 0) + (Number(r.shiftB) || 0) + (Number(r.shiftC) || 0) || (Number(r.bulkProd || 0) + Number(r.sampleProd || 0)));
    return sum + (Number.isNaN(t) ? 0 : t);
  }, 0);

  let totalDailyCapacity = 0;
  if (appliedUnit !== 'all' && !appliedUnit.toLowerCase().includes('in-house')) {
    totalDailyCapacity = getProductionCapacityForUnit(appliedUnit, 6350);
  } else {
    const distinctFloors = Array.from(new Set(inHouseRecords.map(r => r.floor).filter(Boolean))) as string[];
    if (distinctFloors.length > 0) {
      totalDailyCapacity = distinctFloors.reduce((sum: number, f: string) => sum + getProductionCapacityForUnit(f, 15000), 0);
    } else {
      const inHouseUnits = getUnitConfigs().filter(u => !u.unitName.toLowerCase().includes('sub'));
      totalDailyCapacity = inHouseUnits.reduce((sum, u) => sum + Number(u.productionCapacity || 0), 0) || (inHouseRecords.length > 0 ? 74500 : 0);
    }
  }

  const periodTotalCapacity = totalDailyCapacity * Math.max(1, effectiveDays);

  if (totalInHouseProd > 0 && periodTotalCapacity > 0) {
    return parseFloat(((totalInHouseProd / periodTotalCapacity) * 100).toFixed(2));
  }
  return 0;
}
