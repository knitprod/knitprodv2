/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Secondary Element Consumption Dashboard Cards
 * 1. Needle Broken (pcs) - Line Chart (Broken Qty) + Column Chart (Set Change Needle)
 * 2. Sinker Broken (pcs) - Line Chart (Broken Qty) + Column Chart (Set Change Sinker)
 * 3. Oil Consumption (Ltr) - Real-time Consumption by Unit from Ledger
 * 4. Belt Broken (pcs) - Line Chart showing Broken Belt count by Unit from Ledger
 * 
 * STRICT DATA INTEGRITY: Displays ONLY real records recorded in the ledger (0 if not recorded).
 */

import React, { useMemo, useState } from 'react';
import { 
  Wrench, 
  Droplet, 
  Disc, 
  Calendar,
  Sparkles,
  Layers,
  Package
} from 'lucide-react';
import { useGlobalData } from '../context/GlobalDataContext';
import { FilterState } from './DashboardFilterToolbar';
import { 
  filterLedgerByState, 
  isRecordMatchingFloor, 
  isSubContactRecord 
} from '../lib/productionMetrics';
import OtherSparePartsLedgerDrawer, { parseSparePartsFromLedger } from './OtherSparePartsLedgerDrawer';

interface DashboardSecondaryElementCardsProps {
  filterState?: FilterState;
}

