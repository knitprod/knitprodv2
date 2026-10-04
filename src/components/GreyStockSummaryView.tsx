/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Grey Stock Summary View
 * Daily file-driven module with Main Layer (Order-wise summary) and
 * Second Layer (expandable color/fabric detailed records), fully matched with
 * Knitting Status & Textile Close by PMC.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Package,
  Boxes,
  Truck,
  Archive,
  ArrowUpRight,
  Code,
  Copy,
  Check,
  Loader2,
  Database
} from 'lucide-react';
import { UserRecord } from './UserManagementView';
import { GreyStockItem, GreyStockOrderGroup, KnittingStatusOrder, TextileCloseRecord } from '../types';
import { 
  GreyStockStorage, 
  groupGreyStockRecords, 
  parseGreyStockExcel,
  GreyStockUploadMeta
} from '../lib/greyStockStore';
import { KnittingStatusStorage } from '../lib/knittingStatusStore';
import { TextileClosePMCStorage } from '../lib/textileClosePMCStore';
import { SupabaseSync } from '../lib/supabaseClient';
import { KnittingOrderSnippingModal } from './KnittingOrderSnippingModal';

interface GreyStockSummaryViewProps {
  currentUser?: UserRecord | null;
}

/**
 * Converts a GreyStockOrderGroup to KnittingStatusOrder for official HD Snipping Tool
 */
export function convertGreyStockGroupToKnittingOrder(group: GreyStockOrderGroup): KnittingStatusOrder {
  return {
    id: `gs-order-${group.orderNo}`,
    orderNo: group.orderNo,
    buyerName: group.buyerName || '',
    teamLeader: 'Knitting Performance Unit',
    fabrication: group.items[0]?.fabType || 'Single Jersey',
    knitStartDate: '-',
    knitEndDate: '-',
    pmcKnitStartDate: '-',
    actualKnitStartDate: '-',
    pmcKnitEndDate: '-',
    actualKnitEndDate: '-',
    reqQty: group.greyRequired || group.totalNetReceived,
    greyQty: group.greyRequired || group.totalNetReceived,
    production: group.totalNetReceived,
    knitBalance: group.totalGreyStock,
    remarks: `Grey Stock Summary: Net Rec ${group.totalNetReceived.toLocaleString()} kg, Issued ${group.totalNetIssued.toLocaleString()} kg, Stock ${group.totalGreyStock.toLocaleString()} kg`,
    items: group.items.map((itm, idx) => ({
      id: itm.id || `gs-itm-${group.orderNo}-${idx}`,
      color: itm.colour || '—',
      mcType: 'Circular Knit',
      fabType: itm.fabType || '—',
      fabrication: `${itm.fabType || ''} (${itm.fabStyle || ''})`,
      fgsm: '—',
      fWidth: '—',
      yarnCount: '—',
      gaugeDia: '—',
      knitStartDate: '-',
      knitEndDate: '-',
      reqQty: itm.matchedGreyQty || itm.netReceivedQty,
      greyQty: itm.matchedGreyQty || itm.netReceivedQty,
      production: Number(itm.netReceivedQty) || 0,
      hold: 0,
      reject: 0,
      itmQty: 0,
      knitBalance: Number(itm.stockQty) || 0,
      productionUnit: itm.ownerUnit || 'EKL',
      avgProdPerDay: 0,
    }))
  };
}

