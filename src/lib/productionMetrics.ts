/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LedgerRecord } from '../types';
import { 
  getUnitConfigs, 
  getProductionCapacityForUnit, 
  getAvgProdPerMachineForUnit, 
  getTotalMachinesForUnit,
  getInHouseTotalDailyCapacity,
  getEffectiveDailyCapacity
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
 * Calculates effective days in the given period:
 * - Single Date: 1 day
 * - Date Range: (dateTo - dateFrom) in days + 1 (e.g. 26 Aug to 27 Aug = 2 days, 26 to 28 = 3 days)
 * - Month Scope / Other Filters: Exact count of unique active dates with records in that period
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

  const distinctDates = new Set(records.map(r => r.date).filter(Boolean));
  return Math.max(1, distinctDates.size);
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
 * Calculates Total Planned Period Capacity in Kg:
 * Formula: Daily Capacity * Effective Days
 * (e.g. 50K * 1 day = 50K, 50K * 2 days = 100K, 50K * 3 days = 150K)
 */
export function calculateLedgerPeriodCapacity(
  appliedUnit: string = 'all',
  effectiveDays: number = 1
): number {
  const dailyCapacity = getEffectiveDailyCapacity(appliedUnit);
  return dailyCapacity * Math.max(1, effectiveDays);
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

  const periodTotalCapacity = calculateLedgerPeriodCapacity(appliedUnit, effectiveDays);

  if (totalInHouseProd > 0 && periodTotalCapacity > 0) {
    return parseFloat(((totalInHouseProd / periodTotalCapacity) * 100).toFixed(2));
  }
  return 0;
}
