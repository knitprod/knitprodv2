/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, ShieldAlert, Factory, Layers } from 'lucide-react';

export interface QualityStatusCardProps {
  // In-House metrics (Tracks Reject, Hold, Jhute/Cut Pcs)
  inHouseReject?: number;
  inHouseRejectPct?: number;
  inHouseHold?: number;
  inHouseHoldPct?: number;
  inHouseJhuteCutpcs?: number;
  inHouseJhuteCutpcsPct?: number;
  inHouseCumulativeScrapPct?: number;
  inHousePassRatePct?: number;

  // Sub-Contact metrics (Tracks Reject, Hold, Jhute/Cut Pcs)
  subContactReject?: number;
  subContactRejectPct?: number;
  subContactHold?: number;
  subContactHoldPct?: number;
  subContactJhuteCutpcs?: number;
  subContactJhuteCutpcsPct?: number;
  subContactCumulativeScrapPct?: number;
  subContactPassRatePct?: number;

  // Overall totals
  totalReject?: number;
  rejectPct?: number;
  totalHold?: number;
  holdPct?: number;
  totalJhuteCutpcs?: number;
  jhuteCutpcsPct?: number;
  cumulativeScrapPct?: number;
  periodLabel?: string;
  className?: string;
}

/**
 * Format quality metric weight:
 * - If kg >= 1000 -> Format as Tons (e.g. "10.09 T" or "1.03 T")
 * - If kg < 1000 -> Format in Kg (e.g. "749 Kg")
 */
function formatQualityWeight(kg: number) {
  const safeKg = Math.max(0, Math.round(kg || 0));
  if (safeKg >= 1000) {
    const tons = (safeKg / 1000).toFixed(safeKg % 1000 === 0 ? 1 : 2);
    return {
      value: tons,
      unit: 'Tons',
      display: `${tons} T`,
      full: `${tons} Tons (${safeKg.toLocaleString()} Kg)`,
    };
  }
  return {
    value: safeKg.toLocaleString(),
    unit: 'Kg',
    display: `${safeKg.toLocaleString()} Kg`,
    full: `${safeKg.toLocaleString()} Kg`,
  };
}

