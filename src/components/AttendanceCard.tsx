/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Users, 
  UserX, 
  UserCheck, 
  Layers, 
  Calendar, 
  AlertTriangle, 
  ChevronRight, 
  X, 
  Download, 
  Search, 
  Filter, 
  CheckCircle2, 
  ArrowUpRight 
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface UnitManpowerItem {
  floor: string;
  totalOperator: number;
  present: number;
  absent: number;
  absentPct: number;
  turnoutPct: number;
}

export interface AbsentLogItem {
  id: string;
  date: string;
  floor: string;
  totalOperator: number;
  present: number;
  absent: number;
  absentPct: number;
  remarks?: string;
}

export interface AttendanceCardProps {
  totalStaff: number;
  totalAbsent: number;
  absentPct: number;
  presentStaff?: number;
  presentPct?: number;
  periodLabel?: string;
  unitManpowerList?: UnitManpowerItem[];
  absentList?: AbsentLogItem[];
  className?: string;
}

/**
 * Fallback list of standard units when no live unit breakdown is provided
 */
const DEFAULT_UNIT_MANPOWER: UnitManpowerItem[] = [
  { floor: 'EKL', totalOperator: 10, present: 10, absent: 0, absentPct: 0, turnoutPct: 100 },
  { floor: 'EFL', totalOperator: 12, present: 12, absent: 0, absentPct: 0, turnoutPct: 100 },
  { floor: 'EFL-2', totalOperator: 8, present: 8, absent: 0, absentPct: 0, turnoutPct: 100 },
  { floor: 'Auto Stripe', totalOperator: 6, present: 6, absent: 0, absentPct: 0, turnoutPct: 100 },
  { floor: 'EFL-Extension', totalOperator: 8, present: 8, absent: 0, absentPct: 0, turnoutPct: 100 },
  { floor: 'ESL-Extension', totalOperator: 8, present: 7, absent: 1, absentPct: 12.5, turnoutPct: 87.5 },
];

