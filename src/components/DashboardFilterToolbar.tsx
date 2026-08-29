/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
import { useGlobalData } from '../context/GlobalDataContext';
import { LedgerCalendarDatePicker } from './LedgerCalendarDatePicker';

interface DashboardFilterToolbarProps {
  filterState?: FilterState;
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
  { id: 'all', name: 'All Units' },
  { id: 'EKL', name: 'EKL' },
  { id: 'EFL', name: 'EFL' },
  { id: 'EFL-2', name: 'EFL-2' },
  { id: 'Auto Stripe', name: 'Auto Stripe' },
  { id: 'EFL-Extension', name: 'EFL-Extension' },
  { id: 'ESL-Extension', name: 'ESL-Extension' },
  { id: 'Sub-Contact', name: 'Sub-Contact' },
];

const YEARS = [
  { id: 'all', name: 'All Years' },
  { id: '2026', name: '2026' },
  { id: '2025', name: '2025' },
  { id: '2024', name: '2024' },
  { id: '2023', name: '2023' },
];

export default function DashboardFilterToolbar({ 
  filterState,
  onApplyFilters, 
  onResetFilters,
  defaultUnit = 'all',
  defaultDate = ''
}: DashboardFilterToolbarProps) {
  const { ledger } = useGlobalData();

  // Extract unique available dates present in the ledger
  const availableLedgerDates = useMemo(() => {
    const dates = new Set<string>();
    (ledger || []).forEach(r => {
      if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
        dates.add(r.date);
      }
    });
    return Array.from(dates).sort();
  }, [ledger]);

  const minAvailableDate = availableLedgerDates[0] || '';
  const maxAvailableDate = availableLedgerDates[availableLedgerDates.length - 1] || '';

  // Local filter states
  const [unit, setUnit] = useState<string>(filterState?.unit || defaultUnit);
  const [year, setYear] = useState<string>(filterState?.year || 'all');
  const [dateFrom, setDateFrom] = useState<string>(filterState?.dateFrom || '');
  const [dateTo, setDateTo] = useState<string>(filterState?.dateTo || '');

  // Searchable dropdown state for Units
  const [showUnitDropdown, setShowUnitDropdown] = useState<boolean>(false);
  const [unitSearch, setUnitSearch] = useState<string>('');

  // Sync state whenever filterState or default changes
  useEffect(() => {
    if (filterState) {
      setUnit(filterState.unit || 'all');
      setYear(filterState.year || 'all');
      setDateFrom(filterState.dateFrom || '');
      setDateTo(filterState.dateTo || '');
    } else if (defaultUnit) {
      setUnit(defaultUnit);
    }
  }, [filterState, defaultUnit]);

  const filteredUnits = UNITS.filter(u => 
    u.name.toLowerCase().includes(unitSearch.toLowerCase())
  );

  const activeUnitObj = UNITS.find(u => u.id === unit) || UNITS[0];

  const handleApply = () => {
    let computedDateMode: 'single' | 'range' | 'month' | 'year' = 'range';
    if (dateFrom && dateTo) {
      computedDateMode = dateFrom === dateTo ? 'single' : 'range';
    } else if (dateFrom || dateTo) {
      computedDateMode = 'range';
    } else if (year && year !== 'all') {
      computedDateMode = 'year';
    } else {
      computedDateMode = 'range';
    }

    onApplyFilters({
      unit,
      dateMode: computedDateMode,
      singleDate: dateFrom && dateTo && dateFrom === dateTo ? dateFrom : (dateFrom || dateTo || defaultDate || '2026-08-26'),
      dateFrom,
      dateTo,
      month: dateFrom ? dateFrom.substring(0, 7) : '',
      year
    });
  };

  const handleReset = () => {
    setUnit('all');
    setYear('all');
    setDateFrom('');
    setDateTo('');
    setUnitSearch('');
    onResetFilters();
  };

  const handleExportPDF = () => {
    alert(`Generating PDF Report:\n\n📄 File: Knitting_Floor_Performance_Report.pdf\n🏢 Unit: ${unit}\n📅 Period: ${dateFrom || 'All'} to ${dateTo || 'All'}\n\nStatus: Download started.`);
  };

  const handleExportExcel = () => {
    alert(`Generating Excel (.xlsx) Report:\n\n📊 File: Knitting_Floor_Performance_Report.xlsx\n🏢 Unit: ${unit}\n📅 Period: ${dateFrom || 'All'} to ${dateTo || 'All'}\n\nStatus: Exporting dataset.`);
  };

  return (
    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-3.5 shadow-xs" id="dashboard-filter-toolbar">
      <div className="flex flex-wrap lg:flex-nowrap items-end gap-3 w-full">
        {/* 1. FACTORY FLOOR / UNIT */}
        <div className="w-full sm:flex-1 min-w-[200px] space-y-1.5 relative">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wide flex items-center gap-1.5 uppercase">
            <span>🏭</span>
            <span>FACTORY FLOOR / UNIT</span>
          </label>
          
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUnitDropdown(!showUnitDropdown)}
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 text-left flex items-center justify-between shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-hidden cursor-pointer"
            >
              <span className="truncate">{activeUnitObj.name}</span>
              <ChevronDown className="h-4 w-4 text-slate-600 dark:text-slate-400 shrink-0 ml-1.5" />
            </button>

            {/* Dropdown panel */}
            {showUnitDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setShowUnitDropdown(false)} 
                />
                <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 shadow-xl z-30 animate-fade-in">
                  <div className="relative mb-1.5">
                    <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search unit..."
                      value={unitSearch}
                      onChange={(e) => setUnitSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 py-1.5 pl-8 pr-2.5 text-xs font-medium text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
                    />
                  </div>

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
                          className={`w-full rounded-md px-2.5 py-1.5 text-xs text-left flex items-center justify-between transition cursor-pointer ${
                            isSelected 
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold' 
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 font-medium'
                          }`}
                        >
                          <span className="text-xs">{u.name}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 2. YEAR */}
        <div className="w-full sm:w-[130px] lg:w-[140px] space-y-1.5 relative shrink-0">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wide flex items-center gap-1.5 uppercase">
            <span>📅</span>
            <span>YEAR</span>
          </label>
          <div className="relative">
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full appearance-none rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3.5 py-2 pr-8 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-hidden cursor-pointer"
            >
              {YEARS.map(y => (
                <option key={y.id} value={y.id} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                  {y.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 dark:text-slate-400" />
          </div>
        </div>

        {/* 3. FROM DATE */}
        <div className="w-full sm:w-[160px] lg:w-[175px] space-y-1.5 relative shrink-0">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wide flex items-center gap-1.5 uppercase">
            <span>📅</span>
            <span>FROM DATE</span>
          </label>
          <LedgerCalendarDatePicker
            id="dashboard-filter-from-date"
            value={dateFrom}
            onChange={(val) => setDateFrom(val)}
            allowedDates={availableLedgerDates}
            maxDate={dateTo || maxAvailableDate}
            placeholder="Select From Date"
          />
        </div>

        {/* 4. TO DATE */}
        <div className="w-full sm:w-[160px] lg:w-[175px] space-y-1.5 relative shrink-0">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wide flex items-center gap-1.5 uppercase">
            <span>📅</span>
            <span>TO DATE</span>
          </label>
          <LedgerCalendarDatePicker
            id="dashboard-filter-to-date"
            value={dateTo}
            onChange={(val) => setDateTo(val)}
            allowedDates={availableLedgerDates}
            minDate={dateFrom || minAvailableDate}
            maxDate={maxAvailableDate}
            placeholder="Select To Date"
          />
        </div>

        {/* 5. Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-end w-full sm:w-auto">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 sm:flex-initial rounded-md bg-[#0B4D8C] hover:bg-[#093e70] dark:bg-blue-600 dark:hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Apply Criteria</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
