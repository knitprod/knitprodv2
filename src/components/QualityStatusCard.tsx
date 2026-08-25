/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, ShieldAlert, AlertTriangle, Sparkles } from 'lucide-react';

export interface QualityStatusCardProps {
  totalReject: number;
  rejectPct: number;
  totalHold: number;
  holdPct: number;
  totalJhuteCutpcs?: number;
  jhuteCutpcsPct?: number;
  cumulativeScrapPct?: number;
  periodLabel?: string;
  className?: string;
}

export default function QualityStatusCard({
  totalReject,
  rejectPct,
  totalHold,
  holdPct,
  totalJhuteCutpcs = 1840,
  jhuteCutpcsPct = 0.12,
  cumulativeScrapPct,
  periodLabel,
  className = '',
}: QualityStatusCardProps) {
  // Format formatted numbers
  const formattedReject = typeof totalReject === 'number' 
    ? totalReject.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '4,062.55';
    
  const formattedHold = typeof totalHold === 'number'
    ? totalHold.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '46,527.79';

  const displayRejectPct = typeof rejectPct === 'number' ? rejectPct.toFixed(2) : '0.07';
  const displayHoldPct = typeof holdPct === 'number' ? holdPct.toFixed(1) : '0.8';
  
  const calcScrap = cumulativeScrapPct !== undefined 
    ? cumulativeScrapPct 
    : ((Number(displayRejectPct) || 0) + (Number(displayHoldPct) || 0));
  const displayScrapPct = calcScrap.toFixed(2);

  const displayJhute = typeof totalJhuteCutpcs === 'number' ? Math.round(totalJhuteCutpcs).toLocaleString() : '1,840';
  const displayJhutePct = typeof jhuteCutpcsPct === 'number' ? jhuteCutpcsPct.toFixed(2) : '0.12';

  // Quality clearance / pass rate %
  const passRatePct = Math.max(0, Math.min(100, 100 - (Number(displayRejectPct) + Number(displayHoldPct))));

  return (
    <div
      id="kpi-quality-status-card"
      className={`rounded-2xl border border-red-200/90 dark:border-red-900/60 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between gap-3 hover:border-red-300 dark:hover:border-red-800 transition-all ${className}`}
    >
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <span className="font-sans text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
            QUALITY STATUS
          </span>
        </div>
        
        {/* Red Shield Alert Badge */}
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/80 shadow-2xs">
          <ShieldAlert className="h-4 w-4" />
        </div>
      </div>

      {/* 2. Main Metrics: Reject & Hold side-by-side */}
      <div className="grid grid-cols-2 gap-2 items-center bg-slate-50/60 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
        {/* Reject Column */}
        <div className="space-y-0.5">
          <div className="font-mono text-xl sm:text-2xl font-black tracking-tight text-red-600 dark:text-red-400">
            {formattedReject}
          </div>
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>Reject</span>
            <span className="text-red-600 dark:text-red-400 font-mono font-black">({displayRejectPct}%)</span>
          </div>
        </div>

        {/* Hold Column */}
        <div className="space-y-0.5 pl-2 border-l border-slate-200 dark:border-slate-700">
          <div className="font-mono text-xl sm:text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
            {formattedHold}
          </div>
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>Hold</span>
            <span className="text-amber-600 dark:text-amber-400 font-mono font-black">({displayHoldPct}%)</span>
          </div>
        </div>
      </div>

      {/* 3. Cumulative Scrap & Jhute/CutPcs Information */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className="text-slate-800 dark:text-slate-200 font-semibold">
            Jhute/CutPcs
          </span>
          <div className="text-slate-600 dark:text-slate-300 font-mono text-[10.5px]">
            <span className="font-black text-slate-800 dark:text-white">{displayJhute} Kg</span>{' '}
            <span className="text-slate-400">({displayJhutePct}%)</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] pt-0.5 text-slate-500 dark:text-slate-400">
          <span className="font-sans font-bold uppercase tracking-wide">
            Cumulative Scrap:
          </span>
          <span className="font-mono font-black text-red-600 dark:text-red-400 text-xs">
            {displayScrapPct}%
          </span>
        </div>
      </div>

      {/* 4. Quality Pass Rate Progress Bar (matching other cards) */}
      <div className="pt-0.5 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span className="text-slate-800 dark:text-slate-200">
            Quality Pass Rate
          </span>
          <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
            {passRatePct.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner">
          <div
            className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500 shadow-xs"
            style={{ width: `${passRatePct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
