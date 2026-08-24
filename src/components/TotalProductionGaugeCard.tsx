/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface TotalProductionGaugeCardProps {
  key?: React.Key;
  totalProduction: number;
  totalBulkProduction?: number;
  monthName?: string;
  monthTotalProduction?: number;
  monthBulkProduction?: number;
  inHouseBulkProduction?: number;
  subContactBulkProduction?: number;
  inHousePct?: number;
  subContactPct?: number;
  sampleProduction?: number;
  prodLossForSample?: number;
  lastMonthProduction?: number;
  growthPct?: number;
  achievementPct?: number;
  className?: string;
}

export default function TotalProductionGaugeCard({
  totalProduction,
  totalBulkProduction,
  monthName = 'August',
  monthTotalProduction,
  monthBulkProduction,
  inHouseBulkProduction,
  subContactBulkProduction,
  inHousePct,
  subContactPct,
  sampleProduction = 0,
  prodLossForSample = 0,
  lastMonthProduction,
  growthPct = -21,
  achievementPct = 80,
  className = '',
}: TotalProductionGaugeCardProps) {
  // 1. Resolve Monthly Totals & Bulk (strictly rounded integers, no fractions)
  const calculatedMonthTotal = Math.round(
    monthTotalProduction !== undefined ? monthTotalProduction : totalProduction
  );

  const calculatedTotalBulk = Math.round(
    totalBulkProduction !== undefined ? totalBulkProduction : totalProduction * 0.98
  );

  const calculatedMonthBulk = Math.round(
    monthBulkProduction !== undefined
      ? monthBulkProduction
      : (inHouseBulkProduction !== undefined && subContactBulkProduction !== undefined
          ? inHouseBulkProduction + subContactBulkProduction
          : calculatedMonthTotal * 0.98)
  );

  // 2. In-House & Sub-Contact are strictly the breakdown of Bulk Production (strictly rounded integers)
  const calculatedSubContactBulk = Math.round(
    subContactBulkProduction !== undefined
      ? subContactBulkProduction
      : (subContactPct !== undefined
          ? calculatedMonthBulk * (subContactPct / 100)
          : calculatedMonthBulk * 0.43)
  );

  const calculatedInHouseBulk = Math.round(
    inHouseBulkProduction !== undefined
      ? inHouseBulkProduction
      : (inHousePct !== undefined
          ? calculatedMonthBulk * (inHousePct / 100)
          : Math.max(0, calculatedMonthBulk - calculatedSubContactBulk))
  );

  // 3. Gauge Percentages (Split of Bulk Production: In-House % vs Sub-Contact %)
  const computedInHousePct = calculatedMonthBulk > 0
    ? Math.round((calculatedInHouseBulk / calculatedMonthBulk) * 100)
    : (inHousePct !== undefined ? inHousePct : 57);
  const clampedInHousePct = Math.min(100, Math.max(0, computedInHousePct));
  const clampedSubContactPct = 100 - clampedInHousePct;

  // 4. Sample Production & Production Loss For Sample (strictly rounded integers)
  const calculatedSampleProd = Math.round(
    sampleProduction !== undefined
      ? sampleProduction
      : Math.max(0, calculatedMonthTotal - calculatedMonthBulk)
  );

  const calculatedProdLoss = Math.round(
    prodLossForSample !== undefined
      ? prodLossForSample
      : calculatedSampleProd * 1.5
  );

  const calculatedLastMonthProd = Math.round(
    lastMonthProduction !== undefined
      ? lastMonthProduction
      : calculatedMonthTotal / (1 + (growthPct / 100))
  );

  // Growth sign check
  const isNegative = growthPct < 0;
  const displayGrowthPct = Math.abs(Math.round(growthPct));

  // Speedometer Gauge Arc Calculations (180-degree semi-circle gauge)
  const radius = 54;
  const strokeWidth = 13;
  const cx = 75;
  const cy = 70;
  const totalArcLength = Math.PI * radius; // Arc perimeter for 180 deg
  const inHouseArcLength = (clampedInHousePct / 100) * totalArcLength;

  // Needle angle: 180 deg (left, 0%) to 0 deg (right, 100%)
  const needleAngleDeg = 180 - (180 * (clampedInHousePct / 100));
  const needleAngleRad = (needleAngleDeg * Math.PI) / 180;
  const needleLength = 42;
  const needleTipX = cx + needleLength * Math.cos(needleAngleRad);
  const needleTipY = cy - needleLength * Math.sin(needleAngleRad);

  return (
    <div 
      className={`rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs overflow-hidden flex flex-col justify-between transition-all duration-200 hover:shadow-md ${className}`}
      id="total-production-kpi-gauge-card"
    >
      {/* 1. Header Bar: Total Production | Total: xxxKg | Bulk: xxxKg */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/50 px-3.5 py-2">
        <div className="flex items-center gap-2">
          {/* Production / Factory Icon with outer ring */}
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-800 dark:border-slate-200 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-2xs">
            <span className="text-xs leading-none">🏭</span>
          </div>
          <span className="font-sans text-xs font-black text-gray-900 dark:text-white tracking-tight">
            Total Production
          </span>
          {achievementPct !== undefined && (
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-sm ml-0.5 ${
              achievementPct >= 90
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                : achievementPct >= 75
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'
            }`}>
              {Math.round(achievementPct)}% Achieved
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold text-gray-800 dark:text-slate-200">
          <div>
            <span className="text-gray-500 dark:text-slate-400 font-medium">Total: </span>
            <span className="font-mono font-black text-gray-950 dark:text-white">
              {Math.round(totalProduction).toLocaleString()}Kg
            </span>
          </div>
          <div className="hidden xs:block h-3.5 w-px bg-gray-300 dark:bg-slate-700" />
          <div>
            <span className="text-gray-500 dark:text-slate-400 font-medium">Bulk: </span>
            <span className="font-mono font-black text-gray-950 dark:text-white">
              {calculatedTotalBulk.toLocaleString()}Kg
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Section: Production of [Month] & Two Columns (Left Metrics, Right Gauge) */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        {/* Centered Month Sub-Header */}
        <div className="text-center pb-2">
          <span className="font-sans text-xs font-black tracking-wide text-gray-900 dark:text-white">
            Production of {monthName}
          </span>
        </div>

        {/* Content Row: Metrics on Left, Gauge on Right (Non-overlapping layout) */}
        <div className="flex flex-col xs:flex-row items-center justify-between gap-3">
          {/* Left Column: Key Production Metrics with strictly aligned grid */}
          <div className="flex-1 min-w-0 w-full space-y-1 font-sans text-xs">
            {/* Total */}
            <div className="grid grid-cols-[96px_14px_1fr] items-center text-gray-800 dark:text-slate-200">
              <span className="text-gray-600 dark:text-slate-400 font-medium text-left truncate">
                Total
              </span>
              <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
              <span className="font-mono font-black text-gray-950 dark:text-white text-right truncate">
                {calculatedMonthTotal.toLocaleString()}Kg
              </span>
            </div>

            {/* Bulk */}
            <div className="grid grid-cols-[96px_14px_1fr] items-center text-gray-800 dark:text-slate-200">
              <span className="text-gray-600 dark:text-slate-400 font-medium text-left truncate">
                Bulk
              </span>
              <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
              <span className="font-mono font-black text-gray-950 dark:text-white text-right truncate">
                {calculatedMonthBulk.toLocaleString()}Kg
              </span>
            </div>

            {/* In-House */}
            <div className="grid grid-cols-[96px_14px_1fr] items-center text-gray-800 dark:text-slate-200">
              <span className="text-gray-600 dark:text-slate-400 font-medium text-left truncate">
                In-House
              </span>
              <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
              <span className="font-mono font-black text-gray-950 dark:text-white text-right truncate">
                {calculatedInHouseBulk.toLocaleString()}Kg
              </span>
            </div>

            {/* Sub-Contact */}
            <div className="grid grid-cols-[96px_14px_1fr] items-center text-gray-800 dark:text-slate-200">
              <span className="text-gray-600 dark:text-slate-400 font-medium text-left truncate">
                Sub-Contact
              </span>
              <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
              <span className="font-mono font-black text-gray-950 dark:text-white text-right truncate">
                {calculatedSubContactBulk.toLocaleString()}Kg
              </span>
            </div>

            {/* Total Sample Production */}
            <div className="grid grid-cols-[96px_14px_1fr] items-center text-gray-800 dark:text-slate-200">
              <span className="text-gray-600 dark:text-slate-400 font-medium text-left truncate" title="Total Sample Production">
                Total Sample
              </span>
              <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
              <span className="font-mono font-black text-gray-950 dark:text-white text-right truncate">
                {calculatedSampleProd.toLocaleString()}Kg
              </span>
            </div>

            {/* Production Loss for Sample */}
            <div className="grid grid-cols-[96px_14px_1fr] items-center text-gray-800 dark:text-slate-200">
              <span className="text-gray-600 dark:text-slate-400 font-medium text-left truncate" title="Production Loss For Sample">
                Loss For Sample
              </span>
              <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
              <span className="font-mono font-black text-gray-950 dark:text-white text-right truncate">
                {calculatedProdLoss.toLocaleString()}Kg
              </span>
            </div>
          </div>

          {/* Right Column: Speedometer / Semi-Circle Gauge (Isolated width to prevent any overlap) */}
          <div className="w-36 shrink-0 flex flex-col items-center justify-center pl-1">
            <div className="relative w-34 h-20 flex items-center justify-center">
              <svg 
                viewBox="0 0 150 82" 
                className="w-full h-full overflow-visible"
                aria-label={`Bulk Production Split: In-House ${clampedInHousePct}%, Sub-Contact ${clampedSubContactPct}%`}
              >
                {/* 1. Base / Sub-Contact Arc (Vibrant Red #EF4444) */}
                <path
                  d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  className="transition-all duration-700 ease-out"
                />

                {/* 2. In-House Arc (Vibrant Cyan #00BCD4) */}
                <path
                  d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                  fill="none"
                  stroke="#00BCD4"
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  strokeDasharray={`${inHouseArcLength} ${totalArcLength}`}
                  className="transition-all duration-700 ease-out"
                />

                {/* 3. Needle Pointer pointing to split percentage */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={needleTipX}
                  y2={needleTipY}
                  stroke="#64748B"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className="dark:stroke-slate-400 transition-all duration-700 ease-out"
                />

                {/* 4. Center Pivot Cap */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="5.5"
                  fill="#64748B"
                  className="dark:fill-slate-400"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r="2"
                  fill="#FFFFFF"
                  className="dark:fill-slate-900"
                />
              </svg>
            </div>

            {/* Gauge Bottom Labels (In-House % vs Sub-Contact %) */}
            <div className="w-full flex items-center justify-between text-[10px] font-bold mt-1 px-1">
              <div className="text-left">
                <span className="font-mono font-black text-gray-900 dark:text-white block leading-tight">
                  {clampedInHousePct}%
                </span>
                <span className="text-[9px] font-semibold text-gray-600 dark:text-slate-400 block whitespace-nowrap">
                  In-House
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono font-black text-gray-900 dark:text-white block leading-tight">
                  {clampedSubContactPct}%
                </span>
                <span className="text-[9px] font-semibold text-gray-600 dark:text-slate-400 block whitespace-nowrap">
                  Sub-Contact
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Footer Bar: Till Todays Last Month Production: xxxKg  ↑/↓x% */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-t border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 px-3.5 py-1.5 text-[10px] text-gray-600 dark:text-slate-400">
        <div className="truncate">
          <span className="font-medium text-gray-700 dark:text-slate-300">
            Till Todays Last Month Production:
          </span>{' '}
          <span className="font-mono font-bold text-gray-950 dark:text-white">
            {calculatedLastMonthProd.toLocaleString()}Kg
          </span>
        </div>
        <div className={`flex items-center gap-0.5 font-bold shrink-0 ${
          isNegative 
            ? 'text-red-600 dark:text-red-400' 
            : 'text-emerald-600 dark:text-emerald-400'
        }`}>
          <span className="text-xs">{isNegative ? '↓' : '↑'}</span>
          <span>{displayGrowthPct}%</span>
        </div>
      </div>
    </div>
  );
}
