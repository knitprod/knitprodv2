/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Factory, Layers, PieChart } from 'lucide-react';

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
  target = 870453,
  production = 687425,
  bulkProduction = 663940,
  bulkTarget = 819040,
  sampleProduction = 23485,
  lossForSample = 67298,
  achievementPct,
  className = '',
}: {
  target?: number;
  production?: number;
  bulkProduction?: number;
  bulkTarget?: number;
  sampleProduction?: number;
  lossForSample?: number;
  achievementPct?: number;
  className?: string;
}) {
  const ihTarget = Math.round(target || 870453);
  const ihBulk = Math.round(bulkProduction || 663940);
  const ihBulkTarget = Math.round(bulkTarget || 819040);
  const ihSample = Math.round(sampleProduction || 23485);
  const ihLossForSample = Math.round(lossForSample || 67298);

  const ihProd = production !== undefined 
    ? Math.round(production) 
    : (ihBulk + ihSample);

  const calculatedIhAchieve = ihTarget > 0 ? Math.round((ihProd / ihTarget) * 100) : 79;
  const ihAchievePct = achievementPct !== undefined 
    ? Math.abs(Math.round(achievementPct)) 
    : calculatedIhAchieve;
  const clampedIhAchieve = Math.min(100, Math.max(0, ihAchievePct));

  return (
    <div
      id="card-in-house-production"
      className={`rounded-2xl border border-blue-200/90 dark:border-blue-900/60 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between gap-3 hover:border-blue-300 dark:hover:border-blue-800 transition-all ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <Factory className="h-3.5 w-3.5" />
          </div>
          <span className="font-sans text-xs font-black uppercase tracking-wider text-blue-950 dark:text-blue-200">
            IN-HOUSE PRODUCTION
          </span>
        </div>
        <span className="rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/80 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-900 dark:text-blue-300">
          Tgt: {ihTarget.toLocaleString()} Kg
        </span>
      </div>

      {/* Main Numbers Row */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              {ihProd.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Kg Prod
            </span>
            <span className="text-slate-300 dark:text-slate-600 text-sm font-light">/</span>
          </div>
          <div className="font-mono text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5">
            {ihTarget.toLocaleString()} Tgt
          </div>
        </div>

        {/* Achievement Badge (Amber/Yellow matching photo) */}
        <div 
          className="rounded-xl px-3 py-1.5 text-center font-mono shadow-2xs border border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/60 dark:text-amber-300 min-w-[62px]"
          title={`In-House Plan Achievement: ${ihAchievePct}%`}
        >
          <div className="text-[8px] font-sans font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            ACHIEVE
          </div>
          <div className="text-base sm:text-lg font-black leading-tight mt-0.5">{ihAchievePct}%</div>
        </div>
      </div>

      {/* 3-Column Breakdown Chips */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 p-2 border border-slate-100 dark:border-slate-800">
        {/* 1. Bulk Prod */}
        <div className="text-center px-0.5">
          <div className="text-[8.5px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">
            BULK PROD
          </div>
          <div className="font-mono text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
            {ihBulk.toLocaleString()}
          </div>
          <div className="font-mono text-[8.5px] font-medium text-slate-500 dark:text-slate-400">
            Tgt: {ihBulkTarget.toLocaleString()}
          </div>
        </div>

        {/* 2. Sample Prod */}
        <div className="text-center px-0.5 border-x border-slate-200/60 dark:border-slate-700/60">
          <div className="text-[8.5px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">
            SAMPLE PROD
          </div>
          <div className="font-mono text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
            {ihSample.toLocaleString()}
          </div>
          <div className="font-mono text-[8.5px] font-medium text-slate-400">
            Sample
          </div>
        </div>

        {/* 3. Loss Sample */}
        <div className="text-center px-0.5" title={`Production Loss For Sample: ${ihLossForSample.toLocaleString()} Kg`}>
          <div className="text-[8.5px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 whitespace-nowrap">
            LOSS SAMPLE
          </div>
          <div className="font-mono text-xs sm:text-sm font-black text-amber-700 dark:text-amber-300 mt-0.5">
            {ihLossForSample.toLocaleString()}
          </div>
          <div className="font-mono text-[8.5px] font-medium text-amber-600/80 dark:text-amber-400/80">
            Prod Loss
          </div>
        </div>
      </div>

      {/* In-House Plan Progress Bar */}
      <div className="pt-0.5 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span className="text-slate-800 dark:text-slate-200">
            In-House Plan
          </span>
          <span className="font-mono font-black text-blue-600 dark:text-blue-400">
            {ihAchievePct}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner">
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
  target = 575000,
  production = 510931,
  sampleProduction = 0,
  flatKnitPcs = 20091,
  achievementPct,
  className = '',
}: {
  target?: number;
  production?: number;
  sampleProduction?: number;
  flatKnitPcs?: number;
  achievementPct?: number;
  className?: string;
}) {
  const scTarget = Math.round(target || 575000);
  const scProd = Math.round(production || 510931);
  const totalFlatKnit = Math.round(flatKnitPcs || 20091);

  const calculatedScAchieve = scTarget > 0 ? Math.round((scProd / scTarget) * 100) : 89;
  const scAchievePct = achievementPct !== undefined 
    ? Math.abs(Math.round(achievementPct)) 
    : calculatedScAchieve;
  const clampedScAchieve = Math.min(100, Math.max(0, scAchievePct));

  return (
    <div
      id="card-sub-contact-production"
      className={`rounded-2xl border border-purple-200/90 dark:border-purple-900/60 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between gap-3 hover:border-purple-300 dark:hover:border-purple-800 transition-all ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <span className="font-sans text-xs font-black uppercase tracking-wider text-purple-950 dark:text-purple-200">
            SUB-CONTACT
          </span>
        </div>
        <span className="rounded-lg bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800/80 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-900 dark:text-purple-300">
          Tgt: {scTarget.toLocaleString()} Kg
        </span>
      </div>

      {/* Main Numbers Row */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              {scProd.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Kg Prod
            </span>
            <span className="text-slate-300 dark:text-slate-600 text-sm font-light">/</span>
          </div>
          <div className="font-mono text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5">
            {scTarget.toLocaleString()} Tgt
          </div>
        </div>

        {/* Achievement Badge (Green matching photo) */}
        <div 
          className="rounded-xl px-3 py-1.5 text-center font-mono shadow-2xs border border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-950/60 dark:text-emerald-300 min-w-[62px]"
          title={`Sub-Contact Plan Achievement: ${scAchievePct}%`}
        >
          <div className="text-[8px] font-sans font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            ACHIEVE
          </div>
          <div className="text-base sm:text-lg font-black leading-tight mt-0.5">{scAchievePct}%</div>
        </div>
      </div>

      {/* 3-Column Breakdown Chips */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 p-2 border border-slate-100 dark:border-slate-800">
        {/* 1. Bulk Prod */}
        <div className="text-center px-0.5">
          <div className="text-[8.5px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">
            BULK PROD
          </div>
          <div className="font-mono text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
            {scProd.toLocaleString()}
          </div>
          <div className="font-mono text-[8.5px] font-medium text-slate-500 dark:text-slate-400">
            Kg Prod
          </div>
        </div>

        {/* 2. Sample Prod */}
        <div className="text-center px-0.5 border-x border-slate-200/60 dark:border-slate-700/60">
          <div className="text-[8.5px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">
            SAMPLE PROD
          </div>
          <div className="font-mono text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
            {sampleProduction || 0}
          </div>
          <div className="font-mono text-[8.5px] font-medium text-slate-400">
            Kg Prod
          </div>
        </div>

        {/* 3. Flat Knit */}
        <div className="text-center px-0.5">
          <div className="text-[8.5px] font-bold uppercase tracking-wide text-purple-700 dark:text-purple-400 whitespace-nowrap">
            FLAT KNIT
          </div>
          <div className="font-mono text-xs sm:text-sm font-black text-purple-900 dark:text-purple-200 mt-0.5">
            {totalFlatKnit.toLocaleString()}
          </div>
          <div className="font-mono text-[8.5px] font-medium text-purple-600 dark:text-purple-400">
            Pcs
          </div>
        </div>
      </div>

      {/* Sub-Contact Plan Progress Bar */}
      <div className="pt-0.5 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span className="text-slate-800 dark:text-slate-200">
            Sub-Contact Plan
          </span>
          <span className="font-mono font-black text-purple-600 dark:text-purple-400">
            {scAchievePct}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner">
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
  target = 1445453,
  production = 1198356,
  inHouseProduction = 687425,
  subContactProduction = 510931,
  achievementPct,
  efficiencyPct = 81.1,
  capacityUtilizationPct = 57.3,
  className = '',
}: {
  target?: number;
  production?: number;
  inHouseProduction?: number;
  subContactProduction?: number;
  achievementPct?: number;
  efficiencyPct?: number;
  capacityUtilizationPct?: number;
  className?: string;
}) {
  const totalTgt = Math.round(target || 1445453);
  const totalPrd = Math.round(production || 1198356);
  const ihProd = Math.round(inHouseProduction || 687425);
  const scProd = Math.round(subContactProduction || 510931);

  const calculatedTotalAchieve = totalTgt > 0 ? Math.round((totalPrd / totalTgt) * 100) : 83;
  const totalAchievePct = achievementPct !== undefined
    ? Math.abs(Math.round(achievementPct))
    : calculatedTotalAchieve;

  // Share split percentages
  const ihSharePct = totalPrd > 0 ? Math.round((ihProd / totalPrd) * 100) : 57;
  const scSharePct = Math.max(0, 100 - ihSharePct);

  // Efficiency and Capacity display values
  const displayEfficiencyPct = parseFloat(Number(efficiencyPct || 81.1).toFixed(1));
  const displayCapacityUtilPct = parseFloat(Number(capacityUtilizationPct || 57.3).toFixed(1));

  return (
    <div
      id="card-total-in-house-and-sub"
      className={`rounded-2xl border border-indigo-200/90 dark:border-indigo-900/60 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between gap-3.5 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            <PieChart className="h-3.5 w-3.5" />
          </div>
          <span className="font-sans text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
            TOTAL IN-HOUSE & SUB
          </span>
        </div>
        <span className="rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/80 px-2 py-0.5 font-sans text-[10px] font-bold text-indigo-950 dark:text-indigo-200">
          Combined Total
        </span>
      </div>

      {/* Primary Numbers Row in Tons (Matching Exact Photo) */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              {Math.round(totalPrd / 1000).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              Tons
            </span>
            <span className="text-slate-300 dark:text-slate-600 text-sm font-light">/</span>
          </div>
          <div className="font-mono text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5">
            {Math.round(totalTgt / 1000).toLocaleString()} Tons Tgt
          </div>
        </div>

        {/* Achievement Badge (Matching Photo) */}
        <div 
          className="rounded-xl px-3 py-1.5 text-center font-mono shadow-2xs border border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-950/60 dark:text-emerald-300 min-w-[62px]"
          title={`Total Plan Achievement: ${totalAchievePct}%`}
        >
          <div className="text-[8px] font-sans font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            ACHIEVE
          </div>
          <div className="text-base sm:text-lg font-black leading-tight mt-0.5">{totalAchievePct}%</div>
        </div>
      </div>

      {/* Dual-Color Production Ratio Card */}
      <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/50 p-2.5 shadow-2xs border border-slate-100 dark:border-slate-800 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold whitespace-nowrap gap-2">
          <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 shrink-0">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-600 shrink-0" />
            <span>In-House Ratio: <strong className="font-mono text-[11px]">{ihSharePct}%</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 shrink-0">
            <span>Sub-Contact Ratio: <strong className="font-mono text-[11px]">{scSharePct}%</strong></span>
            <span className="inline-block w-2 h-2 rounded-full bg-rose-600 shrink-0" />
          </div>
        </div>

        {/* Two-sided Progress Bar: Blue on Left to Red on Right */}
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 flex p-0.5 shadow-inner border border-slate-200/80 dark:border-slate-700/80">
          <div
            className="h-full rounded-l-full bg-blue-600 dark:bg-blue-500 transition-all duration-500 shadow-2xs"
            style={{ width: `${ihSharePct}%` }}
            title={`In-House: ${ihSharePct}% (${ihProd.toLocaleString()} Kg)`}
          />
          <div
            className="h-full rounded-r-full bg-rose-600 dark:bg-rose-500 transition-all duration-500 shadow-2xs"
            style={{ width: `${scSharePct}%` }}
            title={`Sub-Contact: ${scSharePct}% (${scProd.toLocaleString()} Kg)`}
          />
        </div>

        <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-600 dark:text-slate-400 pt-0.5 whitespace-nowrap gap-2">
          <span className="shrink-0">{ihProd.toLocaleString()} Kg In-House</span>
          <span className="shrink-0">{scProd.toLocaleString()} Kg Sub-Contact</span>
        </div>
      </div>

      {/* Efficiency and Capacity Utilization Bottom Cards */}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        {/* 1. Efficiency Card */}
        <div className="rounded-xl border border-slate-200/90 bg-white/95 p-2 dark:border-slate-800 dark:bg-slate-900/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
              EFFICIENCY
            </span>
            <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400">
              {displayEfficiencyPct}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner">
            <div
              className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-500 shadow-xs"
              style={{ width: `${Math.min(100, Math.max(0, displayEfficiencyPct))}%` }}
            />
          </div>
        </div>

        {/* 2. Capacity Utilization Card */}
        <div className="rounded-xl border border-slate-200/90 bg-white/95 p-2 dark:border-slate-800 dark:bg-slate-900/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
              CAPACITY UTIL.
            </span>
            <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
              {displayCapacityUtilPct}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner">
            <div
              className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500 shadow-xs"
              style={{ width: `${Math.min(100, Math.max(0, displayCapacityUtilPct))}%` }}
            />
          </div>
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
  subContactAchievementPct,
  overallTarget,
  overallProduction,
  overallBulkProduction,
  overallSampleProduction,
  overallAchievementPct,
  flatKnitPcs = 20091,
  efficiencyPct = 81.1,
  capacityUtilizationPct = 57.3,
  periodLabel,
  className = '',
}: ProductionTargetSummaryCardProps) {
  const ihTarget = Math.round(inHouseTarget || 870453);
  const ihBulk = Math.round(inHouseBulkProduction || 663940);
  const ihBulkTarget = Math.round(inHouseBulkTarget || 819040);
  const ihSample = Math.round(inHouseSampleProduction || 23485);
  const ihLossForSample = Math.round(inHouseProdLossForSample || 67298);

  const ihProd = inHouseProduction !== undefined 
    ? Math.round(inHouseProduction) 
    : (ihBulk + ihSample);

  const scTarget = Math.round(subContactTarget || 575000);
  const scProd = Math.round(subContactProduction || 510931);

  const totalTgt = overallTarget !== undefined ? Math.round(overallTarget) : (ihTarget + scTarget);
  const totalPrd = overallProduction !== undefined ? Math.round(overallProduction) : (ihProd + scProd);

  return (
    <div
      id="kpi-production-target-card-group"
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 ${className}`}
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
      />

      {/* 2. SUB-CONTACT PRODUCTION CARD */}
      <SubContactProductionCard
        target={scTarget}
        production={scProd}
        sampleProduction={overallSampleProduction || 0}
        flatKnitPcs={flatKnitPcs}
        achievementPct={subContactAchievementPct}
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
      />
    </div>
  );
}
