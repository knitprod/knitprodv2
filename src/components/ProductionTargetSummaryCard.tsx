/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Factory, Layers, PieChart } from 'lucide-react';

/**
 * Validates and formats weight quantities:
 * - If qty <= 1,000 Kg: formats in Kg (e.g. "980 Kg", "1,000 Kg")
 * - If qty > 1,000 Kg: converts to Tons (qty / 1000) (e.g. "802.16 Tons")
 */
export function formatWeightWithUnit(
  qty: number | undefined | null,
  defaultUnit: string = 'Kg'
): { value: string; unit: string; full: string } {
  if (qty === undefined || qty === null || isNaN(qty)) {
    return { value: '0', unit: defaultUnit, full: `0 ${defaultUnit}` };
  }
  const num = Number(qty);
  if (Math.abs(num) <= 1000) {
    const valStr = Math.round(num).toLocaleString();
    return { value: valStr, unit: 'Kg', full: `${valStr} Kg` };
  }
  const tons = num / 1000;
  const valStr = tons >= 100
    ? tons.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })
    : tons.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return { value: valStr, unit: 'Tons', full: `${valStr} Tons` };
}

export function formatWeight(qty: number | undefined | null): string {
  return formatWeightWithUnit(qty).full;
}

export interface ProductionTargetSummaryCardProps {
  // In-House metrics
  inHouseTarget: number; // Total In-House Target
  inHouseProduction: number; // Total In-House Production
  inHouseBulkProduction: number;
  inHouseBulkTarget?: number; // In-House Bulk Target
  inHouseSampleProduction: number;
  inHouseProdLossForSample?: number; // Production Loss for Sample
  inHouseAchievementPct?: number;

  // Sub-Contact metrics
  subContactTarget: number;
  subContactProduction: number;
  subContactSampleProduction?: number;
  subContactAchievementPct?: number;

  // Combined / Overall metrics (In-House + Sub-Contact)
  overallTarget?: number;
  overallProduction?: number;
  overallBulkProduction?: number;
  overallSampleProduction?: number;
  overallAchievementPct?: number;
  flatKnitPcs?: number;

  // Efficiency and Capacity Utilization metrics
  efficiencyPct?: number;
  capacityUtilizationPct?: number;

  // Metadata / Display
  periodLabel?: string;
  className?: string;
}

