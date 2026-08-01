/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, CalendarRange, Layers, Activity } from 'lucide-react';
import { FactoryFloor } from '../types';

interface WelcomeBannerProps {
  floors: FactoryFloor[];
  onNavigate: (page: string) => void;
}

export default function WelcomeBanner({ floors, onNavigate }: WelcomeBannerProps) {
  // Compute basic aggregates for today
  const activeShift = 'Shift C'; // Standard local time is 21:30, which corresponds to Shift B or Shift C
  const totalTarget = floors.reduce((sum, f) => sum + f.targetKg, 0);
  const totalProduction = floors.reduce((sum, f) => sum + f.productionKg, 0);
  const totalPercentage = Math.round((totalProduction / totalTarget) * 100);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-linear-to-r from-blue-900 to-slate-900 p-6 text-white shadow-lg">
      {/* Absolute background visual decoration */}
      <div className="absolute right-0 top-0 h-full w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
        {/* Banner Left Details */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-2.5 py-1 text-xs font-semibold text-blue-300">
            <Sparkles className="h-3 w-3" />
            <span>Knitting Plant Live System</span>
          </div>
          <h1 className="font-sans text-2xl font-black tracking-tight sm:text-3xl">
            Welcome Back, <span className="text-blue-400">Production Control</span>
          </h1>
          <p className="max-w-xl text-xs font-medium text-slate-300 sm:text-sm">
            Epyllion Knitex Ltd. is operating at <strong className="text-white">{totalPercentage}%</strong> of the daily combined production target across all floors. Shift C operations are currently active.
          </p>
        </div>

        {/* Banner Right Stats Column */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:w-80 shrink-0">
          <div className="rounded-xl bg-white/5 p-3 backdrop-blur-xs">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Shift
            </span>
            <span className="mt-1 block font-mono text-sm font-black text-blue-400">
              {activeShift}
            </span>
            <span className="text-[9px] font-medium text-slate-400">22:00 - 06:00 UTC</span>
          </div>

          <div className="rounded-xl bg-white/5 p-3 backdrop-blur-xs">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Production
            </span>
            <span className="mt-1 block font-mono text-sm font-black text-emerald-400">
              {totalProduction.toLocaleString()} Kg
            </span>
            <span className="text-[9px] font-medium text-slate-400">of {totalTarget.toLocaleString()} Kg plan</span>
          </div>
        </div>
      </div>

      {/* Quick stats bottom bar */}
      <div className="mt-5 flex flex-wrap gap-4 border-t border-white/10 pt-4 text-xs font-semibold text-slate-300">
        <div className="flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-emerald-500" />
          <span>System Status: <strong className="text-emerald-400">Online & Syncing</strong></span>
        </div>
        <span className="text-white/25 hidden sm:inline">•</span>
        <div className="flex items-center gap-1.5">
          <CalendarRange className="h-4 w-4 text-blue-400" />
          <span>Active Contracts: <strong className="text-white">8 Orders</strong></span>
        </div>
        <span className="text-white/25 hidden sm:inline">•</span>
        <button 
          onClick={() => onNavigate('Production Entry')}
          className="ml-auto text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1 text-[11px]"
          id="welcome-quick-entry-link"
        >
          Add New Production Roll →
        </button>
      </div>
    </div>
  );
}
