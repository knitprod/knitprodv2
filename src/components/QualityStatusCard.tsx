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

  // Sub-Contact metrics (Tracks Reject only; Hold & Jhute do not apply)
  subContactReject?: number;
  subContactRejectPct?: number;
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

  // ----------------------------------------------------
  // SUB-CONTACT VALUES (Reject only)
  // ----------------------------------------------------
  const scReject = Math.round(subContactReject !== undefined ? subContactReject : 0);
  const scRejectPct = typeof subContactRejectPct === 'number' ? subContactRejectPct : 0;

  const scScrap = subContactCumulativeScrapPct !== undefined
    ? subContactCumulativeScrapPct
    : scRejectPct;
  const scPassRate = subContactPassRatePct !== undefined
    ? subContactPassRatePct
    : Math.max(0, Math.min(100, 100 - scScrap));

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
      className={`rounded-2xl border border-red-200/90 dark:border-red-900/60 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between gap-2.5 hover:border-red-300 dark:hover:border-red-800 transition-all ${className}`}
    >
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between pb-0.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <span className="font-sans text-xs font-black uppercase tracking-wider text-slate-950 dark:text-white">
            QUALITY STATUS
          </span>
        </div>
        
        {/* Pass Rate Badge & Alert Icon */}
        <div className="flex items-center gap-1.5">
          <span className="rounded-lg bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/80 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800 dark:text-emerald-300 shadow-2xs">
            {overallPassRate.toFixed(1)}% Pass
          </span>
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/80 shadow-2xs">
            <ShieldAlert className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>

      {/* 2. IN-HOUSE CONTAINER */}
      <div 
        id="quality-status-in-house-container"
        className="rounded-xl border border-blue-200/90 bg-linear-to-b from-blue-50/70 via-blue-50/30 to-white dark:from-blue-950/40 dark:via-slate-900/90 dark:to-slate-900/60 p-2.5 dark:border-blue-900/50 shadow-2xs flex flex-col justify-between gap-2"
      >
        {/* In-House Header */}
        <div className="flex items-center justify-between pb-1 border-b border-blue-100 dark:border-blue-900/40">
          <div className="flex items-center gap-1">
            <Factory className="h-3 w-3 text-blue-700 dark:text-blue-400" />
            <span className="font-sans text-[10.5px] font-black uppercase tracking-wider text-blue-950 dark:text-blue-200">
              IN-HOUSE
            </span>
          </div>
          <span className="rounded-md bg-blue-100 dark:bg-blue-900/80 border border-blue-200 dark:border-blue-800 px-1.5 py-0.2 font-mono text-[9px] font-bold text-blue-900 dark:text-blue-200 shadow-2xs">
            {ihPassRate.toFixed(1)}% Pass
          </span>
        </div>

        {/* In-House 3-Column Metrics (Reject, Hold, Jhute/Cut) */}
        <div className="grid grid-cols-3 gap-1.5 items-center bg-white/95 dark:bg-slate-900/90 p-2 rounded-lg border border-blue-100 dark:border-blue-900/30">
          {/* Reject */}
          <div className="space-y-0.5 text-left">
            <div className="font-mono text-base sm:text-lg font-black tracking-tight text-red-600 dark:text-red-400 truncate" title={`${ihReject.toLocaleString()} Kg Reject`}>
              {ihReject.toLocaleString()}
            </div>
            <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-0.5 flex-wrap">
              <span>Reject</span>
              <span className="text-red-600 dark:text-red-400 font-mono font-black">({ihRejectPct.toFixed(2)}%)</span>
            </div>
          </div>

          {/* Hold */}
          <div className="space-y-0.5 pl-1.5 border-l border-slate-200 dark:border-slate-700 text-left">
            <div className="font-mono text-base sm:text-lg font-black tracking-tight text-amber-600 dark:text-amber-400 truncate" title={`${ihHold.toLocaleString()} Kg Hold`}>
              {ihHold.toLocaleString()}
            </div>
            <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-0.5 flex-wrap">
              <span>Hold</span>
              <span className="text-amber-600 dark:text-amber-400 font-mono font-black">({ihHoldPct < 0.1 ? ihHoldPct.toFixed(2) : ihHoldPct.toFixed(1)}%)</span>
            </div>
          </div>

          {/* Jhute/Cut */}
          <div className="space-y-0.5 pl-1.5 border-l border-slate-200 dark:border-slate-700 text-left">
            <div className="font-mono text-base sm:text-lg font-black tracking-tight text-indigo-600 dark:text-indigo-400 truncate" title={`${ihJhute.toLocaleString()} Kg Jhute/CutPcs`}>
              {ihJhute.toLocaleString()}
            </div>
            <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-0.5 flex-wrap">
              <span className="truncate">Jhute/Cut</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-mono font-black">({ihJhutePct.toFixed(2)}%)</span>
            </div>
          </div>
        </div>

        {/* In-House Scrap & Progress Bar */}
        <div className="pt-0.5 space-y-1">
          <div className="flex items-center justify-between text-[9.5px] font-bold">
            <span className="text-slate-600 dark:text-slate-400">
              Scrap: <span className="font-mono text-red-600 dark:text-red-400 font-black">{ihScrap.toFixed(2)}%</span>
            </span>
            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
              {ihPassRate.toFixed(1)}% Pass
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-100/90 dark:bg-slate-800 shadow-inner">
            <div
              className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500 shadow-xs"
              style={{ width: `${ihPassRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. SUB-CONTACT CONTAINER (Accurately reflects Reject only; Hold & Jhute/Cut are N/A) */}
      <div 
        id="quality-status-sub-contact-container"
        className="rounded-xl border border-purple-200/90 bg-linear-to-b from-purple-50/70 via-purple-50/30 to-white p-2.5 dark:border-purple-900/50 dark:from-purple-950/40 dark:via-slate-900/90 dark:to-slate-900/60 shadow-2xs space-y-2"
      >
        {/* Sub-Contact Header */}
        <div className="flex items-center justify-between pb-1 border-b border-purple-100 dark:border-purple-900/40">
          <div className="flex items-center gap-1">
            <Layers className="h-3 w-3 text-purple-700 dark:text-purple-400" />
            <span className="font-sans text-[10.5px] font-black uppercase tracking-wider text-purple-950 dark:text-purple-200">
              SUB-CONTACT
            </span>
          </div>
          <span className="rounded-md bg-purple-100 dark:bg-purple-900/80 border border-purple-200 dark:border-purple-800 px-1.5 py-0.2 font-mono text-[9px] font-bold text-purple-900 dark:text-purple-200 shadow-2xs">
            {scPassRate.toFixed(1)}% Pass
          </span>
        </div>

        {/* Sub-Contact Metrics (Reject active; Hold & Jhute marked as N/A / not applicable) */}
        <div className="grid grid-cols-3 gap-1.5 items-center bg-white/95 dark:bg-slate-900/90 p-2 rounded-lg border border-purple-100 dark:border-purple-900/30">
          {/* Reject */}
          <div className="space-y-0.5 text-left">
            <div className="font-mono text-base sm:text-lg font-black tracking-tight text-red-600 dark:text-red-400 truncate" title={`${scReject.toLocaleString()} Kg Reject`}>
              {scReject.toLocaleString()}
            </div>
            <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-0.5 flex-wrap">
              <span>Reject</span>
              <span className="text-red-600 dark:text-red-400 font-mono font-black">({scRejectPct.toFixed(2)}%)</span>
            </div>
          </div>

          {/* Hold - N/A for Sub-Contact */}
          <div className="space-y-0.5 pl-1.5 border-l border-slate-200 dark:border-slate-700 text-left opacity-60">
            <div className="font-mono text-base sm:text-lg font-semibold tracking-tight text-slate-400 dark:text-slate-500 truncate" title="Hold is not tracked for Sub-Contact">
              —
            </div>
            <div className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-0.5 flex-wrap">
              <span>Hold</span>
              <span className="font-mono text-[8.5px]">(N/A)</span>
            </div>
          </div>

          {/* Jhute/Cut - N/A for Sub-Contact */}
          <div className="space-y-0.5 pl-1.5 border-l border-slate-200 dark:border-slate-700 text-left opacity-60">
            <div className="font-mono text-base sm:text-lg font-semibold tracking-tight text-slate-400 dark:text-slate-500 truncate" title="Jhute/Cut is not tracked for Sub-Contact">
              —
            </div>
            <div className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-0.5 flex-wrap">
              <span className="truncate">Jhute/Cut</span>
              <span className="font-mono text-[8.5px]">(N/A)</span>
            </div>
          </div>
        </div>

        {/* Sub-Contact Scrap & Progress Bar */}
        <div className="pt-0.5 space-y-1">
          <div className="flex items-center justify-between text-[9.5px] font-bold">
            <span className="text-slate-600 dark:text-slate-400">
              Reject Rate: <span className="font-mono text-red-600 dark:text-red-400 font-black">{scScrap.toFixed(2)}%</span>
            </span>
            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
              {scPassRate.toFixed(1)}% Pass
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-purple-100/90 dark:bg-slate-800 shadow-inner">
            <div
              className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500 shadow-xs"
              style={{ width: `${scPassRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
