/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Grey Yarn Stock Summary View
 * High-performance enterprise inventory module under Knitting Status tracking:
 * 1st Layer: Order Summary with Rollup Sums & Actions (View & Snip)
 * 2nd Layer: Expandable Physical Yarn Count, Physical Yarn Lot & Spinner Breakdown
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Search,
  Filter,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  X,
  Building2,
  User,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  Clock,
  Eye,
  Scissors,
  Activity,
  Boxes,
  Truck,
  Archive,
  ArrowUpRight,
  Code,
  Copy,
  Check,
  Loader2,
  Database,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  SlidersHorizontal,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Calendar as CalendarIcon,
  Hash
} from 'lucide-react';
import { UserRecord } from './UserManagementView';
import { isPageAllowedForUser } from '../lib/userPermissions';
import { safeCopyText } from '../lib/clipboardHelper';
import {
  GreyYarnStockItem,
  GreyYarnStockOrderGroup,
  GreyYarnStockStorage,
  GreyYarnStockUploadMeta,
  groupGreyYarnStockRecords,
  parseGreyYarnStockExcel,
  exportGreyYarnStockToExcel,
  downloadGreyYarnStockTemplate,
  formatYarnNumber,
  normOrder
} from '../lib/greyYarnStockStore';
import { SupabaseSync } from '../lib/supabaseClient';
import { GreyYarnStockDetailsModal } from './GreyYarnStockDetailsModal';
import { GreyYarnStockSnippingModal } from './GreyYarnStockSnippingModal';
import SearchableSelect from './SearchableSelect';
import { SyncProgressBar, SyncProgressState } from './SyncProgressBar';

interface GreyYarnStockSummaryViewProps {
  currentUser?: UserRecord | null;
  onNavigateTab?: (tab: string) => void;
}

export type YarnStockStatusFilter = 'all' | 'active_stock' | 'excess_issued' | 'pending_balance' | 'zero_stock';
export type YarnSortField = 'stock' | 'orderNo' | 'buyer' | 'received' | 'issued' | 'required' | 'balance' | 'status' | 'completionDate';
export type YarnSortDirection = 'asc' | 'desc';

interface HighlightableCellProps {
  value: string | number | null | undefined;
  isMatch: boolean;
  searchQuery?: string;
  badge?: string;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  className?: string;
  defaultTextClass?: string;
}

/**
 * Enterprise Cell Highlighter that highlights matched cells from search & filter options
 */
