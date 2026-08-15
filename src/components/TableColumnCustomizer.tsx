/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Columns, Eye, EyeOff, RotateCcw, Check, Pin, PinOff, Snowflake, ChevronDown } from 'lucide-react';

export interface ColumnDef {
  id: string;
  label: string;
  defaultWidth?: number;
  minWidth?: number;
  alwaysVisible?: boolean;
}

export function useTableColumns(
  tableId: string,
  userId: string = 'guest',
  columns: ColumnDef[],
  defaultFreezeCount: number = 3
) {
  const storageKey = `ekl_table_config_${tableId}_${userId}`;

  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_hidden`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_widths`);
      if (saved) return JSON.parse(saved);
    } catch {}
    const defaults: Record<string, number> = {};
    columns.forEach((col) => {
      if (col.defaultWidth) defaults[col.id] = col.defaultWidth;
    });
    return defaults;
  });

  const [isFrozen, setIsFrozen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_is_frozen`);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [freezeCount, setFreezeCountState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_freeze_count`);
      return saved !== null ? JSON.parse(saved) : defaultFreezeCount;
    } catch {
      return defaultFreezeCount;
    }
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}_hidden`, JSON.stringify(hiddenColumns));
    } catch (e) {
      console.warn('Failed to save column visibility:', e);
    }
  }, [hiddenColumns, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}_widths`, JSON.stringify(columnWidths));
    } catch (e) {
      console.warn('Failed to save column widths:', e);
    }
  }, [columnWidths, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}_is_frozen`, JSON.stringify(isFrozen));
    } catch (e) {
      console.warn('Failed to save freeze state:', e);
    }
  }, [isFrozen, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}_freeze_count`, JSON.stringify(freezeCount));
    } catch (e) {
      console.warn('Failed to save freeze count:', e);
    }
  }, [freezeCount, storageKey]);

  const toggleColumn = useCallback((colId: string) => {
    setHiddenColumns((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
    );
  }, []);

  const resetColumns = useCallback(() => {
    setHiddenColumns([]);
    const defaults: Record<string, number> = {};
    columns.forEach((col) => {
      if (col.defaultWidth) defaults[col.id] = col.defaultWidth;
    });
    setColumnWidths(defaults);
    setIsFrozen(true);
    setFreezeCountState(defaultFreezeCount);
  }, [columns, defaultFreezeCount]);

  const setColumnWidth = useCallback((colId: string, width: number) => {
    setColumnWidths((prev) => ({
      ...prev,
      [colId]: Math.max(50, width),
    }));
  }, []);

  const toggleFreeze = useCallback(() => {
    setIsFrozen((prev) => !prev);
  }, []);

  const setFreezeCount = useCallback((count: number) => {
    setFreezeCountState(count);
    if (count > 0) {
      setIsFrozen(true);
    } else {
      setIsFrozen(false);
    }
  }, []);

  const isColVisible = useCallback(
    (colId: string) => !hiddenColumns.includes(colId),
    [hiddenColumns]
  );

  const getColWidth = useCallback(
    (colId: string, fallback: number = 120) => columnWidths[colId] || fallback,
    [columnWidths]
  );

  // Compute sticky positions for frozen columns
  const stickyLefts = useMemo(() => {
    if (!isFrozen || freezeCount <= 0) return {};
    const visibleCols = columns.filter((col) => !hiddenColumns.includes(col.id));
    const lefts: Record<string, number> = {};
    let currentLeft = 0;

    for (let i = 0; i < Math.min(freezeCount, visibleCols.length); i++) {
      const col = visibleCols[i];
      lefts[col.id] = currentLeft;
      const width = columnWidths[col.id] || col.defaultWidth || 120;
      currentLeft += width;
    }
    return lefts;
  }, [columns, hiddenColumns, columnWidths, isFrozen, freezeCount]);

  const lastFrozenColId = useMemo(() => {
    if (!isFrozen || freezeCount <= 0) return null;
    const visibleCols = columns.filter((col) => !hiddenColumns.includes(col.id));
    const count = Math.min(freezeCount, visibleCols.length);
    return count > 0 ? visibleCols[count - 1]?.id || null : null;
  }, [columns, hiddenColumns, isFrozen, freezeCount]);

  const isColFrozen = useCallback(
    (colId: string) => {
      return isFrozen && colId in stickyLefts;
    },
    [isFrozen, stickyLefts]
  );

  const getStickyLeft = useCallback(
    (colId: string) => {
      return stickyLefts[colId] ?? 0;
    },
    [stickyLefts]
  );

  const getStickyStyle = useCallback(
    (colId: string, isHeader: boolean = false) => {
      if (!isFrozen || !(colId in stickyLefts)) {
        return {};
      }
      return {
        position: 'sticky' as const,
        left: `${stickyLefts[colId]}px`,
        zIndex: isHeader ? 40 : 20,
      };
    },
    [isFrozen, stickyLefts]
  );

  const getStickyClass = useCallback(
    (colId: string, isHeader: boolean = false) => {
      if (!isFrozen || !(colId in stickyLefts)) {
        return '';
      }
      const isLast = colId === lastFrozenColId;
      const borderClass = isLast
        ? ' border-r-2 border-slate-300 dark:border-slate-700 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.15)]'
        : ' border-r border-slate-200 dark:border-slate-800';

      if (isHeader) {
        return `sticky bg-slate-100 dark:bg-slate-800 z-40${borderClass}`;
      } else {
        return `sticky bg-white dark:bg-slate-900 group-hover:bg-slate-100 dark:group-hover:bg-slate-800 z-20${borderClass}`;
      }
    },
    [isFrozen, stickyLefts, lastFrozenColId]
  );

  return {
    hiddenColumns,
    columnWidths,
    isFrozen,
    freezeCount,
    toggleFreeze,
    setFreezeCount,
    setIsFrozen,
    toggleColumn,
    resetColumns,
    setColumnWidth,
    isColVisible,
    getColWidth,
    isColFrozen,
    getStickyLeft,
    getStickyStyle,
    getStickyClass,
    lastFrozenColId,
  };
}

