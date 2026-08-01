/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, RotateCw, AlertTriangle, Cpu, TrendingUp, Sparkles, Sliders } from 'lucide-react';
import { FactoryFloor } from '../types';

interface FactoryFloorsProps {
  floors: FactoryFloor[];
  selectedFloorId: string | null;
  onSelectFloor: (floorId: string | null) => void;
}

export default function FactoryFloors({ floors, selectedFloorId, onSelectFloor }: FactoryFloorsProps) {
  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-sans text-lg font-black tracking-tight text-gray-900">
            Factory Floor Live Performance
          </h2>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Real-time status of 6 knitting wings
          </p>
        </div>
        {selectedFloorId && (
          <button
            onClick={() => onSelectFloor(null)}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-100"
            id="clear-floor-filter-btn"
          >
            <Sliders className="h-3 w-3" />
            <span>Show All Floors</span>
          </button>
        )}
      </div>

      {/* Grid Layout of 6 Floors */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {floors.map((floor) => {
          const isSelected = selectedFloorId === floor.id;
          
          // Determine status styles
          const statusConfig = {
            optimal: {
              badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
              pulse: 'bg-emerald-500',
              text: 'Optimal Operations',
              bar: 'bg-emerald-500',
            },
            warning: {
              badge: 'bg-amber-500/10 text-amber-700 border-amber-200',
              pulse: 'bg-amber-500',
              text: 'Setup/Yarn Hold',
              bar: 'bg-amber-500',
            },
            critical: {
              badge: 'bg-red-500/10 text-red-700 border-red-200',
              pulse: 'bg-red-500',
              text: 'Maintenance Stopped',
              bar: 'bg-red-500',
            },
          }[floor.status];

          return (
            <button
              key={floor.id}
              onClick={() => onSelectFloor(isSelected ? null : floor.id)}
              className={`group flex flex-col text-left rounded-2xl border p-5 shadow-xs transition-all duration-200 ${
                isSelected 
                  ? 'border-blue-500 bg-blue-50/20 ring-2 ring-blue-500/20' 
                  : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-md'
              }`}
              id={`floor-card-${floor.id}`}
            >
              {/* Header: Floor Name and Status Beacon */}
              <div className="flex w-full items-center justify-between">
                <div>
                  <h3 className="font-sans text-base font-black text-gray-950 group-hover:text-blue-700 transition-colors">
                    {floor.name}
                  </h3>
                  <p className="text-[10px] font-bold text-gray-400 truncate max-w-[150px]" title={floor.longName}>
                    {floor.longName}
                  </p>
                </div>

                {/* Status Beacon */}
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${statusConfig.pulse}`} />
                    <span className={`relative inline-flex h-2 w-2 rounded-full ${statusConfig.pulse}`} />
                  </span>
                  <span className="hidden text-[10px] font-bold text-gray-500 lg:inline">
                    {floor.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Achievement Meter (Circular progress bar alternative: elegant full-width track) */}
              <div className="mt-5 space-y-1.5 w-full">
                <div className="flex justify-between text-xs font-bold text-gray-700">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Daily Achievement</span>
                  <span className="font-mono">{floor.achievementPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${statusConfig.bar}`}
                    style={{ width: `${Math.min(floor.achievementPct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Production and Machine Metrics Row */}
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-50 pt-4 w-full">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Production</span>
                  <span className="block font-mono text-sm font-black text-gray-900">
                    {floor.productionKg.toLocaleString()} <span className="text-[10px] text-gray-400">Kg</span>
                  </span>
                  <span className="text-[9px] font-semibold text-gray-400">
                    Target: {floor.targetKg.toLocaleString()} Kg
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Frames Active</span>
                  <span className="block font-mono text-sm font-black text-gray-900">
                    {floor.runningMachines} <span className="text-[10px] text-gray-400">/ {floor.totalMachines}</span>
                  </span>
                  <span className="text-[9px] font-semibold text-gray-400">
                    Idle: {floor.idleMachines} | Eff: {floor.efficiencyPct}%
                  </span>
                </div>
              </div>

              {/* Bottom: Last Updated & Action Footer */}
              <div className="mt-4 flex w-full items-center justify-between border-t border-gray-50 pt-3.5 text-[10px] font-bold text-gray-400 uppercase">
                <span>Updated: {floor.lastUpdated}</span>
                <span className="text-blue-500 group-hover:translate-x-1 transition-transform">
                  {isSelected ? 'Selected ✓' : 'Filter Details →'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