interface SecondaryElementMetric {
  key: string;
  unit: string;
  label: string;
  needleBroken: number;
  setChangeNeedle: number;
  needlePerKg: number;
  sinkerBroken: number;
  setChangeSinker: number;
  sinkerPerKg: number;
  oilConsumption: number;
  oilPerKg: number;
  beltBroken: number;
  beltPerKg: number;
  totalProduction: number;
  recordCount: number;
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

export default function DashboardSecondaryElementCards({ filterState }: DashboardSecondaryElementCardsProps) {
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

    return '29 Aug 2026';
  }, [filterState, ledger]);

  // Aggregate metrics per internal unit STRICTLY from filtered ledger rows (NO MOCK/DEFAULTS)
  const elementData = useMemo<SecondaryElementMetric[]>(() => {
    const { filteredRows } = filterLedgerByState(ledger, filterState);
    // Secondary elements are tracked on in-house manufacturing units
    const inHouseRows = filteredRows.filter(r => !isSubContactRecord(r));

    const standardUnits = [
      { key: 'ekl', name: 'EKL', label: 'EKL', matchKeys: ['ekl'] },
      { key: 'efl', name: 'EFL', label: 'EFL', matchKeys: ['efl', 'efl-1', 'efl 1'] },
      { key: 'efl-2', name: 'EFL-2', label: 'EFL-2', matchKeys: ['efl-2', 'efl 2', 'efl2'] },
      { key: 'auto-stripe', name: 'Auto Stripe', label: 'Auto-Stripe', matchKeys: ['auto stripe', 'auto-stripe', 'autostripe', 'auto'] },
      { key: 'efl-extension', name: 'EFL-Extension', label: 'Extension', matchKeys: ['efl-extension', 'extension', 'efl extension', 'ext'] },
      { key: 'esl-extension', name: 'ESL-Extension', label: 'ESL-Extension', matchKeys: ['esl-extension', 'esl extension', 'esl-ext', 'esl'] },
    ];

    const result: SecondaryElementMetric[] = [];

    for (const u of standardUnits) {
      const rows = inHouseRows.filter(r => {
        const floor = (r.floor || '').trim().toLowerCase();
        const unit = (r.unit || '').trim().toLowerCase();
        
        // Exact match with exclusion to avoid EFL matching EFL-2 or EFL-Extension incorrectly
        if (u.key === 'efl') {
          if (floor.includes('efl-2') || floor.includes('efl 2') || floor.includes('extension') || floor.includes('ext')) {
            return false;
          }
          if (unit.includes('efl-2') || unit.includes('efl 2') || unit.includes('extension') || unit.includes('ext')) {
            return false;
          }
        }
        if (u.key === 'efl-extension') {
          if (floor.includes('esl') || unit.includes('esl')) {
            return false;
          }
        }

        return u.matchKeys.some(k => floor === k || unit === k || floor.includes(k) || unit.includes(k) || isRecordMatchingFloor(r, u.name));
      });

      const totProd = rows.reduce((sum, r) => sum + (Number(r.totalProduction) || 0), 0);
      
      // Calculate Needle Broken (STRICTLY FROM LEDGER)
      const needleBroken = rows.reduce((sum, r) => sum + (Number(r.needleBroken) || 0), 0);

      // Calculate Set Change Needle (STRICTLY FROM LEDGER)
      const setChangeNeedle = rows.reduce((sum, r) => sum + (Number(r.setChangeNeedle) || 0), 0);

      // Calculate Sinker Broken (STRICTLY FROM LEDGER)
      const sinkerBroken = rows.reduce((sum, r) => sum + (Number(r.sinkerBroken) || 0), 0);

      // Calculate Set Change Sinker (STRICTLY FROM LEDGER)
      const setChangeSinker = rows.reduce((sum, r) => sum + (Number(r.setChangeSinker) || 0), 0);

      // Calculate Oil Consumption (STRICTLY FROM LEDGER)
      const oilConsumption = rows.reduce((sum, r) => sum + (Number(r.oilConsumption) || 0), 0);

      // Calculate Belt Broken (STRICTLY FROM LEDGER)
      const beltBroken = rows.reduce((sum, r) => sum + (Number(r.beltBroken) || 0), 0);

      const needlePerKg = (needleBroken > 0 && totProd > 0) ? Math.round(totProd / needleBroken) : 0;
      const sinkerPerKg = (sinkerBroken > 0 && totProd > 0) ? Math.round(totProd / sinkerBroken) : 0;
      const oilPerKg = (oilConsumption > 0 && totProd > 0) ? Math.round(totProd / oilConsumption) : 0;
      const beltPerKg = (beltBroken > 0 && totProd > 0) ? Math.round(totProd / beltBroken) : 0;

      result.push({
        key: u.key,
        unit: u.name,
        label: u.label,
        needleBroken,
        setChangeNeedle,
        needlePerKg,
        sinkerBroken,
        setChangeSinker,
        sinkerPerKg,
        oilConsumption,
        oilPerKg,
        beltBroken,
        beltPerKg,
        totalProduction: totProd,
        recordCount: rows.length,
      });
    }

    return result;
  }, [ledger, filterState]);

  // Overall totals
  const totalNeedleBroken = useMemo(() => elementData.reduce((sum, u) => sum + u.needleBroken, 0), [elementData]);
  const totalSetChangeNeedle = useMemo(() => elementData.reduce((sum, u) => sum + u.setChangeNeedle, 0), [elementData]);
  const totalSinkerBroken = useMemo(() => elementData.reduce((sum, u) => sum + u.sinkerBroken, 0), [elementData]);
  const totalSetChangeSinker = useMemo(() => elementData.reduce((sum, u) => sum + u.setChangeSinker, 0), [elementData]);
  const totalOilConsumption = useMemo(() => elementData.reduce((sum, u) => sum + u.oilConsumption, 0), [elementData]);
  const totalBeltBroken = useMemo(() => elementData.reduce((sum, u) => sum + u.beltBroken, 0), [elementData]);

  // Overall count for Other Spare Parts logged in filtered ledger (parsed)
  const totalOtherSpareParts = useMemo(() => {
    const { filteredRows } = filterLedgerByState(ledger, filterState);
    const inHouseRows = filteredRows.filter(r => !isSubContactRecord(r));
    const parsed = parseSparePartsFromLedger(inHouseRows);
    const totalQty = parsed.reduce((sum, item) => sum + item.quantity, 0);
    return { totalQty, count: parsed.length };
  }, [ledger, filterState]);

  // Scaling calculations
  // Card 1: Needle Broken (Line max & Set Change Bar max)
  const maxBrokenNeedle = useMemo(() => {
    const maxVal = Math.max(...elementData.map(u => u.needleBroken), 0);
    if (maxVal === 0) return 200;
    if (maxVal <= 50) return 50;
    if (maxVal <= 100) return 100;
    if (maxVal <= 200) return 200;
    return Math.ceil(maxVal / 50) * 50;
  }, [elementData]);

  const maxSetChangeNeedle = useMemo(() => {
    const maxVal = Math.max(...elementData.map(u => u.setChangeNeedle), 0);
    if (maxVal === 0) return 8000;
    if (maxVal <= 2000) return 2000;
    if (maxVal <= 4000) return 4000;
    if (maxVal <= 8000) return 8000;
    return Math.ceil(maxVal / 2000) * 2000;
  }, [elementData]);

  // Card 2: Sinker Broken (Line max & Set Change Sinker Bar max)
  const maxBrokenSinker = useMemo(() => {
    const maxVal = Math.max(...elementData.map(u => u.sinkerBroken), 0);
    if (maxVal === 0) return 10;
    if (maxVal <= 5) return 5;
    if (maxVal <= 10) return 10;
    if (maxVal <= 50) return 50;
    return Math.ceil(maxVal / 10) * 10;
  }, [elementData]);

  const maxSetChangeSinker = useMemo(() => {
    const maxVal = Math.max(...elementData.map(u => u.setChangeSinker), 0);
    if (maxVal === 0) return 1000;
    if (maxVal <= 500) return 500;
    if (maxVal <= 1000) return 1000;
    if (maxVal <= 5000) return 5000;
    return Math.ceil(maxVal / 500) * 500;
  }, [elementData]);

  // Card 3: Oil Consumption
  const maxOil = useMemo(() => {
    const maxVal = Math.max(...elementData.map(u => u.oilConsumption), 0);
    if (maxVal === 0) return 15;
    if (maxVal <= 10) return 10;
    if (maxVal <= 20) return 20;
    return Math.ceil(maxVal / 5) * 5;
  }, [elementData]);

  // Card 4: Belt Broken
  const maxBelt = useMemo(() => {
    const maxVal = Math.max(...elementData.map(u => u.beltBroken), 0);
    if (maxVal === 0) return 1;
    if (maxVal <= 1) return 1;
    if (maxVal <= 5) return 5;
    if (maxVal <= 10) return 10;
    return Math.ceil(maxVal / 2) * 2;
  }, [elementData]);

  const numUnits = elementData.length || 6;
  const svgWidth = 600;
  const svgHeight = 165;

  return (
    <div className="w-full my-5" id="dashboard-secondary-element-section">
      {/* ---------------------------------------------------- */}
      {/* SECTION HEADER BANNER: Secondary Element Consumption */}
      {/* ---------------------------------------------------- */}
      <div className="w-full bg-[#C8681B] dark:bg-[#B95D18] text-white py-2.5 px-4 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-2.5 mb-4 border border-[#B35612] dark:border-[#964207]">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-white drop-shadow-xs" />
          <h2 className="text-base sm:text-lg font-bold tracking-wide text-white drop-shadow-xs">
            Secondary Element Consumption
          </h2>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-xs">
            <Package className="w-3.5 h-3.5 text-amber-300" />
            <span>Spare Parts: {totalOtherSpareParts.totalQty} pcs</span>
          </span>

          <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-xs">
            <Calendar className="w-3.5 h-3.5 text-white" />
            {activeDateDisplay}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white text-[#C8681B] shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            6 In-House Units
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 4 CARDS GRID (Needle, Sinker, Oil, Belt Broken)      */}
      {/* ---------------------------------------------------- */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        
        {/* ==================================================== */}
        {/* CARD 1: Needle Broken (pcs)                          */}
        {/* Line: Broken Qty • Stacked Column: Set Change Needle  */}
        {/* ==================================================== */}
        <div 
          className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
          id="card-needle-broken"
        >
          {/* Header */}
          <div className="bg-[#2B1D14] dark:bg-[#1E140F] text-white px-3.5 py-2.5 flex items-center justify-between border-b border-[#3D291C]">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-white/10">
                <Wrench className="w-3.5 h-3.5 text-[#E67E22]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                  Needle Broken (pcs)
                </h3>
              </div>
            </div>
            <div className="text-right flex items-center gap-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-[#E67E22]/20 text-[#E67E22] border border-[#E67E22]/40 whitespace-nowrap">
                Tot: {totalNeedleBroken.toLocaleString()} pcs
              </span>
            </div>
          </div>

          {/* Subheader & Legend */}
          <div className="px-3 pt-2 pb-1.5 flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
              Left: Broken • Right: Set Chg
            </span>
            <div className="flex items-center gap-2 select-none">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs bg-[#D35400] dark:bg-[#E67E22]"></span>
                <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">Set</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-0.5 bg-[#0F4C75] dark:bg-[#38BDF8] flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-[#0F4C75] dark:bg-[#38BDF8]"></div>
                </div>
                <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">Broken</span>
              </div>
            </div>
          </div>

          {/* Dual-Axis SVG Line & Column Chart */}
          <div className="p-2.5 relative flex-1 flex flex-col justify-between">
            <div className="w-full h-[200px] relative flex flex-col justify-between">
              
              {/* Top Row: Left Y-Axis, Plot Area, Right Y-Axis */}
              <div className="w-full h-[145px] relative flex">
                {/* Left Y-Axis (Broken Qty: 0 to maxBrokenNeedle) */}
                <div className="w-7 h-[145px] flex flex-col justify-between items-end pr-1 text-[9px] font-bold text-[#0F4C75] dark:text-[#38BDF8] select-none pb-2 border-r border-slate-200 dark:border-slate-800">
                  <span>{maxBrokenNeedle}</span>
                  <span>{Math.round(maxBrokenNeedle * 0.75)}</span>
                  <span>{Math.round(maxBrokenNeedle * 0.50)}</span>
                  <span>{Math.round(maxBrokenNeedle * 0.25)}</span>
                  <span>0</span>
                </div>

                {/* Main Chart Stage */}
                <div className="flex-1 h-[145px] relative px-0.5 border-b border-slate-300 dark:border-slate-700">
                  {/* Horizontal reference lines */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between opacity-30 pb-2">
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-slate-300 dark:border-slate-700"></div>
                  </div>

                  {/* SVG Layer for Connected Broken Qty Line */}
                  <svg 
                    viewBox={`0 0 ${svgWidth} 145`} 
                    preserveAspectRatio="none" 
                    className="absolute inset-0 w-full h-[145px] pointer-events-none z-20 overflow-visible"
                  >
                    {(() => {
                      const points = elementData.map((item, idx) => {
                        const x = (idx + 0.5) * (svgWidth / numUnits);
                        const rawPct = Math.min(100, Math.max(0, (item.needleBroken / (maxBrokenNeedle || 1)) * 100));
                        const y = 135 - (rawPct / 100) * 110;
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

                  {/* Columns Container */}
                  <div className="relative w-full h-full flex items-end justify-between z-10">
                    {elementData.map((item) => {
                      const isHovered = hoveredUnit === item.unit;
                      const barHeightPct = item.setChangeNeedle > 0 
                        ? Math.min(100, Math.max(4, (item.setChangeNeedle / (maxSetChangeNeedle || 1)) * 100))
                        : 0;
                      const colHeightPx = (barHeightPct / 100) * 110;

                      return (
                        <div
                          key={`col-${item.unit}`}
                          className={`flex-1 flex flex-col items-center justify-end h-full px-0.5 group cursor-pointer transition-all duration-150 rounded-t-lg relative ${
                            isHovered ? 'bg-amber-500/10 dark:bg-amber-400/10' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                          }`}
                          onMouseEnter={() => setHoveredUnit(item.unit)}
                          onMouseLeave={() => setHoveredUnit(null)}
                          title={`${item.unit}\n• Set Change Needle: ${item.setChangeNeedle.toLocaleString()} pcs\n• Broken Needle: ${item.needleBroken.toLocaleString()} pcs\n• Needle/Kg: ${item.needlePerKg.toLocaleString()} Kg`}
                        >
                          {/* Set Change Orange Column */}
                          <div className="flex flex-col items-center justify-end h-full w-[13px] sm:w-[16px] relative pb-0.5">
                            {item.setChangeNeedle > 0 && (
                              <span className="text-[7px] font-bold text-[#D35400] dark:text-[#F39C12] select-none absolute -top-3.5 whitespace-nowrap z-10 transition-transform group-hover:scale-110">
                                {item.setChangeNeedle >= 1000 ? `${(item.setChangeNeedle / 1000).toFixed(item.setChangeNeedle % 1000 === 0 ? 0 : 1)}k` : item.setChangeNeedle}
                              </span>
                            )}
                            {barHeightPct > 0 ? (
                              <div
                                className="w-full rounded-t-xs transition-all duration-300 bg-gradient-to-t from-[#D35400] to-[#E67E22] hover:brightness-110 shadow-xs"
                                style={{ height: `${Math.max(4, colHeightPx)}px` }}
                              />
                            ) : (
                              <div className="w-full h-0.5 bg-slate-200 dark:bg-slate-700 opacity-60"></div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* HTML Point Markers (Positioned cleanly over SVG vertices) */}
                  {elementData.map((item, idx) => {
                    const pctX = ((idx + 0.5) / numUnits) * 100;
                    const rawLinePct = Math.min(100, Math.max(0, (item.needleBroken / (maxBrokenNeedle || 1)) * 100));
                    const yPx = 135 - (rawLinePct / 100) * 110;
                    const isHovered = hoveredUnit === item.unit;

                    return (
                      <div 
                        key={`pt-${item.unit}`}
                        className="absolute z-30 flex flex-col items-center pointer-events-auto cursor-pointer -translate-x-1/2 -translate-y-1/2 group"
                        style={{ left: `${pctX}%`, top: `${yPx}px` }}
                        onMouseEnter={() => setHoveredUnit(item.unit)}
                        onMouseLeave={() => setHoveredUnit(null)}
                      >
                        {/* Broken Qty Value Badge directly above line point */}
                        <div className="absolute bottom-full mb-1 flex items-center justify-center pointer-events-none">
                          <span className={`text-[8.5px] font-black px-1 py-0.2 rounded-xs select-none transition-all drop-shadow-xs whitespace-nowrap ${
                            isHovered
                              ? 'bg-[#0F4C75] text-white scale-110'
                              : 'text-[#0F4C75] dark:text-[#38BDF8] bg-white/90 dark:bg-slate-900/90 shadow-2xs'
                          }`}>
                            {item.needleBroken}
                          </span>
                        </div>
                        <div className={`w-2 h-2 rounded-full bg-[#0F4C75] dark:bg-[#38BDF8] border border-white dark:border-slate-900 shadow-xs transition-transform ${
                          isHovered ? 'scale-125 ring-2 ring-[#0F4C75]/40' : ''
                        }`}></div>
                      </div>
                    );
                  })}
                </div>

                {/* Right Y-Axis (Set Change: 0 to maxSetChangeNeedle) */}
                <div className="w-9 h-[145px] flex flex-col justify-between items-start pl-1 text-[9px] font-bold text-[#E67E22] dark:text-[#F39C12] select-none pb-2 border-l border-slate-200 dark:border-slate-800">
                  <span>{maxSetChangeNeedle >= 1000 ? `${maxSetChangeNeedle / 1000}k` : maxSetChangeNeedle}</span>
                  <span>{Math.round(maxSetChangeNeedle * 0.75) >= 1000 ? `${(Math.round(maxSetChangeNeedle * 0.75) / 1000).toFixed(1)}k` : Math.round(maxSetChangeNeedle * 0.75)}</span>
                  <span>{Math.round(maxSetChangeNeedle * 0.50) >= 1000 ? `${(Math.round(maxSetChangeNeedle * 0.50) / 1000).toFixed(1)}k` : Math.round(maxSetChangeNeedle * 0.50)}</span>
                  <span>{Math.round(maxSetChangeNeedle * 0.25) >= 1000 ? `${(Math.round(maxSetChangeNeedle * 0.25) / 1000).toFixed(1)}k` : Math.round(maxSetChangeNeedle * 0.25)}</span>
                  <span>0</span>
                </div>
              </div>

              {/* Dedicated X-Axis Labels Row (Slanted at -40deg to prevent any text overlay or crowding) */}
              <div className="w-full h-11 relative flex items-start pt-1.5 overflow-visible">
                <div className="w-7 shrink-0" />
                <div className="flex-1 flex justify-between px-0.5 overflow-visible">
                  {elementData.map((item) => {
                    const isHovered = hoveredUnit === item.unit;
                    return (
                      <div 
                        key={`x-lbl-${item.unit}`} 
                        className="flex-1 flex justify-center items-start overflow-visible cursor-pointer group"
                        onMouseEnter={() => setHoveredUnit(item.unit)}
                        onMouseLeave={() => setHoveredUnit(null)}
                        title={item.label}
                      >
                        <span 
                          className={`text-[8.5px] sm:text-[9px] font-bold select-none whitespace-nowrap transform -rotate-40 origin-top-left translate-y-0.5 transition-colors ${
                            isHovered 
                              ? 'text-[#E67E22] font-extrabold' 
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="w-9 shrink-0" />
              </div>

            </div>

            {/* Bottom mini metric row */}
            <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9.5px]">
              <span className="text-slate-500 dark:text-slate-400 truncate">
                Set Chg: <strong className="text-slate-800 dark:text-slate-200 font-bold">{totalSetChangeNeedle.toLocaleString()}</strong>
              </span>
              <span className="text-[#0F4C75] dark:text-[#38BDF8] font-bold truncate">
                Broken: {totalNeedleBroken.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* CARD 2: Sinker Broken (pcs)                          */}
        {/* Line: Broken Qty • Stacked Column: Set Change Sinker  */}
        {/* ==================================================== */}
        <div 
          className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
          id="card-sinker-broken"
        >
          {/* Header */}
          <div className="bg-[#2B1D14] dark:bg-[#1E140F] text-white px-3.5 py-2.5 flex items-center justify-between border-b border-[#3D291C]">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-white/10">
                <Disc className="w-3.5 h-3.5 text-[#0284C7]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                  Sinker Broken (pcs)
                </h3>
              </div>
            </div>
            <div className="text-right flex items-center gap-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-[#0284C7]/20 text-[#38BDF8] border border-[#0284C7]/40 whitespace-nowrap">
                Tot: {totalSinkerBroken.toLocaleString()} pcs
              </span>
            </div>
          </div>

          {/* Subheader & Legend */}
          <div className="px-3 pt-2 pb-1.5 flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
              Left: Broken • Right: Set Chg
            </span>
            <div className="flex items-center gap-2 select-none">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs bg-[#0284C7] dark:bg-[#38BDF8]"></span>
                <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">Set</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-0.5 bg-[#0369A1] dark:bg-[#7DD3FC] flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-[#0369A1] dark:bg-[#7DD3FC]"></div>
                </div>
                <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">Broken</span>
              </div>
            </div>
          </div>

          {/* Dual Axis SVG Line & Column Chart Stage */}
          <div className="p-2.5 relative flex-1 flex flex-col justify-between">
            <div className="w-full h-[200px] relative flex flex-col justify-between">
              
              {/* Top Row: Left Y-Axis, Plot Area, Right Y-Axis */}
              <div className="w-full h-[145px] relative flex">
                {/* Left Y-Axis (Broken Qty: 0 to maxBrokenSinker) */}
                <div className="w-7 h-[145px] flex flex-col justify-between items-end pr-1 text-[9px] font-bold text-[#0369A1] dark:text-[#7DD3FC] select-none pb-2 border-r border-slate-200 dark:border-slate-800">
                  <span>{maxBrokenSinker}</span>
                  <span>{Math.round(maxBrokenSinker * 0.75)}</span>
                  <span>{Math.round(maxBrokenSinker * 0.50)}</span>
                  <span>{Math.round(maxBrokenSinker * 0.25)}</span>
                  <span>0</span>
                </div>

                {/* Chart Stage */}
                <div className="flex-1 h-[145px] relative px-0.5 border-b border-slate-300 dark:border-slate-700">
                  {/* Horizontal reference lines */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between opacity-30 pb-2">
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-slate-300 dark:border-slate-700"></div>
                  </div>

                  {/* SVG Layer for Connected Sinker Broken Line */}
                  <svg 
                    viewBox={`0 0 ${svgWidth} 145`} 
                    preserveAspectRatio="none" 
                    className="absolute inset-0 w-full h-[145px] pointer-events-none z-20 overflow-visible"
                  >
                    {(() => {
                      const points = elementData.map((item, idx) => {
                        const x = (idx + 0.5) * (svgWidth / numUnits);
                        const rawPct = Math.min(100, Math.max(0, (item.sinkerBroken / (maxBrokenSinker || 1)) * 100));
                        const y = 135 - (rawPct / 100) * 110;
                        return `${x},${y}`;
                      }).join(' ');

                      return (
                        <polyline
                          fill="none"
                          stroke="#0369A1"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={points}
                        />
                      );
                    })()}
                  </svg>

                  {/* Columns Container */}
                  <div className="relative w-full h-full flex items-end justify-between z-10">
                    {elementData.map((item) => {
                      const isHovered = hoveredUnit === item.unit;
                      const barHeightPct = item.setChangeSinker > 0 
                        ? Math.min(100, Math.max(4, (item.setChangeSinker / (maxSetChangeSinker || 1)) * 100))
                        : 0;
                      const colHeightPx = (barHeightPct / 100) * 110;

                      return (
                        <div
                          key={`col-sinker-${item.unit}`}
                          className={`flex-1 flex flex-col items-center justify-end h-full px-0.5 group cursor-pointer transition-all duration-150 rounded-t-lg relative ${
                            isHovered ? 'bg-sky-500/10 dark:bg-sky-400/10' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                          }`}
                          onMouseEnter={() => setHoveredUnit(item.unit)}
                          onMouseLeave={() => setHoveredUnit(null)}
                          title={`${item.unit}\n• Set Change Sinker: ${item.setChangeSinker.toLocaleString()} pcs\n• Sinker Broken: ${item.sinkerBroken} pcs\n• Sinker/Kg: ${item.sinkerPerKg.toLocaleString()} Kg`}
                        >
                          {/* Set Change Sinker Column */}
                          <div className="flex flex-col items-center justify-end h-full w-[13px] sm:w-[16px] relative pb-0.5">
                            {item.setChangeSinker > 0 && (
                              <span className="text-[7px] font-bold text-[#0284C7] dark:text-[#38BDF8] select-none absolute -top-3.5 whitespace-nowrap z-10 transition-transform group-hover:scale-110">
                                {item.setChangeSinker.toLocaleString()}
                              </span>
                            )}
                            {barHeightPct > 0 ? (
                              <div
                                className="w-full rounded-t-xs transition-all duration-300 bg-gradient-to-t from-[#0284C7] to-[#38BDF8] hover:brightness-110 shadow-xs"
                                style={{ height: `${Math.max(4, colHeightPx)}px` }}
                              />
                            ) : (
                              <div className="w-full h-0.5 bg-slate-200 dark:bg-slate-700 opacity-60"></div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* HTML Point Markers for Sinker Broken */}
                  {elementData.map((item, idx) => {
                    const pctX = ((idx + 0.5) / numUnits) * 100;
                    const rawLinePct = Math.min(100, Math.max(0, (item.sinkerBroken / (maxBrokenSinker || 1)) * 100));
                    const yPx = 135 - (rawLinePct / 100) * 110;
                    const isHovered = hoveredUnit === item.unit;

                    return (
                      <div 
                        key={`pt-sinker-${item.unit}`}
                        className="absolute z-30 flex flex-col items-center pointer-events-auto cursor-pointer -translate-x-1/2 -translate-y-1/2 group"
                        style={{ left: `${pctX}%`, top: `${yPx}px` }}
                        onMouseEnter={() => setHoveredUnit(item.unit)}
                        onMouseLeave={() => setHoveredUnit(null)}
                      >
                        {/* Broken Sinker Qty Value Badge */}
                        <div className="absolute bottom-full mb-1 flex items-center justify-center pointer-events-none">
                          <span className={`text-[8.5px] font-black px-1 py-0.2 rounded-xs select-none transition-all drop-shadow-xs whitespace-nowrap ${
                            isHovered
                              ? 'bg-[#0369A1] text-white scale-110'
                              : 'text-[#0369A1] dark:text-[#7DD3FC] bg-white/90 dark:bg-slate-900/90 shadow-2xs'
                          }`}>
                            {item.sinkerBroken}
                          </span>
                        </div>
                        <div className={`w-2 h-2 rounded-full bg-[#0369A1] dark:bg-[#7DD3FC] border border-white dark:border-slate-900 shadow-xs transition-transform ${
                          isHovered ? 'scale-125 ring-2 ring-[#0369A1]/40' : ''
                        }`}></div>
                      </div>
                    );
                  })}
                </div>

                {/* Right Y-Axis (Set Change Sinker: 0 to maxSetChangeSinker) */}
                <div className="w-9 h-[145px] flex flex-col justify-between items-start pl-1 text-[9px] font-bold text-[#0284C7] dark:text-[#38BDF8] select-none pb-2 border-l border-slate-200 dark:border-slate-800">
                  <span>{maxSetChangeSinker.toLocaleString()}</span>
                  <span>{Math.round(maxSetChangeSinker * 0.75).toLocaleString()}</span>
                  <span>{Math.round(maxSetChangeSinker * 0.50).toLocaleString()}</span>
                  <span>{Math.round(maxSetChangeSinker * 0.25).toLocaleString()}</span>
                  <span>0</span>
                </div>
              </div>

              {/* Dedicated X-Axis Labels Row (Slanted at -40deg) */}
              <div className="w-full h-11 relative flex items-start pt-1.5 overflow-visible">
                <div className="w-7 shrink-0" />
                <div className="flex-1 flex justify-between px-0.5 overflow-visible">
                  {elementData.map((item) => {
                    const isHovered = hoveredUnit === item.unit;
                    return (
                      <div 
                        key={`x-lbl-sinker-${item.unit}`} 
                        className="flex-1 flex justify-center items-start overflow-visible cursor-pointer group"
                        onMouseEnter={() => setHoveredUnit(item.unit)}
                        onMouseLeave={() => setHoveredUnit(null)}
                        title={item.label}
                      >
                        <span 
                          className={`text-[8.5px] sm:text-[9px] font-bold select-none whitespace-nowrap transform -rotate-40 origin-top-left translate-y-0.5 transition-colors ${
                            isHovered 
                              ? 'text-[#0284C7] font-extrabold' 
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="w-9 shrink-0" />
              </div>

            </div>

            {/* Bottom metric row */}
            <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9.5px]">
              <span className="text-slate-500 dark:text-slate-400 truncate">
                Set Chg: <strong className="text-slate-800 dark:text-slate-200 font-bold">{totalSetChangeSinker.toLocaleString()}</strong>
              </span>
              <span className="text-[#0369A1] dark:text-[#7DD3FC] font-bold truncate">
                Broken: {totalSinkerBroken.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* CARD 3: Oil Consumption (Ltr)                        */}
        {/* Line Chart showing lubrication consumption from Ledger*/}
        {/* ==================================================== */}
        <div 
          className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
          id="card-oil-consumption"
        >
          {/* Header */}
          <div className="bg-[#2B1D14] dark:bg-[#1E140F] text-white px-3.5 py-2.5 flex items-center justify-between border-b border-[#3D291C]">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-white/10">
                <Droplet className="w-3.5 h-3.5 text-[#D946EF]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                  Oil Consumption (Ltr)
                </h3>
              </div>
            </div>
            <div className="text-right flex items-center gap-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-[#D946EF]/20 text-[#E879F9] border border-[#D946EF]/40 whitespace-nowrap">
                Tot: {totalOilConsumption.toLocaleString()} Ltr
              </span>
            </div>
          </div>

          {/* Subheader */}
          <div className="px-3 pt-2 pb-1.5 flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
              Lubrication Oil Consumption
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-0.5 bg-[#D946EF] flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-[#D946EF]"></div>
              </div>
              <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">Oil (Ltr)</span>
            </div>
          </div>

          {/* Single Axis Chart Stage */}
          <div className="p-2.5 relative flex-1 flex flex-col justify-between">
            <div className="w-full h-[200px] relative flex flex-col justify-between">
              
              {/* Top Row: Left Y-Axis & Plot Stage */}
              <div className="w-full h-[145px] relative flex">
                {/* Y-Axis (0 to maxOil) */}
                <div className="w-7 h-[145px] flex flex-col justify-between items-end pr-1 text-[9px] font-bold text-[#D946EF] dark:text-[#E879F9] select-none pb-2 border-r border-slate-200 dark:border-slate-800">
                  <span>{maxOil}</span>
                  <span>{Math.round(maxOil * 0.75)}</span>
                  <span>{Math.round(maxOil * 0.50)}</span>
                  <span>{Math.round(maxOil * 0.25)}</span>
                  <span>0</span>
                </div>

                {/* Chart Stage */}
                <div className="flex-1 h-[145px] relative px-0.5 border-b border-slate-300 dark:border-slate-700">
                  {/* Horizontal reference lines */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between opacity-30 pb-2">
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-slate-300 dark:border-slate-700"></div>
                  </div>

                  {/* SVG Layer for Oil Line (Magenta/Pink) */}
                  <svg 
                    viewBox={`0 0 ${svgWidth} 145`} 
                    preserveAspectRatio="none" 
                    className="absolute inset-0 w-full h-[145px] pointer-events-none z-20 overflow-visible"
                  >
                    {(() => {
                      const points = elementData.map((item, idx) => {
                        const x = (idx + 0.5) * (svgWidth / numUnits);
                        const rawPct = Math.min(100, Math.max(0, (item.oilConsumption / (maxOil || 1)) * 100));
                        const y = 135 - (rawPct / 100) * 110;
                        return `${x},${y}`;
                      }).join(' ');

                      return (
                        <polyline
                          fill="none"
                          stroke="#D946EF"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={points}
                        />
                      );
                    })()}
                  </svg>

                  {/* HTML Point Markers for Oil */}
                  {elementData.map((item, idx) => {
                    const pctX = ((idx + 0.5) / numUnits) * 100;
                    const rawLinePct = Math.min(100, Math.max(0, (item.oilConsumption / (maxOil || 1)) * 100));
                    const yPx = 135 - (rawLinePct / 100) * 110;
                    const isHovered = hoveredUnit === item.unit;

                    return (
                      <div 
                        key={`pt-oil-${item.unit}`}
                        className="absolute z-30 flex flex-col items-center pointer-events-auto cursor-pointer -translate-x-1/2 -translate-y-1/2 group"
                        style={{ left: `${pctX}%`, top: `${yPx}px` }}
                        onMouseEnter={() => setHoveredUnit(item.unit)}
                        onMouseLeave={() => setHoveredUnit(null)}
                      >
                        {/* Oil Consumption Value Label */}
                        <div className="absolute bottom-full mb-1 flex items-center justify-center pointer-events-none">
                          <span className={`text-[8.5px] font-black px-1 py-0.2 rounded-xs select-none transition-all drop-shadow-xs whitespace-nowrap ${
                            isHovered
                              ? 'bg-[#D946EF] text-white scale-110'
                              : 'text-[#D946EF] dark:text-[#E879F9] bg-white/90 dark:bg-slate-900/90 shadow-2xs'
                          }`}>
                            {item.oilConsumption}
                          </span>
                        </div>
                        <div className={`w-2 h-2 rounded-full bg-[#D946EF] border border-white dark:border-slate-900 shadow-xs transition-transform ${
                          isHovered ? 'scale-125 ring-2 ring-[#D946EF]/40' : ''
                        }`}></div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dedicated X-Axis Labels Row (Slanted at -40deg) */}
              <div className="w-full h-11 relative flex items-start pt-1.5 overflow-visible">
                <div className="w-7 shrink-0" />
                <div className="flex-1 flex justify-between px-0.5 overflow-visible">
                  {elementData.map((item) => {
                    const isHovered = hoveredUnit === item.unit;
                    return (
                      <div 
                        key={`x-lbl-oil-${item.unit}`} 
                        className="flex-1 flex justify-center items-start overflow-visible cursor-pointer group"
                        onMouseEnter={() => setHoveredUnit(item.unit)}
                        onMouseLeave={() => setHoveredUnit(null)}
                        title={item.label}
                      >
                        <span 
                          className={`text-[8.5px] sm:text-[9px] font-bold select-none whitespace-nowrap transform -rotate-40 origin-top-left translate-y-0.5 transition-colors ${
                            isHovered 
                              ? 'text-[#D946EF] font-extrabold' 
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Bottom metric row */}
            <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9.5px]">
              <span className="text-slate-500 dark:text-slate-400 truncate">
                Avg: <strong className="text-slate-800 dark:text-slate-200 font-bold">{totalOilConsumption > 0 ? (totalOilConsumption / (elementData.filter(u => u.oilConsumption > 0).length || 1)).toFixed(1) : '0'} Ltr</strong>
              </span>
              <span className="text-[#D946EF] dark:text-[#E879F9] font-bold truncate">
                Total: {totalOilConsumption.toLocaleString()} Ltr
              </span>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* CARD 4: Belt Broken (pcs)                            */}
        {/* Line Chart showing Broken Belt count from Ledger      */}
        {/* ==================================================== */}
        <div 
          className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
          id="card-belt-broken"
        >
          {/* Header */}
          <div className="bg-[#2B1D14] dark:bg-[#1E140F] text-white px-3.5 py-2.5 flex items-center justify-between border-b border-[#3D291C]">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-white/10">
                <Layers className="w-3.5 h-3.5 text-[#EAB308]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                  Belt Broken (pcs)
                </h3>
              </div>
            </div>
            <div className="text-right flex items-center gap-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-[#EAB308]/20 text-[#FDE047] border border-[#EAB308]/40 whitespace-nowrap">
                Tot: {totalBeltBroken.toLocaleString()} pcs
              </span>
            </div>
          </div>

          {/* Subheader */}
          <div className="px-3 pt-2 pb-1.5 flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
              Replacement Belt Consumption
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-0.5 bg-[#854D0E] dark:bg-[#CA8A04] flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-[#0284C7] dark:bg-[#38BDF8]"></div>
              </div>
              <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">Broken (pcs)</span>
            </div>
          </div>

          {/* Single Axis Chart Stage */}
          <div className="p-2.5 relative flex-1 flex flex-col justify-between">
            <div className="w-full h-[200px] relative flex flex-col justify-between">
              
              {/* Top Row: Left Y-Axis & Plot Stage */}
              <div className="w-full h-[145px] relative flex">
                {/* Y-Axis (0 to maxBelt) */}
                <div className="w-7 h-[145px] flex flex-col justify-between items-end pr-1 text-[9px] font-bold text-[#854D0E] dark:text-[#FDE047] select-none pb-2 border-r border-slate-200 dark:border-slate-800">
                  <span>{maxBelt}</span>
                  <span>{(maxBelt * 0.8).toFixed(maxBelt === 1 ? 1 : 0)}</span>
                  <span>{(maxBelt * 0.6).toFixed(maxBelt === 1 ? 1 : 0)}</span>
                  <span>{(maxBelt * 0.4).toFixed(maxBelt === 1 ? 1 : 0)}</span>
                  <span>{(maxBelt * 0.2).toFixed(maxBelt === 1 ? 1 : 0)}</span>
                  <span>0</span>
                </div>

                {/* Chart Stage */}
                <div className="flex-1 h-[145px] relative px-0.5 border-b border-slate-300 dark:border-slate-700">
                  {/* Horizontal reference lines */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between opacity-30 pb-2">
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700"></div>
                    <div className="w-full border-b border-slate-300 dark:border-slate-700"></div>
                  </div>

                  {/* SVG Layer for Belt Line (Olive Gold with Sky Blue nodes) */}
                  <svg 
                    viewBox={`0 0 ${svgWidth} 145`} 
                    preserveAspectRatio="none" 
                    className="absolute inset-0 w-full h-[145px] pointer-events-none z-20 overflow-visible"
                  >
                    {(() => {
                      const points = elementData.map((item, idx) => {
                        const x = (idx + 0.5) * (svgWidth / numUnits);
                        const rawPct = Math.min(100, Math.max(0, (item.beltBroken / (maxBelt || 1)) * 100));
                        const y = 135 - (rawPct / 100) * 110;
                        return `${x},${y}`;
                      }).join(' ');

                      return (
                        <polyline
                          fill="none"
                          stroke="#854D0E"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={points}
                        />
                      );
                    })()}
                  </svg>

                  {/* HTML Point Markers for Belt Broken */}
                  {elementData.map((item, idx) => {
                    const pctX = ((idx + 0.5) / numUnits) * 100;
                    const rawLinePct = Math.min(100, Math.max(0, (item.beltBroken / (maxBelt || 1)) * 100));
                    const yPx = 135 - (rawLinePct / 100) * 110;
                    const isHovered = hoveredUnit === item.unit;

                    return (
                      <div 
                        key={`pt-belt-${item.unit}`}
                        className="absolute z-30 flex flex-col items-center pointer-events-auto cursor-pointer -translate-x-1/2 -translate-y-1/2 group"
                        style={{ left: `${pctX}%`, top: `${yPx}px` }}
                        onMouseEnter={() => setHoveredUnit(item.unit)}
                        onMouseLeave={() => setHoveredUnit(null)}
                      >
                        {/* Belt Broken Value Label */}
                        <div className="absolute bottom-full mb-1 flex items-center justify-center pointer-events-none">
                          <span className={`text-[8.5px] font-black px-1 py-0.2 rounded-xs select-none transition-all drop-shadow-xs whitespace-nowrap ${
                            isHovered
                              ? 'bg-[#854D0E] text-white scale-110'
                              : 'text-slate-800 dark:text-slate-100 bg-white/90 dark:bg-slate-900/90 shadow-2xs'
                          }`}>
                            {item.beltBroken}
                          </span>
                        </div>
                        <div className={`w-2 h-2 rounded-full bg-[#0284C7] dark:bg-[#38BDF8] border border-white dark:border-slate-900 shadow-xs transition-transform ${
                          isHovered ? 'scale-125 ring-2 ring-[#0284C7]/40' : ''
                        }`}></div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dedicated X-Axis Labels Row (Slanted at -40deg) */}
              <div className="w-full h-11 relative flex items-start pt-1.5 overflow-visible">
                <div className="w-7 shrink-0" />
                <div className="flex-1 flex justify-between px-0.5 overflow-visible">
                  {elementData.map((item) => {
                    const isHovered = hoveredUnit === item.unit;
                    return (
                      <div 
                        key={`x-lbl-belt-${item.unit}`} 
                        className="flex-1 flex justify-center items-start overflow-visible cursor-pointer group"
                        onMouseEnter={() => setHoveredUnit(item.unit)}
                        onMouseLeave={() => setHoveredUnit(null)}
                        title={item.label}
                      >
                        <span 
                          className={`text-[8.5px] sm:text-[9px] font-bold select-none whitespace-nowrap transform -rotate-40 origin-top-left translate-y-0.5 transition-colors ${
                            isHovered 
                              ? 'text-[#854D0E] dark:text-[#FDE047] font-extrabold' 
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Bottom metric row */}
            <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9.5px]">
              <span className="text-slate-500 dark:text-slate-400 truncate">
                Total Plant: <strong className="text-slate-800 dark:text-slate-200 font-bold">{totalBeltBroken.toLocaleString()} pcs</strong>
              </span>
              <span className="text-[#854D0E] dark:text-[#FDE047] font-bold truncate">
                Status: {totalBeltBroken === 0 ? 'Optimal' : `${totalBeltBroken} rep.`}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ---------------------------------------------------- */}
      {/* OTHER SPARE PARTS STATIC SECTION & TABLE             */}
      {/* ---------------------------------------------------- */}
      <OtherSparePartsLedgerDrawer
        ledger={ledger}
        filterState={filterState}
        activeDateDisplay={activeDateDisplay}
      />
    </div>
  );
}
