/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Executive Unit-wise Analytics Cards
 * 1. Production Unitwise (Target Bulk vs Bulk Production vs Production Loss for Sample)
 * 2. Efficiency % (Canonical Ledger Calculation)
 * 3. Capacity Utilization % (Canonical Ledger Calculation)
 * 
 * Connected directly with Production Ledger Data & Dynamic Header Date Display
 */

import React, { useMemo, useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Gauge, 
  Calendar,
  Layers, 
  Info,
  ChevronRight
} from 'lucide-react';
import { useGlobalData } from '../context/GlobalDataContext';
import { LedgerRecord } from '../types';
import { FilterState } from './DashboardFilterToolbar';
import { 
  filterLedgerByState, 
  isRecordMatchingFloor, 
  isSubContactRecord,
  calculateLedgerEfficiency, 
  calculateLedgerCapacityUtilization,
  calculateEffectiveDays,
  getFloorMultiplier,
  getLast7Dates
} from '../lib/productionMetrics';

interface DashboardUnitwiseCardsProps {
  filterState?: FilterState;
}

interface UnitMetricData {
  key: string;
  unit: string;
  label: string;
  targetBulk: number;
  bulkProduction: number;
  sampleLoss: number;
  efficiencyPct: number;
  capacityUtilizationPct: number;
  hasLedgerData: boolean;
}

const formatDateFriendly = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthNum = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[monthNum - 1] || parts[1];
  return `${day} ${monthName} ${year}`;
};

const formatShortDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const monthNum = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[monthNum - 1] || parts[1];
  return `${day} ${monthName}`;
};

