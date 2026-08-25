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
      className={`rounded-2xl border border-indigo-200/90 dark:border-indigo-900/60 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between gap-3 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all ${className}`}
    >
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            <Cpu className="h-3.5 w-3.5" />
          </div>
          <span className="font-sans text-xs font-black uppercase tracking-wider text-slate-950 dark:text-white">
            MACHINE STATUS
          </span>
        </div>
        <span className="rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/80 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-900 dark:text-indigo-300 shadow-2xs">
          {inHouseUtilPct}% Util
        </span>
      </div>

      {/* 2. In-House Container */}
      <div 
        id="machine-status-in-house-container"
        className="rounded-xl border border-blue-200/90 bg-linear-to-b from-blue-50/70 via-blue-50/30 to-white dark:from-blue-950/40 dark:via-slate-900/90 dark:to-slate-900/60 p-2.5 dark:border-blue-900/50 shadow-2xs flex flex-col justify-between gap-2"
      >
        {/* In-House Title & Setting Capacity Badge */}
        <div className="flex items-center justify-between pb-1 border-b border-blue-100 dark:border-blue-900/40">
          <div className="flex items-center gap-1">
            <Factory className="h-3 w-3 text-blue-700 dark:text-blue-400" />
            <span className="font-sans text-[10.5px] font-black uppercase tracking-wider text-blue-950 dark:text-blue-200">
              IN-HOUSE
            </span>
          </div>
          <span className="rounded-md bg-blue-100 dark:bg-blue-900/80 border border-blue-200 dark:border-blue-800 px-1.5 py-0.2 font-mono text-[9px] font-bold text-blue-900 dark:text-blue-200 shadow-2xs">
            {runningMC} / {totalMC} MC
          </span>
        </div>

        {/* Primary Numbers Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              {runningMC}
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              Run
            </span>
            <span className="text-slate-300 dark:text-slate-600 text-xs">/</span>
            <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400" title="Total Setting Machines">
              {totalMC} Set
            </span>
          </div>

          {/* Idle % Badge */}
          <div 
            className="rounded-lg px-2 py-0.5 text-center font-mono shadow-2xs border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-300 min-w-[48px]"
            title="Idle Rate %"
          >
            <div className="text-[7.5px] font-sans font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none">
              IDLE
            </div>
            <div className="text-xs font-black leading-tight mt-0.5">{idlePct}%</div>
          </div>
        </div>

        {/* 3-Column Breakdown Chips */}
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-white/95 p-1 shadow-2xs dark:bg-slate-900/90 border border-blue-100 dark:border-blue-900/30">
          <div className="text-center px-0.5">
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block whitespace-nowrap">
              BULK
            </span>
            <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-100">
              {bulkMC}
            </span>
          </div>
          <div className="text-center px-0.5 border-x border-slate-100 dark:border-slate-800">
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block whitespace-nowrap">
              SAMPLE
            </span>
            <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-100">
              {sampleMC}
            </span>
          </div>
          <div className="text-center px-0.5">
            <span className="text-[8px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block whitespace-nowrap">
              IDLE MC
            </span>
            <span className="font-mono text-xs font-black text-amber-700 dark:text-amber-300">
              {idleMC}
            </span>
          </div>
        </div>

        {/* In-House Machine Utilization Bar */}
        <div className="pt-0.5 space-y-1">
          <div className="flex items-center justify-between text-[9.5px] font-bold">
            <span className="text-blue-950 dark:text-blue-200">
              In-House Util
            </span>
            <span className="font-mono font-black text-blue-700 dark:text-blue-400">
              {inHouseUtilPct}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-100/90 dark:bg-slate-800 shadow-inner">
            <div
              className="h-full rounded-full bg-linear-to-r from-blue-600 to-indigo-600 transition-all duration-500 shadow-xs"
              style={{ width: `${inHouseUtilPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Sub-Contact Container */}
      <div 
        id="machine-status-sub-contact-container"
        className="rounded-xl border border-purple-200/90 bg-linear-to-b from-purple-50/70 via-purple-50/30 to-white p-2.5 dark:border-purple-900/50 dark:from-purple-950/40 dark:via-slate-900/90 dark:to-slate-900/60 shadow-2xs space-y-2"
      >
        {/* Sub-Contact Title & External Badge */}
        <div className="flex items-center justify-between pb-1 border-b border-purple-100 dark:border-purple-900/40">
          <div className="flex items-center gap-1">
            <Layers className="h-3 w-3 text-purple-700 dark:text-purple-400" />
            <span className="font-sans text-[10.5px] font-black uppercase tracking-wider text-purple-950 dark:text-purple-200">
              SUB-CONTACT
            </span>
          </div>
          <span className="rounded-md bg-purple-100 dark:bg-purple-900/80 border border-purple-200 dark:border-purple-800 px-1.5 py-0.2 font-mono text-[8.5px] font-bold text-purple-900 dark:text-purple-200 shadow-2xs">
            External
          </span>
        </div>

        {/* Sub-Contact Metrics Row (3 compact columns) */}
        <div className="grid grid-cols-3 gap-1 text-center">
          {/* 1. MC Run */}
          <div className="rounded-lg bg-white/95 p-1 shadow-2xs dark:bg-slate-900/90 border border-purple-100 dark:border-purple-900/30">
            <span className="text-[8px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block whitespace-nowrap">
              MC RUN
            </span>
            <span className="font-mono text-xs font-black text-slate-950 dark:text-white mt-0.5 block">
              {scMCRun}
            </span>
          </div>

          {/* 2. Active Factories */}
          <div className="rounded-lg bg-white/95 p-1 shadow-2xs dark:bg-slate-900/90 border border-purple-100 dark:border-purple-900/30">
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block whitespace-nowrap">
              FACTORY
            </span>
            <span className="font-mono text-xs font-black text-slate-950 dark:text-white mt-0.5 block">
              {scFactories}
            </span>
          </div>

          {/* 3. Vehicles */}
          <div className="rounded-lg bg-white/95 p-1 shadow-2xs dark:bg-slate-900/90 border border-purple-100 dark:border-purple-900/30">
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block whitespace-nowrap">
              VEHICLE
            </span>
            <span className="font-mono text-xs font-black text-slate-950 dark:text-white mt-0.5 block">
              {scVehicles}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
