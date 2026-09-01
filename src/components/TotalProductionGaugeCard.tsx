/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { formatWeight } from './ProductionTargetSummaryCard';

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
  efficiencyPct?: number;
  capacityUtilizationPct?: number;
  className?: string;
}

interface MiniGaugeProps {
  label: string;
  value: number;
  color?: string;
}

function MiniSpeedometer({ label, value, color = '#0284c7' }: MiniGaugeProps) {
  const roundedVal = Math.round(value);
  const clampedVal = Math.min(100, Math.max(0, roundedVal));
  
  const radius = 30;
  const strokeWidth = 6.5;
  const cx = 45;
  const cy = 38;
  const totalArcLength = Math.PI * radius;
  const fillArcLength = (clampedVal / 100) * totalArcLength;

  // Needle angle: 180 deg (left, 0%) to 0 deg (right, 100%)
  const needleAngleDeg = 180 - (180 * (clampedVal / 100));
  const needleAngleRad = (needleAngleDeg * Math.PI) / 180;
  const needleLength = 23;
  const needleTipX = cx + needleLength * Math.cos(needleAngleRad);
  const needleTipY = cy - needleLength * Math.sin(needleAngleRad);

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-w-0">
      <div className="relative w-20 h-10 flex items-center justify-center">
        <svg 
          viewBox="0 0 90 44" 
          className="w-full h-full overflow-visible"
          aria-label={`${label}: ${roundedVal}%`}
        >
          {/* Background Track Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="dark:stroke-slate-700"
          />

          {/* Filled Active Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${fillArcLength} ${totalArcLength}`}
            className="transition-all duration-700 ease-out"
          />

          {/* Needle */}
          <line
            x1={cx}
            y1={cy}
            x2={needleTipX}
            y2={needleTipY}
            stroke="#475569"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="dark:stroke-slate-300 transition-all duration-700 ease-out"
          />

          {/* Center Pivot */}
          <circle
            cx={cx}
            cy={cy}
            r="3.5"
            fill="#475569"
            className="dark:fill-slate-300"
          />
          <circle
            cx={cx}
            cy={cy}
            r="1.2"
            fill="#FFFFFF"
            className="dark:fill-slate-900"
          />
        </svg>
      </div>
      
      {/* Label and Value */}
      <div className="text-center mt-0.5 w-full px-0.5">
        <span className="font-mono text-xs font-black text-gray-950 dark:text-white block leading-tight">
          {roundedVal}%
        </span>
        <span 
          className="text-[9.5px] font-semibold text-gray-600 dark:text-slate-400 block truncate"
          title={label}
        >
          {label}
        </span>
      </div>
    </div>
  );
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
  efficiencyPct = 84,
  capacityUtilizationPct = 76,
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

  // 3. Split of Bulk Production: In-House % vs Sub-Contact %
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
              {formatWeight(totalProduction)}
            </span>
          </div>
          <div className="hidden xs:block h-3.5 w-px bg-gray-300 dark:bg-slate-700" />
          <div>
            <span className="text-gray-500 dark:text-slate-400 font-medium">Bulk: </span>
            <span className="font-mono font-black text-gray-950 dark:text-white">
              {formatWeight(calculatedTotalBulk)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Section: Production of [Month], Metrics List, Progress Bar, and Dual Bottom Speedometers */}
      <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-2">
        {/* Centered Month / Filter Period Sub-Header */}
        <div className="text-center pb-0.5 px-1">
          <span 
            className="font-sans text-xs font-black tracking-wide text-gray-900 dark:text-white block truncate"
            title={(monthName || 'August').startsWith('Production') ? monthName : `Production of ${monthName || 'August'}`}
          >
            {(monthName || 'August').startsWith('Production') ? monthName : `Production of ${monthName || 'August'}`}
          </span>
        </div>

        {/* Key Production Metrics with strictly aligned grid */}
        <div className="w-full space-y-1 font-sans text-xs">
          {/* Total */}
          <div className="grid grid-cols-[100px_14px_1fr] items-center text-gray-800 dark:text-slate-200">
            <span className="text-gray-600 dark:text-slate-400 font-medium text-left truncate">
              Total
            </span>
            <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
            <span className="font-mono font-black text-gray-950 dark:text-white text-right truncate">
              {formatWeight(calculatedMonthTotal)}
            </span>
          </div>

          {/* Bulk */}
          <div className="grid grid-cols-[100px_14px_1fr] items-center text-gray-800 dark:text-slate-200">
            <span className="text-gray-600 dark:text-slate-400 font-medium text-left truncate">
              Bulk
            </span>
            <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
            <span className="font-mono font-black text-gray-950 dark:text-white text-right truncate">
              {formatWeight(calculatedMonthBulk)}
            </span>
          </div>

          {/* In-House */}
          <div className="grid grid-cols-[100px_14px_1fr] items-center text-gray-800 dark:text-slate-200">
            <span className="text-gray-600 dark:text-slate-400 font-medium text-left truncate">
              In-House
            </span>
            <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
            <span className="font-mono font-black text-gray-950 dark:text-white text-right truncate">
              {formatWeight(calculatedInHouseBulk)}
            </span>
          </div>

          {/* Sub-Contact */}
          <div className="grid grid-cols-[100px_14px_1fr] items-center text-gray-800 dark:text-slate-200">
            <span className="text-gray-600 dark:text-slate-400 font-medium text-left truncate">
              Sub-Contact
            </span>
            <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
            <span className="font-mono font-black text-gray-950 dark:text-white text-right truncate">
              {formatWeight(calculatedSubContactBulk)}
            </span>
          </div>

          {/* Total Sample Production */}
          <div className="grid grid-cols-[100px_14px_1fr] items-center text-gray-800 dark:text-slate-200">
            <span className="text-gray-600 dark:text-slate-400 font-medium text-left truncate" title="Total Sample Production">
              Total Sample
            </span>
            <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
            <span className="font-mono font-black text-gray-950 dark:text-white text-right truncate">
              {formatWeight(calculatedSampleProd)}
            </span>
          </div>

          {/* Production Loss for Sample */}
          <div className="grid grid-cols-[100px_14px_1fr] items-center text-gray-800 dark:text-slate-200">
            <span className="text-gray-600 dark:text-slate-400 font-medium text-left truncate" title="Production Loss For Sample">
              Loss For Sample
            </span>
            <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
            <span className="font-mono font-black text-gray-950 dark:text-white text-right truncate">
              {formatWeight(calculatedProdLoss)}
            </span>
          </div>
        </div>

        {/* Horizontal Progress Bar Chart */}
        <div className="w-full pt-0.5">
          {/* Top Labels: "In-House X%" on Left, "Y% Sub-Contact" on Right */}
          <div className="w-full flex items-center justify-between text-[11px] font-bold text-gray-900 dark:text-slate-100 mb-1">
            <span className="text-left">In-House {clampedInHousePct}%</span>
            <span className="text-right">{clampedSubContactPct}% Sub-Contact</span>
          </div>

          {/* Dual-Color Segmented Horizontal Bar stretching full width */}
          <div 
            className="h-4 sm:h-4.5 w-full flex overflow-hidden shadow-2xs"
            role="progressbar"
            aria-label={`Bulk Production Breakdown: In-House ${clampedInHousePct}%, Sub-Contact ${clampedSubContactPct}%`}
          >
            {/* In-House Segment (Deep Petrol Teal) */}
            <div
              style={{ width: `${clampedInHousePct}%` }}
              className="h-full bg-[#13607c] transition-all duration-500 ease-out"
              title={`In-House: ${clampedInHousePct}%`}
            />
            {/* Sub-Contact Segment (Warm Orange) */}
            <div
              style={{ width: `${clampedSubContactPct}%` }}
              className="h-full bg-[#e26a2c] transition-all duration-500 ease-out"
              title={`Sub-Contact: ${clampedSubContactPct}%`}
            />
          </div>
        </div>

        {/* Bottom Gauges Row: Left Efficiency & Right Capacity Utilization */}
        <div className="w-full pt-1.5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2">
          {/* Left Bottom: Efficiency Speedometer Gauge */}
          <MiniSpeedometer 
            label="Efficiency"
            value={efficiencyPct}
            color="#059669"
          />

          <div className="h-9 w-px bg-gray-200 dark:bg-slate-700" />

          {/* Right Bottom: Capacity Utilization Speedometer Gauge */}
          <MiniSpeedometer 
            label="Capacity Utilization"
            value={capacityUtilizationPct}
            color="#0284c7"
          />
        </div>
      </div>

      {/* 3. Footer Bar: Till Todays Last Month Production: xxxKg  ↑/↓x% */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-t border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 px-3.5 py-1.5 text-[10px] text-gray-600 dark:text-slate-400">
        <div className="truncate">
          <span className="font-medium text-gray-700 dark:text-slate-300">
            Till Todays Last Month Production:
          </span>{' '}
          <span className="font-mono font-bold text-gray-950 dark:text-white">
            {formatWeight(calculatedLastMonthProd)}
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