export default function DashboardUnitwiseCards({ filterState }: DashboardUnitwiseCardsProps) {
  const globalData = useGlobalData();
  const [hoveredUnit, setHoveredUnit] = useState<string | null>(null);

  const ledger = globalData?.ledger || [];

  const isUnitSelected = Boolean(filterState?.unit && filterState.unit.toLowerCase() !== 'all');
  const selectedUnitName = isUnitSelected ? filterState!.unit : '';

  // Compute 7 days if unit is selected
  const last7Dates = useMemo(() => {
    if (!isUnitSelected) return [];
    const explicitTargetDate = filterState?.dateTo || (filterState?.dateMode === 'single' ? filterState?.singleDate : '') || filterState?.dateFrom || '';
    return getLast7Dates(ledger, selectedUnitName, explicitTargetDate);
  }, [ledger, isUnitSelected, selectedUnitName, filterState]);

  // Determine active display date for Card Headers
  const activeDateDisplay = useMemo(() => {
    if (isUnitSelected && last7Dates.length > 0) {
      return `${formatShortDate(last7Dates[0])} – ${formatShortDate(last7Dates[last7Dates.length - 1])}`;
    }

    if (filterState?.dateMode === 'single' && filterState.singleDate) {
      return formatDateFriendly(filterState.singleDate);
    }
    if (filterState?.dateMode === 'range' && (filterState.dateFrom || filterState.dateTo)) {
      if (filterState.dateFrom && filterState.dateTo) {
        return `${formatDateFriendly(filterState.dateFrom)} – ${formatDateFriendly(filterState.dateTo)}`;
      }
      return formatDateFriendly(filterState.dateFrom || filterState.dateTo || '');
    }
    if (filterState?.dateMode === 'month' && filterState.month) {
      return `${filterState.month} ${filterState.year || ''}`.trim();
    }
    if (filterState?.dateMode === 'year' && filterState.year && filterState.year !== 'all') {
      return `Year ${filterState.year}`;
    }

    // Default: find the latest date from ledger records
    if (ledger.length > 0) {
      const dates = ledger
        .map(r => r.date)
        .filter((d): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d)))
        .sort();
      if (dates.length > 0) {
        const latest = dates[dates.length - 1];
        return formatDateFriendly(latest);
      }
    }

    return 'Latest Production';
  }, [filterState, ledger, isUnitSelected, last7Dates]);

  // Compute unit-wise OR Last 7 Days data dynamically connected directly with Production Ledger Data
  const unitData: UnitMetricData[] = useMemo(() => {
    if (!ledger || ledger.length === 0) {
      return [];
    }

    // SCENARIO A: A specific Unit is selected -> Show Last 7 Days for this unit
    if (isUnitSelected) {
      if (last7Dates.length === 0) return [];

      return last7Dates.map(date => {
        const rows = ledger.filter(r => {
          if (r.date !== date) return false;
          if (selectedUnitName.toLowerCase().includes('sub')) {
            return isSubContactRecord(r);
          }
          return isRecordMatchingFloor(r, selectedUnitName);
        });

        // 1. Target Bulk calculation
        let targetBulk = rows.reduce((sum, r) => {
          if (r.targetBulk !== undefined && r.targetBulk !== null && Number(r.targetBulk) > 0) {
            return sum + Number(r.targetBulk);
          }
          if (r.target !== undefined && r.target !== null && Number(r.target) > 0) {
            return sum + Number(r.target);
          }
          const mult = getFloorMultiplier(selectedUnitName);
          const rBulk = r.runningBulk !== undefined && r.runningBulk !== null 
            ? Number(r.runningBulk) 
            : Math.max(0, (Number(r.runningMachine) || 0) - (Number(r.runningSample) || 0));
          return sum + (rBulk * mult);
        }, 0);

        // 2. Bulk Production calculation
        const bulkProduction = rows.reduce((sum, r) => {
          const b = r.bulkProd !== undefined && r.bulkProd !== null
            ? Number(r.bulkProd)
            : Math.max(0, (Number(r.totalProduction) || 0) - (Number(r.sampleProd) || 0));
          return sum + (Number.isNaN(b) ? 0 : b);
        }, 0);

        // 3. Sample Loss calculation
        const sampleLoss = rows.reduce((sum, r) => {
          const l = r.prodLossForSample !== undefined && r.prodLossForSample !== null
            ? Number(r.prodLossForSample)
            : (Number(r.sampleProd) ? Math.round(Number(r.sampleProd) * 0.8) : 0);
          return sum + (Number.isNaN(l) ? 0 : l);
        }, 0);

        // 4. Efficiency % calculation
        let efficiencyPct = 0;
        const effFromCanonical = calculateLedgerEfficiency(rows, [], selectedUnitName);
        if (effFromCanonical > 0) {
          efficiencyPct = Math.round(effFromCanonical);
        } else if (targetBulk > 0 && bulkProduction > 0) {
          efficiencyPct = Math.min(100, Math.round((bulkProduction / targetBulk) * 100));
        } else {
          const validEffRows = rows.filter(r => r.efficiency !== undefined && Number(r.efficiency) > 0);
          if (validEffRows.length > 0) {
            const avg = validEffRows.reduce((sum, r) => {
              let v = Number(r.efficiency) || 0;
              if (v > 0 && v <= 1.5) v = v * 100;
              return sum + v;
            }, 0) / validEffRows.length;
            efficiencyPct = Math.round(avg);
          }
        }

        // 5. Capacity Utilization % calculation
        let capacityUtilizationPct = 0;
        const capFromCanonical = calculateLedgerCapacityUtilization(rows, selectedUnitName, 1);
        if (capFromCanonical > 0) {
          capacityUtilizationPct = Math.round(capFromCanonical);
        } else {
          const validCapRows = rows.filter(r => r.capacityUtilization !== undefined && Number(r.capacityUtilization) > 0);
          if (validCapRows.length > 0) {
            const avg = validCapRows.reduce((sum, r) => {
              let v = Number(r.capacityUtilization) || 0;
              if (v > 0 && v <= 1.5) v = v * 100;
              return sum + v;
            }, 0) / validCapRows.length;
            capacityUtilizationPct = Math.round(avg);
          } else {
            const runM = rows.reduce((sum, r) => sum + (Number(r.runningMachine) || 0), 0);
            const totM = rows.reduce((sum, r) => sum + (Number(r.totalMachines) || 0), 0);
            if (totM > 0 && runM > 0) {
              capacityUtilizationPct = Math.min(100, Math.round((runM / totM) * 100));
            }
          }
        }

        return {
          key: date,
          unit: date,
          label: formatShortDate(date),
          targetBulk: Math.round(targetBulk),
          bulkProduction: Math.round(bulkProduction),
          sampleLoss: Math.round(sampleLoss),
          efficiencyPct: Math.min(100, Math.max(0, efficiencyPct)),
          capacityUtilizationPct: Math.min(100, Math.max(0, capacityUtilizationPct)),
          hasLedgerData: rows.length > 0
        };
      });
    }

    // SCENARIO B: All Units overview
    const { filteredRows } = filterLedgerByState(ledger, filterState);
    if (!filteredRows || filteredRows.length === 0) {
      return [];
    }

    const effectiveDays = calculateEffectiveDays(filteredRows, filterState);

    const knownUnitDefinitions = [
      { key: 'ekl', name: 'EKL', matchKeys: ['ekl'] },
      { key: 'efl', name: 'EFL', matchKeys: ['efl', 'efl-1', 'efl 1'] },
      { key: 'efl-2', name: 'EFL-2', matchKeys: ['efl-2', 'efl2', 'efl 2'] },
      { key: 'auto', name: 'AUTO-STRIPE', matchKeys: ['auto', 'auto stripe', 'auto-stripe', 'autostripe'] },
      { key: 'efl-ext', name: 'EFL-EXTENSION', matchKeys: ['efl-extension', 'efl extension', 'efl-ext', 'eflextension', 'efl ext'] },
      { key: 'esl-ext', name: 'ESL-EXTENSION', matchKeys: ['esl-extension', 'esl extension', 'esl-ext', 'eslextension', 'esl ext', 'esl'] },
      { key: 'sub-contact', name: 'SUB-CONTACT', matchKeys: ['sub-contact', 'sub contact', 'subcontact', 'sub'] }
    ];

    const result: UnitMetricData[] = [];
    const matchedRecordIndices = new Set<number>();

    // Process all standard factory units
    for (const u of knownUnitDefinitions) {
      const matchingRowIndices: number[] = [];
      const rows: LedgerRecord[] = [];

      filteredRows.forEach((r, idx) => {
        const floor = (r.floor || '').trim().toLowerCase();
        const unit = (r.unit || '').trim().toLowerCase();
        
        // Exact unit exclusion guards
        if (u.key === 'efl') {
          if (floor.includes('ext') || floor.includes('2') || unit.includes('ext') || unit.includes('2')) {
            return;
          }
        }

        if (u.key === 'efl-ext') {
          if (floor.includes('esl') || unit.includes('esl')) {
            return;
          }
          if (floor === 'extension' || floor === 'efl-extension' || floor === 'efl extension' || floor === 'efl-ext' || unit === 'efl-extension') {
            matchingRowIndices.push(idx);
            rows.push(r);
            return;
          }
        }

        if (u.key === 'esl-ext') {
          if (floor.includes('esl') || unit.includes('esl')) {
            matchingRowIndices.push(idx);
            rows.push(r);
            return;
          }
        }

        if (u.key === 'sub-contact' || u.key === 'sub') {
          if (isSubContactRecord(r)) {
            matchingRowIndices.push(idx);
            rows.push(r);
            return;
          }
        }

        const isMatch = u.matchKeys.some(k => floor === k || unit === k || floor.includes(k) || isRecordMatchingFloor(r, u.name));
        if (isMatch) {
          matchingRowIndices.push(idx);
          rows.push(r);
        }
      });

      matchingRowIndices.forEach(i => matchedRecordIndices.add(i));

      // 1. Target Bulk calculation from ledger
      let targetBulk = rows.reduce((sum, r) => {
        if (r.targetBulk !== undefined && r.targetBulk !== null && Number(r.targetBulk) > 0) {
          return sum + Number(r.targetBulk);
        }
        if (r.target !== undefined && r.target !== null && Number(r.target) > 0) {
          return sum + Number(r.target);
        }
        const mult = getFloorMultiplier(u.name);
        const rBulk = r.runningBulk !== undefined && r.runningBulk !== null 
          ? Number(r.runningBulk) 
          : Math.max(0, (Number(r.runningMachine) || 0) - (Number(r.runningSample) || 0));
        return sum + (rBulk * mult);
      }, 0);

      // 2. Bulk Production calculation from ledger
      const bulkProduction = rows.reduce((sum, r) => {
        const b = r.bulkProd !== undefined && r.bulkProd !== null
          ? Number(r.bulkProd)
          : Math.max(0, (Number(r.totalProduction) || 0) - (Number(r.sampleProd) || 0));
        return sum + (Number.isNaN(b) ? 0 : b);
      }, 0);

      // 3. Sample Loss calculation from ledger
      const sampleLoss = rows.reduce((sum, r) => {
        const l = r.prodLossForSample !== undefined && r.prodLossForSample !== null
          ? Number(r.prodLossForSample)
          : (Number(r.sampleProd) ? Math.round(Number(r.sampleProd) * 0.8) : 0);
        return sum + (Number.isNaN(l) ? 0 : l);
      }, 0);

      // 4. Efficiency % calculation from ledger
      let efficiencyPct = 0;
      const effFromCanonical = calculateLedgerEfficiency(rows, [], u.name);
      if (effFromCanonical > 0) {
        efficiencyPct = Math.round(effFromCanonical);
      } else if (targetBulk > 0 && bulkProduction > 0) {
        efficiencyPct = Math.min(100, Math.round((bulkProduction / targetBulk) * 100));
      } else {
        const validEffRows = rows.filter(r => r.efficiency !== undefined && Number(r.efficiency) > 0);
        if (validEffRows.length > 0) {
          const avg = validEffRows.reduce((sum, r) => {
            let v = Number(r.efficiency) || 0;
            if (v > 0 && v <= 1.5) v = v * 100;
            return sum + v;
          }, 0) / validEffRows.length;
          efficiencyPct = Math.round(avg);
        } else {
          efficiencyPct = 0;
        }
      }

      // 5. Capacity Utilization % calculation from ledger
      let capacityUtilizationPct = 0;
      const capFromCanonical = calculateLedgerCapacityUtilization(rows, u.name, effectiveDays);
      if (capFromCanonical > 0) {
        capacityUtilizationPct = Math.round(capFromCanonical);
      } else {
        const validCapRows = rows.filter(r => r.capacityUtilization !== undefined && Number(r.capacityUtilization) > 0);
        if (validCapRows.length > 0) {
          const avg = validCapRows.reduce((sum, r) => {
            let v = Number(r.capacityUtilization) || 0;
            if (v > 0 && v <= 1.5) v = v * 100;
            return sum + v;
          }, 0) / validCapRows.length;
          capacityUtilizationPct = Math.round(avg);
        } else {
          const runM = rows.reduce((sum, r) => sum + (Number(r.runningMachine) || 0), 0);
          const totM = rows.reduce((sum, r) => sum + (Number(r.totalMachines) || 0), 0);
          if (totM > 0 && runM > 0) {
            capacityUtilizationPct = Math.min(100, Math.round((runM / totM) * 100));
          } else {
            capacityUtilizationPct = 0;
          }
        }
      }

      result.push({
        key: u.key,
        unit: u.name,
        label: u.name,
        targetBulk: Math.round(targetBulk),
        bulkProduction: Math.round(bulkProduction),
        sampleLoss: Math.round(sampleLoss),
        efficiencyPct: Math.min(100, Math.max(0, efficiencyPct)),
        capacityUtilizationPct: Math.min(100, Math.max(0, capacityUtilizationPct)),
        hasLedgerData: rows.length > 0
      });
    }

    // Also check remaining rows with distinct unit/floor names
    const remainingRowsWithIndex = filteredRows
      .map((r, idx) => ({ r, idx }))
      .filter(({ idx }) => !matchedRecordIndices.has(idx));

    if (remainingRowsWithIndex.length > 0) {
      const remainingGroups: Record<string, LedgerRecord[]> = {};
      remainingRowsWithIndex.forEach(({ r }) => {
        const rawName = (r.floor || r.unit || '').trim();
        if (!rawName) return;
        const name = rawName.toUpperCase();
        if (!remainingGroups[name]) remainingGroups[name] = [];
        remainingGroups[name].push(r);
      });

      Object.entries(remainingGroups).forEach(([name, rows]) => {
        if (rows.length === 0) return;

        const totProd = rows.reduce((sum, r) => sum + (Number(r.totalProduction) || 0), 0);
        const bProd = rows.reduce((sum, r) => sum + (Number(r.bulkProd) || 0), 0);
        const tBulk = rows.reduce((sum, r) => sum + (Number(r.targetBulk) || Number(r.target) || 0), 0);
        const runMachines = rows.reduce((sum, r) => sum + (Number(r.runningMachine) || 0), 0);

        if (totProd === 0 && bProd === 0 && tBulk === 0 && runMachines === 0) {
          return;
        }

        let targetBulk = rows.reduce((sum, r) => {
          if (r.targetBulk !== undefined && r.targetBulk !== null && Number(r.targetBulk) > 0) {
            return sum + Number(r.targetBulk);
          }
          if (r.target !== undefined && r.target !== null && Number(r.target) > 0) {
            return sum + Number(r.target);
          }
          const mult = getFloorMultiplier(name);
          const rBulk = r.runningBulk !== undefined && r.runningBulk !== null 
            ? Number(r.runningBulk) 
            : Math.max(0, (Number(r.runningMachine) || 0) - (Number(r.runningSample) || 0));
          return sum + (rBulk * mult);
        }, 0);

        const bulkProduction = rows.reduce((sum, r) => {
          const b = r.bulkProd !== undefined && r.bulkProd !== null
            ? Number(r.bulkProd)
            : Math.max(0, (Number(r.totalProduction) || 0) - (Number(r.sampleProd) || 0));
          return sum + (Number.isNaN(b) ? 0 : b);
        }, 0);

        const sampleLoss = rows.reduce((sum, r) => {
          const l = r.prodLossForSample !== undefined && r.prodLossForSample !== null
            ? Number(r.prodLossForSample)
            : (Number(r.sampleProd) ? Math.round(Number(r.sampleProd) * 0.8) : 0);
          return sum + (Number.isNaN(l) ? 0 : l);
        }, 0);

        let efficiencyPct = 0;
        const effFromCanonical = calculateLedgerEfficiency(rows, [], name);
        if (effFromCanonical > 0) {
          efficiencyPct = Math.round(effFromCanonical);
        } else if (targetBulk > 0 && bulkProduction > 0) {
          efficiencyPct = Math.min(100, Math.round((bulkProduction / targetBulk) * 100));
        } else {
          const validEffRows = rows.filter(r => r.efficiency !== undefined && Number(r.efficiency) > 0);
          if (validEffRows.length > 0) {
            const avg = validEffRows.reduce((sum, r) => {
              let v = Number(r.efficiency) || 0;
              if (v > 0 && v <= 1.5) v = v * 100;
              return sum + v;
            }, 0) / validEffRows.length;
            efficiencyPct = Math.round(avg);
          }
        }

        let capacityUtilizationPct = 0;
        const capFromCanonical = calculateLedgerCapacityUtilization(rows, name, effectiveDays);
        if (capFromCanonical > 0) {
          capacityUtilizationPct = Math.round(capFromCanonical);
        } else {
          const validCapRows = rows.filter(r => r.capacityUtilization !== undefined && Number(r.capacityUtilization) > 0);
          if (validCapRows.length > 0) {
            const avg = validCapRows.reduce((sum, r) => {
              let v = Number(r.capacityUtilization) || 0;
              if (v > 0 && v <= 1.5) v = v * 100;
              return sum + v;
            }, 0) / validCapRows.length;
            capacityUtilizationPct = Math.round(avg);
          } else {
            const runM = rows.reduce((sum, r) => sum + (Number(r.runningMachine) || 0), 0);
            const totM = rows.reduce((sum, r) => sum + (Number(r.totalMachines) || 0), 0);
            if (totM > 0 && runM > 0) {
              capacityUtilizationPct = Math.min(100, Math.round((runM / totM) * 100));
            }
          }
        }

        result.push({
          key: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          unit: name,
          label: name,
          targetBulk: Math.round(targetBulk),
          bulkProduction: Math.round(bulkProduction),
          sampleLoss: Math.round(sampleLoss),
          efficiencyPct: Math.min(100, Math.max(0, efficiencyPct)),
          capacityUtilizationPct: Math.min(100, Math.max(0, capacityUtilizationPct)),
          hasLedgerData: true
        });
      });
    }

    return result;
  }, [ledger, filterState, isUnitSelected, selectedUnitName, last7Dates]);

  // In-House units only for Efficiency and Capacity Utilization (Sub-Contact is external contract production)
  const inHouseUnitData = useMemo(() => {
    return unitData.filter(u => {
      const k = (u.key || '').toLowerCase();
      const n = (u.unit || '').toLowerCase();
      return !k.includes('sub') && !n.includes('sub');
    });
  }, [unitData]);

  // Overall totals and Canonical Efficiency / Capacity (Identical to Top KPI HUD Cards)
  const totalTargetBulk = useMemo(() => unitData.reduce((sum, u) => sum + u.targetBulk, 0), [unitData]);
  const totalBulkProd = useMemo(() => unitData.reduce((sum, u) => sum + u.bulkProduction, 0), [unitData]);

  const canonicalMetrics = useMemo(() => {
    if (!ledger || ledger.length === 0) return { efficiency: 0, capacity: 0 };
    const { filteredRows } = filterLedgerByState(ledger, filterState);
    if (!filteredRows || filteredRows.length === 0) return { efficiency: 0, capacity: 0 };

    const ihRows = filteredRows.filter(r => !isSubContactRecord(r));
    const scRows = filteredRows.filter(r => isSubContactRecord(r));
    const appliedUnit = filterState?.unit || 'all';
    const effectiveDays = calculateEffectiveDays(filteredRows, filterState);

    const eff = calculateLedgerEfficiency(ihRows, scRows, appliedUnit);
    const cap = calculateLedgerCapacityUtilization(ihRows, appliedUnit, effectiveDays);

    return {
      efficiency: eff,
      capacity: cap,
    };
  }, [ledger, filterState]);

  // Max value calculation for Bar Chart scaling
  const maxBarValue = useMemo(() => {
    const maxVal = Math.max(...unitData.map(u => Math.max(u.targetBulk, u.bulkProduction, u.sampleLoss)), 12000);
    return Math.ceil(maxVal / 2500) * 2500;
  }, [unitData]);

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-4.5 my-4" id="dashboard-unitwise-overview-cards">
      {/* ---------------------------------------------------- */}
      {/* CARD 1: Production Unitwise (Grouped Bar Chart)       */}
      {/* ---------------------------------------------------- */}
      <div 
        className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
        id="card-production-unitwise"
      >
        {/* Card Header with Date in Header & Total Prod */}
        <div className="bg-gradient-to-r from-[#B95D18] via-[#C96B20] to-[#A34E0F] text-white px-4 py-2.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-white/15 backdrop-blur-xs">
              <BarChart3 className="w-4 h-4 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base tracking-tight text-white leading-tight">
                  {isUnitSelected ? `${selectedUnitName} Production Trend` : 'Production Unitwise'}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
                  <Calendar className="w-2.5 h-2.5" />
                  {activeDateDisplay}
                </span>
              </div>
              <p className="text-[10px] text-amber-100/90 font-medium">
                {isUnitSelected ? 'Daily 7-Day Target vs Bulk Output vs Loss' : 'Target vs Bulk Output vs Loss'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
              Prod: {totalBulkProd.toLocaleString()} Kg
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="pt-2.5 px-3.5 pb-1 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {isUnitSelected ? 'Daily Metrics (Kg)' : 'Unit Metrics (Kg)'}
          </span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#0F4C75] inline-block shadow-2xs"></span>
              <span className="text-slate-600 dark:text-slate-300">Target Bulk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#E67E22] inline-block shadow-2xs"></span>
              <span className="text-slate-600 dark:text-slate-300">Bulk Prod</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#16A34A] inline-block shadow-2xs"></span>
              <span className="text-slate-600 dark:text-slate-300">Sample Loss</span>
            </div>
          </div>
        </div>

        {/* Bar Chart Area with Numbers displayed directly */}
        <div className="p-3 sm:p-4 flex-1 flex flex-col justify-end">
          {unitData.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-6 h-[225px] text-slate-400 dark:text-slate-500">
              <Layers className="w-7 h-7 mb-2 opacity-40 text-[#B95D18]" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Unit Data in Ledger</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-[200px]">
                No production ledger entries found for the selected unit/date criteria.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto scrollbar-none">
              <div className="w-full min-w-[340px] h-[225px] relative flex">
                {/* Y-Axis scale */}
                <div className="w-11 sm:w-12 h-[180px] flex flex-col justify-between items-end pr-1.5 sm:pr-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 select-none pb-5 border-r border-slate-200 dark:border-slate-800">
                  <span>{(maxBarValue).toLocaleString()}</span>
                  <span>{Math.round(maxBarValue * 0.66).toLocaleString()}</span>
                  <span>{Math.round(maxBarValue * 0.33).toLocaleString()}</span>
                  <span>0</span>
                </div>

                {/* Bars container */}
                <div className="flex-1 h-[180px] flex items-end justify-between px-1 sm:px-2 pt-6 relative border-b border-slate-200 dark:border-slate-800">
                  {/* Horizontal reference lines */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between opacity-30 pb-5">
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-slate-300 dark:border-slate-700"></div>
                  </div>

                  {unitData.map((item) => {
                    const targetH = Math.min(100, Math.max(3, (item.targetBulk / maxBarValue) * 100));
                    const prodH = Math.min(100, Math.max(3, (item.bulkProduction / maxBarValue) * 100));
                    const lossH = item.sampleLoss > 0 
                      ? Math.min(100, Math.max(2, (item.sampleLoss / maxBarValue) * 100)) 
                      : 0;
                    const isHovered = hoveredUnit === item.unit;

                    return (
                      <div 
                        key={item.unit}
                        className={`flex-1 flex flex-col items-center justify-end h-full px-0.5 group cursor-pointer transition-all duration-150 rounded-t-lg ${
                          isHovered ? 'bg-amber-500/10 dark:bg-amber-400/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                        onMouseEnter={() => setHoveredUnit(item.unit)}
                        onMouseLeave={() => setHoveredUnit(null)}
                        title={`${item.unit}\n• Target Bulk: ${(item.targetBulk ?? 0).toLocaleString()} Kg\n• Bulk Production: ${(item.bulkProduction ?? 0).toLocaleString()} Kg\n• Sample Loss: ${(item.sampleLoss ?? 0).toLocaleString()} Kg\n• Achievement: ${Math.round(((item.bulkProduction ?? 0) / (item.targetBulk || 1)) * 100)}%`}
                      >
                        {/* Grouped 3 Bars */}
                        <div className="w-full flex items-end justify-center gap-[2px] sm:gap-[3px] h-full pb-0.5">
                          {/* 1. Target Bulk Bar */}
                          <div className="flex flex-col items-center justify-end h-full w-[10px] sm:w-[13px] relative">
                            <span className="text-[7px] sm:text-[7.5px] font-bold text-slate-700 dark:text-slate-300 select-none absolute -top-4.5 whitespace-nowrap z-10 transition-transform group-hover:scale-110">
                              {item.targetBulk >= 1000 ? `${(item.targetBulk / 1000).toFixed(item.targetBulk % 1000 === 0 ? 0 : 1)}k` : item.targetBulk}
                            </span>
                            <div 
                              className="w-full bg-[#0F4C75] hover:bg-[#155e91] rounded-t-xs transition-all duration-200 shadow-xs"
                              style={{ height: `${targetH}%` }}
                            ></div>
                          </div>

                          {/* 2. Bulk Production Bar */}
                          <div className="flex flex-col items-center justify-end h-full w-[10px] sm:w-[13px] relative">
                            <span className="text-[7px] sm:text-[7.5px] font-extrabold text-[#D35400] dark:text-[#E67E22] select-none absolute -top-4.5 whitespace-nowrap z-10 transition-transform group-hover:scale-110">
                              {item.bulkProduction >= 1000 ? `${(item.bulkProduction / 1000).toFixed(item.bulkProduction % 1000 === 0 ? 0 : 1)}k` : item.bulkProduction}
                            </span>
                            <div 
                              className="w-full bg-[#E67E22] hover:bg-[#f38c30] rounded-t-xs transition-all duration-200 shadow-xs"
                              style={{ height: `${prodH}%` }}
                            ></div>
                          </div>

                          {/* 3. Production Loss For Sample Bar */}
                          <div className="flex flex-col items-center justify-end h-full w-[10px] sm:w-[13px] relative">
                            {item.sampleLoss > 0 && (
                              <span className="text-[7px] sm:text-[7.5px] font-bold text-[#15803D] dark:text-[#22c55e] select-none absolute -top-4.5 whitespace-nowrap z-10 transition-transform group-hover:scale-110">
                                {item.sampleLoss >= 1000 ? `${(item.sampleLoss / 1000).toFixed(1)}k` : item.sampleLoss}
                              </span>
                            )}
                            <div 
                              className="w-full bg-[#16A34A] hover:bg-[#22c55e] rounded-t-xs transition-all duration-200 shadow-xs"
                              style={{ height: `${lossH}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* X-Axis Unit Label */}
                        <div className="w-full text-center mt-2 pt-1 border-t border-transparent">
                          <span className={`text-[8.5px] sm:text-[9.5px] font-bold uppercase tracking-tight block truncate transition-colors ${
                            isHovered ? 'text-amber-600 dark:text-amber-400 font-extrabold' : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {item.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* CARD 2: Efficiency % (Line Chart with Diamonds)      */}
      {/* ---------------------------------------------------- */}
      <div 
        className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
        id="card-efficiency-pct"
      >
        {/* Card Header with Date in Header & Avg Efficiency */}
        <div className="bg-gradient-to-r from-[#B95D18] via-[#C96B20] to-[#A34E0F] text-white px-4 py-2.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-white/15 backdrop-blur-xs">
              <TrendingUp className="w-4 h-4 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base tracking-tight text-white leading-tight">
                  {isUnitSelected ? `${selectedUnitName} Efficiency %` : 'Efficiency %'}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
                  <Calendar className="w-2.5 h-2.5" />
                  {activeDateDisplay}
                </span>
              </div>
              <p className="text-[10px] text-amber-100/90 font-medium">
                {isUnitSelected ? 'Daily 7-Day Output vs Planned Capacity' : 'Output vs Planned Capacity'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
              Overall: {canonicalMetrics.efficiency.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Legend / Sub-header */}
        <div className="pt-2.5 px-3.5 pb-1 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Target Standard: 85.0%</span>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0F4C75] inline-block"></span>
            <span>Efficiency Trend</span>
          </div>
        </div>

        {/* Line Chart Area */}
        <div className="p-3 sm:p-4 flex-1 flex flex-col justify-end">
          {inHouseUnitData.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-6 h-[225px] text-slate-400 dark:text-slate-500">
              <Layers className="w-7 h-7 mb-2 opacity-40 text-[#B95D18]" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Unit Data in Ledger</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-[200px]">
                No production ledger entries found for the selected unit/date criteria.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto scrollbar-none">
              <div className="min-w-[320px] h-[225px] relative flex">
                {/* Y-Axis scale */}
                <div className="w-11 h-[160px] relative select-none border-r border-slate-200 dark:border-slate-800">
                  <div className="absolute top-[30px] bottom-[15px] left-0 right-0 flex flex-col justify-between items-end pr-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    <span>100%</span>
                    <span>80%</span>
                    <span>60%</span>
                    <span>40%</span>
                    <span>20%</span>
                    <span>0%</span>
                  </div>
                </div>

                {/* SVG Line Chart Canvas */}
                <div className="flex-1 h-[160px] relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 320 160" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="effGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0F4C75" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#0F4C75" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0, 20, 40, 60, 80, 100].map((pct) => {
                      const y = 145 - (pct / 100) * 110;
                      return (
                        <line 
                          key={`eff-grid-${pct}`} 
                          x1="0" 
                          y1={y} 
                          x2="320" 
                          y2={y} 
                          stroke="#cbd5e1" 
                          strokeWidth="0.75" 
                          strokeDasharray={pct === 0 ? 'none' : '3,3'} 
                          className="dark:stroke-slate-800"
                          opacity={pct === 0 ? 0.9 : 0.45} 
                        />
                      );
                    })}

                    {/* Area Fill */}
                    {(() => {
                      if (inHouseUnitData.length === 1) {
                        const y = 145 - (Math.min(100, Math.max(0, inHouseUnitData[0].efficiencyPct)) / 100) * 110;
                        return (
                          <polygon
                            fill="url(#effGradient)"
                            points={`130,145 130,${y} 190,${y} 190,145`}
                          />
                        );
                      }
                      const step = 320 / inHouseUnitData.length;
                      const points = inHouseUnitData.map((d, i) => {
                        const x = i * step + step / 2;
                        const y = 145 - (Math.min(100, Math.max(0, d.efficiencyPct)) / 100) * 110;
                        return `${x},${y}`;
                      }).join(' ');

                      const firstX = step / 2;
                      const lastX = (inHouseUnitData.length - 1) * step + step / 2;
                      const areaPoints = `${firstX},145 ${points} ${lastX},145`;

                      return (
                        <polygon
                          fill="url(#effGradient)"
                          points={areaPoints}
                        />
                      );
                    })()}

                    {/* Connected Polyline */}
                    {(() => {
                      if (inHouseUnitData.length <= 1) return null;
                      const step = 320 / inHouseUnitData.length;
                      const points = inHouseUnitData.map((d, i) => {
                        const x = i * step + step / 2;
                        const y = 145 - (Math.min(100, Math.max(0, d.efficiencyPct)) / 100) * 110;
                        return `${x},${y}`;
                      }).join(' ');

                      return (
                        <polyline
                          fill="none"
                          stroke="#0F4C75"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={points}
                        />
                      );
                    })()}
                  </svg>

                  {/* Crisp HTML Data Point Markers & Top Percentage Badges */}
                  {inHouseUnitData.map((d, i) => {
                    const pctX = inHouseUnitData.length === 1 ? 50 : ((i + 0.5) / inHouseUnitData.length) * 100;
                    const yPx = 145 - (Math.min(100, Math.max(0, d.efficiencyPct)) / 100) * 110;
                    const isHovered = hoveredUnit === d.unit;

                    return (
                      <div
                        key={`eff-marker-${d.unit}`}
                        className="absolute flex items-center justify-center cursor-pointer group z-10"
                        style={{ left: `${pctX}%`, top: `${yPx}px`, transform: 'translate(-50%, -50%)' }}
                        onMouseEnter={() => setHoveredUnit(d.unit)}
                        onMouseLeave={() => setHoveredUnit(null)}
                      >
                        {/* High-Contrast Non-Stretched Percentage Pill Badge */}
                        <div 
                          className={`absolute bottom-full mb-1.5 px-1.5 py-0.5 rounded-md border text-[9px] font-black tracking-tight select-none shadow-xs transition-all whitespace-nowrap pointer-events-none ${
                            isHovered
                              ? 'bg-[#0F4C75] text-white border-[#0F4C75] scale-110 shadow-sm z-20'
                              : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-[#0F4C75]/60 dark:border-[#0F4C75] z-10'
                          }`}
                        >
                          {d.efficiencyPct}%
                        </div>

                        {/* Yellow Diamond Point Marker exactly on line vertex */}
                        <div 
                          className={`w-2.5 h-2.5 rotate-45 border-[2px] transition-transform duration-150 shadow-2xs ${
                            isHovered
                              ? 'bg-amber-400 border-[#0F4C75] scale-125'
                              : 'bg-[#F6D000] border-[#0F4C75]'
                          }`}
                        />
                      </div>
                    );
                  })}

                  {/* X-Axis Slanted Labels */}
                  <div className="w-full flex justify-between absolute top-[150px] left-0 right-0">
                    {inHouseUnitData.map((d) => {
                      const isHovered = hoveredUnit === d.unit;
                      return (
                        <div key={`lbl-eff-${d.unit}`} className="flex-1 flex justify-center">
                          <span 
                            className={`text-[9px] uppercase select-none whitespace-nowrap transform -rotate-45 origin-top-left translate-y-1 transition-colors ${
                              isHovered ? 'text-amber-600 dark:text-amber-400 font-extrabold' : 'text-slate-700 dark:text-slate-300 font-bold'
                            }`}
                            style={{ display: 'inline-block' }}
                          >
                            {d.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* CARD 3: Capacity Utilization % (Line Chart)          */}
      {/* ---------------------------------------------------- */}
      <div 
        className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
        id="card-capacity-utilization-pct"
      >
        {/* Card Header with Date in Header & Avg Capacity */}
        <div className="bg-gradient-to-r from-[#B95D18] via-[#C96B20] to-[#A34E0F] text-white px-4 py-2.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-white/15 backdrop-blur-xs">
              <Gauge className="w-4 h-4 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base tracking-tight text-white leading-tight">
                  {isUnitSelected ? `${selectedUnitName} Capacity Utilization %` : 'Capacity Utilization %'}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
                  <Calendar className="w-2.5 h-2.5" />
                  {activeDateDisplay}
                </span>
              </div>
              <p className="text-[10px] text-amber-100/90 font-medium">
                {isUnitSelected ? 'Daily 7-Day Asset Workload Rate' : 'Daily Asset Workload Rate'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
              Overall: {canonicalMetrics.capacity.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Legend / Sub-header */}
        <div className="pt-2.5 px-3.5 pb-1 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Asset Load Standard: 80%</span>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0F4C75] inline-block"></span>
            <span>Utilization Trend</span>
          </div>
        </div>

        {/* Line Chart Area */}
        <div className="p-3 sm:p-4 flex-1 flex flex-col justify-end">
          {inHouseUnitData.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-6 h-[225px] text-slate-400 dark:text-slate-500">
              <Layers className="w-7 h-7 mb-2 opacity-40 text-[#B95D18]" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Unit Data in Ledger</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-[200px]">
                No production ledger entries found for the selected unit/date criteria.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto scrollbar-none">
              <div className="min-w-[320px] h-[225px] relative flex">
                {/* Y-Axis scale */}
                <div className="w-11 h-[160px] relative select-none border-r border-slate-200 dark:border-slate-800">
                  <div className="absolute top-[30px] bottom-[15px] left-0 right-0 flex flex-col justify-between items-end pr-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    <span>100%</span>
                    <span>80%</span>
                    <span>60%</span>
                    <span>40%</span>
                    <span>20%</span>
                    <span>0%</span>
                  </div>
                </div>

                {/* SVG Line Chart Canvas */}
                <div className="flex-1 h-[160px] relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 320 160" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="capGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0F4C75" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#0F4C75" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0, 20, 40, 60, 80, 100].map((pct) => {
                      const y = 145 - (pct / 100) * 110;
                      return (
                        <line 
                          key={`cap-grid-${pct}`} 
                          x1="0" 
                          y1={y} 
                          x2="320" 
                          y2={y} 
                          stroke="#cbd5e1" 
                          strokeWidth="0.75" 
                          strokeDasharray={pct === 0 ? 'none' : '3,3'} 
                          className="dark:stroke-slate-800"
                          opacity={pct === 0 ? 0.9 : 0.45} 
                        />
                      );
                    })}

                    {/* Area Fill */}
                    {(() => {
                      if (inHouseUnitData.length === 1) {
                        const y = 145 - (Math.min(100, Math.max(0, inHouseUnitData[0].capacityUtilizationPct)) / 100) * 110;
                        return (
                          <polygon
                            fill="url(#capGradient)"
                            points={`130,145 130,${y} 190,${y} 190,145`}
                          />
                        );
                      }
                      const step = 320 / inHouseUnitData.length;
                      const points = inHouseUnitData.map((d, i) => {
                        const x = i * step + step / 2;
                        const y = 145 - (Math.min(100, Math.max(0, d.capacityUtilizationPct)) / 100) * 110;
                        return `${x},${y}`;
                      }).join(' ');

                      const firstX = step / 2;
                      const lastX = (inHouseUnitData.length - 1) * step + step / 2;
                      const areaPoints = `${firstX},145 ${points} ${lastX},145`;

                      return (
                        <polygon
                          fill="url(#capGradient)"
                          points={areaPoints}
                        />
                      );
                    })()}

                    {/* Connected Polyline */}
                    {(() => {
                      if (inHouseUnitData.length <= 1) return null;
                      const step = 320 / inHouseUnitData.length;
                      const points = inHouseUnitData.map((d, i) => {
                        const x = i * step + step / 2;
                        const y = 145 - (Math.min(100, Math.max(0, d.capacityUtilizationPct)) / 100) * 110;
                        return `${x},${y}`;
                      }).join(' ');

                      return (
                        <polyline
                          fill="none"
                          stroke="#0F4C75"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={points}
                        />
                      );
                    })()}
                  </svg>

                  {/* Crisp HTML Data Point Markers & Top Percentage Badges */}
                  {inHouseUnitData.map((d, i) => {
                    const pctX = inHouseUnitData.length === 1 ? 50 : ((i + 0.5) / inHouseUnitData.length) * 100;
                    const yPx = 145 - (Math.min(100, Math.max(0, d.capacityUtilizationPct)) / 100) * 110;
                    const isHovered = hoveredUnit === d.unit;

                    return (
                      <div
                        key={`cap-marker-${d.unit}`}
                        className="absolute flex items-center justify-center cursor-pointer group z-10"
                        style={{ left: `${pctX}%`, top: `${yPx}px`, transform: 'translate(-50%, -50%)' }}
                        onMouseEnter={() => setHoveredUnit(d.unit)}
                        onMouseLeave={() => setHoveredUnit(null)}
                      >
                        {/* High-Contrast Non-Stretched Percentage Pill Badge */}
                        <div 
                          className={`absolute bottom-full mb-1.5 px-1.5 py-0.5 rounded-md border text-[9px] font-black tracking-tight select-none shadow-xs transition-all whitespace-nowrap pointer-events-none ${
                            isHovered
                              ? 'bg-[#0F4C75] text-white border-[#0F4C75] scale-110 shadow-sm z-20'
                              : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-[#0F4C75]/60 dark:border-[#0F4C75] z-10'
                          }`}
                        >
                          {d.capacityUtilizationPct}%
                        </div>

                        {/* Yellow Diamond Point Marker exactly on line vertex */}
                        <div 
                          className={`w-2.5 h-2.5 rotate-45 border-[2px] transition-transform duration-150 shadow-2xs ${
                            isHovered
                              ? 'bg-amber-400 border-[#0F4C75] scale-125'
                              : 'bg-[#F6D000] border-[#0F4C75]'
                          }`}
                        />
                      </div>
                    );
                  })}

                  {/* X-Axis Slanted Labels */}
                  <div className="w-full flex justify-between absolute top-[150px] left-0 right-0">
                    {inHouseUnitData.map((d) => {
                      const isHovered = hoveredUnit === d.unit;
                      return (
                        <div key={`lbl-cap-${d.unit}`} className="flex-1 flex justify-center">
                          <span 
                            className={`text-[9px] uppercase select-none whitespace-nowrap transform -rotate-45 origin-top-left translate-y-1 transition-colors ${
                              isHovered ? 'text-amber-600 dark:text-amber-400 font-extrabold' : 'text-slate-700 dark:text-slate-300 font-bold'
                            }`}
                            style={{ display: 'inline-block' }}
                          >
                            {d.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
