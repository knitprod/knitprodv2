/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Calendar, 
  RefreshCw, 
  Download, 
  FileText, 
  Table, 
  ChevronDown, 
  Check, 
  Search,
  Filter
} from 'lucide-react';

interface DashboardFilterToolbarProps {
  onApplyFilters: (filters: FilterState) => void;
  onResetFilters: () => void;
  defaultUnit?: string;
  defaultDate?: string;
}

export interface FilterState {
  unit: string;
  dateMode: 'single' | 'range' | 'month' | 'year';
  singleDate: string;
  dateFrom: string;
  dateTo: string;
  month: string;
  year: string;
}

const UNITS = [
  { id: 'EKL', name: 'EKL', longName: 'Epyllion Knitting Ltd (Main Floor)' },
  { id: 'EFL', name: 'EFL', longName: 'Epyllion Fabrics Ltd (Floor 1)' },
  { id: 'EFL-2', name: 'EFL-2', longName: 'Epyllion Fabrics Ltd (Floor 2)' },
  { id: 'Auto Stripe', name: 'Auto Stripe', longName: 'Auto Stripe Knitting Division' },
  { id: 'EFL-Extension', name: 'EFL-Extension', longName: 'EFL Extension Wing' },
  { id: 'ESL-Extension', name: 'ESL-Extension', longName: 'ESL Extension Knitting Unit' },
  { id: 'Sub-Contact', name: 'Sub-Contact', longName: 'Sub-Contact Knitting Unit' },
];

