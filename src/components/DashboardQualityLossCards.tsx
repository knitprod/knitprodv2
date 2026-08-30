/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Executive Quality, Wastage & Absenteeism Cards
 * 1. Hold Summary (Hold Qty vs Hold %)
 * 2. Wastage Summary (Reject & Jhut/Cutpcs Qty vs Reject% & Jhut/Cutpcs%)
 * 3. Absent Summary (Absentism Count vs Absent Rate %)
 * 
 * Includes high-precision Dual-Axis Charts with integrated Excel-style Data Tables.
 */

import React, { useMemo, useState } from 'react';
import { 
  PauseCircle, 
  Trash2, 
  UserX, 
  Calendar,
  Layers
} from 'lucide-react';
import { useGlobalData } from '../context/GlobalDataContext';
import { LedgerRecord } from '../types';
import { FilterState } from './DashboardFilterToolbar';
import { 
  filterLedgerByState, 
  isRecordMatchingFloor
} from '../lib/productionMetrics';

interface DashboardQualityLossCardsProps {
  filterState?: FilterState;
}

interface UnitLossMetric {
  key: string;
  unit: string;
  label: string;
  totalProduction: number;
  totalOperator: number;

  // Hold Summary
  holdQty: number;
  holdPct: number;

  // Wastage Summary
  rejectQty: number;
  jhuteCutpcsQty: number;
  rejectPct: number;
  jhuteCutpcsPct: number;

