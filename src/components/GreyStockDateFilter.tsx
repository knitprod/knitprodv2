import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Check, 
  Filter, 
  Clock, 
  CalendarDays,
  CalendarRange,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';

export interface DateFilterState {
  mode: 'all' | 'month' | 'date' | 'range';
  selectedDate: string; // 'YYYY-MM-DD'
  selectedMonth: string; // 'YYYY-MM'
  startDate?: string; // 'YYYY-MM-DD'
  endDate?: string; // 'YYYY-MM-DD'
  label: string; // human readable (e.g. 'Oct 2024', '24-Oct-2024', or '01-Oct → 24-Oct-2024')
}

export interface MonthOption {
  yearMonth: string; // '2024-10'
  label: string; // 'Oct 2024'
  count: number;
}

interface GreyStockDateFilterProps {
  value: DateFilterState;
  onChange: (filter: DateFilterState) => void;
  availableDates?: string[]; // array of ISO YYYY-MM-DD dates that exist in current records
  availableMonths?: MonthOption[];
  className?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAYS_HEADER = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDateLabel(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateRangeLabel(startIso: string, endIso: string): string {
  if (!startIso && !endIso) return '';
  if (startIso && !endIso) return `From ${formatDateLabel(startIso)}`;
  if (!startIso && endIso) return `Until ${formatDateLabel(endIso)}`;
  return `${formatDateLabel(startIso)} → ${formatDateLabel(endIso)}`;
}

export default function GreyStockDateFilter({
  value,
  onChange,
  availableDates = [],
  availableMonths = [],
  className = ''
}: GreyStockDateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'month' | 'single' | 'range'>(() => {
    if (value.mode === 'range') return 'range';
    if (value.mode === 'date') return 'single';
    return 'month';
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Range state for Range tab
  const [rangeStart, setRangeStart] = useState<string>(() => value.startDate || '');
  const [rangeEnd, setRangeEnd] = useState<string>(() => value.endDate || '');
  const [hoverDate, setHoverDate] = useState<string>('');

  // Sync internal range when value changes
  useEffect(() => {
    if (value.mode === 'range') {
      setRangeStart(value.startDate || '');
      setRangeEnd(value.endDate || '');
      setActiveTab('range');
    } else if (value.mode === 'date') {
      setActiveTab('single');
    } else if (value.mode === 'month') {
      setActiveTab('month');
    }
  }, [value]);

  // Calendar view year and month (0-indexed)
  const [viewYear, setViewYear] = useState<number>(() => {
    const candidate = value.selectedDate || value.startDate || value.selectedMonth;
    if (candidate) {
      const y = parseInt(candidate.slice(0, 4), 10);
      if (!isNaN(y)) return y;
    }
    if (availableMonths.length > 0) {
      const y = parseInt(availableMonths[0].yearMonth.slice(0, 4), 10);
      if (!isNaN(y)) return y;
    }
    return new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    const candidate = value.selectedDate || value.startDate || value.selectedMonth;
    if (candidate && candidate.length >= 7) {
      const m = parseInt(candidate.slice(5, 7), 10) - 1;
      if (!isNaN(m)) return m;
    }
    if (availableMonths.length > 0) {
      const m = parseInt(availableMonths[0].yearMonth.slice(5, 7), 10) - 1;
      if (!isNaN(m)) return m;
    }
    return new Date().getMonth();
  });

  // Keep view in sync when value changes
  useEffect(() => {
    const candidate = value.selectedDate || value.startDate || value.selectedMonth;
    if (candidate) {
      const y = parseInt(candidate.slice(0, 4), 10);
      const m = candidate.length >= 7 ? parseInt(candidate.slice(5, 7), 10) - 1 : NaN;
      if (!isNaN(y)) setViewYear(y);
      if (!isNaN(m)) setViewMonth(m);
    }
  }, [value.selectedDate, value.startDate, value.selectedMonth]);

  // Handle click outside to close popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set of dates with orders for quick lookup
  const dateSet = useMemo(() => new Set(availableDates), [availableDates]);

  // Calendar day calculation for the current viewMonth & viewYear
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const cells: {
      day: number;
      monthOffset: -1 | 0 | 1;
      dateStr: string;
      hasData: boolean;
      isSelected: boolean;
      isRangeStart: boolean;
      isRangeEnd: boolean;
      isInRange: boolean;
      isToday: boolean;
    }[] = [];

    const todayStr = new Date().toISOString().slice(0, 10);

    // Prev month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const isSelected = activeTab === 'single' && value.mode === 'date' && value.selectedDate === dateStr;
      const isRangeStart = activeTab === 'range' && rangeStart === dateStr;
      const isRangeEnd = activeTab === 'range' && rangeEnd === dateStr;
      const isInRange = activeTab === 'range' && !!rangeStart && !!rangeEnd && dateStr > rangeStart && dateStr < rangeEnd;

      cells.push({
        day,
        monthOffset: -1,
        dateStr,
        hasData: dateSet.has(dateStr),
        isSelected,
        isRangeStart,
        isRangeEnd,
        isInRange,
        isToday: dateStr === todayStr
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const isSelected = activeTab === 'single' && value.mode === 'date' && value.selectedDate === dateStr;
      const isRangeStart = activeTab === 'range' && rangeStart === dateStr;
      const isRangeEnd = activeTab === 'range' && rangeEnd === dateStr;
      const isInRange = activeTab === 'range' && !!rangeStart && !!rangeEnd && dateStr > rangeStart && dateStr < rangeEnd;

      cells.push({
        day,
        monthOffset: 0,
        dateStr,
        hasData: dateSet.has(dateStr),
        isSelected,
        isRangeStart,
        isRangeEnd,
        isInRange,
        isToday: dateStr === todayStr
      });
    }

    // Next month padding to fill complete weeks (up to 35 or 42 cells)
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const isSelected = activeTab === 'single' && value.mode === 'date' && value.selectedDate === dateStr;
      const isRangeStart = activeTab === 'range' && rangeStart === dateStr;
      const isRangeEnd = activeTab === 'range' && rangeEnd === dateStr;
      const isInRange = activeTab === 'range' && !!rangeStart && !!rangeEnd && dateStr > rangeStart && dateStr < rangeEnd;

      cells.push({
        day,
        monthOffset: 1,
        dateStr,
        hasData: dateSet.has(dateStr),
        isSelected,
        isRangeStart,
        isRangeEnd,
        isInRange,
        isToday: dateStr === todayStr
      });
    }

    return cells;
  }, [viewYear, viewMonth, dateSet, value, activeTab, rangeStart, rangeEnd]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // Select a single day
  const handleSelectDay = (dateStr: string) => {
    if (activeTab === 'range') {
      handleRangeDayClick(dateStr);
      return;
    }
    const label = formatDateLabel(dateStr);
    onChange({
      mode: 'date',
      selectedDate: dateStr,
      selectedMonth: '',
      startDate: '',
      endDate: '',
      label
    });
    setIsOpen(false);
  };

  // Date Range Click Logic
  const handleRangeDayClick = (dateStr: string) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      // First click: sets start date
      setRangeStart(dateStr);
      setRangeEnd('');
    } else {
      // Second click: sets end date
      let s = rangeStart;
      let e = dateStr;
      if (e < s) {
        // Swap if end is earlier than start
        const temp = s;
        s = e;
        e = temp;
      }
      setRangeStart(s);
      setRangeEnd(e);
      const label = formatDateRangeLabel(s, e);
      onChange({
        mode: 'range',
        selectedDate: '',
        selectedMonth: '',
        startDate: s,
        endDate: e,
        label
      });
      setIsOpen(false);
    }
  };

  const handleApplyRange = () => {
    if (!rangeStart && !rangeEnd) return;
    let s = rangeStart || rangeEnd;
    let e = rangeEnd || rangeStart;
    if (e < s) {
      const temp = s;
      s = e;
      e = temp;
    }
    const label = formatDateRangeLabel(s, e);
    onChange({
      mode: 'range',
      selectedDate: '',
      selectedMonth: '',
      startDate: s,
      endDate: e,
      label
    });
    setIsOpen(false);
  };

  // Presets for Range
  const handlePresetRange = (days: number) => {
    const today = new Date();
    const endStr = today.toISOString().slice(0, 10);
    const startObj = new Date(today.getTime() - (days - 1) * 86400 * 1000);
    const startStr = startObj.toISOString().slice(0, 10);
    setRangeStart(startStr);
    setRangeEnd(endStr);
    const label = formatDateRangeLabel(startStr, endStr);
    onChange({
      mode: 'range',
      selectedDate: '',
      selectedMonth: '',
      startDate: startStr,
      endDate: endStr,
      label
    });
    setIsOpen(false);
  };

  const handlePresetThisMonth = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const startStr = `${y}-${m}-01`;
    const lastDay = new Date(y, today.getMonth() + 1, 0).getDate();
    const endStr = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    setRangeStart(startStr);
    setRangeEnd(endStr);
    const label = formatDateRangeLabel(startStr, endStr);
    onChange({
      mode: 'range',
      selectedDate: '',
      selectedMonth: '',
      startDate: startStr,
      endDate: endStr,
      label
    });
    setIsOpen(false);
  };