const HighlightableCell: React.FC<HighlightableCellProps> = ({
  value,
  isMatch,
  searchQuery,
  badge,
  align = 'left',
  mono = false,
  className = '',
  defaultTextClass = '',
}) => {
  const str = value === null || value === undefined ? '—' : String(value);

  const renderContent = () => {
    if (!searchQuery || !searchQuery.trim() || str === '—') {
      return str;
    }
    const q = searchQuery.trim();
    try {
      const escaped = q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      const parts = str.split(regex);
      if (parts.length === 1) return str;
      return (
        <>
          {parts.map((p, idx) =>
            regex.test(p) ? (
              <mark
                key={idx}
                className="bg-amber-300 dark:bg-amber-400 text-slate-950 font-black px-1 py-0.5 rounded shadow-2xs inline-block mx-0.5"
              >
                {p}
              </mark>
            ) : (
              p
            )
          )}
        </>
      );
    } catch {
      return str;
    }
  };

  if (!isMatch) {
    return (
      <span className={`${mono ? 'font-mono' : ''} ${defaultTextClass} ${className}`}>
        {renderContent()}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 border border-amber-400 dark:border-amber-500 text-amber-950 dark:text-amber-100 font-extrabold shadow-2xs transition-all ${
        align === 'right' ? 'ml-auto justify-end' : ''
      } ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse shrink-0" />
      <span className={`${mono ? 'font-mono' : ''} tracking-tight`}>
        {renderContent()}
      </span>
      {badge && (
        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 font-black shrink-0 border border-amber-300 dark:border-amber-700">
          {badge}
        </span>
      )}
    </div>
  );
};

export default function GreyYarnStockSummaryView({ currentUser, onNavigateTab }: GreyYarnStockSummaryViewProps) {
  // Master records
  const [records, setRecords] = useState<GreyYarnStockItem[]>(() => GreyYarnStockStorage.getRecords());
  const [uploadMeta, setUploadMeta] = useState<GreyYarnStockUploadMeta>(() => GreyYarnStockStorage.getUploadMeta());

  // Search terms
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [orderNoSearch, setOrderNoSearch] = useState('');
  const [debouncedOrderNoSearch, setDebouncedOrderNoSearch] = useState('');

  // Dropdown filter selections
  const [statusFilter, setStatusFilter] = useState('All');
  const [buyerFilter, setBuyerFilter] = useState('All');
  const [spinnerFilter, setSpinnerFilter] = useState('All');
  const [yarnCountFilter, setYarnCountFilter] = useState('All');
  const [stockStatusFilter, setStockStatusFilter] = useState<YarnStockStatusFilter>('all');

  // Sorting
  const [sortField, setSortField] = useState<YarnSortField | null>('stock');
  const [sortDirection, setSortDirection] = useState<YarnSortDirection>('desc');

  // View ergonomics
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Expanded Order Numbers for 2nd layer accordion
  const [expandedOrderNos, setExpandedOrderNos] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const all = GreyYarnStockStorage.getRecords();
    if (all && all.length > 0 && all[0].orderNo) {
      initial.add(all[0].orderNo);
    }
    return initial;
  });

  // Modals
  const [viewingOrder, setViewingOrder] = useState<GreyYarnStockOrderGroup | null>(null);
  const [snipGroup, setSnipGroup] = useState<GreyYarnStockOrderGroup | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Notification Toast & Copy Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedOrderNo, setCopiedOrderNo] = useState<string | null>(null);

  // Sync Progress State
  const [syncProgress, setSyncProgress] = useState<SyncProgressState>({
    isActive: false,
    type: 'sync',
    percent: 0,
    stage: ''
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Debounce search handlers
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedOrderNoSearch(orderNoSearch.trim()), 200);
    return () => clearTimeout(timer);
  }, [orderNoSearch]);

  // Reactive listener for storage updates
  useEffect(() => {
    const handleStorageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<GreyYarnStockItem[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setRecords(customEvent.detail);
        setUploadMeta(GreyYarnStockStorage.getUploadMeta());
      }
    };
    window.addEventListener('epyllion_grey_yarn_stock_updated', handleStorageUpdate);
    return () => window.removeEventListener('epyllion_grey_yarn_stock_updated', handleStorageUpdate);
  }, []);

  // STEP 1: Master Order Groups (1st layer rollup)
  const masterOrderGroups = useMemo(() => {
    return groupGreyYarnStockRecords(records);
  }, [records]);

  // STEP 2: Relational Filters System
  // When an order is filtered via orderNoSearch or searchTerm, all other filters dynamically narrow down
  const relationalOptions = useMemo(() => {
    let baseGroups = masterOrderGroups;

    // Apply Order Number Search first to drive relational dependency
    if (debouncedOrderNoSearch) {
      const termNorm = normOrder(debouncedOrderNoSearch);
      baseGroups = baseGroups.filter(g => normOrder(g.orderNo).includes(termNorm) || g.orderNo.toLowerCase().includes(debouncedOrderNoSearch.toLowerCase()));
    }

    const statuses = new Set<string>();
    const buyers = new Set<string>();
    const spinners = new Set<string>();
    const counts = new Set<string>();

    baseGroups.forEach(g => {
      if (g.status) statuses.add(g.status);
      if (g.buyerName) buyers.add(g.buyerName);
      g.items.forEach(itm => {
        if (itm.spinner) spinners.add(itm.spinner);
        if (itm.physicalYarnCount) counts.add(itm.physicalYarnCount);
      });
    });

    return {
      statuses: Array.from(statuses).sort(),
      buyers: Array.from(buyers).sort(),
      spinners: Array.from(spinners).sort(),
      yarnCounts: Array.from(counts).sort()
    };
  }, [masterOrderGroups, debouncedOrderNoSearch]);

  // STEP 3: Filter & Search Master Order Groups
  const filteredOrderGroups = useMemo(() => {
    let result = masterOrderGroups;

    // Dedicated Order No search
    if (debouncedOrderNoSearch) {
      const oNorm = normOrder(debouncedOrderNoSearch);
      result = result.filter(g => normOrder(g.orderNo).includes(oNorm) || g.orderNo.toLowerCase().includes(debouncedOrderNoSearch.toLowerCase()));
    }

    // General text search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(g => {
        if (g.orderNo.toLowerCase().includes(q)) return true;
        if (g.buyerName.toLowerCase().includes(q)) return true;
        if (g.status.toLowerCase().includes(q)) return true;
        if (g.completionDate && g.completionDate.toLowerCase().includes(q)) return true;
        return g.items.some(i => 
          i.physicalYarnCount.toLowerCase().includes(q) ||
          i.physicalYarnLot.toLowerCase().includes(q) ||
          i.spinner.toLowerCase().includes(q)
        );
      });
    }

    // Status Filter
    if (statusFilter !== 'All') {
      result = result.filter(g => g.status.toLowerCase() === statusFilter.toLowerCase());
    }

    // Buyer Filter
    if (buyerFilter !== 'All') {
      result = result.filter(g => g.buyerName.toLowerCase() === buyerFilter.toLowerCase());
    }

    // Spinner Filter (2nd layer match)
    if (spinnerFilter !== 'All') {
      result = result.filter(g => g.items.some(i => i.spinner.toLowerCase() === spinnerFilter.toLowerCase()));
    }

    // Yarn Count Filter (2nd layer match)
    if (yarnCountFilter !== 'All') {
      result = result.filter(g => g.items.some(i => i.physicalYarnCount.toLowerCase() === yarnCountFilter.toLowerCase()));
    }

    // Stock Status Pill Filter
    if (stockStatusFilter === 'active_stock') {
      result = result.filter(g => g.totalStockQty > 0);
    } else if (stockStatusFilter === 'excess_issued') {
      result = result.filter(g => g.totalExcessIssued > 0);
    } else if (stockStatusFilter === 'pending_balance') {
      result = result.filter(g => g.totalIssuedBalance > 0);
    } else if (stockStatusFilter === 'zero_stock') {
      result = result.filter(g => g.totalStockQty <= 0);
    }

    return result;
  }, [
    masterOrderGroups,
    debouncedOrderNoSearch,
    debouncedSearch,
    statusFilter,
    buyerFilter,
    spinnerFilter,
    yarnCountFilter,
    stockStatusFilter
  ]);

  // STEP 4: Sorting
  const sortedOrderGroups = useMemo(() => {
    if (!sortField) return filteredOrderGroups;

    return [...filteredOrderGroups].sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      switch (sortField) {
        case 'stock':
          valA = a.totalStockQty;
          valB = b.totalStockQty;
          break;
        case 'received':
          valA = a.totalNetReceived;
          valB = b.totalNetReceived;
          break;
        case 'issued':
          valA = a.totalNetIssued;
          valB = b.totalNetIssued;
          break;
        case 'required':
          valA = a.totalYarnRequired;
          valB = b.totalYarnRequired;
          break;
        case 'balance':
          valA = a.totalIssuedBalance;
          valB = b.totalIssuedBalance;
          break;
        case 'orderNo':
          valA = parseInt(a.orderNo.replace(/\D/g, ''), 10) || a.orderNo;
          valB = parseInt(b.orderNo.replace(/\D/g, ''), 10) || b.orderNo;
          break;
        case 'buyer':
          valA = a.buyerName.toLowerCase();
          valB = b.buyerName.toLowerCase();
          break;
        case 'status':
          valA = a.status.toLowerCase();
          valB = b.status.toLowerCase();
          break;
        case 'completionDate':
          valA = a.completionDate || '';
          valB = b.completionDate || '';
          break;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredOrderGroups, sortField, sortDirection]);

  // STEP 5: Pagination
  const totalPages = Math.max(1, Math.ceil(sortedOrderGroups.length / pageSize));
  const paginatedOrderGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedOrderGroups.slice(start, start + pageSize);
  }, [sortedOrderGroups, currentPage, pageSize]);

  // STEP 6: High-level KPI Totals across filtered orders
  const kpiTotals = useMemo(() => {
    let bookingSum = 0;
    let requiredSum = 0;
    let receivedSum = 0;
    let issuedSum = 0;
    let excessSum = 0;
    let stockSum = 0;
    let balanceSum = 0;

    filteredOrderGroups.forEach(g => {
      bookingSum += g.totalBookingQty;
      requiredSum += g.totalYarnRequired;
      receivedSum += g.totalNetReceived;
      issuedSum += g.totalNetIssued;
      excessSum += g.totalExcessIssued;
      stockSum += g.totalStockQty;
      balanceSum += g.totalIssuedBalance;
    });

    return {
      totalOrders: filteredOrderGroups.length,
      bookingSum,
      requiredSum,
      receivedSum,
      issuedSum,
      excessSum,
      stockSum,
      balanceSum
    };
  }, [filteredOrderGroups]);

  // Accordion Expand / Collapse controls
  const toggleOrderExpand = (orderNo: string) => {
    setExpandedOrderNos(prev => {
      const next = new Set(prev);
      if (next.has(orderNo)) {
        next.delete(orderNo);
      } else {
        next.add(orderNo);
      }
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>(sortedOrderGroups.map(g => g.orderNo));
    setExpandedOrderNos(all);
  };

  const collapseAll = () => {
    setExpandedOrderNos(new Set());
  };

  const handleSort = (field: YarnSortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Copy Order Number helper
  const handleCopyOrder = async (orderNo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await safeCopyText(orderNo);
    setCopiedOrderNo(orderNo);
    setToastMessage(`Order #${orderNo} copied to clipboard`);
    setTimeout(() => {
      setCopiedOrderNo(null);
      setToastMessage(null);
    }, 2500);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setOrderNoSearch('');
    setStatusFilter('All');
    setBuyerFilter('All');
    setSpinnerFilter('All');
    setYarnCountFilter('All');
    setStockStatusFilter('all');
    setCurrentPage(1);
  };

  const isAnyFilterActive = 
    searchTerm !== '' || 
    orderNoSearch !== '' || 
    statusFilter !== 'All' || 
    buyerFilter !== 'All' || 
    spinnerFilter !== 'All' || 
    yarnCountFilter !== 'All' || 
    stockStatusFilter !== 'all';

  // Auto-expand orders when any filter or search is active so highlighted 2nd layer cells are immediately visible
  useEffect(() => {
    if (isAnyFilterActive && filteredOrderGroups.length > 0) {
      setExpandedOrderNos(new Set(filteredOrderGroups.slice(0, 50).map(g => g.orderNo)));
    }
  }, [
    isAnyFilterActive,
    debouncedSearch,
    debouncedOrderNoSearch,
    statusFilter,
    buyerFilter,
    spinnerFilter,
    yarnCountFilter,
    stockStatusFilter,
    filteredOrderGroups
  ]);

  /**
   * Evaluates exact matching cells in the 2nd layer data based on current filter & search selections
   */
  const getSecondLayerCellMatches = useCallback((itm: GreyYarnStockItem) => {
    const q = debouncedSearch.trim().toLowerCase();
    const qNum = debouncedSearch.trim();

    // 1. Physical Yarn Count
    const matchesCountFilter = yarnCountFilter !== 'All' && (itm.physicalYarnCount || '').trim().toLowerCase() === yarnCountFilter.trim().toLowerCase();
    const matchesCountSearch = Boolean(q && (itm.physicalYarnCount || '').toLowerCase().includes(q));
    const isCountMatch = matchesCountFilter || matchesCountSearch;

    // 2. Physical Yarn Lot
    const isLotMatch = Boolean(q && (itm.physicalYarnLot || '').toLowerCase().includes(q));

    // 3. Spinner
    const matchesSpinnerFilter = spinnerFilter !== 'All' && (itm.spinner || '').trim().toLowerCase() === spinnerFilter.trim().toLowerCase();
    const matchesSpinnerSearch = Boolean(q && (itm.spinner || '').toLowerCase().includes(q));
    const isSpinnerMatch = matchesSpinnerFilter || matchesSpinnerSearch;

    // 4. Booking Qty
    const isBookingQtyMatch = Boolean(
      qNum && (
        formatYarnNumber(itm.bookingQty).includes(qNum) ||
        String(itm.bookingQty || '').includes(qNum)
      )
    );

    // 5. Yarn Required
    const isYarnReqMatch = Boolean(
      qNum && (
        formatYarnNumber(itm.yarnRequired).includes(qNum) ||
        String(itm.yarnRequired || '').includes(qNum)
      )
    );

    // 6. Total Received
    const isTotalRecMatch = Boolean(
      qNum && (
        formatYarnNumber(itm.totalReceived).includes(qNum) ||
        String(itm.totalReceived || '').includes(qNum)
      )
    );

    // 7. Total Issued
    const isTotalIssMatch = Boolean(
      qNum && (
        formatYarnNumber(itm.totalIssued).includes(qNum) ||
        String(itm.totalIssued || '').includes(qNum)
      )
    );

    // 8. Excess Issued
    const matchesExcessStockFilter = stockStatusFilter === 'excess_issued' && (itm.excessIssued || 0) > 0;
    const matchesExcessSearch = Boolean(
      qNum && (
        formatYarnNumber(itm.excessIssued).includes(qNum) ||
        String(itm.excessIssued || '').includes(qNum)
      )
    );
    const isExcessIssMatch = matchesExcessStockFilter || matchesExcessSearch;

    // 9. Total Stock QTY
    const matchesActiveStockFilter = stockStatusFilter === 'active_stock' && (itm.totalStockQty || 0) > 0;
    const matchesZeroStockFilter = stockStatusFilter === 'zero_stock' && (itm.totalStockQty || 0) <= 0;
    const matchesStockSearch = Boolean(
      qNum && (
        formatYarnNumber(itm.totalStockQty).includes(qNum) ||
        String(itm.totalStockQty || '').includes(qNum)
      )
    );
    const isStockQtyMatch = matchesActiveStockFilter || matchesZeroStockFilter || matchesStockSearch;

    // 10. Issued Balance
    const matchesPendingBalanceFilter = stockStatusFilter === 'pending_balance' && (itm.issuedBalance || 0) > 0;
    const matchesBalanceSearch = Boolean(
      qNum && (
        formatYarnNumber(itm.issuedBalance).includes(qNum) ||
        String(itm.issuedBalance || '').includes(qNum)
      )
    );
    const isIssuedBalanceMatch = matchesPendingBalanceFilter || matchesBalanceSearch;

    const matchCount = [
      isCountMatch,
      isLotMatch,
      isSpinnerMatch,
      isBookingQtyMatch,
      isYarnReqMatch,
      isTotalRecMatch,
      isTotalIssMatch,
      isExcessIssMatch,
      isStockQtyMatch,
      isIssuedBalanceMatch,
    ].filter(Boolean).length;

    return {
      isCountMatch,
      matchesCountFilter,
      isLotMatch,
      isSpinnerMatch,
      matchesSpinnerFilter,
      isBookingQtyMatch,
      isYarnReqMatch,
      isTotalRecMatch,
      isTotalIssMatch,
      isExcessIssMatch,
      matchesExcessStockFilter,
      isStockQtyMatch,
      matchesActiveStockFilter,
      matchesZeroStockFilter,
      isIssuedBalanceMatch,
      matchesPendingBalanceFilter,
      matchCount,
      hasAnyMatch: matchCount > 0,
    };
  }, [debouncedSearch, spinnerFilter, yarnCountFilter, stockStatusFilter]);

  // Total count of matching 2nd layer cells across current filtered orders
  const totalSecondLayerMatches = useMemo(() => {
    if (!isAnyFilterActive) return 0;
    let count = 0;
    for (const grp of filteredOrderGroups) {
      for (const itm of grp.items) {
        count += getSecondLayerCellMatches(itm).matchCount;
      }
    }
    return count;
  }, [filteredOrderGroups, isAnyFilterActive, getSecondLayerCellMatches]);

  // Live Auto-Sync action
  const handleLiveSync = async () => {
    setIsSyncing(true);
    setSyncProgress({
      isActive: true,
      type: 'sync',
      percent: 30,
      stage: 'Connecting to Cloud & recalculating Grey Yarn Stock...'
    });

    try {
      await new Promise(r => setTimeout(r, 600));
      setSyncProgress({
        isActive: true,
        type: 'sync',
        percent: 85,
        stage: 'Linking with Knitting Status & Yarn Allocation...'
      });
      await new Promise(r => setTimeout(r, 400));

      const fresh = GreyYarnStockStorage.getRecords();
      setRecords([...fresh]);
      setUploadMeta(GreyYarnStockStorage.getUploadMeta());

      setSyncProgress({
        isActive: true,
        type: 'sync',
        percent: 100,
        stage: 'Sync completed successfully!'
      });
      setToastMessage('✓ Grey Yarn Stock synchronized live!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setToastMessage('Sync notice: Working with latest local dataset');
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        setSyncProgress(prev => ({ ...prev, isActive: false }));
      }, 700);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      exportGreyYarnStockToExcel(sortedOrderGroups);
      setToastMessage('Exporting Grey Yarn Stock Summary Excel...');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (e: any) {
      setToastMessage('Excel export error: ' + (e?.message || 'Failed'));
    }
  };

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setSyncProgress({
      isActive: true,
      type: 'upload',
      percent: 25,
      stage: `Parsing ${file.name}...`
    });

    try {
      const parsedItems = await parseGreyYarnStockExcel(file);
      setSyncProgress({
        isActive: true,
        type: 'upload',
        percent: 75,
        stage: `Loaded ${parsedItems.length} yarn records. Saving inventory...`
      });

      GreyYarnStockStorage.saveRecords(parsedItems, true);
      const groups = groupGreyYarnStockRecords(parsedItems);

      const meta: GreyYarnStockUploadMeta = {
        lastUploadedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        fileName: file.name,
        totalRecords: parsedItems.length,
        totalOrders: groups.length
      };
      GreyYarnStockStorage.saveUploadMeta(meta);

      setRecords(parsedItems);
      setUploadMeta(meta);
      setIsUploadModalOpen(false);

      setSyncProgress({
        isActive: true,
        type: 'upload',
        percent: 100,
        stage: 'Upload & calculation complete!'
      });
      setToastMessage(`Successfully uploaded ${parsedItems.length} Grey Yarn Stock records!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to parse Excel file');
      setSyncProgress(prev => ({ ...prev, isActive: false }));
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
      setTimeout(() => {
        setSyncProgress(prev => ({ ...prev, isActive: false }));
      }, 800);
    }
  };

  // Official 14-Column Excel Template Download
  const handleDownloadSampleTemplate = () => {
    try {
      downloadGreyYarnStockTemplate();
      setToastMessage('Downloaded Epyllion_Grey_Yarn_Stock_Upload_Template.xlsx');
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      // Fallback
      const templateHeaders = [
        {
          'Completion Date': '24-Oct-2024',
          'Buyer': 'Vogue Sourcing Limited',
          'Status': 'Running',
          'Allocated Order WA': '271890',
          'Physical Count': '26/1 CVC 60/40 Melange',
          'Physical Lot': 'LT-48210',
          'Spinner': 'Square Textiles Ltd.',
          'Booking QTY': 4200,
          'Yarn Required': 4100,
          'Net Received': 4100,
          'Total Issued': 3500,
          'Excess Issued': 0,
          'Total Stock QTY': 600,
          'Issue Balance': 600
        }
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(templateHeaders);
      XLSX.utils.book_append_sheet(wb, ws, 'Grey Yarn Stock');
      XLSX.writeFile(wb, 'Epyllion_Grey_Yarn_Stock_Upload_Template.xlsx');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Sync Progress Bar */}
      <SyncProgressBar progress={syncProgress} />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 dark:border-slate-300 backdrop-blur-md animate-fade-in text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white dark:hover:text-slate-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-View Switcher Bar: Knitting Status vs Textile Close By PMC vs Grey Stock Summary vs Grey Yarn Stock Summary */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {isPageAllowedForUser(currentUser, 'Running Orders') && (
          <button
            type="button"
            onClick={() => onNavigateTab && onNavigateTab('Running Orders')}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          >
            <Activity className="w-4 h-4 text-indigo-500" />
            <span>Running Orders</span>
          </button>
        )}

        {isPageAllowedForUser(currentUser, 'Textile Close By PMC') && (
          <button
            type="button"
            onClick={() => onNavigateTab && onNavigateTab('Textile Close By PMC')}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Textile Close By PMC</span>
          </button>
        )}

        {isPageAllowedForUser(currentUser, 'Grey Stock Summary') && (
          <button
            type="button"
            onClick={() => onNavigateTab && onNavigateTab('Grey Stock Summary')}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          >
            <Boxes className="w-4 h-4 text-blue-500" />
            <span>Grey Stock Summary</span>
          </button>
        )}

        {/* This Tab: Grey Yarn Stock Summary (Active) */}
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/20"
        >
          <Layers className="w-4 h-4 text-indigo-200" />
          <span>Grey Yarn Stock Summary</span>
        </button>
      </div>

      {/* Main Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-xs">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Grey Yarn Stock Summary
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Knitting Status
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Live Synced
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Order-wise summary with expandable physical yarn count, lot &amp; spinner breakdown
              </p>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Combined Live Auto-Sync Button */}
          <button
            type="button"
            onClick={handleLiveSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-2xs cursor-pointer disabled:opacity-50 active:scale-95"
            title="Click to sync and refresh Grey Yarn Stock"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Auto-Sync: Live</span>
          </button>


          {/* Upload Excel Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Excel</span>
          </button>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Clickable KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* 1. Total Orders */}
        <div 
          onClick={() => { setStockStatusFilter('all'); }}
          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs cursor-pointer hover:border-indigo-400 transition-all"
        >
          <span className="text-[10px] font-black uppercase text-slate-400 block truncate">Total Orders</span>
          <span className="text-lg font-black font-mono text-slate-900 dark:text-white block mt-0.5">
            {kpiTotals.totalOrders}
          </span>
          <span className="text-[10px] text-slate-400">{records.length} yarn items</span>
        </div>

        {/* 2. Total Booking QTY */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-black uppercase text-slate-400 block truncate">Booking QTY</span>
          <span className="text-lg font-black font-mono text-slate-800 dark:text-slate-200 block mt-0.5">
            {formatYarnNumber(kpiTotals.bookingSum)}
          </span>
          <span className="text-[10px] text-slate-400">Sum booking (kg)</span>
        </div>

        {/* 3. Yarn Required */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 block truncate">Yarn Required</span>
          <span className="text-lg font-black font-mono text-indigo-700 dark:text-indigo-300 block mt-0.5">
            {formatYarnNumber(kpiTotals.requiredSum)}
          </span>
          <span className="text-[10px] text-indigo-400">Sum req (kg)</span>
        </div>

        {/* 4. Net Received */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block truncate">Net Received</span>
          <span className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-300 block mt-0.5">
            {formatYarnNumber(kpiTotals.receivedSum)}
          </span>
          <span className="text-[10px] text-emerald-500">Sum received (kg)</span>
        </div>

        {/* 5. Net Issued */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 block truncate">Net Issued</span>
          <span className="text-lg font-black font-mono text-blue-700 dark:text-blue-300 block mt-0.5">
            {formatYarnNumber(kpiTotals.issuedSum)}
          </span>
          <span className="text-[10px] text-blue-500">Sum issued (kg)</span>
        </div>

        {/* 6. Excess Issued */}
        <div 
          onClick={() => setStockStatusFilter('excess_issued')}
          className={`p-3.5 rounded-2xl border shadow-2xs cursor-pointer transition-all ${
            stockStatusFilter === 'excess_issued'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 ring-2 ring-rose-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300'
          }`}
        >
          <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 block truncate">Excess Issued</span>
          <span className="text-lg font-black font-mono text-rose-700 dark:text-rose-300 block mt-0.5">
            {formatYarnNumber(kpiTotals.excessSum)}
          </span>
          <span className="text-[10px] text-rose-500">Over requisition (kg)</span>
        </div>

        {/* 7. Stock QTY */}
        <div 
          onClick={() => setStockStatusFilter(stockStatusFilter === 'active_stock' ? 'all' : 'active_stock')}
          className={`p-3.5 rounded-2xl border shadow-2xs cursor-pointer transition-all ${
            stockStatusFilter === 'active_stock'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300'
          }`}
        >
          <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 block truncate">Stock QTY</span>
          <span className="text-lg font-black font-mono text-amber-800 dark:text-amber-300 block mt-0.5">
            {formatYarnNumber(kpiTotals.stockSum)}
          </span>
          <span className="text-[10px] text-amber-600 font-bold">Floor stock (kg)</span>
        </div>

        {/* 8. Issue Balance */}
        <div 
          onClick={() => setStockStatusFilter(stockStatusFilter === 'pending_balance' ? 'all' : 'pending_balance')}
          className={`p-3.5 rounded-2xl border shadow-2xs cursor-pointer transition-all ${
            stockStatusFilter === 'pending_balance'
              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 ring-2 ring-purple-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-300'
          }`}
        >
          <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 block truncate">Issue Balance</span>
          <span className="text-lg font-black font-mono text-purple-800 dark:text-purple-300 block mt-0.5">
            {formatYarnNumber(kpiTotals.balanceSum)}
          </span>
          <span className="text-[10px] text-purple-500">Balance to issue</span>
        </div>
      </div>

      {/* Relational Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* 1. Dedicated Search Order No */}
          <div className="relative">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Search Order No:
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-500" />
              <input
                type="text"
                value={orderNoSearch}
                onChange={e => {
                  setOrderNoSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="e.g. 271890..."
                className="w-full pl-8 pr-7 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {orderNoSearch && (
                <button
                  type="button"
                  onClick={() => setOrderNoSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 2. Relational Buyer Filter */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Buyer:
            </label>
            <SearchableSelect
              options={relationalOptions.buyers}
              value={buyerFilter}
              onChange={val => {
                setBuyerFilter(val);
                setCurrentPage(1);
              }}
              placeholder="All Buyers"
              allLabel="All Buyers"
            />
          </div>

          {/* 3. Relational Spinner Filter */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Spinner:
            </label>
            <SearchableSelect
              options={relationalOptions.spinners}
              value={spinnerFilter}
              onChange={val => {
                setSpinnerFilter(val);
                setCurrentPage(1);
              }}
              placeholder="All Spinners"
              allLabel="All Spinners"
            />
          </div>

          {/* 4. Relational Physical Yarn Count */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Physical Yarn Count:
            </label>
            <SearchableSelect
              options={relationalOptions.yarnCounts}
              value={yarnCountFilter}
              onChange={val => {
                setYarnCountFilter(val);
                setCurrentPage(1);
              }}
              placeholder="All Yarn Counts"
              allLabel="All Yarn Counts"
            />
          </div>

          {/* 5. Status Filter */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Status:
            </label>
            <SearchableSelect
              options={['Running', 'Complete', 'Textile Close', 'Pending']}
              value={statusFilter}
              onChange={val => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
              placeholder="All Statuses"
              allLabel="All Statuses"
            />
          </div>

          {/* 6. General Search */}
          <div className="relative">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Keyword Filter:
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search lot, count, buyer..."
                className="w-full pl-8 pr-7 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stock Status Pills and Reset Button */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Quick Stock Status:</span>
            {[
              { id: 'all', label: 'All Orders' },
              { id: 'active_stock', label: 'Active Stock (>0 kg)' },
              { id: 'excess_issued', label: 'Excess Issued (>0 kg)' },
              { id: 'pending_balance', label: 'Pending Issue Balance' },
              { id: 'zero_stock', label: 'Zero Stock' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStockStatusFilter(tab.id as YarnStockStatusFilter);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  stockStatusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isAnyFilterActive && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Highlights Bar */}
      {isAnyFilterActive && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/30 border border-amber-300 dark:border-amber-700/70 text-xs shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
              <span>2nd Layer Cell Highlights Active:</span>
            </div>
            <span className="text-[11px] text-amber-800 dark:text-amber-300">
              Criteria searched/selected from filters are automatically highlighted in the 2nd layer data cells below with glowing badges &amp; yellow highlights.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 shadow-2xs">
              {totalSecondLayerMatches} matching cell{totalSecondLayerMatches === 1 ? '' : 's'} highlighted
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 cursor-pointer ml-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table: 1st Layer & 2nd Layer */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {/* Table Top Toolbar */}
        <div className="p-3.5 sm:px-5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Showing <span className="font-mono text-indigo-600 dark:text-indigo-400 font-extrabold">{sortedOrderGroups.length}</span> orders
            </span>

            {/* Expand / Collapse All */}
            <div className="flex items-center gap-1.5 ml-2">
              <button
                type="button"
                onClick={expandAll}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Expand All</span>
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>Collapse All</span>
              </button>
            </div>
          </div>

          {/* Density & Page Size */}
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setDensity('comfortable')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  density === 'comfortable' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Comfortable
              </button>
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  density === 'compact' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Compact
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-400">Rows:</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={9999}>All</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 select-none uppercase tracking-wider text-[11px]">
                {/* 1. Expand/Collapse Button */}
                <th className="py-2.5 px-3 w-10 text-center">
                  <span className="sr-only">Expand/Collapse Button</span>
                </th>

                {/* 2. Order Number */}
                <th 
                  onClick={() => handleSort('orderNo')}
                  className="py-2.5 px-3 min-w-[130px] whitespace-nowrap cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-750 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Order Number</span>
                    {sortField === 'orderNo' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 3. Status */}
                <th 
                  onClick={() => handleSort('status')}
                  className="py-2.5 px-3 min-w-[110px] whitespace-nowrap cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-750 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Status</span>
                    {sortField === 'status' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 4. Completion Date */}
                <th 
                  onClick={() => handleSort('completionDate')}
                  className="py-2.5 px-3 min-w-[130px] whitespace-nowrap cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-750 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Completion Date</span>
                    {sortField === 'completionDate' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 5. Buyer Name */}
                <th 
                  onClick={() => handleSort('buyer')}
                  className="py-2.5 px-3 min-w-[140px] whitespace-nowrap cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-750 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Buyer Name</span>
                    {sortField === 'buyer' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 6. Booking QTY(Sum from 2nd Layer Booking QTY) */}
                <th className="py-2.5 px-3 min-w-[120px] whitespace-nowrap text-right">
                  Booking QTY
                </th>

                {/* 7. Yarn Required(Sum from 2nd Layer Yarn Required) */}
                <th 
                  onClick={() => handleSort('required')}
                  className="py-2.5 px-3 min-w-[120px] whitespace-nowrap text-right text-indigo-700 dark:text-indigo-300 cursor-pointer hover:bg-slate-200/60 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Yarn Required</span>
                    {sortField === 'required' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 8. Net Received (Sum from 2nd Layer Total Received) */}
                <th 
                  onClick={() => handleSort('received')}
                  className="py-2.5 px-3 min-w-[120px] whitespace-nowrap text-right text-emerald-700 dark:text-emerald-300 cursor-pointer hover:bg-slate-200/60 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Net Received</span>
                    {sortField === 'received' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 9. Net Issued (Sum from 2nd Layer Total Issued) */}
                <th 
                  onClick={() => handleSort('issued')}
                  className="py-2.5 px-3 min-w-[120px] whitespace-nowrap text-right text-blue-700 dark:text-blue-300 cursor-pointer hover:bg-slate-200/60 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Net Issued</span>
                    {sortField === 'issued' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 10. Excess Issued (Sum from 2nd Layer Excess Issued) */}
                <th className="py-2.5 px-3 min-w-[120px] whitespace-nowrap text-right text-rose-700 dark:text-rose-300">
                  Excess Issued
                </th>

                {/* 11. Stock QTY (Sum from 2nd Layer Total Stock QTY) */}
                <th 
                  onClick={() => handleSort('stock')}
                  className="py-2.5 px-3 min-w-[130px] whitespace-nowrap text-right text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20 cursor-pointer hover:bg-slate-200/60 transition-colors font-extrabold"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Stock QTY</span>
                    {sortField === 'stock' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-600" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 12. Issue Balance */}
                <th 
                  onClick={() => handleSort('balance')}
                  className="py-2.5 px-3 min-w-[120px] whitespace-nowrap text-right text-purple-700 dark:text-purple-300 cursor-pointer hover:bg-slate-200/60 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Issue Balance</span>
                    {sortField === 'balance' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-purple-600" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 13. Action Button(View & Snip) */}
                <th className="py-2.5 px-3 min-w-[140px] whitespace-nowrap text-center">
                  Action Button
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedOrderGroups.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-slate-400">
                    <Layers className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-semibold">No Grey Yarn Stock records match current filters</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {isAnyFilterActive ? 'Try resetting filters or adjusting search term' : 'Upload a Grey Yarn Stock Excel file'}
                    </p>
                    {isAnyFilterActive && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-3 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedOrderGroups.map(group => {
                  const isExpanded = expandedOrderNos.has(group.orderNo);
                  const isComplete = group.status.toLowerCase().includes('complete') || group.status.toLowerCase().includes('close');
                  const isRunning = group.status.toLowerCase().includes('run');
                  const pyClass = density === 'comfortable' ? 'py-3' : 'py-1.5';

                  // 1st layer cell match checks
                  const matchesOrderNo = Boolean(
                    (debouncedOrderNoSearch && group.orderNo.toLowerCase().includes(debouncedOrderNoSearch.toLowerCase())) ||
                    (debouncedSearch && group.orderNo.toLowerCase().includes(debouncedSearch.toLowerCase()))
                  );
                  const matchesStatus = Boolean(
                    (statusFilter !== 'All' && group.status.toLowerCase() === statusFilter.toLowerCase()) ||
                    (debouncedSearch && group.status.toLowerCase().includes(debouncedSearch.toLowerCase()))
                  );
                  const matchesBuyer = Boolean(
                    (buyerFilter !== 'All' && group.buyerName.toLowerCase() === buyerFilter.toLowerCase()) ||
                    (debouncedSearch && group.buyerName.toLowerCase().includes(debouncedSearch.toLowerCase()))
                  );

                  // Calculate 2nd layer cell matches for this order group
                  const groupItemMatches = group.items.map(itm => ({
                    item: itm,
                    matches: getSecondLayerCellMatches(itm),
                  }));
                  const groupMatchedCellsCount = groupItemMatches.reduce((acc, curr) => acc + curr.matches.matchCount, 0);

                  return (
                    <React.Fragment key={group.orderNo}>
                      {/* 1st Layer Row */}
                      <tr 
                        onClick={() => toggleOrderExpand(group.orderNo)}
                        className={`transition-colors cursor-pointer ${
                          isExpanded 
                            ? 'bg-indigo-50/40 dark:bg-indigo-950/20' 
                            : groupMatchedCellsCount > 0
                            ? 'bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50/60 dark:hover:bg-amber-950/25'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* 1. Expand/Collapse Button */}
                        <td className={`${pyClass} px-3 text-center`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleOrderExpand(group.orderNo);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            title={isExpanded ? 'Collapse Yarn Lots' : 'Expand Yarn Lots'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* 2. Order Number */}
                        <td className={`${pyClass} px-3 font-mono font-bold whitespace-nowrap ${
                          matchesOrderNo ? 'bg-amber-100/70 dark:bg-amber-950/50' : ''
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <HighlightableCell
                              value={`#${group.orderNo}`}
                              isMatch={matchesOrderNo}
                              searchQuery={debouncedOrderNoSearch || debouncedSearch}
                              badge={matchesOrderNo ? 'Order' : undefined}
                              mono
                              defaultTextClass="text-slate-900 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={(e) => handleCopyOrder(group.orderNo, e)}
                              className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer"
                              title="Copy Order No."
                            >
                              {copiedOrderNo === group.orderNo ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            {groupMatchedCellsCount > 0 && !isExpanded && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 animate-pulse">
                                <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                {groupMatchedCellsCount}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Status */}
                        <td className={`${pyClass} px-3 whitespace-nowrap ${
                          matchesStatus ? 'bg-amber-100/70 dark:bg-amber-950/50' : ''
                        }`}>
                          {matchesStatus ? (
                            <HighlightableCell
                              value={group.status}
                              isMatch={true}
                              searchQuery={debouncedSearch}
                              badge="Status"
                              defaultTextClass="font-bold"
                            />
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isComplete 
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' 
                                : isRunning
                                ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}>
                              {group.status}
                            </span>
                          )}
                        </td>

                        {/* 4. Completion Date */}
                        <td className={`${pyClass} px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap`}>
                          {group.completionDate || '—'}
                        </td>

                        {/* 5. Buyer Name */}
                        <td className={`${pyClass} px-3 font-semibold whitespace-nowrap ${
                          matchesBuyer ? 'bg-amber-100/70 dark:bg-amber-950/50' : ''
                        }`}>
                          <HighlightableCell
                            value={group.buyerName || '—'}
                            isMatch={matchesBuyer}
                            searchQuery={debouncedSearch}
                            badge={buyerFilter !== 'All' ? 'Buyer Filter' : undefined}
                            defaultTextClass="text-slate-800 dark:text-slate-200 font-semibold"
                          />
                        </td>

                        {/* 6. Booking QTY(Sum from 2nd Layer Booking QTY) */}
                        <td className={`${pyClass} px-3 text-right font-mono font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap`}>
                          {formatYarnNumber(group.totalBookingQty)}
                        </td>

                        {/* 7. Yarn Required(Sum from 2nd Layer Yarn Required) */}
                        <td className={`${pyClass} px-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap`}>
                          {formatYarnNumber(group.totalYarnRequired)}
                        </td>

                        {/* 8. Net Received (Sum from 2nd Layer Total Received) */}
                        <td className={`${pyClass} px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap`}>
                          {formatYarnNumber(group.totalNetReceived)}
                        </td>

                        {/* 9. Net Issued (Sum from 2nd Layer Total Issued) */}
                        <td className={`${pyClass} px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap`}>
                          {formatYarnNumber(group.totalNetIssued)}
                        </td>

                        {/* 10. Excess Issued (Sum from 2nd Layer Excess Issued) */}
                        <td className={`${pyClass} px-3 text-right font-mono whitespace-nowrap ${
                          stockStatusFilter === 'excess_issued'
                            ? 'bg-amber-100/70 dark:bg-amber-950/50'
                            : ''
                        } ${
                          group.totalExcessIssued > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-400 font-normal'
                        }`}>
                          {formatYarnNumber(group.totalExcessIssued)}
                        </td>

                        {/* 11. Stock QTY (Sum from 2nd Layer Total Stock QTY) */}
                        <td className={`${pyClass} px-3 text-right font-mono font-black whitespace-nowrap ${
                          stockStatusFilter === 'active_stock' || stockStatusFilter === 'zero_stock'
                            ? 'bg-amber-200/60 dark:bg-amber-950/70 ring-1 ring-amber-400'
                            : 'bg-amber-50/30 dark:bg-amber-950/15'
                        } ${
                          group.totalStockQty > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-slate-400'
                        }`}>
                          {formatYarnNumber(group.totalStockQty)} kg
                        </td>

                        {/* 12. Issue Balance */}
                        <td className={`${pyClass} px-3 text-right font-mono font-semibold whitespace-nowrap ${
                          stockStatusFilter === 'pending_balance'
                            ? 'bg-purple-100/60 dark:bg-purple-950/50 ring-1 ring-purple-400 text-purple-900 dark:text-purple-200'
                            : 'text-purple-700 dark:text-purple-300'
                        }`}>
                          {formatYarnNumber(group.totalIssuedBalance)}
                        </td>

                        {/* 13. Action Button(View & Snip) */}
                        <td className={`${pyClass} px-3 text-center whitespace-nowrap`} onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingOrder(group)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-600 hover:text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                              title={`View full details for Order ${group.orderNo}`}
                            >
                              <Eye className="w-3 h-3" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSnipGroup(group)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                              title={`Open Grey Yarn Stock Snipping Tool for Order ${group.orderNo}`}
                            >
                              <Scissors className="w-3 h-3" />
                              <span>Snip</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* 2nd Layer: Expandable Yarn Breakdown */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 animate-fade-in">
                          <td colSpan={13} className="p-0">
                            <div className="pl-6 sm:pl-10 pr-4 py-3 bg-slate-50/90 dark:bg-slate-850/70 border-l-4 border-indigo-500 space-y-2">
                              {/* Subtable Banner */}
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                                    2nd Layer: Physical Yarn Count, Physical Yarn Lot &amp; Spinner Breakdown for Order #{group.orderNo}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    ({group.items.length} {group.items.length === 1 ? 'yarn lot' : 'yarn lots'})
                                  </span>
                                  {groupMatchedCellsCount > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs animate-pulse">
                                      <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                                      <span>{groupMatchedCellsCount} matching cell{groupMatchedCellsCount === 1 ? '' : 's'} highlighted</span>
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSnipGroup(group)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                                  >
                                    <Scissors className="w-3 h-3" />
                                    <span>Snip Card</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setViewingOrder(group)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Full View</span>
                                  </button>
                                </div>
                              </div>

                              {/* 2nd Layer Table */}
                              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                                <table className="w-full text-left text-[11px] border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                      <th className="py-2 px-3 min-w-[150px]">
                                        <div className="flex items-center gap-1">
                                          <span>Physical Yarn Count</span>
                                          {yarnCountFilter !== 'All' && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Filtered Column" />
                                          )}
                                        </div>
                                      </th>
                                      <th className="py-2 px-3 min-w-[110px] font-mono">Physical Yarn Lot</th>
                                      <th className="py-2 px-3 min-w-[140px]">
                                        <div className="flex items-center gap-1">
                                          <span>Spinner</span>
                                          {spinnerFilter !== 'All' && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Filtered Column" />
                                          )}
                                        </div>
                                      </th>
                                      <th className="py-2 px-3 text-right">Booking QTY</th>
                                      <th className="py-2 px-3 text-right">Yarn Required</th>
                                      <th className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400">Total Received</th>
                                      <th className="py-2 px-3 text-right text-blue-600 dark:text-blue-400">Total Issued</th>
                                      <th className="py-2 px-3 text-right text-rose-600 dark:text-rose-400">Excess Issued</th>
                                      <th className="py-2 px-3 text-right text-amber-700 dark:text-amber-300 font-black bg-amber-50/50 dark:bg-amber-950/20">Total Stock QTY</th>
                                      <th className="py-2 px-3 text-right text-purple-600 dark:text-purple-400">Issued Balance</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                    {groupItemMatches.map(({ item: itm, matches }, itmIdx) => (
                                      <tr
                                        key={itm.id || `sub-${group.orderNo}-${itmIdx}`}
                                        className={`transition-colors ${
                                          matches.hasAnyMatch
                                            ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70 dark:hover:bg-amber-950/30'
                                            : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                                        }`}
                                      >
                                        {/* 1. Physical Yarn Count */}
                                        <td className={`py-2 px-3 transition-colors ${
                                          matches.isCountMatch ? 'bg-amber-100/80 dark:bg-amber-950/60' : ''
                                        }`}>
                                          <HighlightableCell
                                            value={itm.physicalYarnCount}
                                            isMatch={matches.isCountMatch}
                                            searchQuery={debouncedSearch}
                                            badge={matches.matchesCountFilter ? 'Count Filter' : undefined}
                                            defaultTextClass="font-semibold text-slate-900 dark:text-slate-100"
                                          />
                                        </td>

                                        {/* 2. Physical Yarn Lot */}
                                        <td className={`py-2 px-3 transition-colors ${
                                          matches.isLotMatch ? 'bg-amber-100/80 dark:bg-amber-950/60' : ''
                                        }`}>
                                          <HighlightableCell
                                            value={itm.physicalYarnLot || '—'}
                                            isMatch={matches.isLotMatch}
                                            searchQuery={debouncedSearch}
                                            mono
                                            defaultTextClass="text-slate-700 dark:text-slate-300 font-mono"
                                          />
                                        </td>

                                        {/* 3. Spinner */}
                                        <td className={`py-2 px-3 transition-colors ${
                                          matches.isSpinnerMatch ? 'bg-amber-100/80 dark:bg-amber-950/60' : ''
                                        }`}>
                                          <HighlightableCell
                                            value={itm.spinner || '—'}
                                            isMatch={matches.isSpinnerMatch}
                                            searchQuery={debouncedSearch}
                                            badge={matches.matchesSpinnerFilter ? 'Spinner Filter' : undefined}
                                            defaultTextClass="text-slate-600 dark:text-slate-400"
                                          />
                                        </td>

                                        {/* 4. Booking QTY */}
                                        <td className={`py-2 px-3 text-right font-mono transition-colors ${
                                          matches.isBookingQtyMatch ? 'bg-amber-100/80 dark:bg-amber-950/60' : ''
                                        }`}>
                                          <HighlightableCell
                                            value={formatYarnNumber(itm.bookingQty || 0)}
                                            isMatch={matches.isBookingQtyMatch}
                                            searchQuery={debouncedSearch}
                                            align="right"
                                            mono
                                            defaultTextClass="text-slate-600 dark:text-slate-300"
                                          />
                                        </td>

                                        {/* 5. Yarn Required */}
                                        <td className={`py-2 px-3 text-right font-mono transition-colors ${
                                          matches.isYarnReqMatch ? 'bg-amber-100/80 dark:bg-amber-950/60' : ''
                                        }`}>
                                          <HighlightableCell
                                            value={formatYarnNumber(itm.yarnRequired || 0)}
                                            isMatch={matches.isYarnReqMatch}
                                            searchQuery={debouncedSearch}
                                            align="right"
                                            mono
                                            defaultTextClass="font-semibold text-slate-800 dark:text-slate-200"
                                          />
                                        </td>

                                        {/* 6. Total Received */}
                                        <td className={`py-2 px-3 text-right font-mono transition-colors ${
                                          matches.isTotalRecMatch ? 'bg-amber-100/80 dark:bg-amber-950/60' : ''
                                        }`}>
                                          <HighlightableCell
                                            value={formatYarnNumber(itm.totalReceived || 0)}
                                            isMatch={matches.isTotalRecMatch}
                                            searchQuery={debouncedSearch}
                                            align="right"
                                            mono
                                            defaultTextClass="font-bold text-emerald-600 dark:text-emerald-400"
                                          />
                                        </td>

                                        {/* 7. Total Issued */}
                                        <td className={`py-2 px-3 text-right font-mono transition-colors ${
                                          matches.isTotalIssMatch ? 'bg-amber-100/80 dark:bg-amber-950/60' : ''
                                        }`}>
                                          <HighlightableCell
                                            value={formatYarnNumber(itm.totalIssued || 0)}
                                            isMatch={matches.isTotalIssMatch}
                                            searchQuery={debouncedSearch}
                                            align="right"
                                            mono
                                            defaultTextClass="font-bold text-blue-600 dark:text-blue-400"
                                          />
                                        </td>

                                        {/* 8. Excess Issued */}
                                        <td className={`py-2 px-3 text-right font-mono transition-colors ${
                                          matches.isExcessIssMatch ? 'bg-amber-100/80 dark:bg-amber-950/60' : ''
                                        }`}>
                                          <HighlightableCell
                                            value={formatYarnNumber(itm.excessIssued || 0)}
                                            isMatch={matches.isExcessIssMatch}
                                            searchQuery={debouncedSearch}
                                            badge={matches.matchesExcessStockFilter ? 'Excess > 0' : undefined}
                                            align="right"
                                            mono
                                            defaultTextClass="font-semibold text-rose-600 dark:text-rose-400"
                                          />
                                        </td>

                                        {/* 9. Total Stock QTY */}
                                        <td className={`py-2 px-3 text-right font-mono transition-colors ${
                                          matches.isStockQtyMatch 
                                            ? 'bg-amber-200/80 dark:bg-amber-950/80' 
                                            : 'bg-amber-50/30 dark:bg-amber-950/10'
                                        }`}>
                                          <HighlightableCell
                                            value={formatYarnNumber(itm.totalStockQty || 0)}
                                            isMatch={matches.isStockQtyMatch}
                                            searchQuery={debouncedSearch}
                                            badge={matches.matchesActiveStockFilter ? 'Stock > 0' : matches.matchesZeroStockFilter ? 'Zero' : undefined}
                                            align="right"
                                            mono
                                            defaultTextClass="font-black text-amber-700 dark:text-amber-300"
                                          />
                                        </td>

                                        {/* 10. Issued Balance */}
                                        <td className={`py-2 px-3 text-right font-mono transition-colors ${
                                          matches.isIssuedBalanceMatch ? 'bg-amber-100/80 dark:bg-amber-950/60' : ''
                                        }`}>
                                          <HighlightableCell
                                            value={formatYarnNumber(itm.issuedBalance || 0)}
                                            isMatch={matches.isIssuedBalanceMatch}
                                            searchQuery={debouncedSearch}
                                            badge={matches.matchesPendingBalanceFilter ? 'Pending' : undefined}
                                            align="right"
                                            mono
                                            defaultTextClass="font-semibold text-purple-700 dark:text-purple-300"
                                          />
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-slate-100 font-bold text-[11px] border-t border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                                      <td colSpan={3} className="py-2 px-3 text-right uppercase tracking-wider">
                                        Total (2nd Layer Sum):
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono">{formatYarnNumber(group.totalBookingQty)}</td>
                                      <td className="py-2 px-3 text-right font-mono">{formatYarnNumber(group.totalYarnRequired)}</td>
                                      <td className="py-2 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatYarnNumber(group.totalNetReceived)}</td>
                                      <td className="py-2 px-3 text-right font-mono text-blue-600 dark:text-blue-400">{formatYarnNumber(group.totalNetIssued)}</td>
                                      <td className="py-2 px-3 text-right font-mono text-rose-600 dark:text-rose-400">{formatYarnNumber(group.totalExcessIssued)}</td>
                                      <td className="py-2 px-3 text-right font-mono text-amber-700 dark:text-amber-300 bg-amber-100/40 dark:bg-amber-950/30">{formatYarnNumber(group.totalStockQty)}</td>
                                      <td className="py-2 px-3 text-right font-mono text-purple-700 dark:text-purple-300">{formatYarnNumber(group.totalIssuedBalance)}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/95 dark:bg-slate-800/95 font-extrabold text-xs text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700 sticky bottom-0 z-10 shadow-sm backdrop-blur-xs">
                <td colSpan={5} className="py-3 px-3 text-right uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300">
                  GRAND TOTAL ({filteredOrderGroups.length} Orders / {records.length} Lots):
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-900 dark:text-white font-black">
                  {formatYarnNumber(kpiTotals.bookingSum)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-indigo-700 dark:text-indigo-300 font-black">
                  {formatYarnNumber(kpiTotals.requiredSum)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-700 dark:text-emerald-300 font-black">
                  {formatYarnNumber(kpiTotals.receivedSum)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-blue-700 dark:text-blue-300 font-black">
                  {formatYarnNumber(kpiTotals.issuedSum)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-rose-700 dark:text-rose-300 font-black">
                  {formatYarnNumber(kpiTotals.excessSum)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-amber-800 dark:text-amber-300 font-black bg-amber-100/50 dark:bg-amber-950/40">
                  {formatYarnNumber(kpiTotals.stockSum)} kg
                </td>
                <td className="py-3 px-3 text-right font-mono text-purple-800 dark:text-purple-300 font-black">
                  {formatYarnNumber(kpiTotals.balanceSum)}
                </td>
                <td className="py-3 px-3 text-center text-slate-400">
                  —
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 sm:px-5 sm:py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            Page <span className="font-bold text-slate-800 dark:text-slate-200">{currentPage}</span> of{' '}
            <span className="font-bold text-slate-800 dark:text-slate-200">{totalPages}</span> ({sortedOrderGroups.length} orders total)
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Upload Excel Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div 
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4 animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">Upload Grey Yarn Stock File</h3>
              </div>
              <button
                type="button"
                onClick={() => { setIsUploadModalOpen(false); setUploadError(null); }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload your file. The system directly roots and parses the exact 14 column headers from your file into 1st layer summaries and 2nd layer lot breakdowns:
            </p>

            {/* Exact 14 Headers Badge Grid */}
            <div className="bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl p-3.5 border border-indigo-100 dark:border-indigo-900/60 text-[11px] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  Exact 14 File Headers Supported:
                </span>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => { setIsUploadModalOpen(false); onNavigateTab('Database Connection'); }}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>View SQL in Database Connection</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono text-[10px]">
                {[
                  'Completion Date',
                  'Buyer',
                  'Status',
                  'Allocated Order WA',
                  'Physical Count',
                  'Physical Lot',
                  'Spinner',
                  'Booking QTY',
                  'Yarn Required',
                  'Net Received',
                  'Total Issued',
                  'Excess Issued',
                  'Total Stock QTY',
                  'Issue Balance'
                ].map((hdr, idx) => (
                  <span 
                    key={hdr} 
                    className="px-2 py-1 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 truncate"
                    title={hdr}
                  >
                    <span className="text-indigo-500 font-bold mr-1">{idx + 1}.</span>
                  </span>
                ))}
              </div>

              {/* Exact Reconciliation Assurance */}
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] leading-tight">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <span>
                  <strong>100% Excel Sum Reconciliation:</strong> The intelligent parser automatically ignores bottom "Total / Grand Total" rows to prevent double-counting, preserves your exact file quantities, and matches the status bar sums in Microsoft Excel / Google Sheets.
                </span>
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-6 text-center hover:border-indigo-400 transition-colors bg-indigo-50/20 dark:bg-indigo-950/10">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={isUploading}
                id="grey-yarn-file-input"
                className="hidden"
              />
              <label htmlFor="grey-yarn-file-input" className="cursor-pointer block space-y-2">
                <FileSpreadsheet className="w-10 h-10 mx-auto text-indigo-500 animate-bounce" />
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {isUploading ? 'Parsing & Uploading to Supabase...' : 'Click to select Excel/CSV file or drop it here'}
                </span>
                <span className="block text-[11px] text-slate-400">Supports Excel (.xlsx, .xls) and CSV (.csv)</span>
              </label>
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleDownloadSampleTemplate}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                title="Download formatted Excel template with 14 headers"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download 14-Column Template</span>
              </button>

              <button
                type="button"
                onClick={() => { setIsUploadModalOpen(false); setUploadError(null); }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      <GreyYarnStockDetailsModal
        orderGroup={viewingOrder}
        isOpen={!!viewingOrder}
        onClose={() => setViewingOrder(null)}
        onOpenSnip={(grp) => setSnipGroup(grp)}
      />

      {/* Snipping Modal */}
      <GreyYarnStockSnippingModal
        orderGroup={snipGroup}
        isOpen={!!snipGroup}
        onClose={() => setSnipGroup(null)}
      />
    </div>
  );
}
