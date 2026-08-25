/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Users, UserX, UserCheck, Activity } from 'lucide-react';

export interface AttendanceCardProps {
  totalStaff: number;
  totalAbsent: number;
  absentPct: number;
  presentStaff?: number;
  presentPct?: number;
  periodLabel?: string;
  className?: string;
}

export default function AttendanceCard({
  totalStaff,
  totalAbsent,
  absentPct,
  presentStaff,
  presentPct,
  periodLabel,
  className = '',
}: AttendanceCardProps) {
  const staffCount = Math.round(totalStaff || 36817);
  const absentCount = Math.round(totalAbsent || 837);
  const calculatedAbsentPct = staffCount > 0 
    ? parseFloat(((absentCount / staffCount) * 100).toFixed(1)) 
    : (typeof absentPct === 'number' ? parseFloat(absentPct.toFixed(1)) : 2.3);

  const calculatedPresent = presentStaff !== undefined ? Math.round(presentStaff) : Math.max(0, staffCount - absentCount);
  const calculatedPresentPct = presentPct !== undefined 
    ? parseFloat(presentPct.toFixed(1)) 
    : Math.max(0, parseFloat((100 - calculatedAbsentPct).toFixed(1)));

  return (
    <div
      id="kpi-attendance-card"
      className={`rounded-2xl border border-amber-200/90 dark:border-amber-900/60 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between gap-3 hover:border-amber-300 dark:hover:border-amber-800 transition-all ${className}`}
    >
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Users className="h-3.5 w-3.5" />
          </div>
          <span className="font-sans text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
            ATTENDANCE
          </span>
        </div>
        
        {/* Orange Users Badge */}
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/80 shadow-2xs">
          <Users className="h-4 w-4" />
        </div>
      </div>

      {/* 2. Primary Big Metric */}
      <div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white">
            {staffCount.toLocaleString()}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
            Total Staff
          </span>
        </div>

        {/* Absent Status Row */}
        <div className="mt-2 flex items-center justify-between">
          <span className="font-sans text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
            <UserX className="h-3.5 w-3.5 shrink-0" />
            <span>{absentCount.toLocaleString()} Absent</span>
          </span>

          <span className="rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 px-2 py-0.5 font-mono text-[10.5px] font-bold text-red-700 dark:text-red-300 shadow-2xs">
            {calculatedAbsentPct}% Absent
          </span>
        </div>
      </div>

      {/* 3. Present Staff Breakdown */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 p-2 border border-slate-100 dark:border-slate-800 text-center">
        <div>
          <div className="text-[8.5px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            PRESENT ON SHIFT
          </div>
          <div className="font-mono text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
            {calculatedPresent.toLocaleString()}
          </div>
        </div>
        <div className="border-l border-slate-200/60 dark:border-slate-700/60">
          <div className="text-[8.5px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            TURNOUT RATE
          </div>
          <div className="font-mono text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {calculatedPresentPct}%
          </div>
        </div>
      </div>

      {/* 4. Attendance / Present Turnout Progress Bar */}
      <div className="pt-0.5 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span className="text-slate-800 dark:text-slate-200">
            Present Workforce
          </span>
          <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
            {calculatedPresentPct}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner">
          <div
            className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500 shadow-xs"
            style={{ width: `${calculatedPresentPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