  const handlePresetAllAvailable = () => {
    if (availableDates.length === 0) return;
    const sorted = [...availableDates].sort();
    const startStr = sorted[0];
    const endStr = sorted[sorted.length - 1];
    setRangeStart(startStr);
    setRangeEnd(endStr);
    const label = formatDateRangeLabel(startStr, endStr);
    onChange({
      mode: 'range',
      selectedDate: '',
      selectedMonth: '',
      startDate: startStr,
      endDate: endStr,
      label
    });
    setIsOpen(false);
  };

  // Month-wise handlers
  const handleSelectMonth = (yearMonth: string, label: string) => {
    onChange({
      mode: 'month',
      selectedDate: '',
      selectedMonth: yearMonth,
      startDate: '',
      endDate: '',
      label
    });
    setIsOpen(false);
  };

  const handleSelectMonthGrid = (monthIdx: number) => {
    const yearMonth = `${viewYear}-${String(monthIdx + 1).padStart(2, '0')}`;
    const label = `${MONTH_SHORT[monthIdx]} ${viewYear}`;
    handleSelectMonth(yearMonth, label);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRangeStart('');
    setRangeEnd('');
    onChange({
      mode: 'all',
      selectedDate: '',
      selectedMonth: '',
      startDate: '',
      endDate: '',
      label: ''
    });
  };

