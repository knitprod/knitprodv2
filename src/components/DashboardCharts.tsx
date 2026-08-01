/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  TrendingUp, 
  Percent, 
  Cpu, 
  Trash2, 
  Clock, 
  Info,
  AlertTriangle,
  UserCheck,
  Wrench,
  Droplet,
  Shuffle,
  ShieldAlert,
  Sliders,
  Sparkles
} from 'lucide-react';

interface DashboardChartsProps {
  filterUnit: string;
  filterDateMode: 'single' | 'range' | 'month' | 'year';
  filterSingleDate: string;
  filterDateFrom: string;
  filterDateTo: string;
  filterMonth: string;
  filterYear: string;
  isLoading?: boolean;
}

export default function DashboardCharts({
  filterUnit,
  filterDateMode,
  filterSingleDate,
  filterDateFrom,
  filterDateTo,
  filterMonth,
  filterYear,
  isLoading = false
}: DashboardChartsProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'core' | 'operations' | 'consumables'>('all');
  const [hoveredIndex, setHoveredIndex] = useState<{chart: string, index: number} | null>(null);

  // Simple deterministic randomizer based on unit name and date to seed realistic datasets
  const getSeededValue = (seedStr: string, multiplier: number, offset: number) => {
    let hash = 0;
    const combined = `${seedStr}_${filterUnit}_${filterDateMode}`;
    for (let i = 0; i < combined.length; i++) {
      hash = combined.charCodeAt(i) + ((hash << 5) - hash);
    }
    const val = Math.abs(Math.sin(hash) * multiplier) + offset;
    return Math.round(val * 10) / 10;
  };

  const getSeededDataArray = (seedName: string, length: number, mult: number, off: number, pct = false) => {
    const arr = [];
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i < length; i++) {
      const v1 = getSeededValue(`${seedName}_v1_${i}`, mult, off);
      const v2 = getSeededValue(`${seedName}_v2_${i}`, mult * 0.95, off * 0.98);
      const v3 = getSeededValue(`${seedName}_v3_${i}`, mult * 0.08, off * 0.02);
      arr.push({
        label: labels[i % labels.length],
        value1: pct ? Math.min(Math.round(v1), 100) : Math.round(v1),
        value2: pct ? Math.min(Math.round(v2), 100) : Math.round(v2),
        value3: Math.round(v3)
      });
    }
    return arr;
  };

  // Generate dynamic, unit-specific data points
  const productionData = getSeededDataArray('production', 7, 20000, 10000); // Target vs Actual
  const qualityData = getSeededDataArray('quality', 5, 80, 20); // Reject vs Hold
  const efficiencyData = getSeededDataArray('efficiency', 7, 15, 80, true); // Efficiency Trend
  const capacityData = getSeededDataArray('capacity', 6, 20, 75, true); // Capacity Utilization
  const absenteeismData = getSeededDataArray('absenteeism', 5, 4, 1.5); // Absenteeism Rate
  const needleData = getSeededDataArray('needle', 7, 40, 150); // Needle wear count
  const sinkerData = getSeededDataArray('sinker', 7, 30, 100); // Sinker replacements
  const oilData = getSeededDataArray('oil', 7, 25, 120); // Oil liters
  const setChangeData = getSeededDataArray('setchange', 5, 15, 45); // Set Changeover speed minutes

  // Total sums for comparison headers
  const totalTarget = productionData.reduce((sum, d) => sum + d.value1, 0);
  const totalActual = productionData.reduce((sum, d) => sum + d.value2, 0);
  const overallAchievement = Math.round((totalActual / totalTarget) * 100);

  // Shimmer Loader Skeleton Component
  const SkeletonCard = () => (
    <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gray-100 dark:bg-slate-800" />
          <div className="space-y-1.5">
            <div className="h-4 w-36 rounded-md bg-gray-100 dark:bg-slate-800" />
            <div className="h-2.5 w-24 rounded-md bg-gray-50 dark:bg-slate-800/50" />
          </div>
        </div>
        <div className="h-5 w-16 rounded-md bg-gray-100 dark:bg-slate-800" />
      </div>
      <div className="h-32 w-full rounded-xl bg-gray-50/50 dark:bg-slate-800/30 flex items-end p-2 gap-2">
        <div className="h-12 flex-1 rounded-sm bg-gray-100 dark:bg-slate-800" />
        <div className="h-24 flex-1 rounded-sm bg-gray-100 dark:bg-slate-800" />
        <div className="h-16 flex-1 rounded-sm bg-gray-100 dark:bg-slate-800" />
        <div className="h-20 flex-1 rounded-sm bg-gray-100 dark:bg-slate-800" />
        <div className="h-28 flex-1 rounded-sm bg-gray-100 dark:bg-slate-800" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6" id="dashboard-charts-panel">
      {/* 1. Category tabs selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-3">
        <div>
          <h2 className="font-sans text-base font-extrabold tracking-tight text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
            <Sparkles className="h-4.5 w-4.5 text-[#0F4C81] dark:text-blue-400" />
            <span>Knitting Operations Analytics</span>
          </h2>
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
            Deep performance analytics spanning 9 core metrics
          </p>
        </div>

        <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-slate-800 p-1 self-start sm:self-auto overflow-x-auto w-full sm:w-auto scrollbar-none">
          {([
            { id: 'all', label: 'All Charts' },
            { id: 'core', label: 'Core Yield' },
            { id: 'operations', label: 'Operations' },
            { id: 'consumables', label: 'Consumables' }
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id 
                  ? 'bg-white dark:bg-slate-700 text-[#0F4C81] dark:text-white shadow-xs' 
                  : 'text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
              id={`analytics-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        // Loading State: Skeletons Grid
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        // Active Charts Grid
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          
          {/* ==========================================================
              CATEGORY 1: CORE YIELD & QUALITY
             ========================================================== */}

          {/* CHART 1: Target vs Production */}
          {(activeTab === 'all' || activeTab === 'core') && (
            <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-gray-200 transition-all" id="chart-target-vs-prod">
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#0F4C81] dark:text-blue-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-sans text-xs font-black text-gray-900 dark:text-slate-100">Target vs Production</h3>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Knitted Yield trend (Kg)</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-extrabold text-blue-700 dark:text-blue-400">
                  {overallAchievement}% Ach.
                </span>
              </div>

              {/* Dynamic Trend Curves */}
              <div className="mt-4 relative">
                <div className="flex items-end justify-between h-32 gap-1.5 pt-2">
                  {productionData.map((d, i) => {
                    const maxVal = Math.max(...productionData.map(x => Math.max(x.value1, x.value2)));
                    const h1 = `${(d.value1 / maxVal) * 100}%`;
                    const h2 = `${(d.value2 / maxVal) * 100}%`;
                    return (
                      <div 
                        key={i} 
                        className="flex flex-col items-center gap-1.5 flex-1 relative group"
                        onMouseEnter={() => setHoveredIndex({ chart: 'prod', index: i })}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        {/* Interactive Tooltip */}
                        {hoveredIndex?.chart === 'prod' && hoveredIndex.index === i && (
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-1.5 rounded-lg text-[9px] font-bold z-10 shadow-lg whitespace-nowrap">
                            Target: {d.value1.toLocaleString()} Kg<br />
                            Actual: {d.value2.toLocaleString()} Kg
                          </div>
                        )}
                        <div className="w-full flex items-end justify-center h-24 gap-1">
                          {/* Target Column */}
                          <div className="w-2.5 rounded-t-sm bg-slate-200 dark:bg-slate-800" style={{ height: h1 }} />
                          {/* Actual Column */}
                          <div className="w-2.5 rounded-t-sm bg-blue-600 dark:bg-blue-500" style={{ height: h2 }} />
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-center gap-3 mt-3 text-[9px] font-bold text-gray-400">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 bg-slate-200 dark:bg-slate-800 rounded-xs" /> Target</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 bg-blue-600 dark:bg-blue-500 rounded-xs" /> Actual Yield</span>
                </div>
              </div>
            </div>
          )}

          {/* CHART 2: Reject vs Hold */}
          {(activeTab === 'all' || activeTab === 'core') && (
            <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-gray-200 transition-all" id="chart-reject-vs-hold">
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-sans text-xs font-black text-gray-900 dark:text-slate-100">Reject vs Hold</h3>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Defective Scrap vs Hold Quantity (Kg)</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-extrabold text-red-600 dark:text-red-400">
                  Warning status
                </span>
              </div>

              {/* Dynamic Reject vs Hold Stacked Column Chart */}
              <div className="mt-4 relative">
                <div className="flex items-end justify-between h-32 gap-1.5 pt-2">
                  {qualityData.map((d, i) => {
                    const totalVal = d.value1 + d.value2;
                    const maxVal = Math.max(...qualityData.map(x => x.value1 + x.value2)) || 100;
                    const h1 = `${(d.value1 / maxVal) * 100}%`; // Reject
                    const h2 = `${(d.value2 / maxVal) * 100}%`; // Hold
                    return (
                      <div 
                        key={i} 
                        className="flex flex-col items-center gap-1.5 flex-1 relative group"
                        onMouseEnter={() => setHoveredIndex({ chart: 'quality', index: i })}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        {hoveredIndex?.chart === 'quality' && hoveredIndex.index === i && (
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-1.5 rounded-lg text-[9px] font-bold z-10 shadow-lg whitespace-nowrap">
                            Reject: {d.value1} Kg<br />
                            Hold: {d.value2} Kg
                          </div>
                        )}
                        <div className="w-full flex flex-col justify-end h-24">
                          <div className="w-5 mx-auto rounded-t-sm overflow-hidden flex flex-col justify-end" style={{ height: `${(totalVal / maxVal) * 100}%` }}>
                            <div className="bg-amber-400 dark:bg-amber-500 flex-1" style={{ height: h2 }} />
                            <div className="bg-red-500 dark:bg-red-600 flex-1" style={{ height: h1 }} />
                          </div>
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500">Day {i+1}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-center gap-3 mt-3 text-[9px] font-bold text-gray-400">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 bg-red-500 rounded-xs" /> Reject Scrap</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 bg-amber-400 rounded-xs" /> QA Hold</span>
                </div>
              </div>
            </div>
          )}

          {/* CHART 3: Efficiency */}
          {(activeTab === 'all' || activeTab === 'core') && (
            <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-gray-200 transition-all" id="chart-efficiency-curve">
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                    <Percent className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-sans text-xs font-black text-gray-900 dark:text-slate-100">Efficiency Ratio</h3>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Cylinder run efficiency (%)</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                  Target: 95%
                </span>
              </div>

              {/* Dynamic Area Trend Curve */}
              <div className="mt-4 relative">
                <div className="flex items-end justify-between h-32 gap-1.5 pt-2">
                  {efficiencyData.map((d, i) => {
                    const h1 = `${d.value1}%`;
                    return (
                      <div 
                        key={i} 
                        className="flex flex-col items-center gap-1.5 flex-1 relative group"
                        onMouseEnter={() => setHoveredIndex({ chart: 'eff', index: i })}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        {hoveredIndex?.chart === 'eff' && hoveredIndex.index === i && (
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-1.5 py-1 rounded text-[9px] font-bold z-10 shadow-lg whitespace-nowrap">
                            {d.value1}% Efficiency
                          </div>
                        )}
                        <div className="w-full flex items-end justify-center h-24">
                          <div 
                            className="w-4 rounded-t-md bg-emerald-500 dark:bg-emerald-600 group-hover:bg-emerald-600 transition-all" 
                            style={{ height: h1 }} 
                          />
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-[10px] text-gray-500 text-center font-bold">
                  Weekly Run-efficiency Weighted Average
                </div>
              </div>
            </div>
          )}

          {/* ==========================================================
              CATEGORY 2: OPERATIONS & ATTENDANCE
             ========================================================== */}

          {/* CHART 4: Capacity Utilization */}
          {(activeTab === 'all' || activeTab === 'operations') && (
            <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-gray-200 transition-all" id="chart-capacity-utilization">
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0F4C81]/10 text-[#0F4C81] dark:text-blue-400">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-sans text-xs font-black text-gray-900 dark:text-slate-100">Capacity Utilization</h3>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Circular loom frame loading</p>
                  </div>
                </div>
              </div>

              {/* Dynamic Capacity bars */}
              <div className="mt-4 space-y-3.5 pt-2">
                {capacityData.slice(0, 4).map((f, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-gray-700 dark:text-slate-300">Loom Area {i + 1}</span>
                      <span className="font-mono text-slate-500">{f.value1}% Loaded</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                      <div 
                        className="h-full bg-blue-700 dark:bg-blue-500 rounded-full" 
                        style={{ width: `${f.value1}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CHART 5: Absentism */}
          {(activeTab === 'all' || activeTab === 'operations') && (
            <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-gray-200 transition-all" id="chart-absenteeism">
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-sans text-xs font-black text-gray-900 dark:text-slate-100">Operator Absenteeism</h3>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Operator absence rate (%)</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 relative">
                <div className="flex items-end justify-between h-32 gap-2 pt-2">
                  {absenteeismData.map((d, i) => {
                    const h1 = `${(d.value1 / 8) * 100}%`;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                        <div className="w-full flex justify-center items-end h-24">
                          <div 
                            className="w-5 rounded-t-md bg-amber-500 hover:bg-amber-600 transition-all" 
                            style={{ height: h1 }} 
                            title={`Absenteeism: ${d.value1}%`}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500">Floor {i+1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* CHART 6: Set Change */}
          {(activeTab === 'all' || activeTab === 'operations') && (
            <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-gray-200 transition-all" id="chart-set-change">
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                    <Shuffle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-sans text-xs font-black text-gray-900 dark:text-slate-100">Set Changeover Speed</h3>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Cylinder set-up change minutes</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 relative">
                <div className="flex items-end justify-between h-32 gap-2 pt-2">
                  {setChangeData.map((d, i) => {
                    const h1 = `${(d.value1 / 90) * 100}%`;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                        <div className="w-full flex justify-center items-end h-24">
                          <div 
                            className="w-4 rounded-t-md bg-purple-500 hover:bg-purple-600 transition-all" 
                            style={{ height: h1 }} 
                            title={`Change speed: ${d.value1} mins`}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500">Set {i+1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==========================================================
              CATEGORY 3: ASSET CONSUMABLES
             ========================================================== */}

          {/* CHART 7: Needle */}
          {(activeTab === 'all' || activeTab === 'consumables') && (
            <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-gray-200 transition-all" id="chart-needle-consumption">
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-sans text-xs font-black text-gray-900 dark:text-slate-100">Needle Consumption</h3>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Needle wear & tear rate (Pcs)</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 relative">
                <div className="flex items-end justify-between h-32 gap-1.5 pt-2">
                  {needleData.map((d, i) => {
                    const maxVal = Math.max(...needleData.map(x => x.value1)) || 200;
                    const h1 = `${(d.value1 / maxVal) * 100}%`;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                        <div className="w-full flex justify-center items-end h-24">
                          <div 
                            className="w-4 rounded-t bg-teal-500 hover:bg-teal-600 transition-all" 
                            style={{ height: h1 }} 
                            title={`Wear: ${d.value1} Pcs`}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* CHART 8: Sinker */}
          {(activeTab === 'all' || activeTab === 'consumables') && (
            <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-gray-200 transition-all" id="chart-sinker-replacement">
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-sans text-xs font-black text-gray-900 dark:text-slate-100">Sinker Replacement</h3>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Sinker wear rate (Pcs)</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 relative">
                <div className="flex items-end justify-between h-32 gap-1.5 pt-2">
                  {sinkerData.map((d, i) => {
                    const maxVal = Math.max(...sinkerData.map(x => x.value1)) || 150;
                    const h1 = `${(d.value1 / maxVal) * 100}%`;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                        <div className="w-full flex justify-center items-end h-24">
                          <div 
                            className="w-4 rounded-t bg-orange-500 hover:bg-orange-600 transition-all" 
                            style={{ height: h1 }} 
                            title={`Sinker Wear: ${d.value1} Pcs`}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* CHART 9: Oil */}
          {(activeTab === 'all' || activeTab === 'consumables') && (
            <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-gray-200 transition-all" id="chart-oil-consumption">
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <Droplet className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-sans text-xs font-black text-gray-900 dark:text-slate-100">Oil Lubrication</h3>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Cylinder lubrication (Liters)</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 relative">
                <div className="flex items-end justify-between h-32 gap-1.5 pt-2">
                  {oilData.map((d, i) => {
                    const maxVal = Math.max(...oilData.map(x => x.value1)) || 200;
                    const h1 = `${(d.value1 / maxVal) * 100}%`;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                        <div className="w-full flex justify-center items-end h-24">
                          <div 
                            className="w-4 rounded-t bg-slate-500 hover:bg-slate-600 transition-all" 
                            style={{ height: h1 }} 
                            title={`Oil: ${d.value1} Ltrs`}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