export default function DashboardFilterToolbar({ 
  onApplyFilters, 
  onResetFilters,
  defaultUnit = 'EKL',
  defaultDate = '2026-07-13' // Yesterday relative to 2026-07-14
}: DashboardFilterToolbarProps) {
  // Local filter states
  const [unit, setUnit] = useState<string>(defaultUnit);
  const [dateMode, setDateMode] = useState<'single' | 'range' | 'month' | 'year'>('single');
  const [singleDate, setSingleDate] = useState<string>(defaultDate);
  const [dateFrom, setDateFrom] = useState<string>('2026-07-01');
  const [dateTo, setDateTo] = useState<string>(defaultDate);
  const [month, setMonth] = useState<string>('2026-07');
  const [year, setYear] = useState<string>('2026');

  // Searchable dropdown state for Units
  const [unitSearch, setUnitSearch] = useState<string>('');
  const [showUnitDropdown, setShowUnitDropdown] = useState<boolean>(false);

  // Sync state if default changes
  useEffect(() => {
    setUnit(defaultUnit);
  }, [defaultUnit]);

  const filteredUnits = UNITS.filter(u => 
    u.name.toLowerCase().includes(unitSearch.toLowerCase()) || 
    u.longName.toLowerCase().includes(unitSearch.toLowerCase())
  );

  const activeUnitObj = UNITS.find(u => u.id === unit) || UNITS[0];

  const handleApply = () => {
    onApplyFilters({
      unit,
      dateMode,
      singleDate,
      dateFrom,
      dateTo,
      month,
      year
    });
  };

  const handleReset = () => {
    setUnit(defaultUnit);
    setDateMode('single');
    setSingleDate(defaultDate);
    setDateFrom('2026-07-01');
    setDateTo(defaultDate);
    setMonth('2026-07');
    setYear('2026');
    setUnitSearch('');
    onResetFilters();
  };

  const handleExportPDF = () => {
    const title = getFormattedTitle();
    alert(`Generating PDF Report:\n\n📄 File: ${title.replace(' — ', '_')}.pdf\n🏢 Unit: ${unit}\n📅 Period: ${getFormattedPeriod()}\n\nStatus: Download started successfully.`);
    
    // Simulate browser download
    const element = document.createElement("a");
    const file = new Blob([`Knitting Floor Performance Report\nUnit: ${unit}\nPeriod: ${getFormattedPeriod()}\nGenerated on: ${new Date().toLocaleDateString()}`], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleExportExcel = () => {
    const title = getFormattedTitle();
    alert(`Generating Excel (.xlsx) Report:\n\n📊 File: ${title.replace(' — ', '_')}.xlsx\n🏢 Unit: ${unit}\n📅 Period: ${getFormattedPeriod()}\n\nStatus: Exporting dynamic dataset.`);
    
    // Simulate xlsx download
    const element = document.createElement("a");
    const file = new Blob([`Unit,Target (Kg),Actual Production (Kg),Achievement %,Quality Rate %,Efficiency %\n${unit},12000,11140,92.8,98.6,94.2`], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.xlsx`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const getFormattedMonth = (mStr: string) => {
    const [y, m] = mStr.split('-');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const idx = parseInt(m) - 1;
    return `${months[idx] || 'Month'} ${y}`;
  };

  const getFormattedDate = (dStr: string) => {
    if (!dStr) return '';
    const dateObj = new Date(dStr);
    if (isNaN(dateObj.getTime())) return dStr;
    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace(/ /g, '-');
  };

  const getFormattedPeriod = () => {
    if (dateMode === 'single') {
      return getFormattedDate(singleDate);
    } else if (dateMode === 'range') {
      return `${getFormattedDate(dateFrom)} to ${getFormattedDate(dateTo)}`;
    } else if (dateMode === 'month') {
      return getFormattedMonth(month);
    } else {
      return `Year ${year}`;
    }
  };

  const getFormattedTitle = () => {
    return `Knitting Floor Performance — ${getFormattedPeriod()}`;
  };

  return (
    <div className="space-y-4" id="dashboard-filter-toolbar">
      {/* 1. Interactive ERP Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-2.5">
        <div>
          <h2 className="font-sans text-xl font-black tracking-tight text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Filter className="h-5 w-5 text-[#0F4C81] dark:text-blue-400" />
            <span>Knitting Floor Performance</span>
          </h2>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold px-1.5 py-0.5 rounded-sm bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
              {activeUnitObj.longName}
            </span>
            <span>•</span>
            <span className="font-mono font-bold text-[#0F4C81] dark:text-blue-400">
              {getFormattedPeriod()}
            </span>
          </div>
        </div>

        {/* Action triggers */}
        <div className="flex items-center gap-1.5 self-end md:self-auto">
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition shadow-2xs cursor-pointer"
            title="Export Report to PDF format"
          >
            <FileText className="h-3.5 w-3.5 text-red-500" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition shadow-2xs cursor-pointer"
            title="Export Report to Excel spreadsheet"
          >
            <Table className="h-3.5 w-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* 2. Compact ERP-grade Filtering Bar */}
      <div className="rounded-xl border border-gray-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-3.5 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end justify-between">
          
          {/* Left panel: Unit Selection & Date Mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            
            {/* Unit Filter - Searchable Select component */}
            <div className="space-y-1 relative">
              <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                <span>Factory Unit</span>
              </label>
              
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowUnitDropdown(!showUnitDropdown)}
                  className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/30 px-3 py-2 text-xs font-bold text-gray-800 dark:text-slate-100 text-left flex items-center justify-between shadow-2xs focus:border-blue-500 focus:outline-hidden"
                >
                  <span className="truncate">{activeUnitObj.longName}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 ml-1" />
                </button>

                {/* Dropdown panel */}
                {showUnitDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowUnitDropdown(false)} 
                    />
                    <div className="absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-xl z-20 animate-fade-in scrollbar-none">
                      {/* Search box within dropdown */}
                      <div className="relative mb-2">
                        <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search units..."
                          value={unitSearch}
                          onChange={(e) => setUnitSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 py-1.5 pl-8 pr-3 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
                        />
                      </div>

                      {/* Options */}
                      <div className="space-y-0.5">
                        {filteredUnits.map((u) => {
                          const isSelected = u.id === unit;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setUnit(u.id);
                                setShowUnitDropdown(false);
                              }}
                              className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-semibold text-left flex items-center justify-between transition ${
                                isSelected 
                                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold' 
                                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-bold text-[11px]">{u.name}</span>
                                <span className="text-[10px] text-gray-400 dark:text-slate-400">{u.longName}</span>
                              </div>
                              {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                            </button>
                          );
                        })}
                        {filteredUnits.length === 0 && (
                          <div className="py-2 text-center text-[11px] font-bold text-gray-400">
                            No units found
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Date Selection Modes */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Date Range Mode</span>
              </label>
              <div className="flex rounded-lg bg-gray-100 dark:bg-slate-800 p-0.5 border border-gray-200 dark:border-slate-700">
                {(['single', 'range', 'month', 'year'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDateMode(mode)}
                    className={`flex-1 rounded-md py-1.5 text-[10px] font-black uppercase tracking-wider transition-all ${
                      dateMode === mode
                        ? 'bg-white dark:bg-slate-700 text-blue-950 dark:text-white shadow-xs'
                        : 'text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {mode === 'single' ? 'Single' : mode === 'range' ? 'Range' : mode === 'month' ? 'Month' : 'Year'}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right panel: Dynamic Date Inputs & Action Buttons */}
          <div className="flex flex-col md:flex-row lg:items-end gap-3 lg:max-w-xl w-full">
            
            {/* Dynamic Date Fields based on Date Mode */}
            <div className="flex-1">
              {dateMode === 'single' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-400 uppercase">Selected Date</label>
                  <input
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/30 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  />
                </div>
              )}

              {dateMode === 'range' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-400 uppercase">From Date</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/30 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-400 uppercase">To Date</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/30 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {dateMode === 'month' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-400 uppercase">Selected Month</label>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/30 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  />
                </div>
              )}

              {dateMode === 'year' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-gray-400 dark:text-slate-400 uppercase">Selected Year</label>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/30 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
                  >
                    <option value="2026">Year 2026</option>
                    <option value="2025">Year 2025</option>
                    <option value="2024">Year 2024</option>
                  </select>
                </div>
              )}
            </div>

            {/* Filter Actions */}
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-extrabold text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 md:flex-initial rounded-lg bg-[#0F4C81] hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 px-5 py-2 text-xs font-extrabold text-white transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 animate-spin-hover" />
                <span>Apply Filter</span>
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
