/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Knitting Status Tracking System
 * Layered Order & Fabric Production Tracking under Plan Order Followup
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Search,
  Filter,
  Download,
  UploadCloud,
  Eye,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  Clock,
  Activity,
  AlertCircle,
  FileSpreadsheet,
  X,
  Layers,
  Building2,
  User,
  Calendar,
  Sparkles,
  RefreshCw,
  ChevronsDown,
  ChevronsUp,
  ShieldAlert,
  ShieldCheck,
  Database,
  Lock
} from 'lucide-react';
import { UserRecord } from './UserManagementView';
import { KnittingStatusOrder, KnittingStatusItem } from '../types';
import {
  KnittingStatusStorage,
  calculateKnittingCondition,
  aggregateOrderValues,
  formatExcelDate,
  sortKnittingItems,
  KnittingCondition
} from '../lib/knittingStatusStore';
import { KnittingOrderDetailsModal } from './KnittingOrderDetailsModal';
import { SupabaseSync } from '../lib/supabaseClient';
import TextileClosePMCView from './TextileClosePMCView';
import { SyncProgressBar, SyncProgressState } from './SyncProgressBar';

interface KnittingStatusViewProps {
  currentUser?: UserRecord | null;
  initialTab?: 'knitting_status' | 'textile_close_pmc';
}

