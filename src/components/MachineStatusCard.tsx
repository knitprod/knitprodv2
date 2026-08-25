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
  const totalMC = Math.round(inHouseTotalMachines || 0);
  const runningMC = Math.round(inHouseRunningMachines || 0);
  const bulkMC = Math.round(inHouseBulkRunning || 0);
  const sampleMC = Math.round(inHouseSampleRunning || 0);
  
  // Idle %: ((Total Running Machine - Total Machine) / Total Machine) * 100
  const idlePct = Math.round(inHouseIdleMachinePct || 0);
  const idleMC = inHouseIdleCount !== undefined 
    ? Math.max(0, Math.round(inHouseIdleCount))
    : Math.max(0, totalMC - runningMC);

  // In-House Utilization % (strictly for In-House only)
  const inHouseUtilPct = totalMC > 0 
    ? Math.min(100, Math.max(0, Math.round((runningMC / totalMC) * 100))) 
    : 0;

  // Sub-Contact integer values
  const scFactories = Math.round(subContactActiveFactories || 0);
  const scMCRun = Math.round(subContactTotalMachineRun || 0);
  const scVehicles = Math.round(subContactActiveVehicles || 0);

  return (
    <div
      id="kpi-machine-status-card"
      className={`rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs overflow-hidden flex flex-col justify-between transition-all duration-200 hover:shadow-md ${className}`}
    >
      {/* 1. Header Bar: Matching Total Target & Total Production Header style */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/50 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-indigo-700 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 shadow-2xs">
            <Cpu className="h-3.5 w-3.5" />
          </div>
          <span className="font-sans text-xs font-black text-gray-900 dark:text-white tracking-tight">
            MACHINE STATUS
          </span>
        </div>
        {periodLabel && (
          <span className="rounded-md bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-2 py-0.5 font-mono text-[10px] font-bold text-gray-700 dark:text-slate-300 shadow-2xs">
            {periodLabel}
          </span>
        )}
      </div>

      {/* 2. Main Content Body: In-House on Top (Filled Area) & Sub-Contact at Bottom */}
      <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between gap-3">
        
        {/* ======================================================================= */}
        {/* UPPER SECTION: IN-HOUSE DATA (Fills the upper primary marked area)      */}
        {/* ======================================================================= */}
        <div 
          id="machine-status-in-house-container"
          className="rounded-xl border border-blue-200/90 bg-linear-to-b from-blue-50/60 to-blue-50/20 p-3 dark:border-blue-900/50 dark:from-blue-950/30 dark:to-blue-950/10 flex-1 flex flex-col justify-between"
        >
          {/* In-House Title & Setting Capacity Badge */}
          <div className="flex items-center justify-between pb-1.5 border-b border-blue-100 dark:border-blue-900/40">
            <div className="flex items-center gap-1.5">
              <Factory className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
              <span className="font-sans text-[11px] font-black uppercase tracking-wider text-blue-900 dark:text-blue-300">
                In-House Machines
              </span>
            </div>
            <span className="rounded-md bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-black text-blue-800 dark:bg-blue-900 dark:text-blue-200 shadow-2xs">
              Setting: {totalMC} MC
            </span>
          </div>

          {/* Primary Big Numbers Row */}
          <div className="my-2 flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-gray-950 dark:text-white">
                {runningMC}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                Run
              </span>
              <span className="text-gray-300 dark:text-slate-600 text-sm font-light">/</span>
              <span className="font-mono text-sm font-semibold text-gray-500 dark:text-slate-400" title="Total Setting Machines">
                {totalMC} Total
              </span>
            </div>

            {/* Idle % Badge */}
            <div 
              className={`rounded-lg px-2.5 py-1 text-center font-mono text-xs font-black shadow-2xs border ${
                idlePct < 0 
                  ? 'border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                  : 'border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
              }`}
              title="Idle % = ((Total Running - Total Machine) / Total Machine) * 100"
            >
              <div className="text-[8px] font-sans font-bold uppercase tracking-wider text-gray-600 dark:text-slate-400">
                Idle Rate
              </div>
              <div>{idlePct > 0 ? `+${idlePct}%` : `${idlePct}%`}</div>
            </div>
          </div>

          {/* 3-Column Breakdown Chips */}
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-white/90 p-2 shadow-2xs dark:bg-slate-900/80 border border-blue-100/80 dark:border-blue-900/30">
            <div className="text-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 block">
                Bulk Run
              </span>
              <span className="font-mono text-sm font-black text-gray-900 dark:text-slate-100">
                {bulkMC}
              </span>
            </div>
            <div className="text-center border-x border-gray-100 dark:border-slate-800">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 block">
                Sample Run
              </span>
              <span className="font-mono text-sm font-black text-gray-900 dark:text-slate-100">
                {sampleMC}
              </span>
            </div>
            <div className="text-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                Idle MC
              </span>
              <span className="font-mono text-sm font-black text-amber-700 dark:text-amber-300">
                {idleMC}
              </span>
            </div>
          </div>

          {/* In-House Machine Utilization Bar (Dedicated exclusively to In-House) */}
          <div className="mt-2.5 pt-1.5 border-t border-blue-100/70 dark:border-blue-900/30">
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold">
              <span className="text-blue-900 dark:text-blue-200">
                In-House Machine Utilization
              </span>
              <span className="font-mono font-black text-blue-700 dark:text-blue-400">
                {inHouseUtilPct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100/90 dark:bg-slate-800 shadow-inner">
              <div
                className="h-full rounded-full bg-linear-to-r from-blue-600 to-indigo-600 transition-all duration-500 shadow-xs"
                style={{ width: `${inHouseUtilPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* LOWER SECTION: SUB-CONTACT DATA (Fills the remaining space cleanly)     */}
        {/* ======================================================================= */}
        <div 
          id="machine-status-sub-contact-container"
          className="rounded-xl border border-purple-200/90 bg-linear-to-b from-purple-50/60 to-purple-50/20 p-2.5 dark:border-purple-900/50 dark:from-purple-950/30 dark:to-purple-950/10"
        >
          {/* Sub-Contact Title & External Badge */}
          <div className="flex items-center justify-between pb-1.5 border-b border-purple-100 dark:border-purple-900/40">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-purple-700 dark:text-purple-400" />
              <span className="font-sans text-[11px] font-black uppercase tracking-wider text-purple-900 dark:text-purple-300">
                Sub-Contact
              </span>
            </div>
            <span className="rounded-md bg-purple-100 px-2 py-0.5 font-mono text-[9px] font-bold text-purple-800 dark:bg-purple-900 dark:text-purple-200 shadow-2xs">
              External Units
            </span>
          </div>

          {/* Sub-Contact Metrics Row (3 compact balanced columns) */}
          <div className="mt-2 grid grid-cols-3 gap-2">
            {/* 1. MC Run */}
            <div className="rounded-lg bg-white/90 p-1.5 text-center shadow-2xs dark:bg-slate-900/80 border border-purple-100/80 dark:border-purple-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
                MC Run
              </span>
              <span className="font-mono text-sm font-black text-gray-950 dark:text-white">
                {scMCRun}
              </span>
            </div>

            {/* 2. Active Factories */}
            <div className="rounded-lg bg-white/90 p-1.5 text-center shadow-2xs dark:bg-slate-900/80 border border-purple-100/80 dark:border-purple-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 block">
                Factories
              </span>
              <span className="font-mono text-sm font-black text-gray-950 dark:text-white">
                {scFactories}
              </span>
            </div>

            {/* 3. Vehicles */}
            <div className="rounded-lg bg-white/90 p-1.5 text-center shadow-2xs dark:bg-slate-900/80 border border-purple-100/80 dark:border-purple-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 block">
                Vehicles
              </span>
              <span className="font-mono text-sm font-black text-gray-950 dark:text-white">
                {scVehicles}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