export function InHouseProductionCard({
  target,
  production,
  bulkProduction,
  bulkTarget,
  sampleProduction,
  lossForSample,
  achievementPct,
  periodLabel,
  className = '',
}: {
  target?: number;
  production?: number;
  bulkProduction?: number;
  bulkTarget?: number;
  sampleProduction?: number;
  lossForSample?: number;
  achievementPct?: number;
  periodLabel?: string;
  className?: string;
}) {
  const ihTarget = target !== undefined ? Math.round(target) : 0;
  const ihBulk = bulkProduction !== undefined ? Math.round(bulkProduction) : (production !== undefined ? Math.round(production) : 0);
  const ihBulkTarget = bulkTarget !== undefined ? Math.round(bulkTarget) : (target !== undefined ? Math.round(target) : 0);
  const ihSample = sampleProduction !== undefined ? Math.round(sampleProduction) : 0;
  const ihLossForSample = lossForSample !== undefined ? Math.round(lossForSample) : 0;

  const ihProd = production !== undefined 
    ? Math.round(production) 
    : (ihBulk + ihSample);

  const calculatedIhAchieve = ihTarget > 0 ? Math.round((ihProd / ihTarget) * 100) : 0;
  const ihAchievePct = achievementPct !== undefined 
    ? Math.abs(Math.round(achievementPct)) 
    : calculatedIhAchieve;
  const clampedIhAchieve = Math.min(100, Math.max(0, ihAchievePct));

  const prodWeight = formatWeightWithUnit(ihProd);
  const targetWeight = formatWeightWithUnit(ihTarget);
  const bulkWeight = formatWeightWithUnit(ihBulk);
  const bulkTargetWeight = formatWeightWithUnit(ihBulkTarget);
  const sampleWeight = formatWeightWithUnit(ihSample);
  const lossWeight = formatWeightWithUnit(ihLossForSample);

  return (
    <div
      id="card-in-house-production"
      className={`w-full h-[200px] rounded-2xl border border-blue-200/90 dark:border-blue-900/60 bg-white dark:bg-slate-900 px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col justify-between hover:border-blue-300 dark:hover:border-blue-800 transition-all overflow-hidden ${className}`}
    >
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shrink-0">
            <Factory className="h-3 w-3" />
          </div>
          <div className="min-w-0 truncate">
            <span className="font-sans text-[11px] font-black uppercase tracking-wider text-blue-950 dark:text-blue-200 block truncate leading-none">
              IN-HOUSE PRODUCTION
            </span>
            {periodLabel && (
              <span className="font-sans text-[9px] font-semibold text-slate-500 dark:text-slate-400 block truncate leading-tight mt-0.5">
                {periodLabel}
              </span>
            )}
          </div>
        </div>
        <span className="rounded-md bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/80 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-blue-900 dark:text-blue-300 shrink-0 ml-1">
          Tgt: {targetWeight.full}
        </span>
      </div>

      {/* 2. Main Numbers Row (Prod & Target on the SAME line + Achieve Badge) */}
      <div className="flex items-center justify-between gap-1.5 my-auto">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="font-mono text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white leading-none">
              {prodWeight.value}
            </span>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">
              {prodWeight.unit === 'Tons' ? 'Tons Prod' : 'Kg Prod'}
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-xs font-light">/</span>
            <span className="font-mono text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 leading-none">
              {targetWeight.full} Tgt
            </span>
          </div>
          <div className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-400 mt-1 leading-none truncate">
            In-House Actual vs Target
          </div>
        </div>

        {/* Achievement Badge */}
        <div 
          className="rounded-lg px-2 py-1 text-center font-mono shadow-2xs border border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/60 dark:text-amber-300 min-w-[56px] shrink-0"
          title={`In-House Plan Achievement: ${ihAchievePct}%`}
        >
          <div className="text-[7.5px] font-sans font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 leading-none">
            ACHIEVE
          </div>
          <div className="text-sm sm:text-base font-black leading-tight mt-0.5">{ihAchievePct}%</div>
        </div>
      </div>

      {/* 3. 3-Column Breakdown Chips (High Contrast & Visible Labels) */}
      <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 p-1.5 border border-slate-200/80 dark:border-slate-800">
        {/* 1. Bulk Prod */}
        <div className="text-center px-0.5">
          <div className="text-[8px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 truncate leading-tight">
            BULK PROD
          </div>
          <div className="font-mono text-[11px] sm:text-xs font-black text-slate-950 dark:text-white leading-tight truncate mt-0.5">
            {bulkWeight.full}
          </div>
          <div className="font-mono text-[8.5px] font-bold text-slate-700 dark:text-slate-300 truncate leading-tight mt-0.5">
            Tgt: {bulkTargetWeight.full}
          </div>
        </div>

        {/* 2. Sample Prod */}
        <div className="text-center px-0.5 border-x border-slate-200 dark:border-slate-700">
          <div className="text-[8px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 truncate leading-tight">
            SAMPLE PROD
          </div>
          <div className="font-mono text-[11px] sm:text-xs font-black text-slate-950 dark:text-white leading-tight truncate mt-0.5">
            {sampleWeight.full}
          </div>
          <div className="font-sans text-[8.5px] font-bold text-slate-700 dark:text-slate-300 leading-tight mt-0.5">
            Sample
          </div>
        </div>

        {/* 3. Loss Sample */}
        <div className="text-center px-0.5" title={`Production Loss For Sample: ${lossWeight.full}`}>
          <div className="text-[8px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 truncate leading-tight">
            LOSS SAMPLE
          </div>
          <div className="font-mono text-[11px] sm:text-xs font-black text-amber-700 dark:text-amber-300 leading-tight truncate mt-0.5">
            {lossWeight.full}
          </div>
          <div className="font-sans text-[8.5px] font-bold text-amber-700 dark:text-amber-400 leading-tight mt-0.5">
            Prod Loss
          </div>
        </div>
      </div>

      {/* 4. In-House Plan Progress Bar (Fully inside the Box) */}
      <div className="space-y-0.5 pt-0.5">
        <div className="flex items-center justify-between text-[9.5px] font-bold leading-none">
          <span className="text-slate-800 dark:text-slate-200">
            In-House Plan
          </span>
          <span className="font-mono font-black text-blue-600 dark:text-blue-400">
            {ihAchievePct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner">
          <div
            className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-500 shadow-xs"
            style={{ width: `${clampedIhAchieve}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function SubContactProductionCard({
  target,
  production,
  sampleProduction = 0,
  flatKnitPcs,
  achievementPct,
  periodLabel,
  className = '',
}: {
  target?: number;
  production?: number;
  sampleProduction?: number;
  flatKnitPcs?: number;
  achievementPct?: number;
  periodLabel?: string;
  className?: string;
}) {
  const scTarget = target !== undefined ? Math.round(target) : 0;
  const scProd = production !== undefined ? Math.round(production) : 0;
  const totalFlatKnit = flatKnitPcs !== undefined ? Math.round(flatKnitPcs) : 0;

  const calculatedScAchieve = scTarget > 0 ? Math.round((scProd / scTarget) * 100) : 0;
  const scAchievePct = achievementPct !== undefined 
    ? Math.abs(Math.round(achievementPct)) 
    : calculatedScAchieve;
  const clampedScAchieve = Math.min(100, Math.max(0, scAchievePct));

  const prodWeight = formatWeightWithUnit(scProd);
  const targetWeight = formatWeightWithUnit(scTarget);
  const sampleWeight = formatWeightWithUnit(sampleProduction);

  return (
    <div
      id="card-sub-contact-production"
      className={`w-full h-[200px] rounded-2xl border border-purple-200/90 dark:border-purple-900/60 bg-white dark:bg-slate-900 px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col justify-between hover:border-purple-300 dark:hover:border-purple-800 transition-all overflow-hidden ${className}`}
    >
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 shrink-0">
            <Layers className="h-3 w-3" />
          </div>
          <div className="min-w-0 truncate">
            <span className="font-sans text-[11px] font-black uppercase tracking-wider text-purple-950 dark:text-purple-200 block truncate leading-none">
              SUB-CONTACT
            </span>
            {periodLabel && (
              <span className="font-sans text-[9px] font-semibold text-slate-500 dark:text-slate-400 block truncate leading-tight mt-0.5">
                {periodLabel}
              </span>
            )}
          </div>
        </div>
        <span className="rounded-md bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800/80 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-purple-900 dark:text-purple-300 shrink-0 ml-1">
          Tgt: {targetWeight.full}
        </span>
      </div>

      {/* 2. Main Numbers Row */}
      <div className="flex items-center justify-between gap-1.5 my-auto">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="font-mono text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white leading-none">
              {prodWeight.value}
            </span>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">
              {prodWeight.unit === 'Tons' ? 'Tons Prod' : 'Kg Prod'}
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-xs font-light">/</span>
            <span className="font-mono text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 leading-none">
              {targetWeight.full} Tgt
            </span>
          </div>
          <div className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-400 mt-1 leading-none truncate">
            Sub-Contact Actual vs Target
          </div>
        </div>

        {/* Achievement Badge */}
        <div 
          className="rounded-lg px-2 py-1 text-center font-mono shadow-2xs border border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-950/60 dark:text-emerald-300 min-w-[56px] shrink-0"
          title={`Sub-Contact Plan Achievement: ${scAchievePct}%`}
        >
          <div className="text-[7.5px] font-sans font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 leading-none">
            ACHIEVE
          </div>
          <div className="text-sm sm:text-base font-black leading-tight mt-0.5">{scAchievePct}%</div>
        </div>
      </div>

      {/* 3. 3-Column Breakdown Chips (High Contrast & Visible Labels) */}
      <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 p-1.5 border border-slate-200/80 dark:border-slate-800">
        {/* 1. Bulk Prod */}
        <div className="text-center px-0.5">
          <div className="text-[8px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 truncate leading-tight">
            BULK PROD
          </div>
          <div className="font-mono text-[11px] sm:text-xs font-black text-slate-950 dark:text-white leading-tight truncate mt-0.5">
            {prodWeight.full}
          </div>
          <div className="font-sans text-[8.5px] font-bold text-slate-700 dark:text-slate-300 leading-tight mt-0.5">
            Bulk
          </div>
        </div>

        {/* 2. Sample Prod */}
        <div className="text-center px-0.5 border-x border-slate-200 dark:border-slate-700">
          <div className="text-[8px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 truncate leading-tight">
            SAMPLE PROD
          </div>
          <div className="font-mono text-[11px] sm:text-xs font-black text-slate-950 dark:text-white leading-tight truncate mt-0.5">
            {sampleWeight.full}
          </div>
          <div className="font-sans text-[8.5px] font-bold text-slate-700 dark:text-slate-300 leading-tight mt-0.5">
            Sample
          </div>
        </div>

        {/* 3. Flat Knit */}
        <div className="text-center px-0.5">
          <div className="text-[8px] font-bold uppercase tracking-wide text-purple-700 dark:text-purple-400 truncate leading-tight">
            FLAT KNIT
          </div>
          <div className="font-mono text-[11px] sm:text-xs font-black text-purple-900 dark:text-purple-200 leading-tight truncate mt-0.5">
            {totalFlatKnit.toLocaleString()}
          </div>
          <div className="font-sans text-[8.5px] font-bold text-purple-700 dark:text-purple-400 leading-tight mt-0.5">
            Pcs
          </div>
        </div>
      </div>

      {/* 4. Sub-Contact Plan Progress Bar (Fully inside the Box) */}
      <div className="space-y-0.5 pt-0.5">
        <div className="flex items-center justify-between text-[9.5px] font-bold leading-none">
          <span className="text-slate-800 dark:text-slate-200">
            Sub-Contact Plan
          </span>
          <span className="font-mono font-black text-purple-600 dark:text-purple-400">
            {scAchievePct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner">
          <div
            className="h-full rounded-full bg-purple-600 dark:bg-purple-500 transition-all duration-500 shadow-xs"
            style={{ width: `${clampedScAchieve}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function TotalInHouseSubCard({
  target,
  production,
  inHouseProduction,
  subContactProduction,
  achievementPct,
  efficiencyPct = 0,
  capacityUtilizationPct = 0,
  periodLabel,
  className = '',
}: {
  target?: number;
  production?: number;
  inHouseProduction?: number;
  subContactProduction?: number;
  achievementPct?: number;
  efficiencyPct?: number;
  capacityUtilizationPct?: number;
  periodLabel?: string;
  className?: string;
}) {
  const totalTgt = target !== undefined ? Math.round(target) : 0;
  const totalPrd = production !== undefined ? Math.round(production) : 0;
  const ihProd = inHouseProduction !== undefined ? Math.round(inHouseProduction) : (totalPrd > 0 ? Math.round(totalPrd * 0.57) : 0);
  const scProd = subContactProduction !== undefined ? Math.round(subContactProduction) : Math.max(0, totalPrd - ihProd);

  const calculatedTotalAchieve = totalTgt > 0 ? Math.round((totalPrd / totalTgt) * 100) : 0;
  const totalAchievePct = achievementPct !== undefined
    ? Math.abs(Math.round(achievementPct))
    : calculatedTotalAchieve;

  // Share split percentages
  const ihSharePct = totalPrd > 0 ? Math.round((ihProd / totalPrd) * 100) : 0;
  const scSharePct = totalPrd > 0 ? Math.max(0, 100 - ihSharePct) : 0;

  // Efficiency and Capacity display values
  const displayEfficiencyPct = efficiencyPct !== undefined ? parseFloat(Number(efficiencyPct).toFixed(1)) : 0;
  const displayCapacityUtilPct = capacityUtilizationPct !== undefined ? parseFloat(Number(capacityUtilizationPct).toFixed(1)) : 0;

  const prodWeight = formatWeightWithUnit(totalPrd);
  const targetWeight = formatWeightWithUnit(totalTgt);
  const ihWeight = formatWeightWithUnit(ihProd);
  const scWeight = formatWeightWithUnit(scProd);

  return (
    <div
      id="card-total-in-house-and-sub"
      className={`w-full h-[200px] rounded-2xl border border-indigo-200/90 dark:border-indigo-900/60 bg-white dark:bg-slate-900 px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-800 transition-all overflow-hidden ${className}`}
    >
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
            <PieChart className="h-3 w-3" />
          </div>
          <div className="min-w-0 truncate">
            <span className="font-sans text-[11px] font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200 block truncate leading-none">
              TOTAL IN-HOUSE & SUB
            </span>
            {periodLabel && (
              <span className="font-sans text-[9px] font-semibold text-slate-500 dark:text-slate-400 block truncate leading-tight mt-0.5">
                {periodLabel}
              </span>
            )}
          </div>
        </div>
        <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/80 px-1.5 py-0.5 font-sans text-[9.5px] font-bold text-indigo-950 dark:text-indigo-200 shrink-0 ml-1">
          Combined Total
        </span>
      </div>

      {/* 2. Primary Numbers Row with Weight Validation */}
      <div className="flex items-center justify-between gap-1.5 my-auto">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="font-mono text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white leading-none">
              {prodWeight.value}
            </span>
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 leading-none">
              {prodWeight.unit === 'Tons' ? 'Tons Prod' : 'Kg Prod'}
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-xs font-light">/</span>
            <span className="font-mono text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 leading-none">
              {targetWeight.full} Tgt
            </span>
          </div>
          <div className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-400 mt-1 leading-none truncate">
            Combined Actual vs Target
          </div>
        </div>

        {/* Achievement Badge */}
        <div 
          className="rounded-lg px-2 py-1 text-center font-mono shadow-2xs border border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-950/60 dark:text-emerald-300 min-w-[56px] shrink-0"
          title={`Total Plan Achievement: ${totalAchievePct}%`}
        >
          <div className="text-[7.5px] font-sans font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 leading-none">
            ACHIEVE
          </div>
          <div className="text-sm sm:text-base font-black leading-tight mt-0.5">{totalAchievePct}%</div>
        </div>
      </div>

      {/* 3. Dual-Color Production Ratio Card */}
      <div className="rounded-lg bg-slate-50/80 dark:bg-slate-800/50 p-1.5 border border-slate-200/80 dark:border-slate-800 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold whitespace-nowrap gap-1">
          <div className="flex items-center gap-1 text-blue-800 dark:text-blue-300 shrink-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
            <span>In-House: <strong className="font-mono text-[10.5px] font-black">{ihSharePct}%</strong></span>
          </div>
          <div className="flex items-center gap-1 text-rose-700 dark:text-rose-300 shrink-0">
            <span>Sub-Contact: <strong className="font-mono text-[10.5px] font-black">{scSharePct}%</strong></span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
          </div>
        </div>

        {/* Two-sided Progress Bar: Blue on Left to Red on Right */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 flex p-0.5 shadow-inner border border-slate-200/80 dark:border-slate-700/80">
          <div
            className="h-full rounded-l-full bg-blue-600 dark:bg-blue-500 transition-all duration-500 shadow-2xs"
            style={{ width: `${ihSharePct}%` }}
            title={`In-House: ${ihSharePct}% (${ihWeight.full})`}
          />
          <div
            className="h-full rounded-r-full bg-rose-600 dark:bg-rose-500 transition-all duration-500 shadow-2xs"
            style={{ width: `${scSharePct}%` }}
            title={`Sub-Contact: ${scSharePct}% (${scWeight.full})`}
          />
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap gap-1 leading-none">
          <span className="shrink-0">{ihWeight.full} In-House</span>
          <span className="shrink-0">{scWeight.full} Sub-Contact</span>
        </div>
      </div>

      {/* 4. Efficiency & Capacity Utilization Mini Badges */}
      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
        <div className="rounded-md border border-slate-200/90 bg-white/95 px-1.5 py-1 dark:border-slate-800 dark:bg-slate-900/90 shadow-2xs flex items-center justify-between">
          <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            EFFICIENCY
          </span>
          <span className="font-mono text-[10.5px] font-black text-blue-600 dark:text-blue-400 ml-1">
            {displayEfficiencyPct}%
          </span>
        </div>
        <div className="rounded-md border border-slate-200/90 bg-white/95 px-1.5 py-1 dark:border-slate-800 dark:bg-slate-900/90 shadow-2xs flex items-center justify-between">
          <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            CAPACITY
          </span>
          <span className="font-mono text-[10.5px] font-black text-emerald-600 dark:text-emerald-400 ml-1">
            {displayCapacityUtilPct}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ProductionTargetSummaryCard({
  inHouseTarget,
  inHouseProduction,
  inHouseBulkProduction,
  inHouseBulkTarget,
  inHouseSampleProduction,
  inHouseProdLossForSample,
  inHouseAchievementPct,
  subContactTarget,
  subContactProduction,
  subContactSampleProduction,
  subContactAchievementPct,
  overallTarget,
  overallProduction,
  overallBulkProduction,
  overallSampleProduction,
  overallAchievementPct,
  flatKnitPcs = 0,
  efficiencyPct = 0,
  capacityUtilizationPct = 0,
  periodLabel,
  className = '',
}: ProductionTargetSummaryCardProps) {
  const ihTarget = inHouseTarget !== undefined ? Math.round(inHouseTarget) : 0;
  const ihBulk = inHouseBulkProduction !== undefined ? Math.round(inHouseBulkProduction) : (inHouseProduction !== undefined ? Math.round(inHouseProduction) : 0);
  const ihBulkTarget = inHouseBulkTarget !== undefined ? Math.round(inHouseBulkTarget) : (inHouseTarget !== undefined ? Math.round(inHouseTarget) : 0);
  const ihSample = inHouseSampleProduction !== undefined ? Math.round(inHouseSampleProduction) : 0;
  const ihLossForSample = inHouseProdLossForSample !== undefined ? Math.round(inHouseProdLossForSample) : 0;

  const ihProd = inHouseProduction !== undefined 
    ? Math.round(inHouseProduction) 
    : (ihBulk + ihSample);

  const scTarget = subContactTarget !== undefined ? Math.round(subContactTarget) : 0;
  const scProd = subContactProduction !== undefined ? Math.round(subContactProduction) : 0;

  const totalTgt = overallTarget !== undefined ? Math.round(overallTarget) : (ihTarget + scTarget);
  const totalPrd = overallProduction !== undefined ? Math.round(overallProduction) : (ihProd + scProd);

  return (
    <div
      id="kpi-production-target-card-group"
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5 ${className}`}
    >
      {/* 1. IN-HOUSE PRODUCTION CARD */}
      <InHouseProductionCard
        target={ihTarget}
        production={ihProd}
        bulkProduction={ihBulk}
        bulkTarget={ihBulkTarget}
        sampleProduction={ihSample}
        lossForSample={ihLossForSample}
        achievementPct={inHouseAchievementPct}
        periodLabel={periodLabel}
      />

      {/* 2. SUB-CONTACT PRODUCTION CARD */}
      <SubContactProductionCard
        target={scTarget}
        production={scProd}
        sampleProduction={subContactSampleProduction ?? 0}
        flatKnitPcs={flatKnitPcs}
        achievementPct={subContactAchievementPct}
        periodLabel={periodLabel}
      />

      {/* 3. TOTAL IN-HOUSE & SUB CARD */}
      <TotalInHouseSubCard
        target={totalTgt}
        production={totalPrd}
        inHouseProduction={ihProd}
        subContactProduction={scProd}
        achievementPct={overallAchievementPct}
        efficiencyPct={efficiencyPct}
        capacityUtilizationPct={capacityUtilizationPct}
        periodLabel={periodLabel}
      />
    </div>
  );
}