export default function KnittingStatusView({ currentUser, initialTab }: KnittingStatusViewProps) {
  // Active Sub-Tab: Knitting Status vs Textile Close By PMC
  const [activeSubTab, setActiveSubTab] = useState<'knitting_status' | 'textile_close_pmc'>(
    initialTab || 'knitting_status'
  );

  useEffect(() => {
    if (initialTab) {
      setActiveSubTab(initialTab);
    }
  }, [initialTab]);

  // Orders State
  const [orders, setOrders] = useState<KnittingStatusOrder[]>(() => KnittingStatusStorage.getOrders());
  
  // Expanded Order IDs
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Expand the first order by default for immediate preview
    const first = KnittingStatusStorage.getOrders()[0];
    if (first) initial.add(first.id);
    return initial;
  });

  // Sync & Progress States
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem('epyllion_knitting_status_last_sync') || null;
    } catch {
      return null;
    }
  });

  const [syncProgress, setSyncProgress] = useState<SyncProgressState>({
    isActive: false,
    type: 'sync',
    percent: 0,
    stage: ''
  });

  // Supabase Real-time Cloud Synchronization
  useEffect(() => {
    if (!SupabaseSync.isConfigured()) return;
    
    // Fetch initial from Supabase
    SupabaseSync.fetchKnittingOrders().then(remoteOrders => {
      if (Array.isArray(remoteOrders) && remoteOrders.length > 0) {
        const sanitized = remoteOrders.map(aggregateOrderValues);
        setOrders(sanitized);
        KnittingStatusStorage.saveOrders(sanitized);
        const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        setLastSyncedAt(nowStr);
        try {
          localStorage.setItem('epyllion_knitting_status_last_sync', nowStr);
        } catch {}
      } else {
        // Auto-seed to Supabase if empty
        const current = KnittingStatusStorage.getOrders();
        if (current && current.length > 0) {
          SupabaseSync.bulkSaveKnittingOrders(current, false).catch(() => {});
        }
      }
    });

    // Real-time subscription
    const unsub = SupabaseSync.subscribeToKnittingOrders(({ eventType, record, id }) => {
      if (eventType === 'DELETE') {
        setOrders(prev => {
          const next = prev.filter(o => o.id !== id && o.orderNo !== id);
          KnittingStatusStorage.saveOrders(next);
          return next;
        });
      } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (!record || (!record.id && !record.orderNo)) return;
        setOrders(prev => {
          const idx = prev.findIndex(o => (o.id && record.id && o.id === record.id) || (o.orderNo && record.orderNo && o.orderNo === record.orderNo));
          const next = idx >= 0 ? prev.map((o, i) => i === idx ? record : o) : [record, ...prev];
          KnittingStatusStorage.saveOrders(next);
          return next;
        });
      }
    });

    return () => {
      unsub();
    };
  }, []);

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [conditionFilter, setConditionFilter] = useState<'All' | KnittingCondition>('All');
  const [buyerFilter, setBuyerFilter] = useState<string>('All');
  const [teamLeaderFilter, setTeamLeaderFilter] = useState<string>('All');

  // Admin status
  const isAdmin = currentUser?.userType === 'Admin';

  // Modal States
  const [viewingOrder, setViewingOrder] = useState<KnittingStatusOrder | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // File Input Ref for Excel upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Helper to persist orders
  const updateOrdersState = (newOrders: KnittingStatusOrder[]) => {
    const sanitized = newOrders.map(aggregateOrderValues);
    setOrders(sanitized);
    KnittingStatusStorage.saveOrders(sanitized);
    if (SupabaseSync.isConfigured()) {
      SupabaseSync.bulkSaveKnittingOrders(sanitized, true).catch(err => console.warn('Supabase knitting order sync notice:', err));
    }
  };

  // Toggle single order expand/collapse
  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Expand All / Collapse All
  const expandAll = () => {
    const pageIds = new Set(paginatedOrders.map(o => o.id));
    setExpandedOrderIds(prev => new Set([...prev, ...pageIds]));
  };

  const collapseAll = () => {
    setExpandedOrderIds(new Set());
  };

  // Distinct Filter Options
  const buyerOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.buyerName) set.add(o.buyerName);
    });
    return Array.from(set).sort();
  }, [orders]);

  const teamLeaderOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.teamLeader) set.add(o.teamLeader);
    });
    return Array.from(set).sort();
  }, [orders]);

  // Criteria-Filtered Orders (matching Buyer, Team Leader, and Search query)
  const criteriaFilteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Buyer filter
      if (buyerFilter !== 'All' && order.buyerName !== buyerFilter) {
        return false;
      }

      // Team Leader filter
      if (teamLeaderFilter !== 'All' && order.teamLeader !== teamLeaderFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesOrder =
          order.orderNo.toLowerCase().includes(q) ||
          order.buyerName.toLowerCase().includes(q) ||
          order.teamLeader.toLowerCase().includes(q);

        const matchesItem = order.items?.some(i =>
          i.color.toLowerCase().includes(q) ||
          i.fabType.toLowerCase().includes(q) ||
          i.mcType.toLowerCase().includes(q) ||
          i.productionUnit.toLowerCase().includes(q)
        );

        if (!matchesOrder && !matchesItem) return false;
      }

      return true;
    });
  }, [orders, buyerFilter, teamLeaderFilter, searchTerm]);

  // Filtered Orders (including Condition filter)
  const filteredOrders = useMemo(() => {
    if (conditionFilter === 'All') return criteriaFilteredOrders;
    return criteriaFilteredOrders.filter(order => {
      const condition = calculateKnittingCondition(order.greyQty, order.knitBalance);
      return condition === conditionFilter;
    });
  }, [criteriaFilteredOrders, conditionFilter]);

  // Pagination State: Show 50 orders in a page as requested
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, conditionFilter, buyerFilter, teamLeaderFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredOrders.length);

  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, startIndex, endIndex]);

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push('...');
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (safeCurrentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

  // Summary Metrics: React dynamically to active filter formation
  const summaryMetrics = useMemo(() => {
    let totalReq = 0;
    let totalGrey = 0;
    let totalProd = 0;
    let totalBal = 0;

    // Quantities are computed strictly over the currently active filtered orders
    filteredOrders.forEach(o => {
      totalReq += Number(o.reqQty) || 0;
      totalGrey += Number(o.greyQty) || 0;
      totalProd += Number(o.production) || 0;
      totalBal += Number(o.knitBalance) || 0;
    });

    // Running, Pending, Complete counts within the current Buyer/Leader/Search scope
    let runningCount = 0;
    let pendingCount = 0;
    let completeCount = 0;

    criteriaFilteredOrders.forEach(o => {
      const cond = calculateKnittingCondition(o.greyQty, o.knitBalance);
      if (cond === 'Running') runningCount++;
      else if (cond === 'Pending') pendingCount++;
      else if (cond === 'Complete') completeCount++;
    });

    const isFiltered =
      conditionFilter !== 'All' ||
      buyerFilter !== 'All' ||
      teamLeaderFilter !== 'All' ||
      Boolean(searchTerm.trim());

    return {
      totalOrders: filteredOrders.length,
      scopeTotalOrders: criteriaFilteredOrders.length,
      allOrdersCount: orders.length,
      isFiltered,
      totalReq,
      totalGrey,
      totalProd,
      totalBal,
      runningCount,
      pendingCount,
      completeCount
    };
  }, [filteredOrders, criteriaFilteredOrders, conditionFilter, buyerFilter, teamLeaderFilter, searchTerm, orders.length]);

  const clearAllFilters = () => {
    setConditionFilter('All');
    setBuyerFilter('All');
    setTeamLeaderFilter('All');
    setSearchTerm('');
  };

  // Manual Cloud Sync Handler with Progress Tracking
  const handleSyncData = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgress({
      isActive: true,
      type: 'sync',
      title: 'Synchronizing Knitting Status with Supabase Cloud',
      percent: 20,
      stage: 'Connecting to Supabase cloud...'
    });

    try {
      const remote = await SupabaseSync.fetchKnittingOrders((loaded, total, percent) => {
        setSyncProgress({
          isActive: true,
          type: 'sync',
          title: 'Synchronizing Knitting Status with Supabase Cloud',
          percent: Math.max(20, percent),
          stage: `Downloading orders (${loaded.toLocaleString()} / ${total.toLocaleString()})...`,
          current: loaded,
          total
        });
      });

      if (Array.isArray(remote) && remote.length > 0) {
        const sanitized = remote.map(aggregateOrderValues);
        setOrders(sanitized);
        KnittingStatusStorage.saveOrders(sanitized);
        const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        setLastSyncedAt(nowStr);
        try {
          localStorage.setItem('epyllion_knitting_status_last_sync', nowStr);
        } catch {}

        setSyncProgress({
          isActive: true,
          type: 'sync',
          title: 'Sync Complete',
          percent: 100,
          stage: `Successfully synchronized ${sanitized.length.toLocaleString()} orders from Supabase.`
        });
        showToast(`Synchronized ${sanitized.length} orders from Supabase Cloud.`);
      } else {
        setSyncProgress({
          isActive: true,
          type: 'sync',
          title: 'Sync Complete',
          percent: 100,
          stage: 'Cloud database is currently empty.'
        });
        showToast('Cloud database synchronized (0 remote orders).');
      }

      setTimeout(() => {
        setSyncProgress(prev => ({ ...prev, isActive: false }));
      }, 2500);
    } catch (err: any) {
      console.error('Knitting status sync error:', err);
      setSyncProgress({
        isActive: true,
        type: 'sync',
        title: 'Sync Failed',
        percent: 100,
        stage: 'Failed to sync with Supabase',
        error: err.message || 'Network error'
      });
      showToast('Sync failed: ' + (err.message || 'Error'));
    } finally {
      setIsSyncing(false);
    }
  };

  // Export to Excel with Download Progress Bar
  const handleExportExcel = () => {
    setSyncProgress({
      isActive: true,
      type: 'download',
      title: 'Generating Knitting Status Excel Report',
      percent: 25,
      stage: 'Compiling Order Summary and Fabric Item details...'
    });

    setTimeout(() => {
      try {
        setSyncProgress(prev => ({
          ...prev,
          percent: 65,
          stage: 'Formatting worksheets and table columns...'
        }));

        // 1. Order Summary Sheet
        const orderData = filteredOrders.map(o => {
          const cond = calculateKnittingCondition(o.greyQty, o.knitBalance);
          return {
            'Order No.': o.orderNo,
            'Condition': cond,
            'Buyer Name': o.buyerName,
            'Team Leader': o.teamLeader,
            'Knit Start Date': o.knitStartDate,
            'Knit End Date': o.knitEndDate,
            'Req. Qty (Kg)': o.reqQty,
            'Grey Qty (Kg)': o.greyQty,
            'Production (Kg)': o.production,
            'Knit Balance (Kg)': o.knitBalance,
            'Items Count': o.items?.length || 0
          };
        });

        // 2. Detailed Item Sheet
        const itemData: any[] = [];
        filteredOrders.forEach(o => {
          const orderCond = calculateKnittingCondition(o.greyQty, o.knitBalance);
          (o.items || []).forEach(itm => {
            itemData.push({
              'Order No.': o.orderNo,
              'Order Condition': orderCond,
              'Buyer Name': o.buyerName,
              'Team Leader': o.teamLeader,
              'Color': itm.color,
              'M/C Type': itm.mcType,
              'Fab. Type': itm.fabType,
              'FGSM': itm.fgsm,
              'F. Width': itm.fWidth,
              'Yarn Count': itm.yarnCount,
              'Gauge & Dia': itm.gaugeDia,
              'Knit Start Date': itm.knitStartDate,
              'Knit End Date': itm.knitEndDate,
              'Req. Qty': itm.reqQty,
              'Grey Qty': itm.greyQty,
              'Production': itm.production,
              'Hold': itm.hold,
              'Reject': itm.reject,
              'ITM QTY': itm.itmQty,
              'Knit Balance': itm.knitBalance,
              'Production Unit': itm.productionUnit,
              'Avg. Prod/Day': itm.avgProdPerDay
            });
          });
        });

        const wb = XLSX.utils.book_new();
        const wsOrders = XLSX.utils.json_to_sheet(orderData);
        const wsItems = XLSX.utils.json_to_sheet(itemData);

        XLSX.utils.book_append_sheet(wb, wsOrders, 'Order Summary');
        XLSX.utils.book_append_sheet(wb, wsItems, 'Fabric Details (Layer 2)');

        const filename = `Epyllion_Knitting_Status_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);

        setSyncProgress({
          isActive: true,
          type: 'download',
          title: 'Export Complete',
          percent: 100,
          stage: `Successfully exported ${filteredOrders.length.toLocaleString()} orders.`
        });
        showToast('Knitting Status Excel report exported successfully!');

        setTimeout(() => {
          setSyncProgress(prev => ({ ...prev, isActive: false }));
        }, 2500);
      } catch (e: any) {
        console.error('Export error:', e);
        setSyncProgress({
          isActive: true,
          type: 'download',
          title: 'Export Failed',
          percent: 100,
          stage: 'Failed to generate Excel file',
          error: e.message
        });
        showToast('Failed to export Excel file: ' + e.message);
      }
    }, 150);
  };

  // Helper for flexible Excel column header resolution (handles newlines, extra spaces, case differences)
  const normalizeKey = (str: string): string => {
    return String(str || '').toLowerCase().replace(/[\r\n\t_.\-/\s]+/g, '');
  };

  const getExcelValue = (row: Record<string, any>, candidateKeys: string[], defaultValue: any = ''): any => {
    if (!row) return defaultValue;

    // 1. Direct match
    for (const k of candidateKeys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return row[k];
      }
    }

    // 2. Normalized match (strips \r, \n, spaces, dots, hyphens)
    const rowKeys = Object.keys(row);
    const normalizedRowMap = new Map<string, string>();
    for (const rk of rowKeys) {
      const norm = normalizeKey(rk);
      if (!normalizedRowMap.has(norm)) {
        normalizedRowMap.set(norm, rk);
      }
    }

    for (const candidate of candidateKeys) {
      const normCand = normalizeKey(candidate);
      const matchedKey = normalizedRowMap.get(normCand);
      if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') {
        return row[matchedKey];
      }
    }

    // 3. Substring inclusion match (for partial header matches)
    for (const candidate of candidateKeys) {
      const normCand = normalizeKey(candidate);
      if (normCand.length < 4) continue;
      for (const [normRk, origRk] of normalizedRowMap.entries()) {
        // Only allow normRk to include normCand (the header in Excel contains the full candidate phrase).
        // Never allow normCand.includes(normRk) to prevent specific compound names matching shorter prefix columns.
        if (normRk.includes(normCand)) {
          if (row[origRk] !== undefined && row[origRk] !== null && String(row[origRk]).trim() !== '') {
            return row[origRk];
          }
        }
      }
    }

    return defaultValue;
  };

  // Upload Excel Handler (Upon upload remove previous data)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadModalOpen(false);

    setSyncProgress({
      isActive: true,
      type: 'upload',
      title: 'Uploading & Replacing Knitting Status Orders',
      percent: 15,
      stage: 'Reading Excel workbook...'
    });

    const reader = new FileReader();
    reader.onload = async evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });

        setSyncProgress(prev => ({
          ...prev,
          percent: 35,
          stage: 'Parsing order rows and fabric specifications...'
        }));

        // Check all sheets in the workbook
        const sheetNames = wb.SheetNames;
        const allRows: any[] = [];
        sheetNames.forEach(sName => {
          const sheet = wb.Sheets[sName];
          const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          if (Array.isArray(raw) && raw.length > 0) {
            allRows.push(...raw);
          }
        });

        if (allRows.length === 0) {
          setSyncProgress({
            isActive: false,
            type: 'upload',
            percent: 0,
            stage: '',
            error: 'The uploaded file contains no rows.'
          });
          showToast('The selected file contains no rows.');
          return;
        }

        // Group rows by Order No.
        const orderMap = new Map<string, KnittingStatusOrder>();

        allRows.forEach((row, idx) => {
          const rawOrderNo = getExcelValue(row, [
            'Order No.', 'Order No', 'Order', 'orderNo', 'OrderNumber', 'Order #', 'Order#'
          ]);
          const orderNo = String(rawOrderNo || `ORD-${idx + 1}`).trim().replace(/^#+/, '');
          if (!orderNo || orderNo === 'ORD-') return;

          // 2. Buyer Name from "Buyer Name" or "Buyer\nName"
          const rowBuyer = String(
            getExcelValue(row, [
              'Buyer Name',
              'Buyer\nName',
              'Buyer \nName',
              'Buyer\r\nName',
              'Buyer',
              'BUYER NAME',
              'Buyer_Name',
              'Brand',
              'Customer',
              'BuyerName'
            ]) || ''
          ).trim();

          const rowLeader = String(
            getExcelValue(row, [
              'Team Leader',
              'Team\nLeader',
              'Leader',
              'teamLeader',
              'TeamLeader',
              'Leader Name',
              'Incharge'
            ]) || ''
          ).trim();

          // Knit Start Date from "A. Knit Star", "A. Knit Start", etc.
          const rowKnitStart = formatExcelDate(
            getExcelValue(row, [
              'A. Knit Star',
              'A. Knit\nStar',
              'A. Knit Start',
              'A. Knit\nStart',
              'A. Knit Star Date',
              'A. Knit Start Date',
              'Knit Start Date',
              'Start Date'
            ])
          );

          // Knit End Date from "A. Knit End", "A. Knit\nEnd", etc.
          const rowKnitEnd = formatExcelDate(
            getExcelValue(row, [
              'A. Knit End',
              'A. Knit\nEnd',
              'A. Knit End Date',
              'Knit End Date',
              'End Date'
            ])
          );

          let existing = orderMap.get(orderNo);
          if (!existing) {
            existing = {
              id: `ks-ord-${orderNo}-${Date.now()}-${idx}`,
              orderNo,
              buyerName: rowBuyer || '',
              teamLeader: rowLeader || '',
              knitStartDate: rowKnitStart || '',
              knitEndDate: rowKnitEnd || '',
              reqQty: Number(getExcelValue(row, ['Req. Qty', 'Req Qty', 'Required Qty', 'Req.Qty', 'Rq Qty']) || 0),
              greyQty: Number(getExcelValue(row, ['Grey Qty', 'Grey QTY', 'GreyQty', 'Grey Fab Qty']) || 0),
              production: Number(getExcelValue(row, ['Production', 'Knitting Prod', 'Prod Qty', 'Total Prod']) || 0),
              knitBalance: Number(getExcelValue(row, ['Knit Balance', 'Balance Qty', 'Balance']) || 0),
              items: []
            };
            orderMap.set(orderNo, existing);
          } else {
            // If existing had empty and this row has real buyer name, update it
            if (rowBuyer && !existing.buyerName) {
              existing.buyerName = rowBuyer;
            }
            if (rowLeader && !existing.teamLeader) {
              existing.teamLeader = rowLeader;
            }
          }

          // Layer 2: Expanded Ledger / Fabric breakdown
          // 1. Take machine type from "M/C Type" or "M/C\nType"
          const mcType = String(
            getExcelValue(row, [
              'M/C Type',
              'M/C\nType',
              'MC Type',
              'MC\nType',
              'Machine Type',
              'Machine\nType',
              'M/C',
              'Machine'
            ]) || ''
          ).trim();

          // 2. Yarn Count from "Actual Count" or "Actual\nCount"
          const actualCount = String(
            getExcelValue(row, [
              'Actual Count',
              'Actual\nCount',
              'ActualCount',
              'Yarn Count',
              'Yarn\nCount',
              'Count',
              'Yarn'
            ]) || ''
          ).trim();

          const color = String(getExcelValue(row, ['Color', 'Fabric Color', 'Colour', 'Shade']) || '').trim();
          const fabType = String(
            getExcelValue(row, [
              'Fab. Type',
              'Fabric Type',
              'Fab Type',
              'Fabric',
              'Item Description'
            ]) || ''
          ).trim();

          const rawFgsm = getExcelValue(row, ['FGSM', 'GSM', 'Finish GSM', 'F.GSM']);
          const fgsm = rawFgsm !== '' && rawFgsm !== undefined
            ? (isNaN(Number(rawFgsm)) ? String(rawFgsm).trim() : Number(rawFgsm))
            : '';

          const rawFWidth = getExcelValue(row, ['F. Width', 'Finish Width', 'F Width', 'Width', 'Dia']);
          const fWidth = rawFWidth ? String(rawFWidth).trim() : '';

          const rawGaugeDia = getExcelValue(row, ['Gauge & Dia', 'Gauge', 'Dia / Gauge', 'Machine Dia / Gauge']);
          const gaugeDia = rawGaugeDia ? String(rawGaugeDia).trim() : '';

          const rawProdUnit = getExcelValue(row, ['Production Unit', 'Unit', 'Floor', 'Factory']);
          const productionUnit = rawProdUnit ? String(rawProdUnit).trim() : '';

          const rawAvgProd = getExcelValue(row, ['Avg. Prod/Day', 'Avg Prod/Day', 'Avg Prod', 'Avg. Prod', 'Avg.Prod/Day']);
          const avgProdPerDay = rawAvgProd !== '' && rawAvgProd !== undefined && !isNaN(Number(rawAvgProd)) ? Number(rawAvgProd) : 0;

          const hasItemDetails = Boolean(color || mcType || fabType || actualCount || fgsm || fWidth || gaugeDia || productionUnit);
          const reqQ = Number(getExcelValue(row, ['Req. Qty', 'Req Qty', 'Required Qty', 'Req.Qty', 'Rq Qty']) || 0);
          const greyQ = Number(getExcelValue(row, ['Grey Qty', 'Grey QTY', 'GreyQty', 'Grey Fab Qty']) || 0);
          const prod = Number(getExcelValue(row, ['Production', 'Knitting Prod', 'Prod Qty', 'Total Prod']) || 0);
          const rawKnitBal = getExcelValue(row, ['Knit Balance', 'Balance Qty', 'Balance']);
          const knitBal = rawKnitBal !== '' && rawKnitBal !== undefined ? Number(rawKnitBal) : Math.max(0, greyQ - prod);

          if (hasItemDetails || (greyQ > 0 || prod > 0)) {
            const rawHold = getExcelValue(row, ['Hold', 'Hold Qty']);
            const rawReject = getExcelValue(row, ['Reject', 'Reject Qty']);
            const rawItm = getExcelValue(row, ['ITM QTY', 'ITM Qty', 'ITM', 'Itm Qty']);

            const item: KnittingStatusItem = {
              id: `itm-${orderNo}-${existing.items.length + 1}`,
              color: color || '',
              mcType: mcType || '',
              fabType: fabType || '',
              fgsm: fgsm,
              fWidth: fWidth,
              yarnCount: actualCount || '',
              gaugeDia: gaugeDia,
              knitStartDate: rowKnitStart || existing.knitStartDate || '',
              knitEndDate: rowKnitEnd || existing.knitEndDate || '',
              reqQty: reqQ,
              greyQty: greyQ,
              production: prod,
              hold: rawHold !== '' && rawHold !== undefined && !isNaN(Number(rawHold)) ? Number(rawHold) : 0,
              reject: rawReject !== '' && rawReject !== undefined && !isNaN(Number(rawReject)) ? Number(rawReject) : 0,
              itmQty: rawItm !== '' && rawItm !== undefined && !isNaN(Number(rawItm)) ? Number(rawItm) : 0,
              knitBalance: knitBal,
              productionUnit: productionUnit,
              avgProdPerDay: avgProdPerDay
            };
            existing.items.push(item);
          }
        });

        const freshOrders = Array.from(orderMap.values()).map(aggregateOrderValues);

        if (freshOrders.length === 0) {
          setSyncProgress({
            isActive: false,
            type: 'upload',
            percent: 0,
            stage: '',
            error: 'No valid orders found in the uploaded file.'
          });
          showToast('No valid orders found in the uploaded file.');
          return;
        }

        // UPON UPLOAD REMOVE PREVIOUS DATA:
        // Replace existing orders in local state and storage
        setOrders(freshOrders);
        KnittingStatusStorage.saveOrders(freshOrders);
        setCurrentPage(1);

        setSyncProgress(prev => ({
          ...prev,
          percent: 55,
          stage: `Replacing database with ${freshOrders.length.toLocaleString()} fresh orders...`
        }));

        // Bulk save to Supabase Cloud with replace=true (purging old orders)
        if (SupabaseSync.isConfigured()) {
          const res = await SupabaseSync.bulkSaveKnittingOrders(
            freshOrders,
            true, // replace previous data
            (processed, total, pct, stage) => {
              setSyncProgress({
                isActive: true,
                type: 'upload',
                title: 'Uploading & Replacing Knitting Status Orders',
                percent: Math.min(95, 55 + Math.round(pct * 0.4)),
                stage: stage || `Saving to Supabase (${processed}/${total})...`,
                current: processed,
                total
              });
            }
          );

          if (!res.success) {
            console.warn('Supabase save notice:', res.error);
          }
        }

        const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        setLastSyncedAt(nowStr);
        try {
          localStorage.setItem('epyllion_knitting_status_last_sync', nowStr);
        } catch {}

        setSyncProgress({
          isActive: true,
          type: 'upload',
          title: 'Upload & Database Replacement Complete',
          percent: 100,
          stage: `Successfully uploaded ${freshOrders.length.toLocaleString()} orders and replaced previous data.`,
          current: freshOrders.length,
          total: freshOrders.length
        });

        showToast(`Uploaded ${freshOrders.length} orders. Previous data replaced successfully!`);
        setIsUploadModalOpen(false);

        setTimeout(() => {
          setSyncProgress(prev => ({ ...prev, isActive: false }));
        }, 3000);
      } catch (err: any) {
        console.error('File parse error:', err);
        setSyncProgress({
          isActive: true,
          type: 'upload',
          title: 'Upload Failed',
          percent: 100,
          stage: 'Failed to process Excel file',
          error: err.message || 'Unknown error'
        });
        showToast('Error reading Excel file: ' + err.message);
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Render Condition Badge
  const renderConditionBadge = (greyQty: number, knitBalance: number) => {
    const condition = calculateKnittingCondition(greyQty, knitBalance);

    if (condition === 'Complete') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          Complete
        </span>
      );
    }

    if (condition === 'Running') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
          </span>
          Running
        </span>
      );
    }

    // Pending
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-xs">
        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        Pending
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in border border-slate-700">
          <Sparkles className="w-5 h-5 text-indigo-400 dark:text-indigo-600 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-View Switcher: Knitting Status vs Textile Close By PMC */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('knitting_status')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'knitting_status'
              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Knitting Status</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('textile_close_pmc')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'textile_close_pmc'
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Textile Close By PMC</span>
        </button>
      </div>

      {activeSubTab === 'textile_close_pmc' ? (
        <TextileClosePMCView currentUser={currentUser} />
      ) : (
        <>
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Knitting Status
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Plan Order Followup
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Supabase Cloud
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Two-layer hierarchical tracking: Order Summary (Layer 1) with expandable Fabric & Item breakdown (Layer 2)</span>
                {lastSyncedAt && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                    <Clock className="w-3 h-3" /> Last synced: {lastSyncedAt}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Sync Cloud, Upload Excel, Export Excel */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sync Button */}
          <button
            id="sync-knitting-status-btn"
            type="button"
            onClick={handleSyncData}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            title="Fetch Latest Orders from Supabase Cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
          </button>

          <button
            id="upload-knitting-status-btn"
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs cursor-pointer"
            title="Import Excel and Replace Previous Data"
          >
            <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
            <span>Upload Excel</span>
          </button>

          <button
            id="export-knitting-status-btn"
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs cursor-pointer"
            title="Export Excel Report"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Sync & Upload/Download Progress Bar Banner */}
      <SyncProgressBar
        progress={syncProgress}
        onDismiss={() => setSyncProgress(prev => ({ ...prev, isActive: false, error: null }))}
        accentColor="indigo"
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Total Orders */}
        <button
          type="button"
          onClick={() => setConditionFilter('All')}
          className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
            conditionFilter === 'All'
              ? 'bg-white dark:bg-slate-800/90 border-slate-400 dark:border-slate-500 shadow-sm ring-2 ring-slate-300 dark:ring-slate-600'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700'
          }`}
          title="Show All Orders"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Orders</span>
            {conditionFilter === 'All' && (
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            )}
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {summaryMetrics.totalOrders}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            {summaryMetrics.isFiltered
              ? `${summaryMetrics.totalOrders} of ${summaryMetrics.allOrdersCount}`
              : 'In follow-up'}
          </div>
        </button>

        {/* Running */}
        <button
          type="button"
          onClick={() => setConditionFilter(conditionFilter === 'Running' ? 'All' : 'Running')}
          className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
            conditionFilter === 'Running'
              ? 'bg-blue-100/70 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 shadow-sm ring-2 ring-blue-500'
              : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 shadow-xs hover:bg-blue-50 dark:hover:bg-blue-950/30'
          }`}
          title="Filter by Running Orders (Click to toggle)"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Running</span>
            <span className={`h-2 w-2 rounded-full bg-blue-500 ${conditionFilter === 'Running' ? 'ring-2 ring-blue-300 animate-ping' : 'animate-pulse'}`} />
          </div>
          <div className="text-xl font-black text-blue-800 dark:text-blue-300 mt-1">
            {summaryMetrics.runningCount}
          </div>
          <div className="text-[10px] text-blue-600/80 dark:text-blue-400 mt-0.5 truncate">
            {conditionFilter === 'Running' ? 'Active filter' : 'Grey > Balance'}
          </div>
        </button>

        {/* Pending */}
        <button
          type="button"
          onClick={() => setConditionFilter(conditionFilter === 'Pending' ? 'All' : 'Pending')}
          className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
            conditionFilter === 'Pending'
              ? 'bg-amber-100/70 dark:bg-amber-900/40 border-amber-400 dark:border-amber-600 shadow-sm ring-2 ring-amber-500'
              : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 shadow-xs hover:bg-amber-50 dark:hover:bg-amber-950/30'
          }`}
          title="Filter by Pending Orders (Click to toggle)"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Pending</span>
            {conditionFilter === 'Pending' && (
              <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-300" />
            )}
          </div>
          <div className="text-xl font-black text-amber-800 dark:text-amber-300 mt-1">
            {summaryMetrics.pendingCount}
          </div>
          <div className="text-[10px] text-amber-600/80 dark:text-amber-400 mt-0.5 truncate">
            {conditionFilter === 'Pending' ? 'Active filter' : 'Grey = Balance'}
          </div>
        </button>

        {/* Complete */}
        <button
          type="button"
          onClick={() => setConditionFilter(conditionFilter === 'Complete' ? 'All' : 'Complete')}
          className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
            conditionFilter === 'Complete'
              ? 'bg-emerald-100/70 dark:bg-emerald-900/40 border-emerald-400 dark:border-emerald-600 shadow-sm ring-2 ring-emerald-500'
              : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 shadow-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
          }`}
          title="Filter by Complete Orders (Click to toggle)"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Complete</span>
            {conditionFilter === 'Complete' && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-300" />
            )}
          </div>
          <div className="text-xl font-black text-emerald-800 dark:text-emerald-300 mt-1">
            {summaryMetrics.completeCount}
          </div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400 mt-0.5 truncate">
            {conditionFilter === 'Complete' ? 'Active filter' : 'Balance < 3 Kg'}
          </div>
        </button>

        {/* Req Qty */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Req. Qty</span>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-1 truncate">
            {summaryMetrics.totalReq.toLocaleString()} <span className="text-xs font-normal text-slate-400">Kg</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            {summaryMetrics.isFiltered ? 'Filtered Req. Qty' : 'Total booked'}
          </div>
        </div>

        {/* Grey Qty */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Grey Qty</span>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-1 truncate">
            {summaryMetrics.totalGrey.toLocaleString()} <span className="text-xs font-normal text-slate-400">Kg</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            {summaryMetrics.isFiltered ? 'Filtered Grey' : 'Allocated Grey'}
          </div>
        </div>

        {/* Production */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Production</span>
          <div className="text-lg font-black text-indigo-700 dark:text-indigo-300 mt-1 truncate">
            {summaryMetrics.totalProd.toLocaleString()} <span className="text-xs font-normal text-slate-400">Kg</span>
          </div>
          <div className="text-[10px] text-indigo-500/80 mt-0.5 truncate">
            {summaryMetrics.isFiltered ? 'Filtered Knitted' : 'Knitted Qty'}
          </div>
        </div>

        {/* Knit Balance */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Knit Balance</span>
          <div className="text-lg font-black text-amber-700 dark:text-amber-300 mt-1 truncate">
            {summaryMetrics.totalBal.toLocaleString()} <span className="text-xs font-normal text-slate-400">Kg</span>
          </div>
          <div className="text-[10px] text-amber-500/80 mt-0.5 truncate">
            {summaryMetrics.isFiltered ? 'Filtered Pending' : 'Pending Knit'}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Condition Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto">
            {(['All', 'Running', 'Pending', 'Complete'] as const).map(tab => {
              const active = conditionFilter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setConditionFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab}
                  {tab === 'Running' && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                      {summaryMetrics.runningCount}
                    </span>
                  )}
                  {tab === 'Pending' && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                      {summaryMetrics.pendingCount}
                    </span>
                  )}
                  {tab === 'Complete' && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                      {summaryMetrics.completeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Expand / Collapse All Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Expand All Orders"
            >
              <ChevronsDown className="w-3.5 h-3.5 text-indigo-500" />
              <span>Expand All</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={collapseAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Collapse All Orders"
            >
              <ChevronsUp className="w-3.5 h-3.5 text-slate-400" />
              <span>Collapse All</span>
            </button>
          </div>
        </div>

        {/* Dropdowns & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by Order No, Buyer, Leader, Color, Fabric..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Buyer Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Buyer:</span>
            <select
              value={buyerFilter}
              onChange={e => setBuyerFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="All">All Buyers ({buyerOptions.length})</option>
              {buyerOptions.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Team Leader Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Leader:</span>
            <select
              value={teamLeaderFilter}
              onChange={e => setTeamLeaderFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="All">All Team Leaders ({teamLeaderOptions.length})</option>
              {teamLeaderOptions.map(tl => (
                <option key={tl} value={tl}>
                  {tl}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filter Indicators & Reset Action */}
        {summaryMetrics.isFiltered && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Filtered: {filteredOrders.length} of {orders.length} orders
              </span>
              {conditionFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium">
                  Condition: {conditionFilter}
                  <button onClick={() => setConditionFilter('All')} className="hover:text-blue-900 dark:hover:text-white cursor-pointer">×</button>
                </span>
              )}
              {buyerFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium">
                  Buyer: {buyerFilter}
                  <button onClick={() => setBuyerFilter('All')} className="hover:text-indigo-900 dark:hover:text-white cursor-pointer">×</button>
                </span>
              )}
              {teamLeaderFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-medium">
                  Leader: {teamLeaderFilter}
                  <button onClick={() => setTeamLeaderFilter('All')} className="hover:text-purple-900 dark:hover:text-white cursor-pointer">×</button>
                </span>
              )}
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-medium">
                  Search: "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} className="hover:text-amber-900 dark:hover:text-white cursor-pointer">×</button>
                </span>
              )}
            </div>
            <button
              onClick={clearAllFilters}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 font-bold hover:underline cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Layered Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            {/* 1st Layer Table Header */}
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 select-none">
                <th className="py-3 px-3 w-10 text-center"></th>
                <th className="py-3 px-3">Order No.</th>
                <th className="py-3 px-3">Condition</th>
                <th className="py-3 px-3">Buyer Name</th>
                <th className="py-3 px-3">Team Leader</th>
                <th className="py-3 px-3">Knit Start Date</th>
                <th className="py-3 px-3">Knit End Date</th>
                <th className="py-3 px-3 text-right">Req. Qty</th>
                <th className="py-3 px-3 text-right">Grey Qty</th>
                <th className="py-3 px-3 text-right">Production</th>
                <th className="py-3 px-3 text-right">Knit Balance</th>
                <th className="py-3 px-3 text-center w-24">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileSpreadsheet className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <span className="font-semibold text-sm">No Knitting Status records found</span>
                      <span className="text-xs text-slate-400">
                        Try resetting your search or filters.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, orderIdx) => {
                  const isExpanded = expandedOrderIds.has(order.id);
                  const itemsCount = order.items?.length || 0;
                  const percentDone = order.greyQty > 0 ? Math.min(100, Math.round((order.production / order.greyQty) * 100)) : 0;

                  return (
                    <React.Fragment key={order.id ? `${order.id}-${orderIdx}` : `ks-order-${orderIdx}`}>
                      {/* 1st Layer: Order Row */}
                      <tr
                        className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer ${
                          isExpanded ? 'bg-indigo-50/30 dark:bg-indigo-950/20 font-medium' : ''
                        }`}
                        onClick={() => toggleOrderExpand(order.id)}
                      >
                        {/* Expand / Collapse Button */}
                        <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => toggleOrderExpand(order.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            aria-label={isExpanded ? 'Collapse order' : 'Expand order'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Order No. */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                              {order.orderNo}
                            </span>
                            {itemsCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Condition (Calculated) */}
                        <td className="py-3 px-3">
                          {renderConditionBadge(order.greyQty, order.knitBalance)}
                        </td>

                        {/* Buyer Name */}
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {order.buyerName}
                        </td>

                        {/* Team Leader */}
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {order.teamLeader || ''}
                        </td>

                        {/* Knit Start Date */}
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono">
                          {order.knitStartDate || ''}
                        </td>

                        {/* Knit End Date */}
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono">
                          {order.knitEndDate || ''}
                        </td>

                        {/* Req. Qty */}
                        <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {order.reqQty ? order.reqQty.toLocaleString() : '0'}
                        </td>

                        {/* Grey Qty */}
                        <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {order.greyQty ? order.greyQty.toLocaleString() : '0'}
                        </td>

                        {/* Production */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {order.production ? order.production.toLocaleString() : '0'}
                        </td>

                        {/* Knit Balance */}
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <span
                            className={
                              order.knitBalance < 3
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : order.knitBalance > 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-600 dark:text-slate-400'
                            }
                          >
                            {order.knitBalance ? order.knitBalance.toLocaleString() : '0'}
                          </span>
                        </td>

                        {/* Action: View Button */}
                        <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setViewingOrder(order);
                              setExpandedOrderIds(prev => new Set([...prev, order.id]));
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                            title={`View all data on Order ${order.orderNo}`}
                            id={`view-order-${order.orderNo}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>

                      {/* 2nd Layer: Expanded Fabric / Items Breakdown */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={12} className="p-0 bg-slate-50/70 dark:bg-slate-950/40 border-y border-indigo-100 dark:border-indigo-950/50">
                            <div className="p-4 pl-10 space-y-3">
                              {/* Sub-table Header Bar */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                                    Fabric &amp; Color Specifications for Order {order.orderNo}
                                  </span>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    ({itemsCount} {itemsCount === 1 ? 'item registered' : 'items registered'})
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setViewingOrder(order)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                                  title="View full order details modal"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Full Details View</span>
                                </button>
                              </div>

                              {/* 2nd Layer Table */}
                              {(!order.items || order.items.length === 0) ? (
                                <div className="text-center py-6 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-400 text-xs">
                                  No detailed fabric items registered for this order.
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                                  <table className="w-full text-left text-[11px] border-collapse">
                                    <thead>
                                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                        <th className="py-2.5 px-2.5">Color</th>
                                        <th className="py-2.5 px-2.5">M/C Type</th>
                                        <th className="py-2.5 px-2.5">Fab. Type</th>
                                        <th className="py-2.5 px-2.5">FGSM</th>
                                        <th className="py-2.5 px-2.5">F. Width</th>
                                        <th className="py-2.5 px-2.5">Yarn Count</th>
                                        <th className="py-2.5 px-2.5">Gauge &amp; Dia</th>
                                        <th className="py-2.5 px-2.5">Knit Start Date</th>
                                        <th className="py-2.5 px-2.5">Knit End Date</th>
                                        <th className="py-2.5 px-2.5 text-right">Req. Qty</th>
                                        <th className="py-2.5 px-2.5 text-right">Grey Qty</th>
                                        <th className="py-2.5 px-2.5 text-right">Production</th>
                                        <th className="py-2.5 px-2.5 text-right">Hold</th>
                                        <th className="py-2.5 px-2.5 text-right">Reject</th>
                                        <th className="py-2.5 px-2.5 text-right">ITM QTY</th>
                                        <th className="py-2.5 px-2.5 text-right">Knit Balance</th>
                                        <th className="py-2.5 px-2.5 text-right">Avg. Prod/Day</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {sortKnittingItems(order.items || []).map((itm, itmIdx) => (
                                        <tr key={itm.id ? `${itm.id}-${itmIdx}` : `itm-${itmIdx}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                          {/* Color */}
                                          <td className="py-2 px-2.5 font-semibold text-slate-900 dark:text-white">
                                            {itm.color}
                                          </td>

                                          {/* M/C Type */}
                                          <td className="py-2 px-2.5 text-slate-700 dark:text-slate-300">
                                            {itm.mcType}
                                          </td>

                                          {/* Fab. Type */}
                                          <td className="py-2 px-2.5 text-slate-700 dark:text-slate-300">
                                            {itm.fabType}
                                          </td>

                                          {/* FGSM */}
                                          <td className="py-2 px-2.5 font-mono text-slate-700 dark:text-slate-300">
                                            {itm.fgsm}
                                          </td>

                                          {/* F. Width */}
                                          <td className="py-2 px-2.5 font-mono text-slate-700 dark:text-slate-300">
                                            {itm.fWidth}
                                          </td>

                                          {/* Yarn Count */}
                                          <td className="py-2 px-2.5 font-mono text-slate-700 dark:text-slate-300">
                                            {itm.yarnCount}
                                          </td>

                                          {/* Gauge & Dia */}
                                          <td className="py-2 px-2.5 font-mono text-slate-700 dark:text-slate-300">
                                            {itm.gaugeDia}
                                          </td>

                                          {/* Knit Start Date */}
                                          <td className="py-2 px-2.5 font-mono text-slate-600 dark:text-slate-400">
                                            {itm.knitStartDate || ''}
                                          </td>

                                          {/* Knit End Date */}
                                          <td className="py-2 px-2.5 font-mono text-slate-600 dark:text-slate-400">
                                            {itm.knitEndDate || ''}
                                          </td>

                                          {/* Req. Qty */}
                                          <td className="py-2 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                                            {itm.reqQty ? itm.reqQty.toLocaleString() : ''}
                                          </td>

                                          {/* Grey Qty */}
                                          <td className="py-2 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                                            {itm.greyQty ? itm.greyQty.toLocaleString() : ''}
                                          </td>

                                          {/* Production */}
                                          <td className="py-2 px-2.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                            {itm.production ? itm.production.toLocaleString() : ''}
                                          </td>

                                          {/* Hold */}
                                          <td className="py-2 px-2.5 text-right font-mono text-amber-600 dark:text-amber-400">
                                            {itm.hold ? itm.hold.toLocaleString() : ''}
                                          </td>

                                          {/* Reject */}
                                          <td className="py-2 px-2.5 text-right font-mono text-red-500">
                                            {itm.reject ? itm.reject.toLocaleString() : ''}
                                          </td>

                                          {/* ITM QTY */}
                                          <td className="py-2 px-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                                            {itm.itmQty ? itm.itmQty.toLocaleString() : ''}
                                          </td>

                                          {/* Knit Balance */}
                                          <td className="py-2 px-2.5 text-right font-mono font-bold">
                                            <span
                                              className={
                                                itm.knitBalance < 3
                                                  ? 'text-emerald-600 dark:text-emerald-400'
                                                  : 'text-amber-600 dark:text-amber-400'
                                              }
                                            >
                                              {itm.knitBalance !== undefined ? itm.knitBalance.toLocaleString() : ''}
                                            </span>
                                          </td>

                                          {/* Avg. Prod/Day */}
                                          <td className="py-2 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                                            {itm.avgProdPerDay ? `${itm.avgProdPerDay} Kg` : ''}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls (50 orders per page) */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <span>
              Showing{' '}
              <span className="font-bold font-mono text-slate-900 dark:text-white">
                {filteredOrders.length > 0 ? startIndex + 1 : 0}
              </span>{' '}
              to{' '}
              <span className="font-bold font-mono text-slate-900 dark:text-white">
                {endIndex}
              </span>{' '}
              of{' '}
              <span className="font-bold font-mono text-slate-900 dark:text-white">
                {filteredOrders.length}
              </span>{' '}
              orders
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <span className="hidden sm:inline text-[11px] font-medium bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300">
              50 orders / page
            </span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {/* First Page */}
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Previous Page */}
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={safeCurrentPage <= 1}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs font-semibold"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {pageNumbers.map((p, i) => {
                  if (p === '...') {
                    return (
                      <span key={`ellipsis-${i}`} className="px-1.5 py-1 text-slate-400 select-none">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = p === safeCurrentPage;
                  return (
                    <button
                      key={`page-${p}`}
                      type="button"
                      onClick={() => setCurrentPage(p as number)}
                      className={`min-w-[32px] h-8 px-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-2xs'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              {/* Next Page */}
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs font-semibold"
                title="Next Page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Last Page */}
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {/* Modal: View Order Details (Shows all data on that order) */}
      {viewingOrder && (
        <KnittingOrderDetailsModal
          order={viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}

      {/* Modal: Upload Excel */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Upload Knitting Status Excel
                </h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Upload an Excel (.xlsx, .xls) file containing either Layer 1 order summaries or detailed Layer 2 fabric rows.
              Column headers like <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600">Order No.</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600">Buyer Name</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600">Grey Qty</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600">Production</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600">Color</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600">Fab. Type</code> are automatically detected.
            </p>

            {/* Replace-on-Upload Notice */}
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <span className="font-bold">Replace-on-Upload Rule:</span> Uploading this file will completely remove and replace all existing Knitting Status records in Supabase Cloud with the newly uploaded dataset.
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-400 dark:hover:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl p-8 text-center transition-all cursor-pointer"
            >
              <UploadCloud className="w-10 h-10 text-indigo-600 dark:text-indigo-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Click to choose file or drag and drop spreadsheet
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Supports .xlsx, .xls, .csv format up to 10MB
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
