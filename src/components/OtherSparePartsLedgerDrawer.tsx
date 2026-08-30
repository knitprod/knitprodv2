/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Other Spare Parts Consumption Section
 * Automatically parses auxiliary mechanical/electrical spare parts from Production Ledger:
 * Example: "Nozel (65), Air Gun (20)" -> Split into individual rows with Name, QTY, and UOM (pcs).
 * 
 * Features:
 * - Synchronized with top Dashboard Filter Panel in default/minimized view.
 * - Minimized view: Clean embedded table without sort filter dropdown.
 * - Maximized view: Renders as a full pop-up modal dialog with dedicated FROM DATE / TO DATE
 *   calendar filter (matching the main Filter Panel setting) and Sort filter dropdown.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Package, 
  Tag, 
  Cpu, 
  Search, 
  Filter, 
  Calendar, 
  BarChart3, 
  RefreshCw,
  X,
  Maximize2,
  Minimize2,
  ChevronDown
} from 'lucide-react';
import { LedgerRecord } from '../types';
import { FilterState } from './DashboardFilterToolbar';
import { filterLedgerByState, isSubContactRecord } from '../lib/productionMetrics';
import { LedgerCalendarDatePicker } from './LedgerCalendarDatePicker';

export interface SparePartItem {
  id: string;
  date: string;
  unit: string;
  floor: string;
  partName: string;
  quantity: number;
  uom: string; // 'pcs'
}

interface OtherSparePartsLedgerDrawerProps {
  ledger: LedgerRecord[];
  filterState?: FilterState;
  activeDateDisplay: string;
}

/**
 * Format date nicely for display while preserving original format if already formatted
 */
const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '-';
  const isoParts = dateStr.split('-');
  if (isoParts.length === 3 && isoParts[0].length === 4) {
    const year = isoParts[0];
    const monthNum = parseInt(isoParts[1], 10);
    const day = parseInt(isoParts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[monthNum - 1] || isoParts[1];
    return `${day} ${monthName} ${year}`;
  }
  return dateStr;
};

/**
 * Core Parser: Extracts spare parts name & quantity from "Other Spare Parts Name" string
 * Handles formats like:
 * - "Nozel (65), Air Gun (20)" -> [{ name: "Nozel", qty: 65 }, { name: "Air Gun", qty: 20 }]
 * - "Feeders (10 pcs); Cams (5)" -> [{ name: "Feeders", qty: 10 }, { name: "Cams", qty: 5 }]
 * - "Bearing - 4" -> [{ name: "Bearing", qty: 4 }]
 * - "Sensor: 3" -> [{ name: "Sensor", qty: 3 }]
 * - "Nozel" (with otherSparePartsQty = 15) -> [{ name: "Nozel", qty: 15 }]
 */
