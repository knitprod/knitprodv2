/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileDown, Printer, Filter, Calendar, Table, Check, Layers, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { FactoryFloor, ProductionEntry } from '../types';
import { FABRIC_TYPES } from '../data';

interface ReportsViewProps {
  floors: FactoryFloor[];
  productionEntries: ProductionEntry[];
}

export default function ReportsView({ floors, productionEntries }: ReportsViewProps) {
  const [floorFilter, setFloorFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [fabricFilter, setFabricFilter] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Filter logic
  const filteredEntries = productionEntries.filter((entry) => {
    const matchesFloor = floorFilter === 'all' || entry.floorId === floorFilter;
    const matchesShift = shiftFilter === 'all' || entry.shift === shiftFilter;
    const matchesFabric = fabricFilter === 'all' || entry.fabricType === fabricFilter;
    return matchesFloor && matchesShift && matchesFabric;
  });

  // Aggregates
  const totalProduction = filteredEntries.reduce((sum, e) => sum + e.productionKg, 0);
  const totalReject = filteredEntries.reduce((sum, e) => sum + e.rejectKg, 0);
  const averageWaste = filteredEntries.length > 0 
    ? Math.round((totalReject / (totalProduction + totalReject)) * 1000) / 10 
    : 0;

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    }, 1500);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      setIsPrinting(false);
      window.print();
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-xl font-black tracking-tight text-gray-900">
            System Reports & Audit Trails
          </h2>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Export shift summaries, roll weights, and quality indices
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            disabled={isPrinting || isExporting}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            id="print-report-btn"
          >
            <Printer className="h-4 w-4" />
            <span>{isPrinting ? 'Preparing Spooler...' : 'Print Report'}</span>
          </button>
          
          <button
            onClick={handleExport}
            disabled={isPrinting || isExporting}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-blue-950 disabled:opacity-50 shadow-sm"
            id="export-report-btn"
          >
            <FileDown className="h-4 w-4" />
            <span>{isExporting ? 'Packaging CSV...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {showToast && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800 shadow-xs flex items-center gap-2.5 animate-fade-in">
          <Check className="h-4 w-4 text-blue-600" />
          <span>Epyllion_Knitex_Report_${new Date().toISOString().split('T')[0]}.csv exported successfully to downloads.</span>
        </div>
      )}

      {/* Filter Parameters Widget */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2 border-b border-gray-50 pb-3 mb-4">
          <SlidersHorizontal className="h-4 w-4 text-blue-600" />
          <h3 className="font-sans text-xs font-black text-gray-900 uppercase">Query Criteria Filters</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Floor */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Knitting Floor</label>
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-bold text-gray-700 transition-colors focus:border-blue-500 focus:bg-white focus:outline-hidden"
            >
              <option value="all">All Floors</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Shift */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Roster Shift</label>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-bold text-gray-700 transition-colors focus:border-blue-500 focus:bg-white focus:outline-hidden"
            >
              <option value="all">All Shifts</option>
              <option value="A">Shift A (06:00 - 14:00)</option>
              <option value="B">Shift B (14:00 - 22:00)</option>
              <option value="C">Shift C (22:00 - 06:00)</option>
            </select>
          </div>

          {/* Fabric structure */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Knitted Structure</label>
            <select
              value={fabricFilter}
              onChange={(e) => setFabricFilter(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-bold text-gray-700 transition-colors focus:border-blue-500 focus:bg-white focus:outline-hidden"
            >
              <option value="all">All Structures</option>
              {FABRIC_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Aggregate metrics for the filtered report */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Combined Output</span>
          <span className="mt-1 block font-mono text-xl font-black text-gray-900">{totalProduction.toLocaleString()} Kg</span>
          <span className="text-[9px] font-semibold text-gray-400">Sum of filtered logs</span>
        </div>

        <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Combined Waste</span>
          <span className="mt-1 block font-mono text-xl font-black text-red-600">{totalReject.toLocaleString()} Kg</span>
          <span className="text-[9px] font-semibold text-gray-400">Fabric scrap weight</span>
        </div>

        <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Quality Index (Scrap Ratio)</span>
          <span className="mt-1 block font-mono text-xl font-black text-emerald-700">{(100 - averageWaste).toFixed(1)}%</span>
          <span className="text-[9px] font-semibold text-gray-400">Target tolerance: &gt; 98.0%</span>
        </div>
      </div>

      {/* Reports Table Sheet */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-50 pb-3 mb-4">
          <Table className="h-4.5 w-4.5 text-blue-600" />
          <h3 className="font-sans text-xs font-black text-gray-900 uppercase">Roll Log Sheets ({filteredEntries.length} items)</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-medium">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Floor</th>
                <th className="px-4 py-3">Machine ID</th>
                <th className="px-4 py-3">Supervisor / Operator</th>
                <th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3">Yarn Count</th>
                <th className="px-4 py-3">Structure</th>
                <th className="px-4 py-3 text-right">Yield Weight</th>
                <th className="px-4 py-3 text-right">Scrap Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-700">
              {filteredEntries.map((entry) => {
                const floorName = floors.find((f) => f.id === entry.floorId)?.name || entry.floorId.toUpperCase();
                return (
                  <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-gray-500 whitespace-nowrap">{entry.timestamp}</td>
                    <td className="px-4 py-3.5 font-bold text-gray-900 whitespace-nowrap">{floorName}</td>
                    <td className="px-4 py-3.5 font-mono text-blue-600 font-bold whitespace-nowrap">{entry.machineId}</td>
                    <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{entry.operatorName}</td>
                    <td className="px-4 py-3.5 font-bold text-gray-500 text-center whitespace-nowrap">Shift {entry.shift}</td>
                    <td className="px-4 py-3.5 font-semibold text-gray-600 whitespace-nowrap">{entry.yarnType}</td>
                    <td className="px-4 py-3.5 font-bold text-gray-800 whitespace-nowrap">{entry.fabricType}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-black text-gray-900 whitespace-nowrap">{entry.productionKg.toFixed(1)} <span className="text-[10px] text-gray-400">Kg</span></td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-red-600 whitespace-nowrap">{entry.rejectKg.toFixed(1)} <span className="text-[10px] text-gray-400">Kg</span></td>
                  </tr>
                );
              })}

              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs font-bold text-gray-400 uppercase">
                    No active log records found matching specified criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
