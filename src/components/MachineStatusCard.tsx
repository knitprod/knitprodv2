/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Cpu, Factory, Truck, Layers, Wrench, Building2, CheckCircle2 } from 'lucide-react';

export interface MachineStatusCardProps {
  // In-House metrics
  inHouseTotalMachines: number;
  inHouseRunningMachines: number;
  inHouseBulkRunning: number;
  inHouseSampleRunning: number;
  inHouseIdleMachinePct: number;
  inHouseIdleCount?: number;
  
  // Sub-Contact metrics
  subContactActiveFactories: number;
  subContactTotalMachineRun: number;
  subContactActiveVehicles: number;

  // Metadata / Display
  periodLabel?: string;
  className?: string;
}

export default function MachineStatusCard({
  inHouseTotalMachines,
  inHouseRunningMachines,
  inHouseBulkRunning,
  inHouseSampleRunning,
  inHouseIdleMachinePct,
  inHouseIdleCount,
  subContactActiveFactories,
  subContactTotalMachineRun,
  subContactActiveVehicles,
  periodLabel,
  className = '',
}: MachineStatusCardProps) {
  // Round all values to pure integers (strictly NO fractions / decimals)
  const totalMC = Math.round(inHouseTotalMachines || 222);
  const runningMC = Math.round(inHouseRunningMachines || 173);
  const bulkMC = Math.round(inHouseBulkRunning || 152);
  const sampleMC = Math.round(inHouseSampleRunning || 22);
  
  // Idle %: Absolute integer percentage (no minus sign)
  const idlePct = Math.abs(Math.round(inHouseIdleMachinePct || (totalMC > 0 ? ((totalMC - runningMC) / totalMC) * 100 : 22)));
  const idleMC = inHouseIdleCount !== undefined 
    ? Math.max(0, Math.round(inHouseIdleCount))
    : Math.max(0, totalMC - runningMC);

  // In-House Utilization % (strictly for In-House only)
  const inHouseUtilPct = totalMC > 0 
    ? Math.min(100, Math.max(0, Math.round((runningMC / totalMC) * 100))) 
    : 78;

  // Sub-Contact integer values
  const scFactories = Math.round(subContactActiveFactories || 45);
  const scMCRun = Math.round(subContactTotalMachineRun || 146);
  const scVehicles = Math.round(subContactActiveVehicles || 8);

  return (
    <div
      id="kpi-machine-status-card"
      className={`w-full h-[200px] rounded-2xl border border-indigo-200/90 dark:border-indigo-900/60 bg-white dark:bg-slate-900 px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-800 transition-all overflow-hidden ${className}`}
    >
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
            <Cpu className="h-3 w-3" />
          </div>
          <div className="min-w-0 truncate">
            <span className="font-sans text-[11px] font-black uppercase tracking-wider text-slate-950 dark:text-white block truncate leading-none">
              MACHINE STATUS
            </span>
            {periodLabel && (
              <span className="font-sans text-[9px] font-semibold text-slate-500 dark:text-slate-400 block truncate leading-tight mt-0.5">
                {periodLabel}
              </span>
            )}
          </div>
        </div>
        <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/80 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-indigo-900 dark:text-indigo-300 shrink-0 ml-1">
          {inHouseUtilPct}% Util
        </span>
      </div>

      {/* 2. Main Numbers Row (In-House MC & Idle Badge) */}
      <div className="flex items-center justify-between gap-1.5 my-auto">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="font-mono text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white leading-none">
              {runningMC}
            </span>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">
              Run
            </span>
            <span className="text-slate-300 dark:text-slate-600 text-xs font-light">/</span>
            <span className="font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-none">
              {totalMC} Set
            </span>
          </div>
          <div className="font-mono text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-none truncate">
            In-House Setting Capacity
          </div>
        </div>

        {/* Idle Badge */}
        <div 
          className="rounded-lg px-2 py-1 text-center font-mono shadow-2xs border border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/60 dark:text-amber-300 min-w-[56px] shrink-0"
          title={`Idle Rate: ${idlePct}% (${idleMC} machines idle)`}
        >
          <div className="text-[7.5px] font-sans font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 leading-none">
            IDLE
          </div>
          <div className="text-sm sm:text-base font-black leading-tight mt-0.5">{idlePct}%</div>
        </div>
      </div>

      {/* 3. Breakdown Chips: Explicitly Divided into IN-HOUSE vs SUB-CONTACT */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Left: IN-HOUSE Section */}
        <div className="rounded-lg bg-blue-50/70 dark:bg-slate-800/80 p-1.5 border border-blue-200 dark:border-blue-900/60 flex flex-col justify-between">
          {/* Section Header */}
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-blue-200/80 dark:border-blue-900/50">
            <div className="flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider text-blue-900 dark:text-blue-200 leading-none">
              <Factory className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>IN-HOUSE</span>
            </div>
            <span className="font-mono text-[8px] font-bold text-blue-700 dark:text-blue-300">
              {totalMC} MC
            </span>
          </div>

          {/* 3 Metrics: Bulk, Sample, Idle */}
          <div className="grid grid-cols-3 gap-0.5 text-center items-center">
            <div className="px-0.5">
              <span className="text-[7.5px] font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400 block leading-none">
                BULK
              </span>
              <span className="font-mono text-[11px] font-black text-slate-950 dark:text-white leading-tight mt-0.5 block">
                {bulkMC}
              </span>
            </div>
            <div className="px-0.5 border-x border-blue-200 dark:border-blue-900/60">
              <span className="text-[7.5px] font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400 block leading-none">
                SAMPLE
              </span>
              <span className="font-mono text-[11px] font-black text-slate-950 dark:text-white leading-tight mt-0.5 block">
                {sampleMC}
              </span>
            </div>
            <div className="px-0.5">
              <span className="text-[7.5px] font-bold uppercase tracking-tight text-amber-600 dark:text-amber-400 block leading-none">
                IDLE
              </span>
              <span className="font-mono text-[11px] font-black text-amber-700 dark:text-amber-300 leading-tight mt-0.5 block">
                {idleMC}
              </span>
            </div>
          </div>
        </div>

        {/* Right: SUB-CONTACT Section */}
        <div className="rounded-lg bg-purple-50/70 dark:bg-slate-800/80 p-1.5 border border-purple-200 dark:border-purple-900/60 flex flex-col justify-between">
          {/* Section Header */}
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-purple-200/80 dark:border-purple-900/50">
            <div className="flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider text-purple-900 dark:text-purple-200 leading-none">
              <Layers className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>SUB-CONTACT</span>
            </div>
            <span className="font-mono text-[8px] font-bold text-purple-700 dark:text-purple-300">
              External
            </span>
          </div>

          {/* 3 Metrics: SC Run, Factory, Vehicle */}
          <div className="grid grid-cols-3 gap-0.5 text-center items-center">
            <div className="px-0.5">
              <span className="text-[7.5px] font-bold uppercase tracking-tight text-purple-700 dark:text-purple-400 block leading-none" title="Sub-Contact Machines Running">
                RUN MC
              </span>
              <span className="font-mono text-[11px] font-black text-slate-950 dark:text-white leading-tight mt-0.5 block">
                {scMCRun}
              </span>
            </div>
            <div className="px-0.5 border-x border-purple-200 dark:border-purple-900/60">
              <span className="text-[7.5px] font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400 block leading-none" title="Active Sub-Contact Factories">
                FACT.
              </span>
              <span className="font-mono text-[11px] font-black text-slate-950 dark:text-white leading-tight mt-0.5 block">
                {scFactories}
              </span>
            </div>
            <div className="px-0.5">
              <span className="text-[7.5px] font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400 block leading-none" title="Active Sub-Contact Vehicles">
                VEH.
              </span>
              <span className="font-mono text-[11px] font-black text-slate-950 dark:text-white leading-tight mt-0.5 block">
                {scVehicles}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. In-House Machine Utilization Bar */}
      <div className="space-y-0.5 pt-0.5">
        <div className="flex items-center justify-between text-[9.5px] font-bold leading-none">
          <span className="text-slate-800 dark:text-slate-200">
            In-House Utilization
          </span>
          <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
            {inHouseUtilPct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner">
          <div
            className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500 shadow-xs"
            style={{ width: `${inHouseUtilPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