export default function QualityStatusCard({
  inHouseReject,
  inHouseRejectPct,
  inHouseHold,
  inHouseHoldPct,
  inHouseJhuteCutpcs,
  inHouseJhuteCutpcsPct,
  inHouseCumulativeScrapPct,
  inHousePassRatePct,

  subContactReject,
  subContactRejectPct,
  subContactHold,
  subContactHoldPct,
  subContactJhuteCutpcs,
  subContactJhuteCutpcsPct,
  subContactCumulativeScrapPct,
  subContactPassRatePct,

  totalReject,
  rejectPct,
  totalHold,
  holdPct,
  totalJhuteCutpcs,
  jhuteCutpcsPct,
  cumulativeScrapPct,
  periodLabel,
  className = '',
}: QualityStatusCardProps) {
  // ----------------------------------------------------
  // IN-HOUSE VALUES (Reject, Hold, Jhute/Cut Pcs)
  // ----------------------------------------------------
  const ihReject = Math.round(inHouseReject !== undefined ? inHouseReject : (totalReject !== undefined ? totalReject : 0));
  const ihHold = Math.round(inHouseHold !== undefined ? inHouseHold : (totalHold !== undefined ? totalHold : 0));
  const ihJhute = Math.round(inHouseJhuteCutpcs !== undefined ? inHouseJhuteCutpcs : (totalJhuteCutpcs !== undefined ? totalJhuteCutpcs : 0));

  const ihRejectPct = typeof inHouseRejectPct === 'number' ? inHouseRejectPct : (typeof rejectPct === 'number' ? rejectPct : 0);
  const ihHoldPct = typeof inHouseHoldPct === 'number' ? inHouseHoldPct : (typeof holdPct === 'number' ? holdPct : 0);
  const ihJhutePct = typeof inHouseJhuteCutpcsPct === 'number' ? inHouseJhuteCutpcsPct : (typeof jhuteCutpcsPct === 'number' ? jhuteCutpcsPct : 0);

  const ihScrap = inHouseCumulativeScrapPct !== undefined
    ? inHouseCumulativeScrapPct
    : parseFloat((ihRejectPct + ihHoldPct + ihJhutePct).toFixed(2));
  const ihPassRate = inHousePassRatePct !== undefined
    ? inHousePassRatePct
    : Math.max(0, Math.min(100, 100 - ihScrap));

  const ihRejFormatted = formatQualityWeight(ihReject);
  const ihHoldFormatted = formatQualityWeight(ihHold);
  const ihJhuteFormatted = formatQualityWeight(ihJhute);

  // ----------------------------------------------------
  // SUB-CONTACT VALUES (Reject, Hold, Jhute/Cut Pcs)
  // ----------------------------------------------------
  const scReject = Math.round(subContactReject !== undefined ? subContactReject : 0);
  const scHold = Math.round(subContactHold !== undefined ? subContactHold : 0);
  const scJhute = Math.round(subContactJhuteCutpcs !== undefined ? subContactJhuteCutpcs : 0);

  const scRejectPct = typeof subContactRejectPct === 'number' ? subContactRejectPct : 0;
  const scHoldPct = typeof subContactHoldPct === 'number' ? subContactHoldPct : 0;
  const scJhutePct = typeof subContactJhuteCutpcsPct === 'number' ? subContactJhuteCutpcsPct : 0;

  const scScrap = subContactCumulativeScrapPct !== undefined
    ? subContactCumulativeScrapPct
    : parseFloat((scRejectPct + scHoldPct + scJhutePct).toFixed(2));
  const scPassRate = subContactPassRatePct !== undefined
    ? subContactPassRatePct
    : Math.max(0, Math.min(100, 100 - scScrap));

  const scRejFormatted = formatQualityWeight(scReject);
  const scHoldFormatted = formatQualityWeight(scHold);
  const scJhuteFormatted = formatQualityWeight(scJhute);

  // ----------------------------------------------------
  // OVERALL PASS RATE
  // ----------------------------------------------------
  const overallScrap = cumulativeScrapPct !== undefined
    ? cumulativeScrapPct
    : (ihScrap > 0 && scScrap > 0 ? parseFloat(((ihScrap + scScrap) / 2).toFixed(2)) : (ihScrap || scScrap || 0));
  const overallPassRate = Math.max(0, Math.min(100, 100 - overallScrap));

  return (
    <div
      id="kpi-quality-status-card"
      className={`w-full h-[200px] rounded-2xl border border-red-200/90 dark:border-red-900/60 bg-white dark:bg-slate-900 px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col justify-between hover:border-red-300 dark:hover:border-red-800 transition-all overflow-hidden ${className}`}
    >
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
            <CheckCircle2 className="h-3 w-3" />
          </div>
          <div className="min-w-0 truncate">
            <span className="font-sans text-[11px] font-black uppercase tracking-wider text-slate-950 dark:text-white block truncate leading-none">
              QUALITY STATUS
            </span>
            {periodLabel && (
              <span className="font-sans text-[9px] font-semibold text-slate-500 dark:text-slate-400 block truncate leading-tight mt-0.5">
                {periodLabel}
              </span>
            )}
          </div>
        </div>
        
        {/* Pass Rate Badge & Alert Icon */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/80 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-emerald-800 dark:text-emerald-300 shadow-2xs">
            {overallPassRate.toFixed(1)}% Pass
          </span>
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/80">
            <ShieldAlert className="h-2.5 w-2.5" />
          </div>
        </div>
      </div>

      {/* 2. Side-by-Side Breakdown: IN-HOUSE vs SUB-CONTACT */}
      <div className="grid grid-cols-2 gap-1.5 my-auto">
        {/* Left: IN-HOUSE Section */}
        <div className="rounded-lg bg-blue-50/70 dark:bg-slate-800/80 p-1.5 border border-blue-200 dark:border-blue-900/60 flex flex-col justify-between">
          {/* In-House Header */}
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-blue-200/80 dark:border-blue-900/50">
            <div className="flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider text-blue-900 dark:text-blue-200 leading-none">
              <Factory className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>IN-HOUSE</span>
            </div>
            <span className="font-mono text-[8.5px] font-bold text-blue-800 dark:text-blue-300">
              {ihPassRate.toFixed(1)}% Pass
            </span>
          </div>

          {/* In-House 3 Metrics: Reject, Hold, Jhute (Units clearly marked) */}
          <div className="grid grid-cols-3 gap-0.5 text-center items-center">
            {/* Reject */}
            <div className="px-0.5" title={`In-House Reject: ${ihRejFormatted.full}`}>
              <span className="text-[7.5px] font-bold uppercase tracking-tight text-red-600 dark:text-red-400 block leading-none">
                REJ
              </span>
              <span className="font-mono text-[10.5px] sm:text-[11px] font-black text-red-600 dark:text-red-400 leading-tight mt-0.5 block truncate">
                {ihRejFormatted.display}
              </span>
              <span className="text-[8px] font-mono font-bold text-slate-700 dark:text-slate-300 block leading-tight mt-0.5">
                {ihRejectPct.toFixed(1)}%
              </span>
            </div>

            {/* Hold */}
            <div className="px-0.5 border-x border-blue-200 dark:border-blue-900/60" title={`In-House Hold: ${ihHoldFormatted.full}`}>
              <span className="text-[7.5px] font-bold uppercase tracking-tight text-amber-600 dark:text-amber-400 block leading-none">
                HOLD
              </span>
              <span className="font-mono text-[10.5px] sm:text-[11px] font-black text-amber-600 dark:text-amber-400 leading-tight mt-0.5 block truncate">
                {ihHoldFormatted.display}
              </span>
              <span className="text-[8px] font-mono font-bold text-slate-700 dark:text-slate-300 block leading-tight mt-0.5">
                {ihHoldPct.toFixed(1)}%
              </span>
            </div>

            {/* Jhute */}
            <div className="px-0.5" title={`In-House Jhute/Cut Pcs: ${ihJhuteFormatted.full}`}>
              <span className="text-[7.5px] font-bold uppercase tracking-tight text-indigo-600 dark:text-indigo-400 block leading-none">
                JHUTE
              </span>
              <span className="font-mono text-[10.5px] sm:text-[11px] font-black text-indigo-600 dark:text-indigo-400 leading-tight mt-0.5 block truncate">
                {ihJhuteFormatted.display}
              </span>
              <span className="text-[8px] font-mono font-bold text-slate-700 dark:text-slate-300 block leading-tight mt-0.5">
                {ihJhutePct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Right: SUB-CONTACT Section */}
        <div className="rounded-lg bg-purple-50/70 dark:bg-slate-800/80 p-1.5 border border-purple-200 dark:border-purple-900/60 flex flex-col justify-between">
          {/* Sub-Contact Header */}
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-purple-200/80 dark:border-purple-900/50">
            <div className="flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider text-purple-900 dark:text-purple-200 leading-none">
              <Layers className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>SUB-CONTACT</span>
            </div>
            <span className="font-mono text-[8.5px] font-bold text-purple-800 dark:text-purple-300">
              {scPassRate.toFixed(1)}% Pass
            </span>
          </div>

          {/* Sub-Contact 3 Metrics: Reject, Hold, Jhute */}
          <div className="grid grid-cols-3 gap-0.5 text-center items-center">
            {/* Reject */}
            <div className="px-0.5" title={`Sub-Contact Reject: ${scRejFormatted.full}`}>
              <span className="text-[7.5px] font-bold uppercase tracking-tight text-purple-700 dark:text-purple-400 block leading-none">
                REJ
              </span>
              <span className="font-mono text-[10.5px] sm:text-[11px] font-black text-red-600 dark:text-red-400 leading-tight mt-0.5 block truncate">
                {scRejFormatted.display}
              </span>
              <span className="text-[8px] font-mono font-bold text-slate-700 dark:text-slate-300 block leading-tight mt-0.5">
                {scRejectPct.toFixed(1)}%
              </span>
            </div>

            {/* Hold */}
            <div className="px-0.5 border-x border-purple-200 dark:border-purple-900/60" title={`Sub-Contact Hold: ${scHoldFormatted.full}`}>
              <span className="text-[7.5px] font-bold uppercase tracking-tight text-amber-600 dark:text-amber-400 block leading-none">
                HOLD
              </span>
              <span className="font-mono text-[10.5px] sm:text-[11px] font-black text-amber-600 dark:text-amber-400 leading-tight mt-0.5 block truncate">
                {scHoldFormatted.display}
              </span>
              <span className="text-[8px] font-mono font-bold text-slate-700 dark:text-slate-300 block leading-tight mt-0.5">
                {scHoldPct.toFixed(1)}%
              </span>
            </div>

            {/* Jhute */}
            <div className="px-0.5" title={`Sub-Contact Jhute/Cut Pcs: ${scJhuteFormatted.full}`}>
              <span className="text-[7.5px] font-bold uppercase tracking-tight text-indigo-600 dark:text-indigo-400 block leading-none">
                JHUTE
              </span>
              <span className="font-mono text-[10.5px] sm:text-[11px] font-black text-indigo-600 dark:text-indigo-400 leading-tight mt-0.5 block truncate">
                {scJhuteFormatted.display}
              </span>
              <span className="text-[8px] font-mono font-bold text-slate-700 dark:text-slate-300 block leading-tight mt-0.5">
                {scJhutePct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Overall Quality Pass Rate Bar */}
      <div className="space-y-0.5 pt-0.5">
        <div className="flex items-center justify-between text-[9.5px] font-bold leading-none">
          <span className="text-slate-800 dark:text-slate-200">
            Overall Quality Pass Rate
          </span>
          <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
            {overallPassRate.toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner">
          <div
            className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500 shadow-xs"
            style={{ width: `${overallPassRate}%` }}
          />
        </div>
      </div>
    </div>
  );
}
