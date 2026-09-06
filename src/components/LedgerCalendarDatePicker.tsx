import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock, Check } from 'lucide-react';

interface LedgerCalendarDatePickerProps {
  id?: string;
  label?: string;
  value: string; // YYYY-MM-DD or empty
  onChange: (date: string) => void;
  allowedDates?: string[]; // Array of YYYY-MM-DD dates that exist in the ledger
  restrictToAllowedDates?: boolean; // If true, only allowedDates can be selected. Defaults to false.
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  align?: 'left' | 'right' | 'auto';
}

export const LedgerCalendarDatePicker: React.FC<LedgerCalendarDatePickerProps> = ({
  id,
  label,
  value,
  onChange,
  allowedDates = [],
  restrictToAllowedDates = false,
  minDate,
  maxDate,
  placeholder = 'Select Date',
  className = '',
  buttonClassName = '',
  align = 'auto',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  // Position coordinates for desktop/tablet portal floating popover
  const [coords, setCoords] = useState<{ top: number; left: number; isUpward: boolean }>({
    top: 0,
    left: 0,
    isUpward: false,
  });
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });

  // Calculate popover coordinates on open or resize/scroll
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const isSmallScreen = window.innerWidth < 640;
    setIsMobile(isSmallScreen);

    if (isSmallScreen) return;

    const popoverWidth = 310;
    const popoverHeight = 350;

    let left = rect.left;
    if (align === 'right' || rect.right > window.innerWidth - 60) {
      left = rect.right - popoverWidth;
    }
    // Clamp horizontally to avoid viewport overflow
    left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 16));

    // Vertical positioning: decide whether to open above or below
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldOpenAbove = spaceBelow < popoverHeight && spaceAbove >= popoverHeight;

    const top = shouldOpenAbove ? Math.max(8, rect.top - popoverHeight - 6) : rect.bottom + 6;

    setCoords({
      top,
      left,
      isUpward: shouldOpenAbove,
    });
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleResizeOrScroll = () => updatePosition();
      window.addEventListener('resize', handleResizeOrScroll);
      window.addEventListener('scroll', handleResizeOrScroll, true);
      return () => {
        window.removeEventListener('resize', handleResizeOrScroll);
        window.removeEventListener('scroll', handleResizeOrScroll, true);
      };
    }
  }, [isOpen]);

  // Set the view month/year based on current value, latest allowed date, or today
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (value) {
      const parts = value.split('-').map(Number);
      if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    if (allowedDates.length > 0) {
      const latest = allowedDates[allowedDates.length - 1];
      const parts = latest.split('-').map(Number);
      if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date();
  });

  // When value changes from outside, sync viewDate
  useEffect(() => {
    if (value) {
      const parts = value.split('-').map(Number);
      if (parts.length === 3) {
        setViewDate(new Date(parts[0], parts[1] - 1, parts[2]));
      }
    }
  }, [value]);

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth(); // 0-11

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const monthNamesShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const prevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleMonthChange = (newMonth: number) => {
    setViewDate(new Date(viewYear, newMonth, 1));
  };

  const handleYearChange = (newYear: number) => {
    setViewDate(new Date(newYear, viewMonth, 1));
  };

  // Generate list of available years for quick year selector (+/- 5 years)
  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear();
    const startY = Math.min(viewYear - 4, currentY - 5);
    const endY = Math.max(viewYear + 4, currentY + 3);
    const yrs: number[] = [];
    for (let y = startY; y <= endY; y++) {
      yrs.push(y);
    }
    return yrs;
  }, [viewYear]);

  // Generate calendar days for current viewMonth including previous & next month padding
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const days: {
      day: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isAllowed: boolean;
      hasLedgerEntry: boolean;
      isSelected: boolean;
      isToday: boolean;
      isTargetMonth: 'prev' | 'curr' | 'next';
    }[] = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasLedgerEntry = allowedDates.includes(dateStr);
      const isAllowed = !restrictToAllowedDates || allowedDates.length === 0 || hasLedgerEntry;

      days.push({
        day: d,
        dateStr,
        isCurrentMonth: false,
        isAllowed,
        hasLedgerEntry,
        isSelected: value === dateStr,
        isToday: false,
        isTargetMonth: 'prev',
      });
    }

    // Current month days
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const hasLedgerEntry = allowedDates.includes(dateStr);
      const isAllowed = !restrictToAllowedDates || allowedDates.length === 0 || hasLedgerEntry;

      days.push({
        day: i,
        dateStr,
        isCurrentMonth: true,
        isAllowed,
        hasLedgerEntry,
        isSelected: value === dateStr,
        isToday: dateStr === todayStr,
        isTargetMonth: 'curr',
      });
    }

    // Next month padding days to complete full 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const hasLedgerEntry = allowedDates.includes(dateStr);
      const isAllowed = !restrictToAllowedDates || allowedDates.length === 0 || hasLedgerEntry;

      days.push({
        day: i,
        dateStr,
        isCurrentMonth: false,
        isAllowed,
        hasLedgerEntry,
        isSelected: value === dateStr,
        isToday: false,
        isTargetMonth: 'next',
      });
    }

    return days;
  }, [viewYear, viewMonth, allowedDates, restrictToAllowedDates, value]);

  // Format value for display: YYYY-MM-DD -> "11 Aug, 2026"
  const formattedDisplay = useMemo(() => {
    if (!value) return '';
    const parts = value.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${String(day).padStart(2, '0')} ${monthsShort[monthIdx]}, ${year}`;
      }
    }
    return value;
  }, [value]);

  const handleSelectDate = (dateStr: string, isTargetMonth: 'prev' | 'curr' | 'next') => {
    onChange(dateStr);
    if (isTargetMonth === 'prev') {
      prevMonth();
    } else if (isTargetMonth === 'next') {
      nextMonth();
    }
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    onChange(todayStr);
    setViewDate(today);
    setIsOpen(false);
  };

  const handleSelectYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    onChange(yStr);
    setViewDate(d);
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  // Open native OS date picker if supported/clicked
  const triggerNativePicker = () => {
    if (nativeInputRef.current) {
      if ('showPicker' in HTMLInputElement.prototype) {
        try {
          nativeInputRef.current.showPicker();
          return;
        } catch (err) {
          // Fallback to custom picker if showPicker fails
        }
      }
    }
    setIsOpen(prev => !prev);
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between mb-1">
          <span className="flex items-center gap-1">
            <span>📅</span> {label}
          </span>
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[9px] text-red-500 hover:text-red-600 dark:text-red-400 font-bold hover:underline cursor-pointer"
              title={`Clear ${label}`}
            >
              Clear
            </button>
          )}
        </label>
      )}

      {/* Hidden Native Input to support system wheel date-picker on devices */}
      <input
        ref={nativeInputRef}
        type="date"
        value={value}
        min={minDate}
        max={maxDate}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(false);
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Main Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        className={`w-full flex items-center justify-between rounded-lg border bg-white dark:bg-slate-800 px-2.5 py-1.5 sm:py-2 text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
          isOpen
            ? 'border-[#0F4C81] ring-2 ring-[#0F4C81]/25 dark:border-sky-500 dark:ring-sky-500/25'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
        } ${value ? 'text-slate-900 dark:text-slate-100 font-bold' : 'text-slate-400 dark:text-slate-500'} ${buttonClassName}`}
      >
        <span className="truncate">{formattedDisplay || placeholder}</span>
        <div className="flex items-center gap-1 ml-1 shrink-0">
          {value && (
            <span
              onClick={handleClear}
              className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-red-500 transition-colors"
              title="Clear date"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <CalendarIcon className="h-3.5 w-3.5 text-[#0F4C81] dark:text-sky-400" />
        </div>
      </button>

      {/* Portal Calendar Rendering: Immune to parent overflow clipping on any device */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        isMobile ? (
          /* Mobile Full Centered Modal Dialog */
          <div 
            className="fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setIsOpen(false)}
          >
            <div 
              ref={popoverRef}
              className="w-full max-w-[325px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-2xl animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Title with Native Picker shortcut */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
                  <span>{label || 'Select Date'}</span>
                </span>
                <button
                  type="button"
                  onClick={triggerNativePicker}
                  className="text-[10px] font-bold text-blue-600 dark:text-sky-400 hover:underline px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/50 rounded"
                  title="Open device native picker"
                >
                  System Picker
                </button>
              </div>

              {/* Month & Year Navigator */}
              <div className="flex items-center justify-between gap-1 mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
                  title="Previous Month"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-1.5">
                  <select
                    value={viewMonth}
                    onChange={(e) => handleMonthChange(Number(e.target.value))}
                    className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 cursor-pointer focus:outline-hidden"
                  >
                    {monthNames.map((m, idx) => (
                      <option key={m} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={viewYear}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                    className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 cursor-pointer focus:outline-hidden"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
                  title="Next Month"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Weekday Labels */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                {daysOfWeek.map((day, idx) => (
                  <span
                    key={day}
                    className={`text-[11px] font-bold uppercase ${
                      idx === 0 || idx === 6
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {day}
                  </span>
                ))}
              </div>

              {/* Calendar Days Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {calendarDays.map((cell, idx) => {
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!cell.isAllowed}
                      onClick={() => handleSelectDate(cell.dateStr, cell.isTargetMonth)}
                      className={`h-9 w-full flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                        cell.isSelected
                          ? 'bg-[#0F4C81] text-white shadow-md'
                          : cell.isCurrentMonth
                            ? 'text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-[#0F4C81]'
                            : 'text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      } ${cell.isToday && !cell.isSelected ? 'border border-[#0F4C81]/70 dark:border-sky-500 font-black' : ''} ${
                        !cell.isAllowed ? 'opacity-30 cursor-not-allowed' : ''
                      }`}
                    >
                      <span>{cell.day}</span>
                      {cell.hasLedgerEntry && (
                        <span
                          className={`h-1.5 w-1.5 rounded-full -mt-0.5 ${
                            cell.isSelected
                              ? 'bg-white'
                              : 'bg-emerald-500 dark:bg-emerald-400'
                          }`}
                          title="Entered in Ledger"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Footer Quick Presets */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSelectToday}
                    className="font-bold text-[#0F4C81] dark:text-sky-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded hover:underline cursor-pointer text-xs"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectYesterday}
                    className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded hover:underline cursor-pointer text-xs"
                  >
                    Yesterday
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {value && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="font-bold text-red-500 hover:underline cursor-pointer px-1.5 py-1 text-xs"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1 rounded-lg cursor-pointer text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Desktop & Tablet Floating Portal Popover */
          <div 
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 99999,
            }}
            className="w-[305px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Header: Month & Year Navigator */}
            <div className="flex items-center justify-between gap-1 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1.5">
                <select
                  value={viewMonth}
                  onChange={(e) => handleMonthChange(Number(e.target.value))}
                  className="text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-0.5 cursor-pointer focus:outline-hidden"
                >
                  {monthNamesShort.map((m, idx) => (
                    <option key={m} value={idx}>
                      {monthNames[idx]}
                    </option>
                  ))}
                </select>

                <select
                  value={viewYear}
                  onChange={(e) => handleYearChange(Number(e.target.value))}
                  className="text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-0.5 cursor-pointer focus:outline-hidden"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={nextMonth}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday Labels */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {daysOfWeek.map((day, idx) => (
                <span
                  key={day}
                  className={`text-[10px] font-bold uppercase ${
                    idx === 0 || idx === 6
                      ? 'text-red-400 dark:text-red-400/80'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {calendarDays.map((cell, idx) => {
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!cell.isAllowed}
                    onClick={() => handleSelectDate(cell.dateStr, cell.isTargetMonth)}
                    className={`h-7.5 w-full flex flex-col items-center justify-center rounded-lg text-[11px] font-bold transition-all cursor-pointer relative ${
                      cell.isSelected
                        ? 'bg-[#0F4C81] text-white shadow-xs'
                        : cell.isCurrentMonth
                          ? 'text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-[#0F4C81] dark:hover:text-blue-300'
                          : 'text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    } ${cell.isToday && !cell.isSelected ? 'border border-[#0F4C81]/60 dark:border-sky-500/60' : ''} ${
                      !cell.isAllowed ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                  >
                    <span>{cell.day}</span>
                    {cell.hasLedgerEntry && (
                      <span
                        className={`h-1 w-1 rounded-full -mt-0.5 ${
                          cell.isSelected
                            ? 'bg-white'
                            : 'bg-emerald-500 dark:bg-emerald-400'
                        }`}
                        title="Entered in Ledger"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer Quick Presets & Clear */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectToday}
                  className="font-bold text-[#0F4C81] dark:text-sky-400 hover:underline cursor-pointer bg-blue-50/80 dark:bg-blue-950/40 px-1.5 py-0.5 rounded"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={handleSelectYesterday}
                  className="font-semibold text-slate-600 dark:text-slate-300 hover:underline cursor-pointer bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded"
                >
                  Yesterday
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {value && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="font-bold text-red-500 hover:underline cursor-pointer px-1 py-0.5"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-1.5 py-0.5 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ),
        document.body
      )}
    </div>
  );
};