export default function GreyStockSummaryView({ currentUser }: GreyStockSummaryViewProps) {
  const isAdmin = currentUser?.userType === 'Admin';

  // Primary dataset (daily uploaded records, replaced on each upload)
  const [records, setRecords] = useState<GreyStockItem[]>(() => GreyStockStorage.getRecords());
  const [uploadMeta, setUploadMeta] = useState<GreyStockUploadMeta>(() => GreyStockStorage.getUploadMeta());

  // Connected data sources for matching
  const [knittingOrders, setKnittingOrders] = useState<KnittingStatusOrder[]>(() => KnittingStatusStorage.getOrders());
  const [textileRecords, setTextileRecords] = useState<TextileCloseRecord[]>(() => TextileClosePMCStorage.getRecords());

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [unitFilter, setUnitFilter] = useState('All');
  const [buyerFilter, setBuyerFilter] = useState('All');

  // Expanded Order Numbers for 2-layer accordion
  const [expandedOrderNos, setExpandedOrderNos] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const all = GreyStockStorage.getRecords();
    if (all && all.length > 0 && all[0].orderNo) {
      initial.add(all[0].orderNo);
    }
    return initial;
  });

  // Modal States
  const [viewingOrder, setViewingOrder] = useState<GreyStockOrderGroup | null>(null);
  const [snipOrder, setSnipOrder] = useState<KnittingStatusOrder | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Supabase Cloud states
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [cloudMigrateStatus, setCloudMigrateStatus] = useState<string | null>(null);
  const [isMigratingToCloud, setIsMigratingToCloud] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Initial Load from Supabase Cloud & Real-time WebSockets
  useEffect(() => {
    if (SupabaseSync.isConfigured()) {
      SupabaseSync.fetchGreyStockRecords()
        .then(remoteRecords => {
          if (Array.isArray(remoteRecords) && remoteRecords.length > 0) {
            setRecords(remoteRecords);
            GreyStockStorage.saveRecords(remoteRecords);
          }
        })
        .catch(err => {
          console.warn('Grey Stock Supabase fetch notice:', err);
        });

      // Real-time subscription to cloud table
      const unsub = SupabaseSync.subscribeToGreyStockRecords(({ eventType, record, id }) => {
        if (eventType === 'DELETE') {
          setRecords(prev => {
            const next = prev.filter(r => r.id !== id);
            GreyStockStorage.saveRecords(next);
            return next;
          });
        } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
          setRecords(prev => {
            const idx = prev.findIndex(r => r.id === record.id);
            let next: GreyStockItem[];
            if (idx >= 0) {
              next = [...prev];
              next[idx] = record;
            } else {
              next = [record, ...prev];
            }
            GreyStockStorage.saveRecords(next);
            return next;
          });
        }
      });

      return () => {
        unsub();
      };
    }
  }, []);

  // Listen to cross-component storage updates
  useEffect(() => {
    const handleStorageUpdate = (e: Event) => {
      const customEv = e as CustomEvent<GreyStockItem[]>;
      if (customEv.detail) {
        setRecords(customEv.detail);
        setUploadMeta(GreyStockStorage.getUploadMeta());
      }
    };
    window.addEventListener('epyllion_grey_stock_updated', handleStorageUpdate);

    // Refresh connected data sources
    setKnittingOrders(KnittingStatusStorage.getOrders());
    setTextileRecords(TextileClosePMCStorage.getRecords());

    return () => {
      window.removeEventListener('epyllion_grey_stock_updated', handleStorageUpdate);
    };
  }, []);

  // Filtered Raw Records
  const filteredRecords = useMemo(() => {
    return records.filter(item => {
      if (statusFilter !== 'All' && item.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (unitFilter !== 'All' && item.ownerUnit.toLowerCase() !== unitFilter.toLowerCase()) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesOrd = item.orderNo.toLowerCase().includes(q);
        const matchesCol = item.colour.toLowerCase().includes(q);
        const matchesFab = item.fabType.toLowerCase().includes(q);
        const matchesStyle = item.fabStyle.toLowerCase().includes(q);
        const matchesUnit = item.ownerUnit.toLowerCase().includes(q);
        if (!matchesOrd && !matchesCol && !matchesFab && !matchesStyle && !matchesUnit) {
          return false;
        }
      }

      return true;
    });
  }, [records, statusFilter, unitFilter, searchTerm]);

  // Group into Order-level Main Layer with connected Knitting Status & Textile Close data
  const orderGroups = useMemo(() => {
    const groups = groupGreyStockRecords(filteredRecords, knittingOrders, textileRecords);

    // Apply buyer filter if specified
    if (buyerFilter !== 'All') {
      return groups.filter(g => g.buyerName.toLowerCase() === buyerFilter.toLowerCase());
    }

    return groups;
  }, [filteredRecords, knittingOrders, textileRecords, buyerFilter]);

  // Dynamic filter options
  const filterOptions = useMemo(() => {
    const statuses = new Set<string>();
    const units = new Set<string>();
    const buyers = new Set<string>();

    records.forEach(r => {
      if (r.status) statuses.add(r.status);
      if (r.ownerUnit) units.add(r.ownerUnit);
    });

    orderGroups.forEach(g => {
      if (g.buyerName && g.buyerName !== '—') buyers.add(g.buyerName);
    });

    return {
      statuses: Array.from(statuses).sort(),
      units: Array.from(units).sort(),
      buyers: Array.from(buyers).sort()
    };
  }, [records, orderGroups]);

  // Overall KPI Summary
  const summaryMetrics = useMemo(() => {
    let totalReq = 0;
    let totalNetRec = 0;
    let totalNetIss = 0;
    let totalStock = 0;

    orderGroups.forEach(g => {
      totalReq += g.greyRequired || 0;
      totalNetRec += g.totalNetReceived || 0;
      totalNetIss += g.totalNetIssued || 0;
      totalStock += g.totalGreyStock || 0;
    });

    return {
      totalOrders: orderGroups.length,
      totalItems: filteredRecords.length,
      totalReq,
      totalNetRec,
      totalNetIss,
      totalStock
    };
  }, [orderGroups, filteredRecords]);

  // Pagination Math
  const totalPages = Math.max(1, Math.ceil(orderGroups.length / pageSize));
  const paginatedOrderGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return orderGroups.slice(start, start + pageSize);
  }, [orderGroups, currentPage, pageSize]);

  // Expand / Collapse Handlers
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
    setExpandedOrderNos(new Set(orderGroups.map(g => g.orderNo)));
  };

  const collapseAll = () => {
    setExpandedOrderNos(new Set());
  };

  // Upload handler with strict Daily Data Replacement rule
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const parsed = await parseGreyStockExcel(file);
      if (!parsed || parsed.length === 0) {
        throw new Error('No valid Grey Stock rows found in the uploaded file.');
      }

      // Replaces previous dataset completely
      GreyStockStorage.saveRecords(parsed);
      setRecords(parsed);

      const uniqueOrders = new Set(parsed.map(p => p.orderNo)).size;
      const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const meta: GreyStockUploadMeta = {
        lastUploadedAt: nowStr,
        fileName: file.name,
        totalRecords: parsed.length,
        totalOrders: uniqueOrders
      };
      GreyStockStorage.saveUploadMeta(meta);
      setUploadMeta(meta);

      // Auto-expand first order for immediate feedback
      if (parsed[0]?.orderNo) {
        setExpandedOrderNos(new Set([parsed[0].orderNo]));
      }

      setCurrentPage(1);
      setIsUploadModalOpen(false);
      showToast(`Successfully replaced dataset: ${parsed.length.toLocaleString()} rows uploaded across ${uniqueOrders} orders.`);

      // Sync to Supabase Cloud if configured
      if (SupabaseSync.isConfigured()) {
        SupabaseSync.bulkSaveGreyStockRecords(parsed, true)
          .then(res => {
            if (res.success) {
              showToast(`Synced & replaced ${res.count} records in Supabase Cloud!`);
            } else {
              console.warn('Supabase sync notice:', res.error);
            }
          })
          .catch(err => {
            console.warn('Supabase upload error:', err);
          });
      }
    } catch (err: any) {
      alert(`File Upload Error: ${err.message || 'Failed to parse file. Please verify required headers.'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Sync latest from Supabase Cloud
  const handleSyncCloud = async () => {
    if (!SupabaseSync.isConfigured()) {
      setIsSupabaseModalOpen(true);
      return;
    }
    setIsSyncingCloud(true);
    try {
      const remote = await SupabaseSync.fetchGreyStockRecords();
      if (Array.isArray(remote) && remote.length > 0) {
        setRecords(remote);
        GreyStockStorage.saveRecords(remote);
        showToast(`Synced ${remote.length} records from Supabase Cloud.`);
      } else {
        showToast('Supabase table is empty. Click "Upload to Supabase" in the modal to seed.');
      }
    } catch (err: any) {
      showToast(`Cloud Sync error: ${err.message || String(err)}`);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Push local records to Supabase Cloud
  const handleMigrateCurrentToCloud = async () => {
    if (!SupabaseSync.isConfigured()) {
      setCloudMigrateStatus('Supabase is not configured. Please verify credentials in Database Connection.');
      return;
    }
    setIsMigratingToCloud(true);
    setCloudMigrateStatus('Uploading & replacing dataset in Supabase Cloud...');
    try {
      const res = await SupabaseSync.bulkSaveGreyStockRecords(records, true);
      if (res.success) {
        setCloudMigrateStatus(`Success! Uploaded ${res.count} records to Supabase table 'public.grey_stock_summary'.`);
        showToast(`Uploaded ${res.count} records to Supabase Cloud!`);
      } else {
        if (res.error?.includes('grey_stock_summary') || res.error?.includes('schema cache') || res.error?.includes('PGRST205')) {
          setCloudMigrateStatus("Table 'public.grey_stock_summary' does not exist yet. Please run the SQL schema in your Supabase SQL Editor first.");
        } else {
          setCloudMigrateStatus(`Error: ${res.error || 'Failed to upload to Supabase'}`);
        }
      }
    } catch (err: any) {
      setCloudMigrateStatus(`Upload error: ${err.message || String(err)}`);
    } finally {
      setIsMigratingToCloud(false);
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SupabaseSync.getGreyStockSchemaSQL());
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch (err) {
      console.error('Failed to copy SQL:', err);
    }
  };

  const getUploadCodeSnippet = () => {
    return `// =========================================================================
// TYPESCRIPT / JAVASCRIPT: UPLOAD DATA TO SUPABASE
// Install package: npm install @supabase/supabase-js xlsx
// =========================================================================

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// 1. Initialize Supabase Client
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface GreyStockRow {
  id?: string;
  status: string;
  orderNo: string;
  colour: string;
  fabStyle: string;
  fabType: string;
  ownerUnit: string;
  netReceivedQty: number;
  netIssuedQty: number;
  stockQty: number;
}

/**
 * 2. Upload Grey Stock Records to Supabase
 * @param records Array of GreyStockRow objects
 * @param replace If true, purges existing daily data before inserting
 */
export async function uploadGreyStockToSupabase(records: GreyStockRow[], replace: boolean = true) {
  try {
    // Step A: Replace old daily dataset if replace is requested
    if (replace) {
      console.log('Purging previous daily Grey Stock records...');
      const { error: deleteError } = await supabase
        .from('grey_stock_summary')
        .delete()
        .neq('id', '___PURGE___');

      if (deleteError) {
        throw new Error('Failed to purge previous dataset: ' + deleteError.message);
      }
    }

    // Step B: Prepare rows matching table schema
    const rows = records.map((r, idx) => ({
      id: r.id || \`gs-\${r.orderNo}-\${idx + 1}-\${Date.now()}\`,
      status: r.status || 'Running',
      order_no: String(r.orderNo).trim(),
      colour: r.colour || '',
      fab_style: r.fabStyle || '',
      fab_type: r.fabType || '',
      owner_unit: r.ownerUnit || 'EKL',
      net_received_qty: Number(r.netReceivedQty) || 0,
      net_issued_qty: Number(r.netIssuedQty) || 0,
      stock_qty: Number(r.stockQty) || 0,
      raw_data: r,
      updated_at: new Date().toISOString()
    }));

    // Step C: Batch upload in chunks of 200 rows for optimal network performance
    const CHUNK_SIZE = 200;
    let totalUploaded = 0;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase
        .from('grey_stock_summary')
        .upsert(chunk, { onConflict: 'id' });

      if (error) {
        throw new Error(\`Batch \${i / CHUNK_SIZE + 1} failed: \${error.message}\`);
      }
      totalUploaded += chunk.length;
      console.log(\`Uploaded \${totalUploaded}/\${rows.length} rows...\`);
    }

    console.log(\`Successfully uploaded \${totalUploaded} rows to Supabase!\`);
    return { success: true, count: totalUploaded };
  } catch (err: any) {
    console.error('Supabase upload error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 3. Helper to read Excel File and upload directly to Supabase
 */
export async function uploadExcelFileToSupabase(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const records: GreyStockRow[] = jsonRows.map((row) => ({
    status: row['Status'] || 'Running',
    orderNo: String(row['Order No.'] || row['Order No'] || ''),
    colour: row['Colour'] || row['Color'] || '',
    fabStyle: row['Fab Style'] || row['Style'] || '',
    fabType: row['Fab Type'] || row['Fabric Type'] || '',
    ownerUnit: row['Owner Unit'] || 'EKL',
    netReceivedQty: Number(row['Net Received QTY'] || row['Net Received']) || 0,
    netIssuedQty: Number(row['Net Issued QTY'] || row['Net Issued']) || 0,
    stockQty: Number(row['Stock QTY'] || row['Stock']) || 0,
  }));

  return await uploadGreyStockToSupabase(records, true);
}`;
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(getUploadCodeSnippet());
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Reset to Demo Data
  const handleResetDefaults = () => {
    if (confirm('Are you sure you want to reset to the default demo Grey Stock dataset?')) {
      const def = GreyStockStorage.resetToDefault();
      setRecords(def);
      setUploadMeta(GreyStockStorage.getUploadMeta());
      setExpandedOrderNos(new Set([def[0]?.orderNo || '272277']));
      setIsUploadModalOpen(false);
      showToast('Reset to default Grey Stock dataset.');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const exportRows: any[] = [];
      orderGroups.forEach(g => {
        g.items.forEach(itm => {
          exportRows.push({
            'Order No.': g.orderNo,
            'Status': g.status,
            'Buyer Name': g.buyerName,
            'Grey Required': g.greyRequired,
            'Order Net Received': g.totalNetReceived,
            'Order Net Issued': g.totalNetIssued,
            'Order Grey Stock': g.totalGreyStock,
            'Colour': itm.colour,
            'Fab. Type': itm.fabType,
            'Fab. Style': itm.fabStyle,
            'Owner Unit': itm.ownerUnit,
            'Matched Grey QTY': itm.matchedGreyQty || 0,
            'Item Net Received': itm.netReceivedQty,
            'Item Net Issued': itm.netIssuedQty,
            'Item Stock QTY': itm.stockQty
          });
        });
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Grey Stock Summary');
      XLSX.writeFile(wb, `Grey_Stock_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('Downloaded Grey Stock Summary Excel.');
    } catch (err: any) {
      alert('Failed to export Excel file: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 dark:border-slate-300 backdrop-blur-md animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span className="text-xs font-semibold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white dark:hover:text-slate-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Grey Stock Summary
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Daily Inventory Replacement
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {records.length} Records
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Order-wise summary with expandable color/fabric records linked to Knitting Status</span>
                {uploadMeta.lastUploadedAt && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                    <Clock className="w-3 h-3" /> Updated: {uploadMeta.lastUploadedAt} {uploadMeta.fileName ? `(${uploadMeta.fileName})` : ''}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sync Cloud button */}
          <button
            type="button"
            onClick={handleSyncCloud}
            disabled={isSyncingCloud}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="Synchronize latest Grey Stock records from Supabase Cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-600 dark:text-sky-400 ${isSyncingCloud ? 'animate-spin' : ''}`} />
            <span>{isSyncingCloud ? 'Syncing...' : 'Sync Cloud'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-2xs cursor-pointer"
            title="Export summary to Excel"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer active:scale-95"
            title="Upload daily Grey Stock Excel file"
            id="grey-stock-upload-btn"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Daily File</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Orders</span>
            <Boxes className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-white">
            {summaryMetrics.totalOrders}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {summaryMetrics.totalItems} detailed specifications
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Grey Required</span>
            <Package className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-400">
            {summaryMetrics.totalReq.toLocaleString()} <span className="text-xs font-normal">Kg</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Knitting Status / PMC Total
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Received</span>
            <Truck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {summaryMetrics.totalNetRec.toLocaleString()} <span className="text-xs font-normal">Kg</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Total Received from Floor
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Issued</span>
            <ArrowUpRight className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
            {summaryMetrics.totalNetIss.toLocaleString()} <span className="text-xs font-normal">Kg</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Issued to Dyeing / Delivery
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Grey Stock</span>
            <Archive className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
            {summaryMetrics.totalStock.toLocaleString()} <span className="text-xs font-normal">Kg</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Current Floor Balance
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search Order No., Buyer, Color, Fab Type, Unit..."
            className="w-full pl-9 pr-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
          >
            <option value="All">All Statuses</option>
            {filterOptions.statuses.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          {/* Owner Unit Filter */}
          <select
            value={unitFilter}
            onChange={e => {
              setUnitFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
          >
            <option value="All">All Owner Units</option>
            {filterOptions.units.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          {/* Buyer Filter */}
          <select
            value={buyerFilter}
            onChange={e => {
              setBuyerFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
          >
            <option value="All">All Buyers</option>
            {filterOptions.buyers.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {(statusFilter !== 'All' || unitFilter !== 'All' || buyerFilter !== 'All' || searchTerm) && (
            <button
              onClick={() => {
                setStatusFilter('All');
                setUnitFilter('All');
                setBuyerFilter('All');
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="text-xs font-bold text-rose-600 dark:text-rose-400 px-2 py-1.5 hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Table: 1st Layer (Order Summary) & 2nd Layer (Expandable Breakdown) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Table Top Toolbar */}
        <div className="p-3.5 sm:px-4 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Orders Summary:
            </span>
            <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
              {orderGroups.length} {orderGroups.length === 1 ? 'Order' : 'Orders'} ({filteredRecords.length} Fabric Specifications)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
              title="Expand all orders"
            >
              <ChevronDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Expand All</span>
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
              title="Collapse all orders"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>Collapse All</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            {/* 1. Main Layer Table Header */}
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 select-none">
                {/* 1. Expand and Collapse Button */}
                <th className="py-3 px-3 w-10 text-center">
                  <span className="sr-only">Expand/Collapse</span>
                </th>
                {/* 2. Order No. */}
                <th className="py-3 px-3 min-w-[120px] whitespace-nowrap">Order No.</th>
                {/* 3. Status */}
                <th className="py-3 px-3 min-w-[120px] whitespace-nowrap">Status</th>
                {/* 4. Buyer Name */}
                <th className="py-3 px-3 min-w-[140px] whitespace-nowrap">Buyer Name</th>
                {/* 5. Grey Required */}
                <th className="py-3 px-3 min-w-[120px] whitespace-nowrap text-right text-indigo-700 dark:text-indigo-300">
                  Grey Required
                </th>
                {/* 6. Net Received */}
                <th className="py-3 px-3 min-w-[120px] whitespace-nowrap text-right text-emerald-700 dark:text-emerald-300">
                  Net Received
                </th>
                {/* 7. Net Issued */}
                <th className="py-3 px-3 min-w-[120px] whitespace-nowrap text-right text-blue-700 dark:text-blue-300">
                  Net Issued
                </th>
                {/* 8. Grey Stock */}
                <th className="py-3 px-3 min-w-[120px] whitespace-nowrap text-right text-amber-700 dark:text-amber-300">
                  Grey Stock
                </th>
                {/* 9. Action Buttons */}
                <th className="py-3 px-3 min-w-[140px] whitespace-nowrap text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedOrderGroups.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-semibold">No Grey Stock records found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting filters or upload a daily Grey Stock Excel file
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedOrderGroups.map((group, idx) => {
                  const isExpanded = expandedOrderNos.has(group.orderNo);

                  return (
                    <React.Fragment key={`gs-grp-${group.orderNo}-${idx}`}>
                      {/* Main Layer: Parent Row */}
                      <tr
                        className={`transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/60 cursor-pointer ${
                          isExpanded ? 'bg-blue-50/25 dark:bg-blue-950/20 font-medium' : ''
                        }`}
                        onClick={() => toggleOrderExpand(group.orderNo)}
                      >
                        {/* 1. Expand and Collapse Button */}
                        <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => toggleOrderExpand(group.orderNo)}
                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            aria-label={isExpanded ? 'Collapse order' : 'Expand order'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* 2. Order No. */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                              {group.orderNo}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </td>

                        {/* 3. Status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border shadow-2xs ${
                            group.status.toLowerCase().includes('complete')
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60'
                              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60'
                          }`}>
                            <CheckCircle className="w-3.5 h-3.5" />
                            {group.status || 'Running'}
                          </span>
                        </td>

                        {/* 4. Buyer Name (Matched from Knitting Status) */}
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {group.buyerName || '—'}
                        </td>

                        {/* 5. Grey Required (Matched from Knitting Status / Textile Close PMC) */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                          {group.greyRequired ? group.greyRequired.toLocaleString() : '0'}
                        </td>

                        {/* 6. Net Received (Sum of Second Layer) */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {group.totalNetReceived ? group.totalNetReceived.toLocaleString() : '0'}
                        </td>

                        {/* 7. Net Issued (Sum of Second Layer) */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {group.totalNetIssued ? group.totalNetIssued.toLocaleString() : '0'}
                        </td>

                        {/* 8. Grey Stock (Sum of Second Layer Stock QTY) */}
                        <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                          <span className={group.totalGreyStock <= 0 ? 'text-slate-500' : 'text-amber-600 dark:text-amber-400'}>
                            {group.totalGreyStock ? group.totalGreyStock.toLocaleString() : '0'}
                          </span>
                        </td>

                        {/* 9. Action Buttons: View & Snip */}
                        <td className="py-3 px-3 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingOrder(group)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                              title={`View full details for Order ${group.orderNo}`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSnipOrder(convertGreyStockGroupToKnittingOrder(group))}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                              title={`Open Snipping Tool for Order ${group.orderNo}`}
                              id={`snip-gs-btn-${group.orderNo}`}
                            >
                              <Scissors className="w-3.5 h-3.5" />
                              <span>Snip</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Second Layer: Detailed Records Under Expand/Collapse */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 animate-fade-in">
                          <td colSpan={9} className="p-0">
                            <div className="pl-6 sm:pl-10 pr-4 py-3.5 bg-slate-50/80 dark:bg-slate-850/60 border-l-4 border-blue-500 space-y-2.5">
                              {/* Sub-table Header */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                                    Colour &amp; Fabric Specification Breakdown for Order {group.orderNo}
                                  </span>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    ({group.items.length} {group.items.length === 1 ? 'specification' : 'specifications'})
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSnipOrder(convertGreyStockGroupToKnittingOrder(group))}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                                    title="Open Snipping Tool for this order"
                                    id={`snip-gs-subtable-btn-${group.orderNo}`}
                                  >
                                    <Scissors className="w-3 h-3" />
                                    <span>Snipping Tool</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setViewingOrder(group)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                    title="View full order details modal"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Full Details View</span>
                                  </button>
                                </div>
                              </div>

                              {/* Second Layer Table */}
                              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                                <table className="w-full text-left text-[11px] border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                      <th className="py-2.5 px-3">Colour</th>
                                      <th className="py-2.5 px-3">Fab. Type</th>
                                      <th className="py-2.5 px-3">Fab. Style</th>
                                      <th className="py-2.5 px-3 text-center">Owner Unit</th>
                                      <th className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400">
                                        Grey QTY
                                      </th>
                                      <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                                        Net Received
                                      </th>
                                      <th className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400">
                                        Net Issued
                                      </th>
                                      <th className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">
                                        Stock QTY
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                    {group.items.map((itm, itmIdx) => (
                                      <tr
                                        key={itm.id || `itm-${group.orderNo}-${itmIdx}`}
                                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                                      >
                                        {/* Colour */}
                                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                          {itm.colour || '—'}
                                        </td>
                                        {/* Fab. Type */}
                                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                          {itm.fabType || '—'}
                                        </td>
                                        {/* Fab. Style */}
                                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                          {itm.fabStyle || '—'}
                                        </td>
                                        {/* Owner Unit */}
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                          <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                            {itm.ownerUnit || 'EKL'}
                                          </span>
                                        </td>
                                        {/* Grey QTY (from Knitting Status) */}
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                          {itm.matchedGreyQty ? itm.matchedGreyQty.toLocaleString() : '0'}
                                        </td>
                                        {/* Net Received */}
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                          {itm.netReceivedQty ? itm.netReceivedQty.toLocaleString() : '0'}
                                        </td>
                                        {/* Net Issued */}
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                          {itm.netIssuedQty ? itm.netIssuedQty.toLocaleString() : '0'}
                                        </td>
                                        {/* Stock QTY */}
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                          {itm.stockQty ? itm.stockQty.toLocaleString() : '0'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
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
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 sm:px-4 sm:py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Showing <span className="font-bold text-slate-800 dark:text-slate-200">
              {orderGroups.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </span> to <span className="font-bold text-slate-800 dark:text-slate-200">
              {Math.min(currentPage * pageSize, orderGroups.length)}
            </span> of <span className="font-bold text-slate-800 dark:text-slate-200">{orderGroups.length}</span> orders ({filteredRecords.length} items total)
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <span className="px-3 font-semibold text-slate-700 dark:text-slate-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* View Modal: Detailed Order Breakdown */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  <Boxes className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white font-mono">
                      Order #{viewingOrder.orderNo}
                    </h2>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      <CheckCircle className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      {viewingOrder.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Buyer Name: <span className="font-semibold text-slate-700 dark:text-slate-300">{viewingOrder.buyerName || '—'}</span> (from Knitting Status)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSnipOrder(convertGreyStockGroupToKnittingOrder(viewingOrder))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="Open in Snipping Tool (HD Snapshot)"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Snipping Tool</span>
                </button>

                <button
                  onClick={() => setViewingOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Grey Required</span>
                <div className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {viewingOrder.greyRequired.toLocaleString()} <span className="text-xs font-normal text-slate-400">Kg</span>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Net Received</span>
                <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {viewingOrder.totalNetReceived.toLocaleString()} <span className="text-xs font-normal text-slate-400">Kg</span>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">Net Issued</span>
                <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                  {viewingOrder.totalNetIssued.toLocaleString()} <span className="text-xs font-normal text-slate-400">Kg</span>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Grey Stock</span>
                <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                  {viewingOrder.totalGreyStock.toLocaleString()} <span className="text-xs font-normal text-slate-400">Kg</span>
                </div>
              </div>
            </div>

            {/* Detailed Second Layer Items Table */}
            <div className="overflow-y-auto flex-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Colour</th>
                    <th className="py-2.5 px-3">Fab. Type</th>
                    <th className="py-2.5 px-3">Fab. Style</th>
                    <th className="py-2.5 px-3 text-center">Owner Unit</th>
                    <th className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400">Grey QTY</th>
                    <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">Net Received</th>
                    <th className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400">Net Issued</th>
                    <th className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">Stock QTY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {viewingOrder.items.map((itm, itmIdx) => (
                    <tr key={itm.id || `modal-itm-${itmIdx}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{itm.colour || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{itm.fabType || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{itm.fabStyle || '—'}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{itm.ownerUnit || 'EKL'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">{itm.matchedGreyQty?.toLocaleString() || '0'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{itm.netReceivedQty?.toLocaleString() || '0'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{itm.netIssuedQty?.toLocaleString() || '0'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">{itm.stockQty?.toLocaleString() || '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">
                Total {viewingOrder.items.length} fabric {viewingOrder.items.length === 1 ? 'item' : 'items'} in this order
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSnipOrder(convertGreyStockGroupToKnittingOrder(viewingOrder))}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-xs cursor-pointer active:scale-95"
                  title="Open in Snipping Tool (HD Snapshot)"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Open Snipping Tool</span>
                </button>
                <button
                  onClick={() => setViewingOrder(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Official HD Snipping Tool for Order Details */}
      {snipOrder && (
        <KnittingOrderSnippingModal
          order={snipOrder}
          isOpen={Boolean(snipOrder)}
          onClose={() => setSnipOrder(null)}
          includeAllocation={false}
        />
      )}

      {/* Upload Excel Modal with Explicit Daily Replacement Rule */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Upload Daily Grey Stock File</h3>
                  <p className="text-xs text-slate-500">Imports file and replaces previous Grey Stock dataset</p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Daily Dataset Replacement Notice */}
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <span className="font-bold">Daily Replacement Rule:</span> Uploading this file will completely remove and replace the previous Grey Stock dataset with the newly uploaded dataset.
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <p className="font-bold text-slate-800 dark:text-slate-200 mb-1.5">Required File Headers:</p>
                <div className="flex flex-wrap gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Status</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Order No.</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Colour</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Fab Style</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Fab Type</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Owner Unit</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Net Received QTY</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Net Issued QTY</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Stock QTY</span>
                </div>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center hover:border-blue-500 hover:bg-blue-50/20 transition-all cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <UploadCloud className="w-10 h-10 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {isUploading ? 'Parsing & Replacing Dataset...' : 'Click to choose file or drag and drop'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Excel (.xlsx, .xls) or CSV up to 15MB</p>
              </div>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer"
                >
                  Reset demo data
                </button>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Supabase Code & Setup Modal */}
      {isSupabaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Supabase Cloud Database & Upload Code
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Table: <code className="font-mono text-emerald-600 dark:text-emerald-400">public.grey_stock_summary</code> • Real-time WebSockets & Daily Replace-On-Upload
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSupabaseModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Push local dataset card */}
              <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      Live Cloud Sync & Initial Seed
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Push your current {records.length} Grey Stock records directly to Supabase cloud table.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isMigratingToCloud}
                    onClick={handleMigrateCurrentToCloud}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    {isMigratingToCloud ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload Current Dataset to Supabase</span>
                      </>
                    )}
                  </button>
                </div>
                {cloudMigrateStatus && (
                  <div className={`p-2.5 rounded-lg text-xs font-semibold ${
                    cloudMigrateStatus.includes('Success')
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                  }`}>
                    {cloudMigrateStatus}
                  </div>
                )}
              </div>

              {/* Section 1: SQL Schema */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white dark:bg-slate-100 dark:text-slate-900">
                      1
                    </span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Supabase SQL Schema (Run once in Supabase SQL Editor)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-2xs"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400">Copied SQL!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-52 leading-relaxed selection:bg-emerald-800 border border-slate-800">
                  {SupabaseSync.getGreyStockSchemaSQL()}
                </pre>
              </div>

              {/* Section 2: TypeScript / Node.js Upload Code */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white dark:bg-slate-100 dark:text-slate-900">
                      2
                    </span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      TypeScript / Node.js Upload Code (Replace-on-Upload Implementation)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-2xs"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400">Copied Code!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Upload Code</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-64 leading-relaxed selection:bg-sky-800 border border-slate-800">
                  {getUploadCodeSnippet()}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
              <button
                type="button"
                onClick={() => setIsSupabaseModalOpen(false)}
                className="px-4 py-2 font-semibold text-xs rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