  const isFiltered = value.mode !== 'all';

  const displayButtonText = useMemo(() => {
    if (value.mode === 'range' && value.label) {
      return `Range: ${value.label}`;
    }
    if (value.mode === 'date' && value.label) {
      return `Date: ${value.label}`;
    }
    if (value.mode === 'month' && value.label) {
      return `Month: ${value.label}`;
    }
    return 'Completion Date: All';
  }, [value]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full min-h-[42px] sm:min-h-[38px] flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer select-none shadow-2xs ${
          isFiltered
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-slate-400'
        }`}
        title="Filter by completion calendar date, month, or date range"
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon className={`w-3.5 h-3.5 shrink-0 ${isFiltered ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
          <span className="truncate text-left text-xs font-bold">
            {displayButtonText}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isFiltered && (
            <span
              onClick={handleClear}
              className="p-1 rounded-full bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/60 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-200 shrink-0 transition-colors cursor-pointer"
              title="Clear date filter"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {/* Floating Popover Filter */}
      {isOpen && (
        <div className="absolute right-0 left-auto mt-2 z-50 w-[340px] sm:w-[380px] max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header & Tabs */}
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Completion Date Filter
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-Tabs: Month-wise vs Single Date vs Date Range */}
            <div className="grid grid-cols-3 gap-1 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('month')}
                className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'month'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="truncate">Month-wise</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('single')}
                className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'single'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="truncate">Single Date</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('range')}
                className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'range'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span className="truncate">Date Range</span>
              </button>
            </div>
          </div>

          {/* TAB 1: MONTH-WISE FILTER SYSTEM */}
          {activeTab === 'month' && (
            <div className="p-3.5 space-y-3.5 max-h-[380px] overflow-y-auto">
              {/* Show All Months button */}
              <button
                type="button"
                onClick={() => {
                  handleClear();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  value.mode === 'all'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${value.mode === 'all' ? 'bg-blue-600' : 'bg-slate-400'}`} />
                  <span>Show All Months (Full History)</span>
                </div>
                {value.mode === 'all' && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              </button>

              {/* Detected Months from current records */}
              {availableMonths.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Months with Orders in Stock</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {availableMonths.map(m => {
                      const isActive = value.mode === 'month' && value.selectedMonth === m.yearMonth;
                      return (
                        <button
                          key={m.yearMonth}
                          type="button"
                          onClick={() => handleSelectMonth(m.yearMonth, m.label)}
                          className={`flex items-center justify-between p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            isActive
                              ? 'border-blue-500 bg-blue-600 text-white shadow-xs'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-750 hover:border-blue-300'
                          }`}
                        >
                          <span className="truncate">{m.label}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                            isActive 
                              ? 'bg-blue-700 text-white' 
                              : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                          }`}>
                            {m.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Interactive Year & 12-Month Matrix */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Pick Year & Month
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setViewYear(y => y - 1)}
                      className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                      title="Previous Year"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono font-black text-xs px-2 text-slate-800 dark:text-slate-200">
                      {viewYear}
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewYear(y => y + 1)}
                      className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                      title="Next Year"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {MONTH_SHORT.map((mShort, idx) => {
                    const ym = `${viewYear}-${String(idx + 1).padStart(2, '0')}`;
                    const isActive = value.mode === 'month' && value.selectedMonth === ym;
                    const monthMeta = availableMonths.find(m => m.yearMonth === ym);

                    return (
                      <button
                        key={mShort}
                        type="button"
                        onClick={() => handleSelectMonthGrid(idx)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold text-center transition-all cursor-pointer relative ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-xs font-black ring-2 ring-blue-500/30'
                            : monthMeta
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 hover:bg-blue-100 font-extrabold'
                            : 'bg-slate-100/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <div>{mShort}</div>
                        {monthMeta && !isActive && (
                          <span className="absolute bottom-0.5 right-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE CALENDAR SINGLE DATE */}
          {activeTab === 'single' && (
            <div className="p-3.5 space-y-3">
              {/* Month & Year Navigation Header */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span>{MONTH_NAMES[viewMonth]}</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">{viewYear}</span>
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day Headers (Su, Mo, Tu, ...) */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                {DAYS_HEADER.map(dh => (
                  <div key={dh} className="py-1">
                    {dh}
                  </div>
                ))}
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, idx) => {
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectDay(cell.dateStr)}
                      className={`h-8 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                        cell.isSelected
                          ? 'bg-blue-600 text-white font-black shadow-xs ring-2 ring-blue-500/30'
                          : cell.monthOffset !== 0
                          ? 'text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                          : cell.hasData
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-extrabold border border-emerald-200/80 dark:border-emerald-800 hover:bg-emerald-100'
                          : cell.isToday
                          ? 'border border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-slate-100'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title={cell.dateStr + (cell.hasData ? ' (Orders in stock)' : '')}
                    >
                      <span>{cell.day}</span>
                      {cell.hasData && !cell.isSelected && (
                        <span className="w-1 h-1 rounded-full bg-emerald-500 -mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quick Today & Native Date Input */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    handleSelectDay(todayStr);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Select Today
                </button>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Direct input:</span>
                  <input
                    type="date"
                    value={value.mode === 'date' ? value.selectedDate : ''}
                    onChange={e => {
                      if (e.target.value) {
                        handleSelectDay(e.target.value);
                      }
                    }}
                    className="text-[11px] font-mono px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DATE RANGE SELECTION */}
          {activeTab === 'range' && (
            <div className="p-3.5 space-y-3">
              {/* Range Instruction / Indicator */}
              <div className="flex items-center justify-between bg-blue-50/70 dark:bg-blue-950/40 p-2 rounded-xl border border-blue-200/80 dark:border-blue-900/60 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="font-bold text-blue-800 dark:text-blue-200">
                    {!rangeStart 
                      ? '1. Click start date on calendar' 
                      : !rangeEnd 
                      ? '2. Click end date on calendar' 
                      : 'Range selected'}
                  </span>
                </div>
                {rangeStart && (
                  <button
                    type="button"
                    onClick={() => {
                      setRangeStart('');
                      setRangeEnd('');
                    }}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                  >
                    Reset Range
                  </button>
                )}
              </div>

              {/* Quick Presets Pills */}
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => handlePresetRange(7)}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Last 7D
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetRange(14)}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Last 14D
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetRange(30)}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Last 30D
                </button>
                <button
                  type="button"
                  onClick={handlePresetThisMonth}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  This Month
                </button>
                {availableDates.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePresetAllAvailable}
                    className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/80 dark:border-emerald-800 cursor-pointer"
                    title="Span across earliest to latest available completion date"
                  >
                    All Available
                  </button>
                )}
              </div>

              {/* Month & Year Navigation Header */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span>{MONTH_NAMES[viewMonth]}</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">{viewYear}</span>
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                {DAYS_HEADER.map(dh => (
                  <div key={dh} className="py-1">
                    {dh}
                  </div>
                ))}
              </div>

              {/* Day Cells Grid with Range Band Highlighting */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, idx) => {
                  const isCap = cell.isRangeStart || cell.isRangeEnd;
                  const isMid = cell.isInRange;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleRangeDayClick(cell.dateStr)}
                      className={`h-8 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                        isCap
                          ? 'bg-blue-600 text-white font-black shadow-xs ring-2 ring-blue-500/30'
                          : isMid
                          ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200 font-bold border-y border-blue-200/60 dark:border-blue-800/60'
                          : cell.monthOffset !== 0
                          ? 'text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                          : cell.hasData
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-extrabold border border-emerald-200/80 dark:border-emerald-800 hover:bg-emerald-100'
                          : cell.isToday
                          ? 'border border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-slate-100'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title={cell.dateStr + (cell.hasData ? ' (Orders in stock)' : '')}
                    >
                      <span>{cell.day}</span>
                      {cell.hasData && !isCap && (
                        <span className="w-1 h-1 rounded-full bg-emerald-500 -mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Direct From and To Date Inputs */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">From Date:</span>
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={e => setRangeStart(e.target.value)}
                    className="w-full text-[11px] font-mono px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">To Date:</span>
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={e => setRangeEnd(e.target.value)}
                    className="w-full text-[11px] font-mono px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            {isFiltered ? (
              <button
                type="button"
                onClick={() => {
                  handleClear();
                  setIsOpen(false);
                }}
                className="text-rose-600 dark:text-rose-400 hover:underline font-bold cursor-pointer"
              >
                Clear Filter
              </button>
            ) : (
              <span className="text-slate-400 text-[11px]">All dates included</span>
            )}

            <div className="flex items-center gap-2">
              {activeTab === 'range' && (rangeStart || rangeEnd) && (
                <button
                  type="button"
                  onClick={handleApplyRange}
                  className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-xs"
                >
                  Apply Range
                </button>
              )}
              {activeTab !== 'range' && (
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
