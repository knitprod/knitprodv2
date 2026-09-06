import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface LedgerCalendarDatePickerProps {
  id?: string;
  label?: string;
  value: string; // YYYY-MM-DD or empty
  onChange: (date: string) => void;
  allowedDates?: string[]; // Array of YYYY-MM-DD dates that exist in the ledger
  restrictToAllowedDates?: boolean; // If true, only allowedDates can be selected. Defaults to false (all dates selectable).
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [effectiveAlign, setEffectiveAlign] = useState<'left' | 'right'>('left');

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

  // Compute smart popover alignment to prevent clipping on the right edge
  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (align === 'right') {
        setEffectiveAlign('right');
        return;
      }
      if (align === 'left') {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceRight = window.innerWidth - rect.left;
        if (spaceRight < 310 && rect.right > 280) {
          setEffectiveAlign('right');
        } else {
          setEffectiveAlign('left');
        }
        return;
      }
      // 'auto' alignment: check viewport boundary
      const rect = containerRef.current.getBoundingClientRect();
      const spaceRight = window.innerWidth - rect.left;
      if (spaceRight < 310 && rect.right > 280) {
        setEffectiveAlign('right');
      } else {
        setEffectiveAlign('left');
      }
    }
  }, [isOpen, align]);

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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

  // Generate list of available years for quick year selector (spanning +/- 4 years around view year)
  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear();
    const startY = Math.min(viewYear - 3, currentY - 4);
    const endY = Math.max(viewYear + 3, currentY + 3);
    const yrs: number[] = [];
    for (let y = startY; y <= endY; y++) {
      yrs.push(y);
    }
    return yrs;
  }, [viewYear]);

  // Generate calendar days for current viewMonth
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
    }[] = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        dateStr,
        isCurrentMonth: false,
        isAllowed: false,
        hasLedgerEntry: allowedDates.includes(dateStr),
        isSelected: false,
        isToday: false,
      });
    }

    // Current month days
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const hasLedgerEntry = allowedDates.includes(dateStr);
      const isAllowedByList = !restrictToAllowedDates || allowedDates.length === 0 || hasLedgerEntry;
      const isMinValid = !minDate || dateStr >= minDate;
      const isMaxValid = !maxDate || dateStr <= maxDate;
      const canSelect = isAllowedByList && isMinValid && isMaxValid;

      days.push({
        day: i,
        dateStr,
        isCurrentMonth: true,
        isAllowed: canSelect,
        hasLedgerEntry,
        isSelected: value === dateStr,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        day: i,
        dateStr,
        isCurrentMonth: false,
        isAllowed: false,
        hasLedgerEntry: allowedDates.includes(dateStr),
        isSelected: false,
        isToday: false,
      });
    }

    return days;
  }, [viewYear, viewMonth, allowedDates, restrictToAllowedDates, minDate, maxDate, value]);

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

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    onChange(todayStr);
    setViewDate(today);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 flex items-center justify-between mb-0.5">
          <span className="flex items-center gap-1">
            <span>📅</span> {label}
          </span>
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[9px] text-red-500 hover:underline cursor-pointer"
              title={`Clear ${label}`}
            >
              Clear
            </button>
          )}
        </label>
      )}

      {/* Trigger Button styled like input */}
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between rounded-lg border bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
          isOpen
            ? 'border-[#0F4C81] ring-2 ring-[#0F4C81]/20'
            : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
        } ${value ? 'text-gray-900 dark:text-slate-100' : 'text-gray-400 dark:text-slate-500'} ${buttonClassName}`}
      >
        <span className="truncate">{formattedDisplay || placeholder}</span>
        <div className="flex items-center gap-1 ml-1 shrink-0">
          {value && (
            <span
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-400 hover:text-red-500 transition-colors"
              title="Clear date"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <CalendarIcon className="h-3.5 w-3.5 text-[#0F4C81] dark:text-sky-400" />
        </div>
      </button>

      {/* Calendar Popover & Responsive Dialog */}
      {isOpen && (
        <>
          {/* Mobile & Tablet Modal Backdrop (Visible under 768px to ensure NO clipping in drawer/horizontal scrolls) */}
          <div 
            className="fixed inset-0 bg-black/60 z-50 md:hidden flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setIsOpen(false)}
          >
            <div 
              className="w-full max-w-[320px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-2xl animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Calendar Header: Month & Year Navigator */}
              <div className="flex items-center justify-between gap-1 mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
                  title="Previous Month"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                {/* Quick Month and Year selectors */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={viewMonth}
                    onChange={(e) => handleMonthChange(Number(e.target.value))}
                    className="text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 cursor-pointer focus:outline-hidden"
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
                    className="text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 cursor-pointer focus:outline-hidden"
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
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
                  title="Next Month"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Weekday Labels */}
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
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
                  if (!cell.isCurrentMonth) {
                    return (
                      <div
                        key={idx}
                        className="h-8 flex items-center justify-center text-xs text-slate-300 dark:text-slate-700 select-none"
                      >
                        {cell.day}
                      </div>
                    );
                  }

                  if (!cell.isAllowed) {
                    return (
                      <div
                        key={idx}
                        className="h-8 flex items-center justify-center text-xs text-slate-300 dark:text-slate-600/40 select-none rounded-md"
                        title={minDate && cell.dateStr < minDate ? 'Before minimum date' : 'Date disabled'}
                      >
                        {cell.day}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectDate(cell.dateStr)}
                      className={`h-8 w-full flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                        cell.isSelected
                          ? 'bg-[#0F4C81] text-white shadow-md'
                          : 'text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-[#0F4C81]'
                      } ${cell.isToday && !cell.isSelected ? 'border border-[#0F4C81]/60 dark:border-sky-500/60 font-black' : ''}`}
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

              {/* Footer Legend & Quick Actions */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                  <span>Entered in Ledger</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectToday}
                    className="font-bold text-[#0F4C81] dark:text-sky-400 hover:underline cursor-pointer px-1 py-0.5 text-xs"
                  >
                    Today
                  </button>
                  {value && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="font-bold text-red-500 hover:underline cursor-pointer px-1 py-0.5 text-xs"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-1 rounded-lg cursor-pointer text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Popover (768px and wider) with Smart Boundary Alignment */}
          <div 
            className={`hidden md:block absolute ${
              effectiveAlign === 'right' ? 'right-0' : 'left-0'
            } top-full mt-1.5 z-50 w-76 max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100`}
          >
            {/* Calendar Header: Month & Year Navigator */}
            <div className="flex items-center justify-between gap-1 mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
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
                if (!cell.isCurrentMonth) {
                  return (
                    <div
                      key={idx}
                      className="h-7.5 flex items-center justify-center text-[11px] text-slate-300 dark:text-slate-700 select-none"
                    >
                      {cell.day}
                    </div>
                  );
                }

                if (!cell.isAllowed) {
                  return (
                    <div
                      key={idx}
                      className="h-7.5 flex items-center justify-center text-[11px] text-slate-300 dark:text-slate-600/40 select-none rounded-md"
                      title={minDate && cell.dateStr < minDate ? 'Before minimum date' : 'Date disabled'}
                    >
                      {cell.day}
                    </div>
                  );
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDate(cell.dateStr)}
                    className={`h-7.5 w-full flex flex-col items-center justify-center rounded-lg text-[11px] font-bold transition-all cursor-pointer relative ${
                      cell.isSelected
                        ? 'bg-[#0F4C81] text-white shadow-xs'
                        : 'text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-[#0F4C81] dark:hover:text-blue-300'
                    } ${cell.isToday && !cell.isSelected ? 'border border-[#0F4C81]/50 dark:border-sky-500/50' : ''}`}
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

            {/* Footer Legend & Quick Actions */}
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                <span>Entered in Ledger</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectToday}
                  className="font-bold text-[#0F4C81] dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Today
                </button>
                {value && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="font-bold text-red-500 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