  // Absent Summary
  absentCount: number;
  absentRatePct: number;
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

const formatUnitLabel = (name: string): string => {
  const n = (name || '').trim().toLowerCase();
  if (n.includes('sub')) return 'Sub-Contact';
  if (n.includes('esl')) return 'ESL-Extension';
  if (n.includes('auto')) return 'Auto-Stripe';
  if (n === 'extension' || n.includes('efl-ext') || n.includes('eflextension')) return 'Extension';
  if (n === 'efl-2' || n === 'efl2' || n === 'efl 2') return 'EFL-2';
  if (n === 'efl' || n === 'efl-1' || n === 'efl 1') return 'EFL';
  if (n === 'ekl') return 'EKL';
  return name;
};

export default function DashboardQualityLossCards({ filterState }: DashboardQualityLossCardsProps) {
  const globalData = useGlobalData();
  const [hoveredUnit, setHoveredUnit] = useState<string | null>(null);

  const ledger = globalData?.ledger || [];

  // Determine active display date for Card Headers
  const activeDateDisplay = useMemo(() => {
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

    if (ledger.length > 0) {
      const dates = ledger
        .map(r => r.date)
        .filter((d): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d)))
        .sort();
      if (dates.length > 0) {
        return formatDateFriendly(dates[dates.length - 1]);
      }
    }

    return 'Latest Production';
  }, [filterState, ledger]);

  // Compute unit-wise loss & quality data dynamically connected to Production Ledger
  const lossData: UnitLossMetric[] = useMemo(() => {
    if (!ledger || ledger.length === 0) return [];

    const { filteredRows } = filterLedgerByState(ledger, filterState);
    if (!filteredRows || filteredRows.length === 0) return [];

    const knownUnitDefinitions = [
      { key: 'ekl', name: 'EKL', label: 'EKL', matchKeys: ['ekl'] },
      { key: 'efl', name: 'EFL', label: 'EFL', matchKeys: ['efl', 'efl-1', 'efl 1'] },
      { key: 'efl-2', name: 'EFL-2', label: 'EFL-2', matchKeys: ['efl-2', 'efl2', 'efl 2'] },
      { key: 'auto', name: 'AUTO-STRIPE', label: 'Auto-Stripe', matchKeys: ['auto', 'auto stripe', 'auto-stripe', 'autostripe'] },
      { key: 'efl-ext', name: 'EFL-EXTENSION', label: 'Extension', matchKeys: ['efl-extension', 'efl extension', 'efl-ext', 'eflextension', 'efl ext', 'extension'] },
      { key: 'esl-ext', name: 'ESL-EXTENSION', label: 'ESL-Extension', matchKeys: ['esl-extension', 'esl extension', 'esl-ext', 'eslextension', 'esl ext', 'esl'] },
      { key: 'sub', name: 'SUB-CONTACT', label: 'Sub-Contact', matchKeys: ['sub', 'sub-contact', 'sub contact'] }
    ];

    const result: UnitLossMetric[] = [];
    const matchedRecordIndices = new Set<number>();

    for (const u of knownUnitDefinitions) {
      const matchingRowIndices: number[] = [];
      const rows: LedgerRecord[] = [];

      filteredRows.forEach((r, idx) => {
        const floor = (r.floor || '').trim().toLowerCase();
        const unit = (r.unit || '').trim().toLowerCase();

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

        const isMatch = u.matchKeys.some(k => floor === k || unit === k || floor.includes(k) || isRecordMatchingFloor(r, u.name));
        if (isMatch) {
          matchingRowIndices.push(idx);
          rows.push(r);
        }
      });

      // Track matched records
      matchingRowIndices.forEach(i => matchedRecordIndices.add(i));

      const totProd = rows.reduce((sum, r) => sum + (Number(r.totalProduction) || 0), 0);

      // Metrics calculation
      const holdQty = rows.reduce((sum, r) => sum + (Number(r.hold) || 0), 0);
      let holdPct = 0;
      const validHoldPctRows = rows.filter(r => r.holdPct !== undefined && r.holdPct !== null && Number(r.holdPct) > 0);
      if (validHoldPctRows.length > 0 && rows.length === 1) {
        holdPct = Number(validHoldPctRows[0].holdPct);
      } else if (totProd > 0 && holdQty > 0) {
        holdPct = (holdQty / totProd) * 100;
      } else if (validHoldPctRows.length > 0) {
        holdPct = validHoldPctRows.reduce((sum, r) => sum + Number(r.holdPct), 0) / validHoldPctRows.length;
      }

      const rejectQty = rows.reduce((sum, r) => sum + (Number(r.reject) || 0), 0);
      let rejectPct = 0;
      const validRejectPctRows = rows.filter(r => r.rejectPct !== undefined && r.rejectPct !== null && Number(r.rejectPct) > 0);
      if (validRejectPctRows.length > 0 && rows.length === 1) {
        rejectPct = Number(validRejectPctRows[0].rejectPct);
      } else if (totProd > 0 && rejectQty > 0) {
        rejectPct = (rejectQty / totProd) * 100;
      } else if (validRejectPctRows.length > 0) {
        rejectPct = validRejectPctRows.reduce((sum, r) => sum + Number(r.rejectPct), 0) / validRejectPctRows.length;
      }

      const jhuteCutpcsQty = rows.reduce((sum, r) => sum + (Number(r.jhuteCutpcs) || 0), 0);
      let jhuteCutpcsPct = 0;
      const validJhutePctRows = rows.filter(r => r.jhuteCutpcsPct !== undefined && r.jhuteCutpcsPct !== null && Number(r.jhuteCutpcsPct) > 0);
      if (validJhutePctRows.length > 0 && rows.length === 1) {
        jhuteCutpcsPct = Number(validJhutePctRows[0].jhuteCutpcsPct);
      } else if (totProd > 0 && jhuteCutpcsQty > 0) {
        jhuteCutpcsPct = (jhuteCutpcsQty / totProd) * 100;
      } else if (validJhutePctRows.length > 0) {
        jhuteCutpcsPct = validJhutePctRows.reduce((sum, r) => sum + Number(r.jhuteCutpcsPct), 0) / validJhutePctRows.length;
      }

      const absentCount = rows.reduce((sum, r) => sum + (Number(r.absent) || 0), 0);
      const totalOperator = rows.reduce((sum, r) => sum + (Number(r.totalOperator) || 0), 0);
      let absentRatePct = 0;
      const validAbsentPctRows = rows.filter(r => r.absentPct !== undefined && r.absentPct !== null && Number(r.absentPct) > 0);
      if (validAbsentPctRows.length > 0 && rows.length === 1) {
        absentRatePct = Number(validAbsentPctRows[0].absentPct);
      } else if (totalOperator > 0 && absentCount > 0) {
        absentRatePct = (absentCount / totalOperator) * 100;
      } else if (validAbsentPctRows.length > 0) {
        absentRatePct = validAbsentPctRows.reduce((sum, r) => sum + Number(r.absentPct), 0) / validAbsentPctRows.length;
      }

      result.push({
        key: u.key,
        unit: u.name,
        label: u.label,
        totalProduction: totProd,
        totalOperator,
        holdQty: Math.round(holdQty),
        holdPct: parseFloat(holdPct.toFixed(2)),
        rejectQty: Math.round(rejectQty),
        jhuteCutpcsQty: Math.round(jhuteCutpcsQty),
        rejectPct: parseFloat(rejectPct.toFixed(2)),
        jhuteCutpcsPct: parseFloat(jhuteCutpcsPct.toFixed(2)),
        absentCount: Math.round(absentCount),
        absentRatePct: parseFloat(absentRatePct.toFixed(2))
      });
    }

    // Process remaining units if any
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
        const holdQty = rows.reduce((sum, r) => sum + (Number(r.hold) || 0), 0);
        let holdPct = 0;
        const validHoldPctRows = rows.filter(r => r.holdPct !== undefined && r.holdPct !== null && Number(r.holdPct) > 0);
        if (validHoldPctRows.length > 0 && rows.length === 1) {
          holdPct = Number(validHoldPctRows[0].holdPct);
        } else if (totProd > 0 && holdQty > 0) {
          holdPct = (holdQty / totProd) * 100;
        } else if (validHoldPctRows.length > 0) {
          holdPct = validHoldPctRows.reduce((sum, r) => sum + Number(r.holdPct), 0) / validHoldPctRows.length;
        }

        const rejectQty = rows.reduce((sum, r) => sum + (Number(r.reject) || 0), 0);
        let rejectPct = 0;
        const validRejectPctRows = rows.filter(r => r.rejectPct !== undefined && r.rejectPct !== null && Number(r.rejectPct) > 0);
        if (validRejectPctRows.length > 0 && rows.length === 1) {
          rejectPct = Number(validRejectPctRows[0].rejectPct);
        } else if (totProd > 0 && rejectQty > 0) {
          rejectPct = (rejectQty / totProd) * 100;
        } else if (validRejectPctRows.length > 0) {
          rejectPct = validRejectPctRows.reduce((sum, r) => sum + Number(r.rejectPct), 0) / validRejectPctRows.length;
        }

        const jhuteCutpcsQty = rows.reduce((sum, r) => sum + (Number(r.jhuteCutpcs) || 0), 0);
        let jhuteCutpcsPct = 0;
        const validJhutePctRows = rows.filter(r => r.jhuteCutpcsPct !== undefined && r.jhuteCutpcsPct !== null && Number(r.jhuteCutpcsPct) > 0);
        if (validJhutePctRows.length > 0 && rows.length === 1) {
          jhuteCutpcsPct = Number(validJhutePctRows[0].jhuteCutpcsPct);
        } else if (totProd > 0 && jhuteCutpcsQty > 0) {
          jhuteCutpcsPct = (jhuteCutpcsQty / totProd) * 100;
        } else if (validJhutePctRows.length > 0) {
          jhuteCutpcsPct = validJhutePctRows.reduce((sum, r) => sum + Number(r.jhuteCutpcsPct), 0) / validJhutePctRows.length;
        }

        const absentCount = rows.reduce((sum, r) => sum + (Number(r.absent) || 0), 0);
        const totalOperator = rows.reduce((sum, r) => sum + (Number(r.totalOperator) || 0), 0);
        let absentRatePct = 0;
        const validAbsentPctRows = rows.filter(r => r.absentPct !== undefined && r.absentPct !== null && Number(r.absentPct) > 0);
        if (validAbsentPctRows.length > 0 && rows.length === 1) {
          absentRatePct = Number(validAbsentPctRows[0].absentPct);
        } else if (totalOperator > 0 && absentCount > 0) {
          absentRatePct = (absentCount / totalOperator) * 100;
        } else if (validAbsentPctRows.length > 0) {
          absentRatePct = validAbsentPctRows.reduce((sum, r) => sum + Number(r.absentPct), 0) / validAbsentPctRows.length;
        }

        result.push({
          key: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          unit: name,
          label: formatUnitLabel(name),
          totalProduction: totProd,
          totalOperator,
          holdQty: Math.round(holdQty),
          holdPct: parseFloat(holdPct.toFixed(2)),
          rejectQty: Math.round(rejectQty),
          jhuteCutpcsQty: Math.round(jhuteCutpcsQty),
          rejectPct: parseFloat(rejectPct.toFixed(2)),
          jhuteCutpcsPct: parseFloat(jhuteCutpcsPct.toFixed(2)),
          absentCount: Math.round(absentCount),
          absentRatePct: parseFloat(absentRatePct.toFixed(2))
        });
      });
    }

    return result;
  }, [ledger, filterState]);

  // Overall totals
  const totalHold = useMemo(() => lossData.reduce((sum, u) => sum + u.holdQty, 0), [lossData]);
  const totalReject = useMemo(() => lossData.reduce((sum, u) => sum + u.rejectQty, 0), [lossData]);
  const totalJhute = useMemo(() => lossData.reduce((sum, u) => sum + u.jhuteCutpcsQty, 0), [lossData]);
  const totalAbsent = useMemo(() => lossData.reduce((sum, u) => sum + u.absentCount, 0), [lossData]);

  // --- Dynamic scaling for Chart 1 (Hold Summary) ---
  const maxHoldVal = useMemo(() => {
    const maxVal = Math.max(...lossData.map(u => u.holdQty), 100);
    return Math.ceil(maxVal / 20) * 20;
  }, [lossData]);

  const maxHoldPct = useMemo(() => {
    const maxVal = Math.max(...lossData.map(u => u.holdPct), 10);
    return Math.ceil(maxVal / 2) * 2;
  }, [lossData]);

  // --- Dynamic scaling for Chart 2 (Wastage Summary) ---
  const maxWastageQty = useMemo(() => {
    const maxVal = Math.max(...lossData.map(u => Math.max(u.rejectQty, u.jhuteCutpcsQty)), 25);
    return Math.ceil(maxVal / 5) * 5;
  }, [lossData]);

  const maxWastagePct = useMemo(() => {
    const maxVal = Math.max(...lossData.map(u => Math.max(u.rejectPct, u.jhuteCutpcsPct)), 0.30);
    return Math.max(0.30, Math.ceil(maxVal * 20) / 20);
  }, [lossData]);

  // --- Dynamic scaling for Chart 3 (Absent Summary) ---
  const maxAbsentCount = useMemo(() => {
    const maxVal = Math.max(...lossData.map(u => u.absentCount), 2.5);
    return Math.ceil(maxVal * 2) / 2;
  }, [lossData]);

  const maxAbsentRate = useMemo(() => {
    const maxVal = Math.max(...lossData.map(u => u.absentRatePct), 5.0);
    return Math.ceil(maxVal);
  }, [lossData]);

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-4.5 my-4" id="dashboard-quality-loss-cards">
      {/* ---------------------------------------------------- */}
      {/* CARD 1: Hold Summary (Bars + Line + Data Grid)      */}
      {/* ---------------------------------------------------- */}
      <div 
        className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
        id="card-hold-summary"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#B95D18] via-[#C96B20] to-[#A34E0F] text-white px-4 py-2.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-white/15 backdrop-blur-xs">
              <PauseCircle className="w-4 h-4 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base tracking-tight text-white leading-tight">
                  Hold Summary
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
                  <Calendar className="w-2.5 h-2.5" />
                  {activeDateDisplay}
                </span>
              </div>
              <p className="text-[10px] text-amber-100/90 font-medium">Quality Hold Quantity & Rate %</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
              Hold: {totalHold.toLocaleString()} Kg
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="pt-2 px-3.5 pb-1 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Unit Breakdown</span>
          <div className="flex items-center gap-x-3 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#0F4C75] inline-block shadow-2xs"></span>
              <span className="text-slate-600 dark:text-slate-300">Hold (Kg)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-[#E67E22] inline-block"></span>
              <span className="w-1.5 h-1.5 bg-[#E67E22] inline-block -ml-1"></span>
              <span className="text-slate-600 dark:text-slate-300">Hold %</span>
            </div>
          </div>
        </div>

        {/* Dual Axis Chart Area */}
        <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
          {lossData.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-6 h-[180px] text-slate-400 dark:text-slate-500">
              <Layers className="w-7 h-7 mb-2 opacity-40 text-[#B95D18]" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Hold Data Available</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-[200px]">
                No ledger records matching selected filters.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto scrollbar-none">
              <div className="min-w-[320px] h-[160px] relative flex">
                {/* Left Y-Axis: Hold Qty */}
                <div className="w-9 h-[140px] flex flex-col justify-between items-end pr-1.5 text-[9.5px] font-bold text-slate-500 dark:text-slate-400 select-none pb-1 border-r border-slate-200 dark:border-slate-800">
                  <span>{maxHoldVal}</span>
                  <span>{Math.round(maxHoldVal * 0.75)}</span>
                  <span>{Math.round(maxHoldVal * 0.5)}</span>
                  <span>{Math.round(maxHoldVal * 0.25)}</span>
                  <span>0</span>
                </div>

                {/* SVG Combo Canvas */}
                <div className="flex-1 h-[140px] relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 320 140" preserveAspectRatio="none">
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const y = 130 - ratio * 112;
                      return (
                        <line 
                          key={`hold-grid-${ratio}`} 
                          x1="0" 
                          y1={y} 
                          x2="320" 
                          y2={y} 
                          stroke="#cbd5e1" 
                          strokeWidth="0.75" 
                          strokeDasharray={ratio === 0 ? 'none' : '3,3'} 
                          className="dark:stroke-slate-800"
                          opacity={ratio === 0 ? 0.9 : 0.45} 
                        />
                      );
                    })}

                    {/* Line for Hold % */}
                    {lossData.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#E67E22"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={lossData.map((d, i) => {
                          const step = 320 / lossData.length;
                          const x = i * step + step / 2;
                          const y = 130 - (maxHoldPct > 0 ? (Math.min(maxHoldPct, d.holdPct) / maxHoldPct) * 112 : 0);
                          return `${x},${y}`;
                        }).join(' ')}
                      />
                    )}
                  </svg>

                  {/* Undistorted HTML Bars for Hold Qty */}
                  <div className="absolute inset-0 pointer-events-none">
                    {lossData.map((d, i) => {
                      const pctX = lossData.length === 1 ? 50 : ((i + 0.5) / lossData.length) * 100;
                      const barHPx = maxHoldVal > 0 ? (d.holdQty / maxHoldVal) * 112 : 0;
                      const isHovered = hoveredUnit === d.unit;

                      return (
                        <div
                          key={`hold-bar-col-${d.unit}`}
                          className="absolute bottom-[10px] -translate-x-1/2 flex flex-col items-center pointer-events-auto cursor-pointer group"
                          style={{ left: `${pctX}%` }}
                          onMouseEnter={() => setHoveredUnit(d.unit)}
                          onMouseLeave={() => setHoveredUnit(null)}
                        >
                          {d.holdQty > 0 && (
                            <div
                              className={`w-3.5 sm:w-4 rounded-t-xs transition-all ${
                                isHovered ? 'bg-[#1b6395] shadow-xs' : 'bg-[#0F4C75]'
                              }`}
                              style={{ height: `${Math.max(2, barHPx)}px` }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Undistorted Square Markers for Hold % */}
                  {lossData.map((d, i) => {
                    const pctX = lossData.length === 1 ? 50 : ((i + 0.5) / lossData.length) * 100;
                    const yPx = 130 - (maxHoldPct > 0 ? (Math.min(maxHoldPct, d.holdPct) / maxHoldPct) * 112 : 0);
                    const isHovered = hoveredUnit === d.unit;

                    return (
                      <div
                        key={`hold-pt-${d.unit}`}
                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer z-10"
                        style={{ left: `${pctX}%`, top: `${yPx}px` }}
                        onMouseEnter={() => setHoveredUnit(d.unit)}
                        onMouseLeave={() => setHoveredUnit(null)}
                      >
                        <div
                          className={`w-2.5 h-2.5 bg-[#E67E22] border-2 border-white shadow-2xs transition-transform duration-150 ${
                            isHovered ? 'scale-125 bg-amber-500' : ''
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Right Y-Axis: Hold % */}
                <div className="w-13 h-[140px] flex flex-col justify-between items-start pl-1.5 text-[9.5px] font-bold text-[#E67E22] select-none pb-1 border-l border-slate-200 dark:border-slate-800">
                  <span>{(maxHoldPct).toFixed(2)}%</span>
                  <span>{(maxHoldPct * 0.75).toFixed(2)}%</span>
                  <span>{(maxHoldPct * 0.5).toFixed(2)}%</span>
                  <span>{(maxHoldPct * 0.25).toFixed(2)}%</span>
                  <span>0.00%</span>
                </div>
              </div>
            </div>
          )}

          {/* Integrated Data Table */}
          {lossData.length > 0 && (
            <div className="w-full overflow-x-auto mt-2 border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
              <table className="w-full text-[10px] sm:text-[10.5px] border-collapse bg-white dark:bg-slate-900">
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="px-2 py-1 text-left w-16 sm:w-20 border-r border-slate-200 dark:border-slate-700">Unit</th>
                    {lossData.map(d => (
                      <th key={`hdr-${d.unit}`} className="px-1 py-1 text-center border-r last:border-r-0 border-slate-200 dark:border-slate-700 truncate">
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Hold */}
                  <tr className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-2 py-1 font-bold text-[#0F4C75] dark:text-blue-400 bg-slate-50/80 dark:bg-slate-800/60 border-r border-slate-200 dark:border-slate-700">
                      Hold
                    </td>
                    {lossData.map(d => (
                      <td key={`h-val-${d.unit}`} className="px-1 py-1 text-center font-medium text-slate-800 dark:text-slate-200 border-r last:border-r-0 border-slate-200 dark:border-slate-700 font-mono">
                        {d.holdQty}
                      </td>
                    ))}
                  </tr>
                  {/* Row 2: Hold % */}
                  <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-2 py-1 font-bold text-[#E67E22] bg-slate-50/80 dark:bg-slate-800/60 border-r border-slate-200 dark:border-slate-700">
                      Hold %
                    </td>
                    {lossData.map(d => (
                      <td key={`hp-val-${d.unit}`} className="px-1 py-1 text-center font-semibold text-[#D35400] dark:text-[#E67E22] border-r last:border-r-0 border-slate-200 dark:border-slate-700 font-mono">
                        {d.holdPct.toFixed(2)}%
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* CARD 2: Wastage Summary (Combo Bars + 2 Lines)      */}
      {/* ---------------------------------------------------- */}
      <div 
        className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
        id="card-wastage-summary"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#B95D18] via-[#C96B20] to-[#A34E0F] text-white px-4 py-2.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-white/15 backdrop-blur-xs">
              <Trash2 className="w-4 h-4 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base tracking-tight text-white leading-tight">
                  Wastage Summary
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
                  <Calendar className="w-2.5 h-2.5" />
                  {activeDateDisplay}
                </span>
              </div>
              <p className="text-[10px] text-amber-100/90 font-medium">Reject & Jhute / Cut Pieces</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
              {(totalReject + totalJhute).toLocaleString()} Kg
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="pt-2 px-2.5 pb-1 flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] sm:text-[10.5px] font-semibold text-slate-700 dark:text-slate-200">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#0F4C75] inline-block shadow-2xs"></span>
              <span className="text-slate-600 dark:text-slate-300">Reject</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#16A34A] inline-block shadow-2xs"></span>
              <span className="text-slate-600 dark:text-slate-300">Jhut/Cutpcs</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-[#E67E22] inline-block"></span>
              <span className="w-1 h-1 bg-[#E67E22] inline-block -ml-0.5"></span>
              <span className="text-slate-600 dark:text-slate-300">Reject%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-[#0284C7] inline-block"></span>
              <span className="text-[#0284C7] text-[9px] font-bold -ml-0.5">×</span>
              <span className="text-slate-600 dark:text-slate-300">Jhut/Cutpcs%</span>
            </div>
          </div>
        </div>

        {/* Dual Axis Chart Area */}
        <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
          {lossData.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-6 h-[180px] text-slate-400 dark:text-slate-500">
              <Layers className="w-7 h-7 mb-2 opacity-40 text-[#B95D18]" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Wastage Data Available</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-[200px]">
                No ledger records matching selected filters.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto scrollbar-none">
              <div className="min-w-[320px] h-[160px] relative flex">
                {/* Left Y-Axis: Wastage % */}
                <div className="w-11 h-[140px] flex flex-col justify-between items-end pr-1.5 text-[9.5px] font-bold text-[#0284C7] select-none pb-1 border-r border-slate-200 dark:border-slate-800">
                  <span>{(maxWastagePct).toFixed(2)}%</span>
                  <span>{(maxWastagePct * 0.75).toFixed(2)}%</span>
                  <span>{(maxWastagePct * 0.5).toFixed(2)}%</span>
                  <span>{(maxWastagePct * 0.25).toFixed(2)}%</span>
                  <span>0.00%</span>
                </div>

                {/* SVG Combo Canvas */}
                <div className="flex-1 h-[140px] relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 320 140" preserveAspectRatio="none">
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const y = 130 - ratio * 112;
                      return (
                        <line 
                          key={`wastage-grid-${ratio}`} 
                          x1="0" 
                          y1={y} 
                          x2="320" 
                          y2={y} 
                          stroke="#cbd5e1" 
                          strokeWidth="0.75" 
                          strokeDasharray={ratio === 0 ? 'none' : '3,3'} 
                          className="dark:stroke-slate-800"
                          opacity={ratio === 0 ? 0.9 : 0.45} 
                        />
                      );
                    })}

                    {/* Line 1: Reject % */}
                    {lossData.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#E67E22"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={lossData.map((d, i) => {
                          const step = 320 / lossData.length;
                          const x = i * step + step / 2;
                          const y = 130 - (maxWastagePct > 0 ? (Math.min(maxWastagePct, d.rejectPct) / maxWastagePct) * 112 : 0);
                          return `${x},${y}`;
                        }).join(' ')}
                      />
                    )}

                    {/* Line 2: Jhute/Cutpcs % */}
                    {lossData.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#0284C7"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={lossData.map((d, i) => {
                          const step = 320 / lossData.length;
                          const x = i * step + step / 2;
                          const y = 130 - (maxWastagePct > 0 ? (Math.min(maxWastagePct, d.jhuteCutpcsPct) / maxWastagePct) * 112 : 0);
                          return `${x},${y}`;
                        }).join(' ')}
                      />
                    )}
                  </svg>

                  {/* Undistorted Grouped HTML Bars for Reject (Navy) and Jhute (Green) */}
                  <div className="absolute inset-0 pointer-events-none">
                    {lossData.map((d, i) => {
                      const pctX = lossData.length === 1 ? 50 : ((i + 0.5) / lossData.length) * 100;
                      const rejHPx = maxWastageQty > 0 ? (d.rejectQty / maxWastageQty) * 112 : 0;
                      const jhtHPx = maxWastageQty > 0 ? (d.jhuteCutpcsQty / maxWastageQty) * 112 : 0;
                      const isHovered = hoveredUnit === d.unit;

                      return (
                        <div
                          key={`waste-bar-col-${d.unit}`}
                          className="absolute bottom-[10px] -translate-x-1/2 flex items-end gap-1 pointer-events-auto cursor-pointer group"
                          style={{ left: `${pctX}%` }}
                          onMouseEnter={() => setHoveredUnit(d.unit)}
                          onMouseLeave={() => setHoveredUnit(null)}
                        >
                          {/* Reject Bar */}
                          <div
                            className={`w-2 sm:w-2.5 rounded-t-xs transition-all ${
                              isHovered ? 'bg-[#1b6395] shadow-xs' : 'bg-[#0F4C75]'
                            }`}
                            style={{ height: `${d.rejectQty > 0 ? Math.max(2, rejHPx) : 0}px` }}
                          />

                          {/* Jhute Bar */}
                          <div
                            className={`w-2 sm:w-2.5 rounded-t-xs transition-all ${
                              isHovered ? 'bg-emerald-500 shadow-xs' : 'bg-[#16A34A]'
                            }`}
                            style={{ height: `${d.jhuteCutpcsQty > 0 ? Math.max(2, jhtHPx) : 0}px` }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Undistorted Markers for Reject % (Orange Square) and Jhute % (Cyan Cross) */}
                  {lossData.map((d, i) => {
                    const pctX = lossData.length === 1 ? 50 : ((i + 0.5) / lossData.length) * 100;
                    const rejY = 130 - (maxWastagePct > 0 ? (Math.min(maxWastagePct, d.rejectPct) / maxWastagePct) * 112 : 0);
                    const jhtY = 130 - (maxWastagePct > 0 ? (Math.min(maxWastagePct, d.jhuteCutpcsPct) / maxWastagePct) * 112 : 0);
                    const isHovered = hoveredUnit === d.unit;

                    return (
                      <React.Fragment key={`waste-pts-dom-${d.unit}`}>
                        {/* Reject % Square */}
                        <div
                          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
                          style={{ left: `${pctX}%`, top: `${rejY}px` }}
                        >
                          <div
                            className={`w-2 h-2 sm:w-2.5 sm:h-2.5 bg-[#E67E22] border border-white shadow-2xs transition-transform duration-150 ${
                              isHovered ? 'scale-125 bg-amber-500' : ''
                            }`}
                          />
                        </div>

                        {/* Jhute % Cross 'x' */}
                        <div
                          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center font-black text-[#0284C7] text-[11px] sm:text-xs leading-none drop-shadow-xs select-none"
                          style={{ left: `${pctX}%`, top: `${jhtY}px` }}
                        >
                          ✕
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Right Y-Axis: Wastage Qty */}
                <div className="w-8 h-[140px] flex flex-col justify-between items-start pl-1.5 text-[9.5px] font-bold text-slate-500 dark:text-slate-400 select-none pb-1 border-l border-slate-200 dark:border-slate-800">
                  <span>{maxWastageQty}</span>
                  <span>{Math.round(maxWastageQty * 0.75)}</span>
                  <span>{Math.round(maxWastageQty * 0.5)}</span>
                  <span>{Math.round(maxWastageQty * 0.25)}</span>
                  <span>0</span>
                </div>
              </div>
            </div>
          )}

          {/* Integrated Data Table */}
          {lossData.length > 0 && (
            <div className="w-full overflow-x-auto mt-2 border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
              <table className="w-full text-[9.5px] sm:text-[10px] border-collapse bg-white dark:bg-slate-900">
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="px-1.5 py-1 text-left w-18 sm:w-22 border-r border-slate-200 dark:border-slate-700">Metric</th>
                    {lossData.map(d => (
                      <th key={`hdr-w-${d.unit}`} className="px-1 py-1 text-center border-r last:border-r-0 border-slate-200 dark:border-slate-700 truncate">
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Reject */}
                  <tr className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-1.5 py-0.5 font-bold text-[#0F4C75] dark:text-blue-400 bg-slate-50/80 dark:bg-slate-800/60 border-r border-slate-200 dark:border-slate-700">
                      Reject
                    </td>
                    {lossData.map(d => (
                      <td key={`rej-val-${d.unit}`} className="px-1 py-0.5 text-center font-medium text-slate-800 dark:text-slate-200 border-r last:border-r-0 border-slate-200 dark:border-slate-700 font-mono">
                        {d.rejectQty}
                      </td>
                    ))}
                  </tr>
                  {/* Row 2: Jhut/Cutpcs */}
                  <tr className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-1.5 py-0.5 font-bold text-[#16A34A] dark:text-emerald-400 bg-slate-50/80 dark:bg-slate-800/60 border-r border-slate-200 dark:border-slate-700">
                      Jhut/Cutpcs
                    </td>
                    {lossData.map(d => (
                      <td key={`jht-val-${d.unit}`} className="px-1 py-0.5 text-center font-medium text-slate-800 dark:text-slate-200 border-r last:border-r-0 border-slate-200 dark:border-slate-700 font-mono">
                        {d.jhuteCutpcsQty}
                      </td>
                    ))}
                  </tr>
                  {/* Row 3: Reject % */}
                  <tr className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-1.5 py-0.5 font-bold text-[#E67E22] bg-slate-50/80 dark:bg-slate-800/60 border-r border-slate-200 dark:border-slate-700">
                      Reject%
                    </td>
                    {lossData.map(d => (
                      <td key={`rejp-val-${d.unit}`} className="px-1 py-0.5 text-center font-semibold text-[#D35400] dark:text-[#E67E22] border-r last:border-r-0 border-slate-200 dark:border-slate-700 font-mono">
                        {d.rejectPct.toFixed(2)}%
                      </td>
                    ))}
                  </tr>
                  {/* Row 4: Jhut/Cutpcs % */}
                  <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-1.5 py-0.5 font-bold text-[#0284C7] bg-slate-50/80 dark:bg-slate-800/60 border-r border-slate-200 dark:border-slate-700">
                      Jhut/Cutpcs %
                    </td>
                    {lossData.map(d => (
                      <td key={`jhtp-val-${d.unit}`} className="px-1 py-0.5 text-center font-semibold text-[#0284C7] border-r last:border-r-0 border-slate-200 dark:border-slate-700 font-mono">
                        {d.jhuteCutpcsPct.toFixed(2)}%
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* CARD 3: Absent Summary (Bars + Line + Data Grid)    */}
      {/* ---------------------------------------------------- */}
      <div 
        className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
        id="card-absent-summary"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#B95D18] via-[#C96B20] to-[#A34E0F] text-white px-4 py-2.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-white/15 backdrop-blur-xs">
              <UserX className="w-4 h-4 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base tracking-tight text-white leading-tight">
                  Absent Summary
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
                  <Calendar className="w-2.5 h-2.5" />
                  {activeDateDisplay}
                </span>
              </div>
              <p className="text-[10px] text-amber-100/90 font-medium">Workforce Absenteeism & Rate %</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
              Absent: {totalAbsent} Pers.
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="pt-2 px-3.5 pb-1 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Unit Absenteeism</span>
          <div className="flex items-center gap-x-3 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#0F4C75] inline-block shadow-2xs"></span>
              <span className="text-slate-600 dark:text-slate-300">Absentism</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-[#E67E22] inline-block"></span>
              <span className="w-1.5 h-1.5 bg-[#E67E22] inline-block -ml-1"></span>
              <span className="text-slate-600 dark:text-slate-300">Rate %</span>
            </div>
          </div>
        </div>

        {/* Dual Axis Chart Area */}
        <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
          {lossData.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-6 h-[180px] text-slate-400 dark:text-slate-500">
              <Layers className="w-7 h-7 mb-2 opacity-40 text-[#B95D18]" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Absenteeism Data Available</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-[200px]">
                No ledger records matching selected filters.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto scrollbar-none">
              <div className="min-w-[320px] h-[160px] relative flex">
                {/* Left Y-Axis: Absent Count */}
                <div className="w-8 h-[140px] flex flex-col justify-between items-end pr-1.5 text-[9.5px] font-bold text-slate-500 dark:text-slate-400 select-none pb-1 border-r border-slate-200 dark:border-slate-800">
                  <span>{maxAbsentCount}</span>
                  <span>{(maxAbsentCount * 0.75).toFixed(1)}</span>
                  <span>{(maxAbsentCount * 0.5).toFixed(1)}</span>
                  <span>{(maxAbsentCount * 0.25).toFixed(1)}</span>
                  <span>0</span>
                </div>

                {/* SVG Combo Canvas */}
                <div className="flex-1 h-[140px] relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 320 140" preserveAspectRatio="none">
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const y = 130 - ratio * 112;
                      return (
                        <line 
                          key={`absent-grid-${ratio}`} 
                          x1="0" 
                          y1={y} 
                          x2="320" 
                          y2={y} 
                          stroke="#cbd5e1" 
                          strokeWidth="0.75" 
                          strokeDasharray={ratio === 0 ? 'none' : '3,3'} 
                          className="dark:stroke-slate-800"
                          opacity={ratio === 0 ? 0.9 : 0.45} 
                        />
                      );
                    })}

                    {/* Line for Absent Rate % */}
                    {lossData.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#E67E22"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={lossData.map((d, i) => {
                          const step = 320 / lossData.length;
                          const x = i * step + step / 2;
                          const y = 130 - (maxAbsentRate > 0 ? (Math.min(maxAbsentRate, d.absentRatePct) / maxAbsentRate) * 112 : 0);
                          return `${x},${y}`;
                        }).join(' ')}
                      />
                    )}
                  </svg>

                  {/* Undistorted HTML Bars for Absent Count */}
                  <div className="absolute inset-0 pointer-events-none">
                    {lossData.map((d, i) => {
                      const pctX = lossData.length === 1 ? 50 : ((i + 0.5) / lossData.length) * 100;
                      const barHPx = maxAbsentCount > 0 ? (d.absentCount / maxAbsentCount) * 112 : 0;
                      const isHovered = hoveredUnit === d.unit;

                      return (
                        <div
                          key={`abs-bar-col-${d.unit}`}
                          className="absolute bottom-[10px] -translate-x-1/2 flex flex-col items-center pointer-events-auto cursor-pointer group"
                          style={{ left: `${pctX}%` }}
                          onMouseEnter={() => setHoveredUnit(d.unit)}
                          onMouseLeave={() => setHoveredUnit(null)}
                        >
                          {d.absentCount > 0 && (
                            <div
                              className={`w-3.5 sm:w-4 rounded-t-xs transition-all ${
                                isHovered ? 'bg-[#1b6395] shadow-xs' : 'bg-[#0F4C75]'
                              }`}
                              style={{ height: `${Math.max(2, barHPx)}px` }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Undistorted Square Markers for Absent Rate % */}
                  {lossData.map((d, i) => {
                    const pctX = lossData.length === 1 ? 50 : ((i + 0.5) / lossData.length) * 100;
                    const yPx = 130 - (maxAbsentRate > 0 ? (Math.min(maxAbsentRate, d.absentRatePct) / maxAbsentRate) * 112 : 0);
                    const isHovered = hoveredUnit === d.unit;

                    return (
                      <div
                        key={`abs-pt-${d.unit}`}
                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer z-10"
                        style={{ left: `${pctX}%`, top: `${yPx}px` }}
                        onMouseEnter={() => setHoveredUnit(d.unit)}
                        onMouseLeave={() => setHoveredUnit(null)}
                      >
                        <div
                          className={`w-2.5 h-2.5 bg-[#E67E22] border-2 border-white shadow-2xs transition-transform duration-150 ${
                            isHovered ? 'scale-125 bg-amber-500' : ''
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Right Y-Axis: Absent Rate % */}
                <div className="w-13 h-[140px] flex flex-col justify-between items-start pl-1.5 text-[9.5px] font-bold text-[#E67E22] select-none pb-1 border-l border-slate-200 dark:border-slate-800">
                  <span>{(maxAbsentRate).toFixed(2)}%</span>
                  <span>{(maxAbsentRate * 0.75).toFixed(2)}%</span>
                  <span>{(maxAbsentRate * 0.5).toFixed(2)}%</span>
                  <span>{(maxAbsentRate * 0.25).toFixed(2)}%</span>
                  <span>0.00%</span>
                </div>
              </div>
            </div>
          )}

          {/* Integrated Data Table */}
          {lossData.length > 0 && (
            <div className="w-full overflow-x-auto mt-2 border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
              <table className="w-full text-[10px] sm:text-[10.5px] border-collapse bg-white dark:bg-slate-900">
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="px-2 py-1 text-left w-16 sm:w-20 border-r border-slate-200 dark:border-slate-700">Unit</th>
                    {lossData.map(d => (
                      <th key={`hdr-a-${d.unit}`} className="px-1 py-1 text-center border-r last:border-r-0 border-slate-200 dark:border-slate-700 truncate">
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Absentism */}
                  <tr className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-2 py-1 font-bold text-[#0F4C75] dark:text-blue-400 bg-slate-50/80 dark:bg-slate-800/60 border-r border-slate-200 dark:border-slate-700">
                      Absentism
                    </td>
                    {lossData.map(d => (
                      <td key={`abs-val-${d.unit}`} className="px-1 py-1 text-center font-medium text-slate-800 dark:text-slate-200 border-r last:border-r-0 border-slate-200 dark:border-slate-700 font-mono">
                        {d.absentCount}
                      </td>
                    ))}
                  </tr>
                  {/* Row 2: Rate % */}
                  <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-2 py-1 font-bold text-[#E67E22] bg-slate-50/80 dark:bg-slate-800/60 border-r border-slate-200 dark:border-slate-700">
                      Rate %
                    </td>
                    {lossData.map(d => (
                      <td key={`absp-val-${d.unit}`} className="px-1 py-1 text-center font-semibold text-[#D35400] dark:text-[#E67E22] border-r last:border-r-0 border-slate-200 dark:border-slate-700 font-mono">
                        {d.absentRatePct.toFixed(2)}%
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