export function parseSparePartsFromLedger(records: LedgerRecord[]): SparePartItem[] {
  const items: SparePartItem[] = [];

  records.forEach((record, rowIdx) => {
    const rawNameStr = (record.otherSparePartsName || '').trim();
    const rawQty = Number(record.otherSparePartsQty) || 0;
    const date = record.date || '';
    const floor = (record.floor || record.unit || 'EKL').trim();
    const unit = (record.unit || record.floor || 'EKL').trim().toUpperCase();

    // If both name and qty are blank/zero, skip
    if (!rawNameStr && rawQty <= 0) return;

    // Case 1: Quantity exists but no name was typed
    if (!rawNameStr && rawQty > 0) {
      items.push({
        id: `${record.id || rowIdx}-part-0`,
        date,
        unit,
        floor,
        partName: 'General Spare Part',
        quantity: rawQty,
        uom: 'pcs',
      });
      return;
    }

    // Case 2: Split comma, semicolon, or newline separated spare parts
    const segments = rawNameStr.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);

    if (segments.length === 0) {
      if (rawQty > 0) {
        items.push({
          id: `${record.id || rowIdx}-part-0`,
          date,
          unit,
          floor,
          partName: 'General Spare Part',
          quantity: rawQty,
          uom: 'pcs',
        });
      }
      return;
    }

    segments.forEach((segment, segIdx) => {
      // Regex 1: Match "Name (123)" or "Name (123 pcs)" or "Name (123pcs)"
      const parenMatch = segment.match(/^(.*?)\s*\(\s*(\d+(?:\.\d+)?)\s*(?:pcs|pc|nos|no|set|sets)?\s*\)$/i);
      // Regex 2: Match "Name - 123" or "Name: 123"
      const sepMatch = segment.match(/^(.*?)\s*[-:]\s*(\d+(?:\.\d+)?)\s*(?:pcs|pc|nos|no|set|sets)?$/i);
      // Regex 3: Match "123 pcs Name" or "123 Name"
      const prefixMatch = segment.match(/^(\d+(?:\.\d+)?)\s*(?:pcs|pc|nos|no|set|sets)?\s+([a-zA-Z].*)$/i);

      let parsedName = segment;
      let parsedQty = 1;

      if (parenMatch) {
        parsedName = parenMatch[1].trim();
        parsedQty = parseFloat(parenMatch[2]) || 1;
      } else if (sepMatch) {
        parsedName = sepMatch[1].trim();
        parsedQty = parseFloat(sepMatch[2]) || 1;
      } else if (prefixMatch) {
        parsedQty = parseFloat(prefixMatch[1]) || 1;
        parsedName = prefixMatch[2].trim();
      } else {
        // If single segment and record has otherSparePartsQty > 0, prioritize that quantity
        if (segments.length === 1 && rawQty > 0) {
          parsedQty = rawQty;
        } else {
          parsedQty = 1;
        }
      }

      // Clean up string
      parsedName = parsedName.replace(/^[\s\-:;,]+|[\s\-:;,]+$/g, '').trim();

      if (parsedName) {
        items.push({
          id: `${record.id || rowIdx}-part-${segIdx}`,
          date,
          unit,
          floor,
          partName: parsedName,
          quantity: parsedQty,
          uom: 'pcs',
        });
      }
    });
  });

  return items;
}

