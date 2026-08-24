/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Target, TrendingUp } from 'lucide-react';

export interface TotalTargetGaugeCardProps {
  key?: React.Key;
  totalTarget: number;
  totalBulk?: number;
  monthName?: string;
  monthTotal?: number;
  monthBulk?: number;
  inHouseTarget?: number;
  subContactTarget?: number;
  inHousePct?: number;
  subContactPct?: number;
  lastMonthBulkTarget?: number;
  growthPct?: number;
  className?: string;
}

export default function TotalTargetGaugeCard({
  totalTarget,
  totalBulk,
  monthName = 'August',
  monthTotal,
  monthBulk,
  inHouseTarget,
  subContactTarget,
  inHousePct = 60,
  subContactPct = 40,
  lastMonthBulkTarget,
  growthPct = 6,
  className = '',
}: TotalTargetGaugeCardProps) {
  // Fallbacks if values are missing or default
  const calculatedTotalBulk = totalBulk !== undefined ? totalBulk : Math.round(totalTarget * 0.633);
  const calculatedMonthTotal = monthTotal !== undefined ? monthTotal : Math.round(totalTarget * 0.207);
  const calculatedMonthBulk = monthBulk !== undefined ? monthBulk : Math.round(calculatedTotalBulk * 0.185);
  const calculatedInHouse = inHouseTarget !== undefined ? inHouseTarget : Math.round(calculatedMonthTotal * (inHousePct / 100));
  const calculatedSubContact = subContactTarget !== undefined ? subContactTarget : Math.round(calculatedMonthTotal * (subContactPct / 100));
  const calculatedLastMonthBulk = lastMonthBulkTarget !== undefined 
    ? lastMonthBulkTarget 
    : Math.round(calculatedMonthBulk / (1 + (growthPct / 100)));

  // Determine if growth is positive or negative
  const isNegative = growthPct < 0;
  const displayGrowthPct = Math.abs(growthPct);

  // Gauge Meter SVG Calculations (180-degree semi-circle gauge)
  const radius = 58;
  const strokeWidth = 14;
  const cx = 80;
  const cy = 76;
  const totalArcLength = Math.PI * radius; // Arc perimeter for 180 deg

  // Constrain percentage between 0 and 100
  const clampedInHousePct = Math.min(100, Math.max(0, inHousePct));
  const inHouseArcLength = (clampedInHousePct / 100) * totalArcLength;

  // Needle angle: 180 deg (left, 0%) to 0 deg (right, 100%)
  const needleAngleDeg = 180 - (180 * (clampedInHousePct / 100));
  const needleAngleRad = (needleAngleDeg * Math.PI) / 180;
  const needleLength = 46;
  const needleTipX = cx + needleLength * Math.cos(needleAngleRad);
  const needleTipY = cy - needleLength * Math.sin(needleAngleRad);

  return (
    <div 
      className={`rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs overflow-hidden flex flex-col justify-between transition-all duration-200 hover:shadow-md ${className}`}
      id="total-target-kpi-gauge-card"
    >
      {/* 1. Header Bar: Total Target | Total: xxxKg | Bulk: xxxKg */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/50 px-3.5 py-2">
        <div className="flex items-center gap-2">
          {/* Target Icon with outer ring */}
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-800 dark:border-slate-200 bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-2xs">
            <Target className="h-3.5 w-3.5 text-gray-900 dark:text-white" />
          </div>
          <span className="font-sans text-xs font-black text-gray-900 dark:text-white tracking-tight">
            Total Target
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold text-gray-800 dark:text-slate-200">
          <div>
            <span className="text-gray-500 dark:text-slate-400 font-medium">Total: </span>
            <span className="font-mono font-black text-gray-950 dark:text-white">
              {totalTarget.toLocaleString()}Kg
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

      {/* 2. Main Section: Target of [Month] & Two Columns (Left Metrics, Right Gauge) */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        {/* Centered Month Sub-Header */}
        <div className="text-center pb-2">
          <span className="font-sans text-xs font-black tracking-wide text-gray-900 dark:text-white">
            Target of {monthName}
          </span>
        </div>

        {/* Content Row: Metrics on Left, Gauge on Right */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-3 items-center">
          {/* Left Column: Key Target Metrics with perfectly aligned colons and values */}
          <div className="space-y-1.5 font-sans text-xs">
            <div className="grid grid-cols-[85px_12px_1fr] items-center text-gray-800 dark:text-slate-200">
              <span className="text-gray-600 dark:text-slate-400 font-medium">Total</span>
              <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
              <span className="font-mono font-black text-gray-950 dark:text-white text-right">
                {calculatedMonthTotal.toLocaleString()}Kg
              </span>
            </div>

            <div className="grid grid-cols-[85px_12px_1fr] items-center text-gray-800 dark:text-slate-200">
              <span className="text-gray-600 dark:text-slate-400 font-medium">Bulk</span>
              <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
              <span className="font-mono font-black text-gray-950 dark:text-white text-right">
                {calculatedMonthBulk.toLocaleString()}Kg
              </span>
            </div>

            <div className="grid grid-cols-[85px_12px_1fr] items-center text-gray-800 dark:text-slate-200">
              <span className="text-gray-600 dark:text-slate-400 font-medium">In-House</span>
              <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
              <span className="font-mono font-black text-gray-950 dark:text-white text-right">
                {calculatedInHouse.toLocaleString()}Kg
              </span>
            </div>

            <div className="grid grid-cols-[85px_12px_1fr] items-center text-gray-800 dark:text-slate-200">
              <span className="text-gray-600 dark:text-slate-400 font-medium">Sub-Contact</span>
              <span className="font-bold text-gray-700 dark:text-slate-400 text-center">:</span>
              <span className="font-mono font-black text-gray-950 dark:text-white text-right">
                {calculatedSubContact.toLocaleString()}Kg
              </span>
            </div>
          </div>

          {/* Right Column: Speedometer / Semi-Circle Gauge */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-36 sm:w-40 h-22 flex items-center justify-center">
              <svg 
                viewBox="0 0 160 88" 
                className="w-full h-full overflow-visible"
                aria-label={`Target Split: In-House ${clampedInHousePct}%, Sub-Contact ${100 - clampedInHousePct}%`}
              >
                {/* 1. Base / Sub-Contact Arc (Vibrant Red) */}
                <path
                  d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  className="transition-all duration-700 ease-out"
                />

                {/* 2. In-House Arc (Vibrant Paste / Cyan #00BCD4) */}
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
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="dark:stroke-slate-400 transition-all duration-700 ease-out"
                />

                {/* 4. Center Pivot Cap */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="6"
                  fill="#64748B"
                  className="dark:fill-slate-400"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r="2.5"
                  fill="#FFFFFF"
                  className="dark:fill-slate-900"
                />
              </svg>
            </div>

            {/* Gauge Bottom Labels (In-House % vs Sub-Contact %) */}
            <div className="w-full flex items-center justify-between text-[11px] font-bold px-1 mt-0.5">
              <div className="text-left">
                <span className="font-mono font-black text-gray-900 dark:text-white block leading-tight">
                  {clampedInHousePct}%
                </span>
                <span className="text-[10px] font-semibold text-gray-600 dark:text-slate-400">
                  In-House
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono font-black text-gray-900 dark:text-white block leading-tight">
                  {100 - clampedInHousePct}%
                </span>
                <span className="text-[10px] font-semibold text-gray-600 dark:text-slate-400">
                  Sub-Contact
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Footer Bar: Till Todays Last Month Bulk Target: xxxKg  ↑/↓x% */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-t border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 px-3.5 py-1.5 text-[10px] text-gray-600 dark:text-slate-400">
        <div className="truncate">
          <span className="font-medium text-gray-700 dark:text-slate-300">
            Till Todays Last Month Bulk Target:
          </span>{' '}
          <span className="font-mono font-bold text-gray-950 dark:text-white">
            {calculatedLastMonthBulk.toLocaleString()}Kg
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
