import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SearchableOption {
  label: string;
  value: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | SearchableOption)[];
  placeholder?: string;
  allLabel?: string;
  className?: string;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Search options...',
  allLabel = 'All',
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize options to SearchableOption format
  const normalizedOptions = useMemo<SearchableOption[]>(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { label: opt, value: opt };
      }
      return opt;
    });
  }, [options]);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const term = searchTerm.toLowerCase();
    return normalizedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(term)
    );
  }, [normalizedOptions, searchTerm]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);
  const displayLabel = value === 'All' || !value ? allLabel : (selectedOption ? selectedOption.label : value);
  const isSelected = value !== 'All' && value !== '';

  return (
    <div className={`relative w-full sm:w-auto sm:inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full min-h-[42px] sm:min-h-[38px] flex items-center justify-between gap-2.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all cursor-pointer select-none shadow-2xs ${
          isSelected
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
            : 'border-slate-250 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-slate-400'
        }`}
      >
        <span className="truncate flex-1 text-left font-bold text-xs">{displayLabel}</span>
        {isSelected && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange('All');
            }}
            className="p-1 rounded-full bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/60 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-200 shrink-0 transition-colors"
            title="Reset to All"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
        <ChevronDown className={`h-4 w-4 text-slate-400 dark:text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto mt-1.5 z-50 w-full sm:w-72 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl border border-slate-250 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-8.5 pr-7 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-hidden"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto p-1.5 scrollbar-thin">
            {/* Prominent "All / Show All" Option for Easy Tap on Mobile & Desktop */}
            <button
              type="button"
              onClick={() => {
                onChange('All');
                setIsOpen(false);
              }}
              className={`w-full min-h-[40px] flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-black text-left transition-all cursor-pointer mb-1 ${
                value === 'All' || !value
                  ? 'bg-blue-600 text-white shadow-xs font-black'
                  : 'bg-slate-100/90 dark:bg-slate-800/80 text-slate-900 dark:text-white hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${value === 'All' || !value ? 'bg-white' : 'bg-blue-500'}`} />
                <span className="font-bold">{allLabel}</span>
              </div>
              {(value === 'All' || !value) && <Check className="h-4 w-4 text-white font-bold" />}
            </button>

            <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />

            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs font-semibold text-slate-400">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const active = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full min-h-[38px] flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-left transition-colors cursor-pointer my-0.5 ${
                      active
                        ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800/60'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {active && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 font-bold" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