export default function OtherSparePartsLedgerDrawer({
  ledger,
  filterState,
  activeDateDisplay,
}: OtherSparePartsLedgerDrawerProps) {
  // Maximize state (Pop-up modal dialog)
  const [isMaximized, setIsMaximized] = useState(false);

  // Pop-up Local Date Filter States (Matching the main Filter Panel settings)
  const [localDateFrom, setLocalDateFrom] = useState<string>('');
  const [localDateTo, setLocalDateTo] = useState<string>('');
  const [isFilterCustomized, setIsFilterCustomized] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'qty-desc' | 'name-asc'>('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = isMaximized ? 14 : 7;

  // Available ledger dates for date picker popover
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    ledger.forEach(r => {
      if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
        dates.add(r.date);
      }
    });
    return Array.from(dates).sort();
  }, [ledger]);

  const minAvailableDate = availableDates[0] || '2020-01-01';
  const maxAvailableDate = availableDates[availableDates.length - 1] || '2030-12-31';

  // Sync modal dates with filterState when opening
  useEffect(() => {
    if (isMaximized) {
      if (filterState) {
        setLocalDateFrom(filterState.dateFrom || (filterState.dateMode === 'single' ? filterState.singleDate : ''));
        setLocalDateTo(filterState.dateTo || (filterState.dateMode === 'single' ? filterState.singleDate : ''));
      }
      setIsFilterCustomized(false);
    }
  }, [isMaximized, filterState]);

  // Compute effective filter state
  const effectiveFilterState = useMemo<FilterState | undefined>(() => {
    if (!isMaximized || !isFilterCustomized) {
      return filterState;
    }

    // When user customizes the dates in the popup:
    let computedDateMode: 'single' | 'range' | 'month' | 'year' = 'range';
    if (localDateFrom && localDateTo) {
      computedDateMode = localDateFrom === localDateTo ? 'single' : 'range';
    } else if (localDateFrom || localDateTo) {
      computedDateMode = 'range';
    }

    return {
      unit: filterState?.unit || 'all',
      dateMode: computedDateMode,
      singleDate: localDateFrom && localDateTo && localDateFrom === localDateTo ? localDateFrom : (localDateFrom || localDateTo || ''),
      dateFrom: localDateFrom,
      dateTo: localDateTo,
      month: localDateFrom ? localDateFrom.substring(0, 7) : '',
      year: filterState?.year || 'all',
    };
  }, [filterState, isMaximized, isFilterCustomized, localDateFrom, localDateTo]);

  // Dynamic date banner display text
  const currentDisplayedDateText = useMemo(() => {
    if (!isMaximized || !isFilterCustomized) {
      return activeDateDisplay;
    }
    if (localDateFrom && localDateTo) {
      return localDateFrom === localDateTo 
        ? formatDateDisplay(localDateFrom)
        : `${formatDateDisplay(localDateFrom)} to ${formatDateDisplay(localDateTo)}`;
    }
    if (localDateFrom) return `From ${formatDateDisplay(localDateFrom)}`;
    if (localDateTo) return `To ${formatDateDisplay(localDateTo)}`;
    return 'All Dates';
  }, [isMaximized, isFilterCustomized, activeDateDisplay, localDateFrom, localDateTo]);

  // 1. Extract and parse all Spare Parts items from the filtered Production Ledger
  const sparePartsList = useMemo<SparePartItem[]>(() => {
    const { filteredRows } = filterLedgerByState(ledger, effectiveFilterState);
    const inHouseRows = filteredRows.filter(r => !isSubContactRecord(r));
    return parseSparePartsFromLedger(inHouseRows);
  }, [ledger, effectiveFilterState]);

  // 2. Summary KPI: Total Consumed (pcs)
  const totalPartsConsumed = useMemo(() => {
    return sparePartsList.reduce((sum, item) => sum + item.quantity, 0);
  }, [sparePartsList]);

  // 3. Category Distribution by Spare Part Name
  const partNameDistribution = useMemo(() => {
    const map = new Map<string, number>();
    sparePartsList.forEach(item => {
      const key = item.partName.trim() || 'Other Parts';
      map.set(key, (map.get(key) || 0) + item.quantity);
    });

    const entries = Array.from(map.entries()).map(([name, count]) => ({
      name,
      count,
      pct: totalPartsConsumed > 0 ? Math.round((count / totalPartsConsumed) * 100) : 0,
    }));

    return entries.sort((a, b) => b.count - a.count);
  }, [sparePartsList, totalPartsConsumed]);

  // 4. Top Replaced Item
  const topPartName = partNameDistribution.length > 0 ? partNameDistribution[0].name : 'None Logged';

  // 5. Filter & Sort Table Entries
  const filteredEntries = useMemo(() => {
    let result = [...sparePartsList];

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        item =>
          item.partName.toLowerCase().includes(q) ||
          item.unit.toLowerCase().includes(q) ||
          item.floor.toLowerCase().includes(q) ||
          item.date.toLowerCase().includes(q)
      );
    }

    // Unit filter
    if (selectedUnitFilter !== 'ALL') {
      result = result.filter(
        item =>
          item.unit.toUpperCase().includes(selectedUnitFilter) ||
          item.floor.toUpperCase().includes(selectedUnitFilter)
      );
    }

    // Sorting (Applied in Pop-up and Minimized)
    result.sort((a, b) => {
      if (sortBy === 'date-desc') return b.date.localeCompare(a.date);
      if (sortBy === 'date-asc') return a.date.localeCompare(b.date);
      if (sortBy === 'qty-desc') return b.quantity - a.quantity;
      if (sortBy === 'name-asc') return a.partName.localeCompare(b.partName);
      return 0;
    });

    return result;
  }, [sparePartsList, searchTerm, selectedUnitFilter, sortBy]);

  // 6. Pagination
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage) || 1;
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEntries.slice(start, start + itemsPerPage);
  }, [filteredEntries, currentPage, itemsPerPage]);

  const tagColors = [
    'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60',
    'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700/60',
    'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700/60',
    'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-700/60',
    'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700/60',
    'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-700/60',
  ];

  // Reusable Main Table Body JSX
  const renderTableContent = () => (
    <div className="overflow-x-auto flex-1">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 text-[11px] sticky top-0 z-10 shadow-2xs">
            <th className="py-2.5 px-4 whitespace-nowrap bg-slate-100 dark:bg-slate-800">Date</th>
            <th className="py-2.5 px-4 whitespace-nowrap bg-slate-100 dark:bg-slate-800">Floor / Unit</th>
            <th className="py-2.5 px-4 whitespace-nowrap bg-slate-100 dark:bg-slate-800">Spare Part Name</th>
            <th className="py-2.5 px-4 whitespace-nowrap text-right bg-slate-100 dark:bg-slate-800">QTY</th>
            <th className="py-2.5 px-4 whitespace-nowrap text-center bg-slate-100 dark:bg-slate-800">UOM</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {paginatedEntries.length > 0 ? (
            paginatedEntries.map((entry, idx) => (
              <tr
                key={`${entry.id}-${idx}`}
                className="hover:bg-amber-50/60 dark:hover:bg-amber-950/20 transition-colors"
              >
                {/* Date */}
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {formatDateDisplay(entry.date)}
                  </span>
                </td>

                {/* Floor / Unit */}
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100">
                    {entry.floor || entry.unit}
                  </span>
                </td>

                {/* Spare Part Name */}
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {entry.partName}
                    </span>
                  </div>
                </td>

                {/* QTY */}
                <td className="py-2.5 px-4 whitespace-nowrap text-right">
                  <span className="font-black text-xs text-slate-900 dark:text-slate-100">
                    {entry.quantity.toLocaleString()}
                  </span>
                </td>

                {/* UOM */}
                <td className="py-2.5 px-4 whitespace-nowrap text-center">
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                    {entry.uom || 'pcs'}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="py-8 px-4 text-center">
                <div className="flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
                  <Package className="w-8 h-8 opacity-40 text-amber-500" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    No Spare Parts Logged for this period.
                  </p>
                  <p className="text-[10.5px] text-slate-400 max-w-md">
                    When spare parts (e.g. <em>Nozel (65), Air Gun (20)</em>) are entered in the Production Ledger,
                    they will be parsed and displayed here automatically.
                  </p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      {/* ==================================================== */}
      {/* 1. MINIMIZED EMBEDDED VIEW (ON-PAGE STATIC CARD)     */}
      {/* ==================================================== */}
      <div className="w-full bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl shadow-xs overflow-hidden mt-5 transition-all">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-[#2C3E50] via-[#34495E] to-[#2B1D14] text-white px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-400">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Spare Parts Section
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-900 shadow-2xs">
                  {totalPartsConsumed} pcs Total
                </span>
              </div>
              <p className="text-[10.5px] text-slate-300">
                Filtered by: <span className="font-semibold text-amber-300">{activeDateDisplay}</span>
              </p>
            </div>
          </div>

          {/* Maximize Button to open Pop-up */}
          <button
            onClick={() => setIsMaximized(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-all shadow-xs cursor-pointer"
            title="Maximize / Open full pop-up view with Date Range Filter & Sorting"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Maximize</span>
          </button>
        </div>

        {/* 3 KPI Summary Cards */}
        <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Total Consumed</span>
              <span className="text-xl font-black text-slate-800 dark:text-slate-100">
                {totalPartsConsumed.toLocaleString()} <span className="text-xs font-bold text-slate-400">pcs</span>
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Package className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Unique Part Types</span>
              <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                {partNameDistribution.length} <span className="text-xs font-bold text-slate-400">categories</span>
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Tag className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between">
            <div className="overflow-hidden">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Top Replaced Item</span>
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 truncate block">
                {topPartName}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Category Breakdown Badges */}
        {partNameDistribution.length > 0 && (
          <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
                Spare Part Category Distribution:
              </span>
              <span className="text-[10.5px] font-medium text-slate-400">
                {partNameDistribution.length} distinct item types
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 items-center">
              {partNameDistribution.map((item, idx) => (
                <div
                  key={item.name}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10.5px] font-bold border transition-all cursor-pointer hover:brightness-95 shadow-2xs ${
                    tagColors[idx % tagColors.length]
                  }`}
                  onClick={() => setSearchTerm(item.name)}
                  title={`Click to filter table by ${item.name}`}
                >
                  <span>{item.name}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 text-[9.5px]">
                    {item.count} pcs ({item.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Minimized Toolbar (NO SORT DROPDOWN as requested) */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search spare part name, floor, or date..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs">
              <Filter className="w-3 h-3 text-slate-400" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Floor/Unit:</span>
              <select
                value={selectedUnitFilter}
                onChange={e => {
                  setSelectedUnitFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Units</option>
                <option value="EKL">EKL</option>
                <option value="EFL">EFL</option>
                <option value="EFL-2">EFL-2</option>
                <option value="AUTO">Auto-Stripe</option>
                <option value="EXTENSION">Extension</option>
                <option value="ESL">ESL-Extension</option>
              </select>
            </div>

            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedUnitFilter('ALL');
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {renderTableContent()}

        {/* Pagination Footer */}
        {filteredEntries.length > itemsPerPage && (
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredEntries.length)} of{' '}
              {filteredEntries.length} entries
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 2. MAXIMIZED POP-UP MODAL DIALOG                      */}
      {/* ==================================================== */}
      {isMaximized && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-5 animate-fade-in">
          <div className="w-full max-w-6xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-scale-in">
            
            {/* Pop-up Header */}
            <div className="bg-gradient-to-r from-[#2C3E50] via-[#34495E] to-[#2B1D14] text-white px-5 py-3.5 flex items-center justify-between gap-3 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                      Spare Parts Consumption Ledger
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-400 text-slate-900 shadow-2xs">
                      {totalPartsConsumed} pcs Total
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Active Period: <span className="font-semibold text-amber-300">{currentDisplayedDateText}</span>
                  </p>
                </div>
              </div>

              {/* Minimize / Close Pop-up Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMaximized(false)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-all shadow-xs cursor-pointer"
                  title="Minimize Pop-up"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span>Minimize</span>
                </button>
                <button
                  onClick={() => setIsMaximized(false)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  title="Close Pop-up"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* DEDICATED DATE FILTER BAR (EXACT DESIGN AS PHOTO & DASHBOARD FILTER PANEL) */}
            <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 p-3 sm:p-4 shrink-0">
              <div className="flex flex-wrap items-end gap-3.5">
                
                {/* 1. FROM DATE (As in Photo 1) */}
                <div className="w-full sm:w-[170px] lg:w-[190px] space-y-1.5 relative shrink-0">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 tracking-wide flex items-center gap-1.5 uppercase">
                    <span>📅</span>
                    <span className="text-blue-900 dark:text-blue-400 font-extrabold">FROM DATE</span>
                  </label>
                  <LedgerCalendarDatePicker
                    id="modal-spare-parts-from-date"
                    value={localDateFrom}
                    onChange={(val) => {
                      setLocalDateFrom(val);
                      setIsFilterCustomized(true);
                      setCurrentPage(1);
                    }}
                    allowedDates={availableDates}
                    maxDate={localDateTo || maxAvailableDate}
                    placeholder="Select From Date"
                  />
                </div>

                {/* 2. TO DATE (As in Photo 1) */}
                <div className="w-full sm:w-[170px] lg:w-[190px] space-y-1.5 relative shrink-0">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 tracking-wide flex items-center gap-1.5 uppercase">
                    <span>📅</span>
                    <span className="text-blue-900 dark:text-blue-400 font-extrabold">TO DATE</span>
                  </label>
                  <LedgerCalendarDatePicker
                    id="modal-spare-parts-to-date"
                    value={localDateTo}
                    onChange={(val) => {
                      setLocalDateTo(val);
                      setIsFilterCustomized(true);
                      setCurrentPage(1);
                    }}
                    allowedDates={availableDates}
                    minDate={localDateFrom || minAvailableDate}
                    maxDate={maxAvailableDate}
                    placeholder="Select To Date"
                  />
                </div>

                {/* Filter Action Buttons */}
                <div className="flex items-center gap-2 self-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFilterCustomized(true);
                      setCurrentPage(1);
                    }}
                    className="rounded-md bg-[#0B4D8C] hover:bg-[#093e70] dark:bg-blue-600 dark:hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span>Apply Criteria</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLocalDateFrom('');
                      setLocalDateTo('');
                      setIsFilterCustomized(true);
                      setCurrentPage(1);
                    }}
                    className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    All Dates
                  </button>

                  {isFilterCustomized && (
                    <button
                      type="button"
                      onClick={() => {
                        if (filterState) {
                          setLocalDateFrom(filterState.dateFrom || (filterState.dateMode === 'single' ? filterState.singleDate : ''));
                          setLocalDateTo(filterState.dateTo || (filterState.dateMode === 'single' ? filterState.singleDate : ''));
                        }
                        setIsFilterCustomized(false);
                        setCurrentPage(1);
                      }}
                      className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition cursor-pointer"
                      title="Sync dates with Dashboard filter"
                    >
                      Sync with Dashboard
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Maximized Analytics Summary (3 Cards) */}
            <div className="p-3.5 bg-slate-100/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 block">Total Consumed</span>
                  <span className="text-lg font-black text-slate-800 dark:text-slate-100">
                    {totalPartsConsumed.toLocaleString()} <span className="text-xs font-bold text-slate-400">pcs</span>
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Package className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 block">Unique Part Types</span>
                  <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                    {partNameDistribution.length} <span className="text-xs font-bold text-slate-400">categories</span>
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Tag className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between">
                <div className="overflow-hidden">
                  <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 block">Top Replaced Item</span>
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 truncate block">
                    {topPartName}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Category Badges */}
            {partNameDistribution.length > 0 && (
              <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 mr-1">Categories:</span>
                  {partNameDistribution.map((item, idx) => (
                    <div
                      key={item.name}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer hover:brightness-95 ${
                        tagColors[idx % tagColors.length]
                      }`}
                      onClick={() => setSearchTerm(item.name)}
                      title={`Click to filter table by ${item.name}`}
                    >
                      <span>{item.name}</span>
                      <span className="px-1 py-0.2 rounded-full bg-black/10 dark:bg-white/10 text-[9px]">
                        {item.count} pcs
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* POP-UP TOOLBAR: INCLUDES SORT FILTER DROPDOWN (As in Photo 2) */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search spare part name, floor, or date..."
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Unit Filter */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs">
                  <Filter className="w-3 h-3 text-slate-400" />
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Unit:</span>
                  <select
                    value={selectedUnitFilter}
                    onChange={e => {
                      setSelectedUnitFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Units</option>
                    <option value="EKL">EKL</option>
                    <option value="EFL">EFL</option>
                    <option value="EFL-2">EFL-2</option>
                    <option value="AUTO">Auto-Stripe</option>
                    <option value="EXTENSION">Extension</option>
                    <option value="ESL">ESL-Extension</option>
                  </select>
                </div>

                {/* SORT FILTER DROPDOWN (As in Photo 2) */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs shadow-2xs">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="bg-transparent text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="date-desc">Date (Newest First)</option>
                    <option value="date-asc">Date (Oldest First)</option>
                    <option value="qty-desc">QTY (High to Low)</option>
                    <option value="name-asc">Spare Part Name (A-Z)</option>
                  </select>
                </div>

                {/* Reset Filters */}
                {(searchTerm || selectedUnitFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedUnitFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Pop-up Table Content */}
            <div className="overflow-y-auto flex-1">
              {renderTableContent()}
            </div>

            {/* Pop-up Pagination Footer */}
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs shrink-0">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filteredEntries.length)} of{' '}
                {filteredEntries.length} entries
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-40 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-40 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
