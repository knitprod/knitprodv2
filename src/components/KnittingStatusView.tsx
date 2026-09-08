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

interface KnittingStatusViewProps {
  currentUser?: UserRecord | null;
}

export default function KnittingStatusView({ currentUser }: KnittingStatusViewProps) {
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

  // Supabase Real-time Cloud Synchronization
  useEffect(() => {
    if (!SupabaseSync.isConfigured()) return;
    
    // Fetch initial from Supabase
    SupabaseSync.fetchKnittingOrders().then(remoteOrders => {
      if (Array.isArray(remoteOrders) && remoteOrders.length > 0) {
        const sanitized = remoteOrders.map(aggregateOrderValues);
        setOrders(sanitized);
        KnittingStatusStorage.saveOrders(sanitized);
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

  // Admin and Overwrite States
  const isAdmin = currentUser?.userType === 'Admin';
  const [isOverwriteMode, setIsOverwriteMode] = useState(false);
  const [adminOverwriteConfirmed, setAdminOverwriteConfirmed] = useState(false);

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

  // Export to Excel
  const handleExportExcel = () => {
    try {
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
      showToast('Knitting Status Excel report exported successfully!');
    } catch (e: any) {
      console.error('Export error:', e);
      showToast('Failed to export Excel file: ' + e.message);
    }
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

  // Upload Excel Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });

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

        // ADMIN OVERWRITE: If admin confirmed full database overwrite, replace all records
        if (isOverwriteMode && isAdmin) {
          const freshOrders = Array.from(orderMap.values()).map(aggregateOrderValues);
          updateOrdersState(freshOrders);
          showToast(`Admin Overwrite Complete: Database fully replaced with ${freshOrders.length} orders from uploaded file.`);
          setIsUploadModalOpen(false);
          setIsOverwriteMode(false);
          setAdminOverwriteConfirmed(false);
          return;
        }

        // SMART MERGE: Only take update data, fill blanks, update only new values, match by Order Number & Color
        const currentOrders = [...orders];
        const currentOrdersMap = new Map<string, KnittingStatusOrder>();
        currentOrders.forEach(o => {
          const ordKey = String(o.orderNo || o.id).trim().replace(/^#+/, '').toUpperCase();
          currentOrdersMap.set(ordKey, o);
        });

        let updatedOrdersCount = 0;
        let filledBlanksCount = 0;
        let newOrdersCount = 0;

        orderMap.forEach((uploadedOrder, ordNo) => {
          const ordKey = String(ordNo).trim().replace(/^#+/, '').toUpperCase();
          const existingOrd = currentOrdersMap.get(ordKey);

          if (existingOrd) {
            let ordChanged = false;
            // Fill blank buyer / teamLeader if uploaded has it
            if (uploadedOrder.buyerName && !existingOrd.buyerName) {
              existingOrd.buyerName = uploadedOrder.buyerName;
              filledBlanksCount++;
              ordChanged = true;
            } else if (uploadedOrder.buyerName && existingOrd.buyerName !== uploadedOrder.buyerName) {
              existingOrd.buyerName = uploadedOrder.buyerName;
              ordChanged = true;
            }

            if (uploadedOrder.teamLeader && !existingOrd.teamLeader) {
              existingOrd.teamLeader = uploadedOrder.teamLeader;
              filledBlanksCount++;
              ordChanged = true;
            } else if (uploadedOrder.teamLeader && existingOrd.teamLeader !== uploadedOrder.teamLeader) {
              existingOrd.teamLeader = uploadedOrder.teamLeader;
              ordChanged = true;
            }

            // Match items by Color
            const existingItemsMap = new Map<string, KnittingStatusItem>();
            existingOrd.items.forEach(itm => {
              const colKey = String(itm.color || '').trim().toUpperCase();
              existingItemsMap.set(colKey, itm);
            });

            uploadedOrder.items.forEach(upItm => {
              const colKey = String(upItm.color || '').trim().toUpperCase();
              const existingItm = existingItemsMap.get(colKey);

              if (existingItm) {
                // Match found: fill blank cells and update only new data
                let itmChanged = false;
                const fillOrUpdateStr = (k: keyof KnittingStatusItem) => {
                  const upVal = String(upItm[k] || '').trim();
                  if (!upVal) return;
                  const curVal = String(existingItm[k] || '').trim();
                  if (!curVal) {
                    (existingItm as any)[k] = upVal;
                    filledBlanksCount++;
                    itmChanged = true;
                  } else if (curVal !== upVal) {
                    (existingItm as any)[k] = upVal;
                    itmChanged = true;
                  }
                };
                const fillOrUpdateNum = (k: keyof KnittingStatusItem) => {
                  const upVal = Number(upItm[k]) || 0;
                  const curVal = Number(existingItm[k]) || 0;
                  if (curVal === 0 && upVal > 0) {
                    (existingItm as any)[k] = upVal;
                    filledBlanksCount++;
                    itmChanged = true;
                  } else if (upVal > 0 && curVal !== upVal) {
                    (existingItm as any)[k] = upVal;
                    itmChanged = true;
                  }
                };

                fillOrUpdateStr('mcType');
                fillOrUpdateStr('fabType');
                fillOrUpdateStr('yarnCount');
                fillOrUpdateStr('fWidth');
                fillOrUpdateStr('gaugeDia');
                fillOrUpdateStr('productionUnit');
                fillOrUpdateStr('knitStartDate');
                fillOrUpdateStr('knitEndDate');
                if (upItm.fgsm && !existingItm.fgsm) {
                  existingItm.fgsm = upItm.fgsm;
                  filledBlanksCount++;
                  itmChanged = true;
                } else if (upItm.fgsm && existingItm.fgsm !== upItm.fgsm) {
                  existingItm.fgsm = upItm.fgsm;
                  itmChanged = true;
                }

                fillOrUpdateNum('reqQty');
                fillOrUpdateNum('greyQty');
                fillOrUpdateNum('production');
                fillOrUpdateNum('hold');
                fillOrUpdateNum('reject');
                fillOrUpdateNum('itmQty');
                fillOrUpdateNum('knitBalance');
                fillOrUpdateNum('avgProdPerDay');

                if (itmChanged) ordChanged = true;
              } else {
                // New color variant for this order
                existingOrd.items.push(upItm);
                ordChanged = true;
              }
            });

            if (ordChanged) {
              const reAggregated = aggregateOrderValues(existingOrd);
              Object.assign(existingOrd, reAggregated);
              updatedOrdersCount++;
            }
          } else {
            // New order entirely
            const aggregated = aggregateOrderValues(uploadedOrder);
            currentOrders.unshift(aggregated);
            currentOrdersMap.set(ordKey, aggregated);
            newOrdersCount++;
          }
        });

        updateOrdersState(currentOrders);
        showToast(`Smart Update: ${updatedOrdersCount} orders updated, ${filledBlanksCount} blank cells filled${newOrdersCount > 0 ? `, ${newOrdersCount} new orders added` : ''}. Existing data preserved!`);
        setIsUploadModalOpen(false);
      } catch (err: any) {
        console.error('File parse error:', err);
        showToast('Error reading Excel file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    if (e.target) e.target.value = '';
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
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Two-layer hierarchical tracking: Order Summary (Layer 1) with expandable Fabric & Item breakdown (Layer 2)
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs cursor-pointer"
            title="Import Excel"
          >
            <UploadCloud className="w-4 h-4 text-slate-500" />
            <span>Upload Excel</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs cursor-pointer"
            title="Export Excel"
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

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
                                        <th className="py-2.5 px-2.5">Production Unit</th>
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

                                          {/* Production Unit */}
                                          <td className="py-2 px-2.5">
                                            {itm.productionUnit ? (
                                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                {itm.productionUnit}
                                              </span>
                                            ) : ''}
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

            {/* Admin Overwrite Option */}
            {isAdmin ? (
              <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span className="text-xs font-bold text-rose-950 dark:text-rose-200">
                      Admin Privilege: Overwrite Full Database
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isOverwriteMode}
                      onChange={(e) => {
                        setIsOverwriteMode(e.target.checked);
                        if (!e.target.checked) setAdminOverwriteConfirmed(false);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
                  </label>
                </div>

                {isOverwriteMode && (
                  <div className="pt-2 border-t border-rose-200/60 dark:border-rose-900/60 space-y-2">
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-normal font-medium">
                      All {orders.length} current orders will be purged and completely replaced by this spreadsheet.
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={adminOverwriteConfirmed}
                        onChange={(e) => setAdminOverwriteConfirmed(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-rose-800 dark:text-rose-200 select-none">
                        I confirm master database purge & replace
                      </span>
                    </label>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-400">
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Smart Merge active (Updates new data & fills blanks). Admin login required for full database overwrite.</span>
              </div>
            )}

            <div
              onClick={() => {
                if (isOverwriteMode && !adminOverwriteConfirmed) return;
                fileInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                isOverwriteMode
                  ? adminOverwriteConfirmed
                    ? 'border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20 hover:border-rose-500 cursor-pointer'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 opacity-60 cursor-not-allowed'
                  : 'border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-400 dark:hover:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/20 cursor-pointer'
              }`}
            >
              {isOverwriteMode ? (
                <Database className={`w-10 h-10 mx-auto mb-2 ${adminOverwriteConfirmed ? 'text-rose-500' : 'text-slate-400'}`} />
              ) : (
                <FileSpreadsheet className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
              )}
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isOverwriteMode
                  ? adminOverwriteConfirmed
                    ? 'Click to browse Excel and Overwrite Database'
                    : 'Check confirmation box above to proceed'
                  : 'Click to browse or drag and drop spreadsheet'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Supports .xlsx, .xls, .csv format
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
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setIsOverwriteMode(false);
                  setAdminOverwriteConfirmed(false);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
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