export default function AttendanceCard({
  totalStaff,
  totalAbsent,
  absentPct,
  presentStaff,
  presentPct,
  periodLabel,
  unitManpowerList,
  absentList = [],
  className = '',
}: AttendanceCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'units' | 'absent'>('units');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const staffCount = typeof totalStaff === 'number' && totalStaff > 0 ? Math.round(totalStaff) : 52;
  const absentCount = typeof totalAbsent === 'number' && totalAbsent >= 0 ? Math.round(totalAbsent) : 1;
  const calculatedAbsentPct = staffCount > 0 
    ? parseFloat(((absentCount / staffCount) * 100).toFixed(1)) 
    : (typeof absentPct === 'number' ? parseFloat(absentPct.toFixed(1)) : 1.9);

  const calculatedPresent = presentStaff !== undefined ? Math.round(presentStaff) : Math.max(0, staffCount - absentCount);
  const calculatedPresentPct = presentPct !== undefined 
    ? parseFloat(presentPct.toFixed(1)) 
    : Math.max(0, parseFloat((100 - calculatedAbsentPct).toFixed(1)));

  // Use provided unit manpower or default
  const unitsData: UnitManpowerItem[] = (unitManpowerList && unitManpowerList.length > 0)
    ? unitManpowerList
    : DEFAULT_UNIT_MANPOWER;

  // Filtered absent list for the modal
  const filteredAbsentList = absentList.filter(item => {
    const matchesUnit = selectedUnitFilter === 'all' || item.floor.toLowerCase().replace(/[-\s_]/g, '') === selectedUnitFilter.toLowerCase().replace(/[-\s_]/g, '');
    const matchesQuery = !searchQuery || 
      item.date.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.floor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.remarks && item.remarks.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesUnit && matchesQuery;
  });

  const totalRecordedAbsences = absentList.reduce((sum, item) => sum + (Number(item.absent) || 0), 0);

  const handleExportCSV = () => {
    if (activeModalTab === 'units') {
      const dataToExport = unitsData.map(u => ({
        'Factory Unit': u.floor,
        'Daily Avg Manpower (Total Staff)': u.totalOperator,
        'Present on Shift': u.present,
        'Daily Avg Absent': u.absent,
        'Turnout Rate (%)': `${u.turnoutPct}%`,
        'Absent Rate (%)': `${u.absentPct}%`,
      }));
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Unit Manpower Summary');
      XLSX.writeFile(wb, `Unit_Manpower_Summary_${periodLabel || 'Report'}.xlsx`);
    } else {
      const dataToExport = filteredAbsentList.map(a => ({
        'Date': a.date,
        'Factory Unit': a.floor,
        'Total Manpower': a.totalOperator,
        'Present Staff': a.present,
        'Absent Count': a.absent,
        'Absent Rate (%)': `${a.absentPct}%`,
        'Remarks / Reason': a.remarks || 'Standard Shift Absenteeism',
      }));
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Absent Log');
      XLSX.writeFile(wb, `Absent_List_Log_${periodLabel || 'Report'}.xlsx`);
    }
  };

  const openUnitModal = (unitName?: string) => {
    if (unitName) {
      setSelectedUnitFilter(unitName);
      setActiveModalTab('units');
    }
    setIsModalOpen(true);
  };

  const openAbsentModal = () => {
    setActiveModalTab('absent');
    setIsModalOpen(true);
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DASHBOARD COMPACT CARD (h-[200px])                                     */}
      {/* ========================================================================= */}
      <div
        id="kpi-attendance-card"
        className={`w-full h-[200px] rounded-2xl border border-amber-200/90 dark:border-amber-900/60 bg-white dark:bg-slate-900 px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col justify-between hover:border-amber-300 dark:hover:border-amber-800 transition-all overflow-hidden ${className}`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
              <Users className="h-3 w-3" />
            </div>
            <div className="min-w-0 truncate">
              <span className="font-sans text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white block truncate leading-none">
                ATTENDANCE
              </span>
              {periodLabel && (
                <span className="font-sans text-[9px] font-semibold text-slate-500 dark:text-slate-400 block truncate leading-tight mt-0.5">
                  {periodLabel}
                </span>
              )}
            </div>
          </div>
          
          {/* Action Badges & Absent Trigger */}
          <div className="flex items-center gap-1 shrink-0 ml-1">
            <button
              type="button"
              onClick={openAbsentModal}
              title="Click to view Absent List & Incident Log"
              className="flex items-center gap-1 rounded-md bg-red-50 hover:bg-red-100 dark:bg-red-950/70 dark:hover:bg-red-900/80 border border-red-200 dark:border-red-800/80 px-1.5 py-0.5 text-[9px] font-black text-red-700 dark:text-red-300 transition-colors shadow-2xs cursor-pointer"
            >
              <UserX className="h-2.5 w-2.5 shrink-0" />
              <span>Absent ({absentList.length || absentCount})</span>
            </button>

            <button
              type="button"
              onClick={() => openUnitModal()}
              title="Click to view full Unit-by-Unit Manpower summary"
              className="rounded-md bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/70 dark:hover:bg-amber-900/80 border border-amber-200 dark:border-amber-800/80 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-amber-900 dark:text-amber-300 transition-colors shadow-2xs cursor-pointer"
            >
              {calculatedPresentPct}% Turnout
            </button>
          </div>
        </div>

        {/* Top Metric Row: Total Manpower & Absent Breakdown */}
        <div className="flex items-center justify-between gap-1.5 my-auto">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className="font-mono text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white leading-none">
                {staffCount.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-none">
                Daily Avg Staff
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[9.5px] font-bold leading-none">
              <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5">
                <UserCheck className="h-2.5 w-2.5 shrink-0" />
                <span>{calculatedPresent.toLocaleString()} Present</span>
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-red-600 dark:text-red-400 flex items-center gap-0.5">
                <UserX className="h-2.5 w-2.5 shrink-0" />
                <span>{absentCount.toLocaleString()} Absent ({calculatedAbsentPct}%)</span>
              </span>
            </div>
          </div>

          {/* Absent Rate Badge */}
          <div 
            onClick={openAbsentModal}
            className="rounded-lg px-2 py-1 text-center font-mono shadow-2xs border border-red-200 bg-red-50/90 text-red-900 dark:border-red-800/80 dark:bg-red-950/60 dark:text-red-300 min-w-[54px] shrink-0 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
            title="Click to view detailed Absent List"
          >
            <div className="text-[7px] font-sans font-black uppercase tracking-wider text-red-700 dark:text-red-400 leading-none">
              ABSENT RATE
            </div>
            <div className="text-sm sm:text-base font-black leading-tight mt-0.5">{calculatedAbsentPct}%</div>
          </div>
        </div>

        {/* 3. Unit by Unit Average Manpower Summary Chips (Clickable) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none">
            <div className="flex items-center gap-1">
              <Layers className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>UNIT-BY-UNIT AVG MANPOWER</span>
            </div>
            <button 
              type="button"
              onClick={() => openUnitModal()}
              className="text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 flex items-center gap-0.5 lowercase hover:underline cursor-pointer"
            >
              <span>all units</span>
              <ArrowUpRight className="h-2 w-2" />
            </button>
          </div>

          {/* Micro-Chips Container */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            {unitsData.map((u) => {
              const hasAbsent = u.absent > 0;
              return (
                <button
                  key={u.floor}
                  type="button"
                  onClick={() => openUnitModal(u.floor)}
                  title={`${u.floor}: ${u.totalOperator} Avg Staff, ${u.present} Present, ${u.absent} Absent (${u.turnoutPct}% Turnout)`}
                  className={`shrink-0 rounded-md px-1.5 py-1 text-left border transition-all cursor-pointer ${
                    hasAbsent
                      ? 'bg-red-50/90 border-red-200 dark:bg-red-950/50 dark:border-red-900/60 hover:bg-red-100'
                      : 'bg-slate-50/90 border-slate-200 dark:bg-slate-800/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 leading-none">
                    <span className="font-sans text-[8px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-200 truncate max-w-[55px]">
                      {u.floor}
                    </span>
                    {hasAbsent ? (
                      <span className="font-mono text-[7.5px] font-black text-red-600 dark:text-red-400">
                        {u.absent} Abs
                      </span>
                    ) : (
                      <span className="font-mono text-[7.5px] font-bold text-emerald-600 dark:text-emerald-400">
                        100%
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[9px] font-black text-slate-900 dark:text-white leading-tight mt-0.5 flex items-center gap-0.5">
                    <span>{u.totalOperator}</span>
                    <span className="text-[7.5px] font-normal text-slate-500 dark:text-slate-400">staff</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Present Workforce Turnout Progress Bar */}
        <div className="space-y-0.5 pt-0.5">
          <div className="flex items-center justify-between text-[9px] font-bold leading-none">
            <span className="text-slate-800 dark:text-slate-200">
              Present Workforce ({calculatedPresent}/{staffCount})
            </span>
            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
              {calculatedPresentPct}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner">
            <div
              className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500 shadow-xs"
              style={{ width: `${calculatedPresentPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. UNIT MANPOWER & ABSENT BREAKDOWN MODAL                                 */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-sans text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider leading-none">
                    Unit Manpower & Absenteeism Summary
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {periodLabel || 'Active Filter Period'} &bull; Detailed breakdown by Factory Unit & Shift Absentees
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Top Summary KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
              <div className="rounded-xl bg-white dark:bg-slate-800 p-2.5 border border-slate-200/80 dark:border-slate-700">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Manpower (Avg)
                </div>
                <div className="font-mono text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {staffCount.toLocaleString()} <span className="text-xs font-medium text-slate-500">Staff</span>
                </div>
              </div>

              <div className="rounded-xl bg-white dark:bg-slate-800 p-2.5 border border-slate-200/80 dark:border-slate-700">
                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Present on Shift
                </div>
                <div className="font-mono text-lg font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {calculatedPresent.toLocaleString()} <span className="text-xs font-bold text-emerald-600">({calculatedPresentPct}%)</span>
                </div>
              </div>

              <div className="rounded-xl bg-white dark:bg-slate-800 p-2.5 border border-slate-200/80 dark:border-slate-700">
                <div className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                  Daily Avg Absent
                </div>
                <div className="font-mono text-lg font-black text-red-600 dark:text-red-400 mt-0.5">
                  {absentCount.toLocaleString()} <span className="text-xs font-bold text-red-500">({calculatedAbsentPct}%)</span>
                </div>
              </div>

              <div className="rounded-xl bg-white dark:bg-slate-800 p-2.5 border border-slate-200/80 dark:border-slate-700">
                <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Recorded Absent Days
                </div>
                <div className="font-mono text-lg font-black text-amber-700 dark:text-amber-300 mt-0.5">
                  {absentList.length} <span className="text-xs font-medium text-slate-500">Logs</span>
                </div>
              </div>
            </div>

            {/* Modal Tabs & Controls */}
            <div className="flex items-center justify-between px-5 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('units')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeModalTab === 'units'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Users className="h-3.5 w-3.5 text-amber-600" />
                  <span>Unit-by-Unit Summary</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('absent')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeModalTab === 'absent'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <UserX className="h-3.5 w-3.5 text-red-600" />
                  <span>Absent List Log ({absentList.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors border border-slate-300/80 dark:border-slate-700 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            {/* Modal Body: Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {activeModalTab === 'units' ? (
                /* TAB 1: UNIT-BY-UNIT MANPOWER TABLE */
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-2.5 px-3 uppercase tracking-wider text-[10px]">Factory Unit</th>
                          <th className="py-2.5 px-3 text-center uppercase tracking-wider text-[10px]">Total Manpower (Avg)</th>
                          <th className="py-2.5 px-3 text-center uppercase tracking-wider text-[10px]">Present on Shift</th>
                          <th className="py-2.5 px-3 text-center uppercase tracking-wider text-[10px]">Daily Avg Absent</th>
                          <th className="py-2.5 px-3 text-center uppercase tracking-wider text-[10px]">Turnout Rate</th>
                          <th className="py-2.5 px-3 text-center uppercase tracking-wider text-[10px]">Absent Rate</th>
                          <th className="py-2.5 px-3 text-center uppercase tracking-wider text-[10px]">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {unitsData.map((u) => {
                          const hasAbsent = u.absent > 0;
                          return (
                            <tr key={u.floor} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span>{u.floor}</span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                                {u.totalOperator} Staff
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-300">
                                {u.present} Staff
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold">
                                {hasAbsent ? (
                                  <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-1.5 py-0.5 rounded-md border border-red-200 dark:border-red-900">
                                    {u.absent} Staff
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-emerald-500 rounded-full" 
                                      style={{ width: `${u.turnoutPct}%` }}
                                    />
                                  </div>
                                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                                    {u.turnoutPct}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                                {u.absentPct}%
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {u.turnoutPct >= 95 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle2 className="h-2.5 w-2.5" /> Optimal
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                    <AlertTriangle className="h-2.5 w-2.5" /> Attention
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50/90 dark:bg-slate-800 font-bold border-t border-slate-200 dark:border-slate-700">
                        <tr>
                          <td className="py-2.5 px-3 text-slate-900 dark:text-white uppercase tracking-wider text-[10px]">
                            Grand Total / Avg
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-900 dark:text-white">
                            {staffCount} Staff
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-emerald-700 dark:text-emerald-300">
                            {calculatedPresent} Staff
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-red-600 dark:text-red-400">
                            {absentCount} Staff
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-emerald-700 dark:text-emerald-300">
                            {calculatedPresentPct}%
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-red-600 dark:text-red-400">
                            {calculatedAbsentPct}%
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-700 dark:text-emerald-300">
                            {calculatedPresentPct >= 95 ? 'Optimal' : 'Normal'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
                /* TAB 2: ABSENT LIST LOG */
                <div className="space-y-3">
                  {/* Filters Bar */}
                  <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search date, unit, or remarks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent text-xs text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
                      />
                      {searchQuery && (
                        <button type="button" onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Filter className="h-3.5 w-3.5 text-slate-500" />
                      <select
                        value={selectedUnitFilter}
                        onChange={(e) => setSelectedUnitFilter(e.target.value)}
                        className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 outline-none font-bold"
                      >
                        <option value="all">All Units ({absentList.length})</option>
                        {unitsData.map(u => (
                          <option key={u.floor} value={u.floor}>{u.floor}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Absent Table */}
                  {filteredAbsentList.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="py-2.5 px-3 uppercase tracking-wider text-[10px]">Date</th>
                            <th className="py-2.5 px-3 uppercase tracking-wider text-[10px]">Factory Unit</th>
                            <th className="py-2.5 px-3 text-center uppercase tracking-wider text-[10px]">Total Staff</th>
                            <th className="py-2.5 px-3 text-center uppercase tracking-wider text-[10px]">Present</th>
                            <th className="py-2.5 px-3 text-center uppercase tracking-wider text-[10px]">Absent Count</th>
                            <th className="py-2.5 px-3 text-center uppercase tracking-wider text-[10px]">Absent %</th>
                            <th className="py-2.5 px-3 uppercase tracking-wider text-[10px]">Remarks / Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredAbsentList.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>{item.date}</span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-blue-700 dark:text-blue-400">
                                {item.floor}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                                {item.totalOperator}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-300">
                                {item.present}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-black text-red-600 dark:text-red-400">
                                <span className="bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-900">
                                  {item.absent}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-red-600 dark:text-red-400">
                                {item.absentPct}%
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 italic">
                                {item.remarks || 'Standard Shift Absenteeism'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-10 text-center rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        No Absent Records Found
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedUnitFilter !== 'all' 
                          ? `No absences recorded for ${selectedUnitFilter} in the active period.`
                          : 'Full 100% attendance recorded across all units.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                {activeModalTab === 'units' ? `${unitsData.length} Factory Units Analyzed` : `${filteredAbsentList.length} Absent Incident Logs`}
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