export function FreezePanesButton({
  isFrozen,
  freezeCount,
  onToggleFreeze,
  onSetFreezeCount,
  maxFreezeCount = 10,
}: {
  isFrozen: boolean;
  freezeCount: number;
  onToggleFreeze: () => void;
  onSetFreezeCount: (count: number) => void;
  maxFreezeCount?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <div className="inline-flex rounded-xl shadow-2xs border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
        <button
          onClick={onToggleFreeze}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
            isFrozen
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title={isFrozen ? 'Freeze Panes Active: Click to unfreeze' : 'Click to freeze left columns'}
          id="freeze-panes-toggle-btn"
        >
          {isFrozen ? (
            <Pin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 fill-blue-600/20" />
          ) : (
            <PinOff className="h-3.5 w-3.5 text-slate-400" />
          )}
          <span className="hidden sm:inline">Freeze Panes</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            isFrozen
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
          }`}>
            {isFrozen ? `${freezeCount} Col` : 'OFF'}
          </span>
        </button>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-1.5 py-2 border-l border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          title="Configure Freeze Pane columns"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 shadow-xl z-50 animate-fade-in space-y-1">
          <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Snowflake className="h-3 w-3 text-blue-500" /> Freeze Options
            </span>
            <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold">
              {isFrozen ? 'Active' : 'Disabled'}
            </span>
          </div>

          <button
            onClick={() => {
              onToggleFreeze();
              setIsOpen(false);
            }}
            className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span>{isFrozen ? 'Unfreeze Panes' : 'Freeze First Columns'}</span>
            {isFrozen ? <PinOff className="h-3.5 w-3.5 text-amber-500" /> : <Pin className="h-3.5 w-3.5 text-blue-600" />}
          </button>

          <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="block px-2 py-1 text-[10px] font-bold text-slate-400">Freeze Column Count:</span>
            <div className="grid grid-cols-5 gap-1 px-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].slice(0, maxFreezeCount).map((count) => (
                <button
                  key={count}
                  onClick={() => {
                    onSetFreezeCount(count);
                    setIsOpen(false);
                  }}
                  className={`py-1 rounded-lg text-xs font-black transition-all cursor-pointer text-center ${
                    isFrozen && freezeCount === count
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/50'
                  }`}
                >
                  {count} Col
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ColumnCustomizerDropdown({
  tableId,
  columns,
  hiddenColumns,
  onToggleColumn,
  onResetColumns,
  isFrozen,
  freezeCount,
  onToggleFreeze,
  onSetFreezeCount,
}: {
  tableId: string;
  columns: ColumnDef[];
  hiddenColumns: string[];
  onToggleColumn: (colId: string) => void;
  onResetColumns: () => void;
  isFrozen?: boolean;
  freezeCount?: number;
  onToggleFreeze?: () => void;
  onSetFreezeCount?: (count: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hiddenCount = hiddenColumns.length;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer shadow-2xs ${
          hiddenCount > 0
            ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
        title="Customizer: Hide/Show or resize table columns"
        id={`col-customizer-btn-${tableId}`}
      >
        <Columns className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="hidden sm:inline">Columns</span>
        {hiddenCount > 0 && (
          <span className="rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[10px] font-black">
            {hiddenCount} Hidden
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 shadow-2xl z-50 animate-fade-in space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <Columns className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Column Customizer
            </span>
            <button
              onClick={onResetColumns}
              className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              Reset All
            </button>
          </div>

          {onToggleFreeze && (
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                  <Pin className="h-3 w-3 text-blue-600" /> Freeze Left Panes
                </span>
                <button
                  onClick={onToggleFreeze}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black cursor-pointer transition-colors ${
                    isFrozen
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isFrozen ? 'ON' : 'OFF'}
                </button>
              </div>
              {isFrozen && onSetFreezeCount && (
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  <span className="text-slate-500 font-medium w-full sm:w-auto">Frozen cols:</span>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => onSetFreezeCount(num)}
                      className={`h-5 w-5 rounded font-black text-[10px] transition-all cursor-pointer ${
                        freezeCount === num
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {columns.map((col) => {
              if (col.alwaysVisible) return null;
              const isHidden = hiddenColumns.includes(col.id);

              return (
                <button
                  key={col.id}
                  onClick={() => onToggleColumn(col.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs font-medium transition-colors cursor-pointer ${
                    isHidden
                      ? 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 line-through'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate pr-2">{col.label}</span>
                  <div className="shrink-0">
                    {isHidden ? (
                      <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <div className="flex h-4 w-4 items-center justify-center rounded-md bg-blue-600 text-white">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center font-medium">
            Drag right edge of header cells to resize columns
          </div>
        </div>
      )}
    </div>
  );
}

export function ResizableTh({
  children,
  width,
  onWidthChange,
  className = '',
  style = {},
  isSticky = false,
  stickyLeft = 0,
  isLastFrozen = false,
  stickyBgClass,
  ...props
}: {
  children: React.ReactNode;
  width?: number;
  onWidthChange?: (newWidth: number) => void;
  className?: string;
  style?: React.CSSProperties;
  isSticky?: boolean;
  stickyLeft?: number;
  isLastFrozen?: boolean;
  stickyBgClass?: string;
  [key: string]: any;
}) {
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width || 120);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width || 120;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const deltaX = moveEvent.clientX - startX.current;
      const newWidth = Math.max(60, startWidth.current + deltaX);
      if (onWidthChange) {
        onWidthChange(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const stickyStyle: React.CSSProperties = isSticky
    ? {
        position: 'sticky',
        left: `${stickyLeft}px`,
        zIndex: 40,
      }
    : {
        zIndex: 20,
      };

  const currentStyle: React.CSSProperties = {
    ...stickyStyle,
    ...style,
    ...(width ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` } : {}),
  };

  const bgClassToUse = stickyBgClass || (className.includes('bg-') ? '' : 'bg-slate-100 dark:bg-slate-800');

  const stickyClasses = isSticky
    ? `sticky ${bgClassToUse} ${
        isLastFrozen
          ? 'border-r-2 border-slate-300/40 dark:border-slate-700 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.15)]'
          : 'border-r border-slate-200/20 dark:border-slate-800'
      }`
    : '';

  return (
    <th
      className={`relative group ${stickyClasses} ${className}`}
      style={currentStyle}
      {...props}
    >
      <div className="w-full whitespace-normal break-words leading-tight">{children}</div>
      {onWidthChange && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-blue-500/60 active:bg-blue-600 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 transition-colors z-20"
          title="Drag to resize column"
        />
      )}
    </th>
  );
}
