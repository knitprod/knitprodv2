/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as LucideIcons from 'lucide-react';
import { KPIMetric } from '../types';
import ProductionTargetSummaryCard from './ProductionTargetSummaryCard';
import MachineStatusCard from './MachineStatusCard';
import QualityStatusCard from './QualityStatusCard';
import AttendanceCard from './AttendanceCard';
import { useGlobalData } from '../context/GlobalDataContext';
import { getUnitConfigs, getProductionCapacityForUnit, getAvgProdPerMachineForUnit, getTotalMachinesForUnit } from '../lib/unitStore';
import { FilterState } from './DashboardFilterToolbar';

interface KPICardsProps {
  kpis: KPIMetric[];
  filterState?: FilterState;
}

export default function KPICards({ kpis, filterState }: KPICardsProps) {
  const globalData = useGlobalData();
  const ledger = globalData?.ledger || [];

  // Month names for date/month conversions
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Helper to extract month name safely
  const getMonthNameFromDateStr = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const idx = parseInt(parts[1], 10) - 1;
      if (idx >= 0 && idx < 12) return monthNames[idx];
    }
    return '';
  };

  // Helper to format single date (e.g. "11 Aug, 2026")
  const formatSingleDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${String(day).padStart(2, '0')} ${monthsShort[monthIdx]}, ${year}`;
      }
    }
    return dateStr;
  };

  // Helper to format date range (e.g. "01 Aug - 15 Aug, 2026")
  const formatDateRange = (fromStr: string, toStr: string): string => {
    if (!fromStr && !toStr) return '';
    if (fromStr && !toStr) return formatSingleDate(fromStr);
    if (!fromStr && toStr) return formatSingleDate(toStr);
    if (fromStr === toStr) return formatSingleDate(fromStr);

    const pFrom = fromStr.split('-');
    const pTo = toStr.split('-');
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (pFrom.length === 3 && pTo.length === 3) {
      const mFrom = parseInt(pFrom[1], 10) - 1;
      const mTo = parseInt(pTo[1], 10) - 1;
      const dFrom = String(parseInt(pFrom[2], 10)).padStart(2, '0');
      const dTo = String(parseInt(pTo[2], 10)).padStart(2, '0');
      const yFrom = pFrom[0];
      const yTo = pTo[0];

      if (yFrom === yTo && mFrom === mTo) {
        return `${dFrom} ${monthsShort[mFrom]} - ${dTo} ${monthsShort[mTo]}, ${yFrom}`;
      } else if (yFrom === yTo) {
        return `${dFrom} ${monthsShort[mFrom]} - ${dTo} ${monthsShort[mTo]}, ${yFrom}`;
      } else {
        return `${dFrom} ${monthsShort[mFrom]} ${yFrom} - ${dTo} ${monthsShort[mTo]} ${yTo}`;
      }
    }
    return `${fromStr} - ${toStr}`;
  };

  const now = new Date();
  const currentRunningMonth = monthNames[now.getMonth()] || 'August';

  // Determine dynamic period label and records
  let periodLabel = currentRunningMonth;
  let isMonthScope = true;
  let targetRecords = ledger;

  if (filterState) {
    const { unit, dateMode, singleDate, dateFrom, dateTo, month, year } = filterState;

    if (dateMode === 'single' && singleDate) {
      periodLabel = formatSingleDate(singleDate);
      isMonthScope = false;
      targetRecords = ledger.filter(r => {
        const matchUnit = unit === 'all' || r.floor === unit || r.unit === unit;
        return matchUnit && r.date === singleDate;
      });
    } else if (dateMode === 'range' && dateFrom && dateTo) {
      periodLabel = formatDateRange(dateFrom, dateTo);
      isMonthScope = false;
      targetRecords = ledger.filter(r => {
        const matchUnit = unit === 'all' || r.floor === unit || r.unit === unit;
        return matchUnit && r.date >= dateFrom && r.date <= dateTo;
      });
    } else if (dateMode === 'month' && month) {
      const parts = month.split('-');
      if (parts.length >= 2) {
        const mIdx = parseInt(parts[1], 10) - 1;
        periodLabel = monthNames[mIdx] || currentRunningMonth;
      }
      isMonthScope = true;
      targetRecords = ledger.filter(r => {
        const matchUnit = unit === 'all' || r.floor === unit || r.unit === unit;
        const recMonth = (r.month && r.month.trim() !== '') ? r.month : getMonthNameFromDateStr(r.date);
        return matchUnit && recMonth.toLowerCase() === periodLabel.toLowerCase();
      });
    } else if (dateMode === 'year' && year) {
      periodLabel = `Year ${year}`;
      isMonthScope = false;
      targetRecords = ledger.filter(r => {
        const matchUnit = unit === 'all' || r.floor === unit || r.unit === unit;
        return matchUnit && String(r.year || (r.date ? r.date.substring(0, 4) : '')) === String(year);
      });
    } else {
      // Default: Running Month (August)
      periodLabel = currentRunningMonth;
      isMonthScope = true;
      targetRecords = ledger.filter(r => {
        const matchUnit = unit === 'all' || r.floor === unit || r.unit === unit;
        const recMonth = (r.month && r.month.trim() !== '') ? r.month : getMonthNameFromDateStr(r.date);
        return matchUnit && recMonth.toLowerCase() === currentRunningMonth.toLowerCase();
      });
    }
  } else {
    // Default: Running Month (August)
    periodLabel = currentRunningMonth;
    isMonthScope = true;
    targetRecords = ledger.filter(r => {
      const recMonth = (r.month && r.month.trim() !== '') ? r.month : getMonthNameFromDateStr(r.date);
      return recMonth.toLowerCase() === currentRunningMonth.toLowerCase();
    });
  }

  // Active records - strictly use targetRecords matching the active filter criteria
  const activeRecords = targetRecords;

  const inHouseRecords = activeRecords.filter((r) => r.floor !== 'Sub-Contact' && r.unit !== 'Sub-Contact' && !(r.remarks && r.remarks.toLowerCase().includes('sub-contact')));
  const subContactRecords = activeRecords.filter((r) => r.floor === 'Sub-Contact' || r.unit === 'Sub-Contact' || (r.remarks && r.remarks.toLowerCase().includes('sub-contact')));

  // In-House Target (Total Target & Bulk Target)
  const inHouseTotalTarget = inHouseRecords.reduce((sum, r) => {
    const t = r.target !== undefined && r.target !== null && Number(r.target) > 0 
      ? Number(r.target) 
      : ((r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : 0) + Number((r as any).sampleTarget || 0));
    return sum + (Number.isNaN(t) ? 0 : t);
  }, 0);

  const inHouseBulkTarget = inHouseRecords.reduce((sum, r) => {
    const b = r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : (Number(r.target) || 0);
    return sum + (Number.isNaN(b) ? 0 : b);
  }, 0);

  // In-House Production (Bulk, Sample, Total, and Loss for Sample)
  const inHouseBulkProd = inHouseRecords.reduce((sum, r) => {
    const b = r.bulkProd !== undefined && r.bulkProd !== null ? Number(r.bulkProd) : (Number(r.totalProduction) || 0);
    return sum + (Number.isNaN(b) ? 0 : b);
  }, 0);

  const inHouseSampleProd = inHouseRecords.reduce((sum, r) => {
    const s = r.sampleProd !== undefined && r.sampleProd !== null 
      ? Number(r.sampleProd) 
      : (r.totalProduction !== undefined && r.bulkProd !== undefined ? Math.max(0, Number(r.totalProduction) - Number(r.bulkProd)) : 0);
    return sum + (Number.isNaN(s) ? 0 : s);
  }, 0);

  const inHouseProdTotal = inHouseRecords.reduce((sum, r) => {
    const t = r.totalProduction !== undefined && r.totalProduction !== null && Number(r.totalProduction) > 0 
      ? Number(r.totalProduction) 
      : (Number(r.bulkProd || 0) + Number(r.sampleProd || 0));
    return sum + (Number.isNaN(t) ? 0 : t);
  }, 0) || (inHouseBulkProd + inHouseSampleProd);

  const inHouseLossForSample = inHouseRecords.reduce((sum, r) => {
    const l = r.prodLossForSample !== undefined && r.prodLossForSample !== null ? Number(r.prodLossForSample) : 0;
    return sum + (Number.isNaN(l) ? 0 : l);
  }, 0);

  const inHouseAchievePct = inHouseTotalTarget > 0 ? Math.round((inHouseProdTotal / inHouseTotalTarget) * 100) : 0;

  // Sub-Contact Target & Production
  const subContactTarget = subContactRecords.reduce((sum, r) => {
    const b = r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : (Number(r.target) || 0);
    return sum + (Number.isNaN(b) ? 0 : b);
  }, 0);

  const subContactBulkProd = subContactRecords.reduce((sum, r) => {
    const b = r.bulkProd !== undefined && r.bulkProd !== null ? Number(r.bulkProd) : (Number(r.totalProduction) || 0);
    return sum + (Number.isNaN(b) ? 0 : b);
  }, 0);

  const subContactAchievePct = subContactTarget > 0 ? Math.round((subContactBulkProd / subContactTarget) * 100) : 0;

  // Overall Combined totals (In-House + Sub-Contact)
  const overallTotalTarget = inHouseTotalTarget + subContactTarget;
  const overallTotalProduction = inHouseProdTotal + subContactBulkProd;
  const overallBulkProduction = inHouseBulkProd + subContactBulkProd;
  const overallSampleProduction = inHouseSampleProd;
  const overallAchievementPct = overallTotalTarget > 0 ? Math.round((overallTotalProduction / overallTotalTarget) * 100) : 0;

  const totalFlatKnitPcs = activeRecords.reduce((sum, r) => {
    const fk = r.productionFlatKnit !== undefined && r.productionFlatKnit !== null ? Number(r.productionFlatKnit) : 0;
    return sum + (Number.isNaN(fk) ? 0 : fk);
  }, 0);

  // Efficiency & Capacity
  const effKpi = kpis.find(k => k.id === 'efficiency');
  const capKpi = kpis.find(k => k.id === 'capacity_utilization' || k.id === 'capacity');

  let efficiencyVal = 0;
  if (effKpi && effKpi.value && activeRecords.length > 0) {
    efficiencyVal = parseFloat(String(effKpi.value).replace(/[^0-9.]/g, '')) || 0;
  } else if (inHouseBulkTarget > 0) {
    efficiencyVal = parseFloat(((inHouseBulkProd / inHouseBulkTarget) * 100).toFixed(1));
  }

  let capacityVal = 0;
  if (capKpi && capKpi.value && activeRecords.length > 0) {
    capacityVal = parseFloat(String(capKpi.value).replace(/[^0-9.]/g, '')) || 0;
  }

  // Machine Status
  let inHouseTotalMachines = 0;
  const activeUnitFilter = filterState?.unit;
  if (activeUnitFilter && activeUnitFilter !== 'all') {
    inHouseTotalMachines = getTotalMachinesForUnit(activeUnitFilter, 66);
  } else {
    const distinctFloors = Array.from(new Set(inHouseRecords.map(r => r.floor).filter(Boolean))) as string[];
    if (distinctFloors.length > 0) {
      inHouseTotalMachines = distinctFloors.reduce((sum: number, f: string) => sum + getTotalMachinesForUnit(f, 45), 0);
    } else {
      const inHouseConfigs = getUnitConfigs().filter(u => !u.unitName.toLowerCase().includes('sub'));
      inHouseTotalMachines = inHouseConfigs.reduce((sum, u) => sum + Number(u.totalMachine || 0), 0) || (activeRecords.length > 0 ? 261 : 0);
    }
  }

  // In-House Daily Sums for Averages
  const inHouseDateMap: Record<string, { bulkRun: number; sampleRun: number; totalRun: number }> = {};
  inHouseRecords.forEach(r => {
    const d = r.date || 'default';
    if (!inHouseDateMap[d]) {
      inHouseDateMap[d] = { bulkRun: 0, sampleRun: 0, totalRun: 0 };
    }
    const bRun = Number(r.runningBulk) || Math.max(0, (Number(r.runningMachine) || 0) - (Number(r.runningSample) || 0));
    const sRun = Number(r.runningSample) || 0;
    inHouseDateMap[d].bulkRun += bRun;
    inHouseDateMap[d].sampleRun += sRun;
    inHouseDateMap[d].totalRun += (bRun + sRun);
  });

  const inHouseDateKeys = Object.keys(inHouseDateMap);
  const inHouseDaysCount = Math.max(1, inHouseDateKeys.length);

  const sumBulkRun = inHouseDateKeys.reduce((acc, d) => acc + inHouseDateMap[d].bulkRun, 0);
  const sumSampleRun = inHouseDateKeys.reduce((acc, d) => acc + inHouseDateMap[d].sampleRun, 0);
  const sumTotalRun = inHouseDateKeys.reduce((acc, d) => acc + inHouseDateMap[d].totalRun, 0);

  const inHouseBulkRunning = inHouseDateKeys.length > 0 ? (sumBulkRun / inHouseDaysCount) : 0;
  const inHouseSampleRunning = inHouseDateKeys.length > 0 ? (sumSampleRun / inHouseDaysCount) : 0;
  const inHouseRunningMachines = inHouseDateKeys.length > 0 ? (sumTotalRun / inHouseDaysCount) : 0;

  // Idle Machine %
  const inHouseIdleMachinePct = inHouseTotalMachines > 0 && inHouseRunningMachines > 0
    ? ((inHouseRunningMachines - inHouseTotalMachines) / inHouseTotalMachines) * 100
    : 0;
  const inHouseIdleCount = Math.max(0, inHouseTotalMachines - inHouseRunningMachines);

  // Sub-Contact Daily Sums for Averages
  const scDateMap: Record<string, { actFactories: number; mcRun: number; vehicles: number }> = {};
  subContactRecords.forEach(r => {
    const d = r.date || 'default';
    if (!scDateMap[d]) {
      scDateMap[d] = { actFactories: 0, mcRun: 0, vehicles: 0 };
    }
    const actF = Number(r.totalRunningFactories) || Number(r.runningFactories) || (Number(r.totalOperator) > 0 ? Number(r.totalOperator) : 0);
    const mc = Number(r.runningMachine) || (Number(r.runningBulk || 0) + Number(r.runningSample || 0)) || 0;
    const veh = Number(r.numberVehicles) || 0;

    scDateMap[d].actFactories += actF;
    scDateMap[d].mcRun += mc;
    scDateMap[d].vehicles += veh;
  });

  const scDateKeys = Object.keys(scDateMap);
  const scDaysCount = Math.max(1, scDateKeys.length);

  const sumScFactories = scDateKeys.reduce((acc, d) => acc + scDateMap[d].actFactories, 0);
  const sumScMc = scDateKeys.reduce((acc, d) => acc + scDateMap[d].mcRun, 0);
  const sumScVeh = scDateKeys.reduce((acc, d) => acc + scDateMap[d].vehicles, 0);

  const subContactActiveFactories = scDateKeys.length > 0 ? (sumScFactories / scDaysCount) : 0;
  const subContactTotalMachineRun = scDateKeys.length > 0 ? (sumScMc / scDaysCount) : 0;
  const subContactActiveVehicles = scDateKeys.length > 0 ? (sumScVeh / scDaysCount) : 0;

  // In-House Quality Status Metrics
  const rawInHouseReject = inHouseRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.reject)) ? 0 : Number(r.reject || 0)), 0);
  const rawInHouseHold = inHouseRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.hold)) ? 0 : Number(r.hold || 0)), 0);
  const rawInHouseJhute = inHouseRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.jhuteCutpcs)) ? 0 : Number(r.jhuteCutpcs || 0)), 0);

  const inHouseReject = Math.round(rawInHouseReject);
  const inHouseHold = Math.round(rawInHouseHold);
  const inHouseJhute = Math.round(rawInHouseJhute);

  const inHouseRejectPct = inHouseProdTotal > 0 ? parseFloat(((inHouseReject / inHouseProdTotal) * 100).toFixed(2)) : 0;
  const inHouseHoldPct = inHouseProdTotal > 0 ? parseFloat(((inHouseHold / inHouseProdTotal) * 100).toFixed(1)) : 0;
  const inHouseJhutePct = inHouseProdTotal > 0 ? parseFloat(((inHouseJhute / inHouseProdTotal) * 100).toFixed(2)) : 0;
  const inHouseScrapPct = parseFloat((inHouseRejectPct + inHouseHoldPct + inHouseJhutePct).toFixed(2));
  const inHousePassRatePct = inHouseProdTotal > 0 ? Math.max(0, Math.min(100, 100 - inHouseScrapPct)) : 0;

  // Sub-Contact Quality Status Metrics (Sub-Contact only has Reject; Hold & Jhute/CutPcs do not apply)
  const rawSubContactReject = subContactRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.reject)) ? 0 : Number(r.reject || 0)), 0);
  const subContactReject = Math.round(rawSubContactReject);
  const subContactHold = 0;
  const subContactJhute = 0;

  const subContactRejectPct = subContactBulkProd > 0 ? parseFloat(((subContactReject / subContactBulkProd) * 100).toFixed(2)) : 0;
  const subContactHoldPct = 0;
  const subContactJhutePct = 0;
  const subContactScrapPct = subContactRejectPct;
  const subContactPassRatePct = subContactBulkProd > 0 ? Math.max(0, Math.min(100, 100 - subContactScrapPct)) : 0;

  // Combined Quality Totals (In-House has Reject, Hold, Jhute; Sub-Contact only contributes Reject)
  const totalReject = inHouseReject + subContactReject;
  const totalHold = inHouseHold;
  const totalJhuteCutpcs = inHouseJhute;
  const totalProdCombined = inHouseProdTotal + subContactBulkProd;
  const rejectPct = totalProdCombined > 0 ? parseFloat(((totalReject / totalProdCombined) * 100).toFixed(2)) : 0;
  const holdPct = totalProdCombined > 0 ? parseFloat(((totalHold / totalProdCombined) * 100).toFixed(2)) : 0;
  const jhuteCutpcsPct = totalProdCombined > 0 ? parseFloat(((totalJhuteCutpcs / totalProdCombined) * 100).toFixed(2)) : 0;
  const cumulativeScrapPct = parseFloat((rejectPct + holdPct + jhuteCutpcsPct).toFixed(2));

  // Attendance Metrics: Computed as DAILY AVERAGE across the active period (Running Month by default, reacts to filter)
  const activeStaffRecords = inHouseRecords.filter(r => (Number(r.totalOperator) || Number((r as any).totalStaff) || Number((r as any).manpower) || 0) > 0);
  const activeStaffRecordsCount = Math.max(1, activeStaffRecords.length);
  const sumStaff = activeStaffRecords.reduce((acc, r) => acc + (Number(r.totalOperator) || Number((r as any).totalStaff) || Number((r as any).manpower) || 0), 0);
  const sumAbsent = activeStaffRecords.reduce((acc, r) => acc + (Number(r.absent) || 0), 0);

  const avgStaff = activeStaffRecords.length > 0 ? Math.round(sumStaff / activeStaffRecordsCount) : 0;
  const avgAbsent = activeStaffRecords.length > 0 ? Math.round(sumAbsent / activeStaffRecordsCount) : 0;
  const avgPresent = Math.max(0, avgStaff - avgAbsent);
  const absentPct = avgStaff > 0 ? parseFloat(((avgAbsent / avgStaff) * 100).toFixed(1)) : 0;
  const presentPct = avgStaff > 0 ? parseFloat(((avgPresent / avgStaff) * 100).toFixed(1)) : 0;

  return (
    <div className="space-y-4" id="dashboard-kpi-cards-container">
      {/* ======================================================================= */}
      {/* TOP ROW: 3 PRODUCTION SUMMARY CARDS                                     */}
      {/* ======================================================================= */}
      <ProductionTargetSummaryCard
        inHouseTarget={inHouseTotalTarget}
        inHouseProduction={inHouseProdTotal}
        inHouseBulkProduction={inHouseBulkProd}
        inHouseBulkTarget={inHouseBulkTarget}
        inHouseSampleProduction={inHouseSampleProd}
        inHouseProdLossForSample={inHouseLossForSample}
        inHouseAchievementPct={inHouseAchievePct}
        subContactTarget={subContactTarget}
        subContactProduction={subContactBulkProd}
        subContactAchievementPct={subContactAchievePct}
        overallTarget={overallTotalTarget}
        overallProduction={overallTotalProduction}
        overallBulkProduction={overallBulkProduction}
        overallSampleProduction={overallSampleProduction}
        overallAchievementPct={overallAchievementPct}
        flatKnitPcs={totalFlatKnitPcs}
        efficiencyPct={efficiencyVal}
        capacityUtilizationPct={capacityVal}
        periodLabel={periodLabel}
      />

      {/* ======================================================================= */}
      {/* BOTTOM ROW: 3 CARDS (MACHINE STATUS, QUALITY STATUS, ATTENDANCE)        */}
      {/* ======================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Card 4: Machine Status */}
        <MachineStatusCard
          inHouseTotalMachines={inHouseTotalMachines}
          inHouseRunningMachines={inHouseRunningMachines}
          inHouseBulkRunning={inHouseBulkRunning}
          inHouseSampleRunning={inHouseSampleRunning}
          inHouseIdleMachinePct={inHouseIdleMachinePct}
          inHouseIdleCount={inHouseIdleCount}
          subContactActiveFactories={subContactActiveFactories}
          subContactTotalMachineRun={subContactTotalMachineRun}
          subContactActiveVehicles={subContactActiveVehicles}
          periodLabel={periodLabel}
        />

        {/* Card 5: Quality Status */}
        <QualityStatusCard
          inHouseReject={inHouseReject}
          inHouseRejectPct={inHouseRejectPct}
          inHouseHold={inHouseHold}
          inHouseHoldPct={inHouseHoldPct}
          inHouseJhuteCutpcs={inHouseJhute}
          inHouseJhuteCutpcsPct={inHouseJhutePct}
          inHouseCumulativeScrapPct={inHouseScrapPct}
          inHousePassRatePct={inHousePassRatePct}
          subContactReject={subContactReject}
          subContactRejectPct={subContactRejectPct}
          subContactCumulativeScrapPct={subContactScrapPct}
          subContactPassRatePct={subContactPassRatePct}
          totalReject={totalReject}
          rejectPct={rejectPct}
          totalHold={totalHold}
          holdPct={holdPct}
          totalJhuteCutpcs={totalJhuteCutpcs}
          jhuteCutpcsPct={jhuteCutpcsPct}
          cumulativeScrapPct={cumulativeScrapPct}
          periodLabel={periodLabel}
        />

        {/* Card 6: Attendance (Showing Daily Average Counts) */}
        <AttendanceCard
          totalStaff={avgStaff}
          totalAbsent={avgAbsent}
          absentPct={absentPct}
          presentStaff={avgPresent}
          presentPct={presentPct}
          periodLabel={periodLabel}
        />
      </div>
    </div>
  );
}
