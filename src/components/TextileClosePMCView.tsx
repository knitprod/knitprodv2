/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Textile Close By PMC View
 * List and tracking for textile orders & fabric specifications closed by PMC
 * Fully integrated with Supabase Cloud, Replace-on-Upload, Real-time Sync & Progress Tracking
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
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  Clock
} from 'lucide-react';
import { UserRecord } from './UserManagementView';
import { TextileCloseRecord } from '../types';
import { TextileClosePMCStorage } from '../lib/textileClosePMCStore';
import { SupabaseSync } from '../lib/supabaseClient';
import { SyncProgressBar, SyncProgressState } from './SyncProgressBar';

interface TextileClosePMCViewProps {
  currentUser?: UserRecord | null;
}

export default function TextileClosePMCView({ currentUser }: TextileClosePMCViewProps) {
  // Admin permissions
  const isAdmin = currentUser?.userType === 'Admin';

  // Records State
  const [records, setRecords] = useState<TextileCloseRecord[]>(() => TextileClosePMCStorage.getRecords());

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [buyerFilter, setBuyerFilter] = useState<string>('All');
  const [teamLeaderFilter, setTeamLeaderFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Modals & Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Sync & Progress States
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem('epyllion_tc_pmc_last_sync') || null;
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Initial Load & Real-time Cloud Synchronization
  useEffect(() => {
    if (!SupabaseSync.isConfigured()) return;

    // Fetch initial from Supabase Cloud
    SupabaseSync.fetchTextileCloseRecords()
      .then(remoteRecords => {
        if (Array.isArray(remoteRecords) && remoteRecords.length > 0) {
          setRecords(remoteRecords);
          TextileClosePMCStorage.saveRecords(remoteRecords);
          const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          setLastSyncedAt(nowStr);
          try {
            localStorage.setItem('epyllion_tc_pmc_last_sync', nowStr);
          } catch {}
        } else {
          // If remote is empty, seed demo records to Supabase
          const local = TextileClosePMCStorage.getRecords();
          if (local && local.length > 0) {
            SupabaseSync.bulkSaveTextileCloseRecords(local, false).catch(() => {});
          }
        }
      })
      .catch(err => {
        console.warn('Textile Close By PMC Supabase fetch error:', err);
      });

    // Real-time WebSocket Subscription
    const unsub = SupabaseSync.subscribeToTextileCloseRecords(({ eventType, record, id }) => {
      if (eventType === 'DELETE') {
        setRecords(prev => {
          const next = prev.filter(r => r.id !== id);
          TextileClosePMCStorage.saveRecords(next);
          return next;
        });
      } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (!record || !record.id) return;
        setRecords(prev => {
          const idx = prev.findIndex(r => r.id === record.id || (r.orderNo === record.orderNo && r.color === record.color));
          const next = idx >= 0 ? prev.map((r, i) => (i === idx ? record : r)) : [record, ...prev];
          TextileClosePMCStorage.saveRecords(next);
          return next;
        });
      }
    });

    return () => {
      unsub();
    };
  }, []);

  // 2. Manual Cloud Sync Handler
  const handleSyncData = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgress({
      isActive: true,
      type: 'sync',
      title: 'Synchronizing Textile Close with Supabase Cloud',
      percent: 20,
      stage: 'Connecting to Supabase cloud...'
    });

    try {
      const remote = await SupabaseSync.fetchTextileCloseRecords((loaded, total, percent) => {
        setSyncProgress({
          isActive: true,
          type: 'sync',
          title: 'Synchronizing Textile Close with Supabase Cloud',
          percent: Math.max(20, percent),
          stage: `Downloading records (${loaded.toLocaleString()} / ${total.toLocaleString()})...`,
          current: loaded,
          total
        });
      });

      if (Array.isArray(remote) && remote.length > 0) {
        setRecords(remote);
        TextileClosePMCStorage.saveRecords(remote);
        const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        setLastSyncedAt(nowStr);
        try {
          localStorage.setItem('epyllion_tc_pmc_last_sync', nowStr);
        } catch {}

        setSyncProgress({
          isActive: true,
          type: 'sync',
          title: 'Sync Complete',
          percent: 100,
          stage: `Successfully synchronized ${remote.length.toLocaleString()} records from Supabase.`
        });
        showToast(`Synchronized ${remote.length} records from Supabase Cloud.`);
      } else {
        setSyncProgress({
          isActive: true,
          type: 'sync',
          title: 'Sync Complete',
          percent: 100,
          stage: 'Cloud database is currently empty.'
        });
        showToast('Cloud database synchronized (0 remote records).');
      }

      setTimeout(() => {
        setSyncProgress(prev => ({ ...prev, isActive: false }));
      }, 2500);
    } catch (err: any) {
      console.error('Textile Close sync error:', err);
      const isMissingTable = err?.message?.includes('textile_close_pmc') || err?.message?.includes('PGRST205') || err?.message?.includes('schema cache');
      setSyncProgress({
        isActive: true,
        type: 'sync',
        title: 'Sync Failed',
        percent: 100,
        stage: isMissingTable ? "Table 'public.textile_close_pmc' not found in Supabase" : 'Failed to sync with Supabase',
        error: isMissingTable ? "Table 'public.textile_close_pmc' not found. Visit Database Connection to setup and migrate." : (err.message || 'Network error')
      });
      showToast(isMissingTable ? "Table missing. Visit Database Connection to setup." : ('Sync failed: ' + (err.message || 'Error')));
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. Upload Excel Handler (Upon upload remove previous data)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadModalOpen(false);

    setSyncProgress({
      isActive: true,
      type: 'upload',
      title: 'Uploading & Replacing Textile Close Records',
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
          stage: 'Parsing rows and mapping headers...'
        }));

        const allRows: any[] = [];
        wb.SheetNames.forEach(sName => {
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
          showToast('The uploaded file contains no rows.');
          return;
        }

        // Parse records with standardized logic
        const parsed = TextileClosePMCStorage.parseExcelRows(allRows);

        if (parsed.length === 0) {
          setSyncProgress({
            isActive: false,
            type: 'upload',
            percent: 0,
            stage: '',
            error: 'No valid records found in the uploaded file.'
          });
          showToast('No valid records found in the uploaded file.');
          return;
        }

        // UPON UPLOAD REMOVE PREVIOUS DATA:
        // 1. Immediately replace local state and storage
        setRecords(parsed);
        TextileClosePMCStorage.saveRecords(parsed);
        setCurrentPage(1);

        setSyncProgress(prev => ({
          ...prev,
          percent: 55,
          stage: `Replacing database with ${parsed.length.toLocaleString()} fresh records...`
        }));

        // 2. Bulk save to Supabase Cloud with replace=true (purging old records)
        if (SupabaseSync.isConfigured()) {
          const res = await SupabaseSync.bulkSaveTextileCloseRecords(
            parsed,
            true, // replace previous data
            (processed, total, pct, stage) => {
              setSyncProgress({
                isActive: true,
                type: 'upload',
                title: 'Uploading & Replacing Textile Close Records',
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
          localStorage.setItem('epyllion_tc_pmc_last_sync', nowStr);
        } catch {}

        setSyncProgress({
          isActive: true,
          type: 'upload',
          title: 'Upload & Database Replacement Complete',
          percent: 100,
          stage: `Successfully uploaded ${parsed.length.toLocaleString()} records and replaced previous data.`,
          current: parsed.length,
          total: parsed.length
        });

        showToast(`Uploaded ${parsed.length} records. Previous data replaced successfully!`);

        setTimeout(() => {
          setSyncProgress(prev => ({ ...prev, isActive: false }));
        }, 3000);
      } catch (err: any) {
        console.error('File parsing error:', err);
        setSyncProgress({
          isActive: true,
          type: 'upload',
          title: 'Upload Failed',
          percent: 100,
          stage: 'Failed to process Excel file',
          error: err.message || 'Unknown error'
        });
        showToast('Upload error: ' + (err.message || 'Failed'));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  // 4. Export Excel Handler with Progress Bar
  const handleExport = () => {
    setSyncProgress({
      isActive: true,
      type: 'download',
      title: 'Generating Textile Close Excel Report',
      percent: 25,
      stage: 'Compiling filtered dataset...'
    });

    setTimeout(() => {
      try {
        setSyncProgress(prev => ({
          ...prev,
          percent: 70,
          stage: 'Formatting worksheets and columns...'
        }));

        TextileClosePMCStorage.exportToExcel(filteredRecords);

        setSyncProgress({
          isActive: true,
          type: 'download',
          title: 'Export Complete',
          percent: 100,
          stage: `Successfully exported ${filteredRecords.length.toLocaleString()} records.`
        });
        showToast(`Exported ${filteredRecords.length} records to Excel.`);

        setTimeout(() => {
          setSyncProgress(prev => ({ ...prev, isActive: false }));
        }, 2500);
      } catch (err: any) {
        setSyncProgress({
          isActive: true,
          type: 'download',
          title: 'Export Failed',
          percent: 100,
          stage: 'Failed to generate Excel file',
          error: err.message || 'Export error'
        });
        showToast('Export failed: ' + err.message);
      }
    }, 150);
  };

  // Reset demo data handler
  const handleResetDefaults = async () => {
    if (!window.confirm('Reset Textile Close By PMC list to initial demo records and replace cloud database?')) return;
    const defaults = TextileClosePMCStorage.resetToDefault();
    setRecords(defaults);
    if (SupabaseSync.isConfigured()) {
      await SupabaseSync.bulkSaveTextileCloseRecords(defaults, true).catch(() => {});
    }
    showToast('Reset to default Textile Close records.');
  };

  // Unique Filter Lists
  const buyersList = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.buyerName) set.add(r.buyerName.trim());
    });
    return Array.from(set).sort();
  }, [records]);

  const teamLeadersList = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.teamLeader) set.add(r.teamLeader.trim());
    });
    return Array.from(set).sort();
  }, [records]);

  const statusesList = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.status) set.add(r.status.trim());
    });
    return Array.from(set).sort();
  }, [records]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const match =
          r.orderNo.toLowerCase().includes(q) ||
          r.buyerName.toLowerCase().includes(q) ||
          r.teamLeader.toLowerCase().includes(q) ||
          r.color.toLowerCase().includes(q) ||
          r.fabType.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          String(r.fgsm).toLowerCase().includes(q) ||
          r.fWidth.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Buyer Filter
      if (buyerFilter !== 'All' && r.buyerName !== buyerFilter) return false;

      // Team Leader Filter
      if (teamLeaderFilter !== 'All' && r.teamLeader !== teamLeaderFilter) return false;

      // Status Filter
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;

      return true;
    });
  }, [records, searchTerm, buyerFilter, teamLeaderFilter, statusFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    let totalReq = 0;
    let totalGrey = 0;
    let totalProd = 0;
    let totalBal = 0;
    const uniqueOrders = new Set<string>();

    filteredRecords.forEach(r => {
      totalReq += Number(r.reqQty) || 0;
      totalGrey += Number(r.greyQty) || 0;
      totalProd += Number(r.production) || 0;
      totalBal += Number(r.knitBal) || 0;
      if (r.orderNo) uniqueOrders.add(r.orderNo);
    });

    const completionRate = totalReq > 0 ? Math.min(100, Math.round((totalProd / totalReq) * 100)) : 0;

    return {
      totalItems: filteredRecords.length,
      totalOrders: uniqueOrders.size,
      totalReq,
      totalGrey,
      totalProd,
      totalBal,
      completionRate
    };
  }, [filteredRecords]);

  // Pagination Math
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Textile Close By PMC
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  PMC Sign-off Registry
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Supabase Cloud
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Fabric specification tracking for orders officially closed and signed off by PMC</span>
                {lastSyncedAt && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <Clock className="w-3 h-3" /> Last synced: {lastSyncedAt}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Sync, Upload, Export (No manual add/edit buttons) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sync Button */}
          <button
            id="sync-textile-close-btn"
            type="button"
            onClick={handleSyncData}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            title="Fetch Latest Data from Supabase Cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
          </button>

          {/* Upload Excel Button - Admin Only */}
          {isAdmin && (
            <button
              id="upload-textile-close-btn"
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs cursor-pointer"
              title="Import Excel and Replace Previous Data"
            >
              <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
              <span>Upload Excel</span>
            </button>
          )}

          {/* Export Excel Button */}
          <button
            id="export-textile-close-btn"
            type="button"
            onClick={handleExport}
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
        accentColor="emerald"
      />

      {/* KPI Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Items */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Records</span>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {metrics.totalItems.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400">{metrics.totalOrders} Unique Orders</span>
        </div>

        {/* Req QTY */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Req QTY</span>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
            {metrics.totalReq.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">Kg</span>
          </div>
          <span className="text-[10px] text-slate-400">Target Demand</span>
        </div>

        {/* Grey QTY */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Grey QTY</span>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
            {metrics.totalGrey.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">Kg</span>
          </div>
          <span className="text-[10px] text-slate-400">Issued Grey Fabric</span>
        </div>

        {/* Production */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Production</span>
          <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {metrics.totalProd.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">Kg</span>
          </div>
          <span className="text-[10px] text-slate-400">Knitted Output</span>
        </div>

        {/* Knit Bal */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Remaining Bal</span>
          <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
            {metrics.totalBal.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">Kg</span>
          </div>
          <span className="text-[10px] text-slate-400">Variance at Closure</span>
        </div>

        {/* Completion % */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Closed Fulfillment</span>
          <div className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">
            {metrics.completionRate}%
          </div>
          <span className="text-[10px] text-slate-400">Overall Yield Rate</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="search-textile-close-input"
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search Order, Buyer, Leader, Color, Fab..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Buyer Filter */}
          <div className="relative">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              id="filter-buyer-select"
              value={buyerFilter}
              onChange={e => {
                setBuyerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All">All Buyers ({buyersList.length})</option>
              {buyersList.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Team Leader Filter */}
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              id="filter-team-leader-select"
              value={teamLeaderFilter}
              onChange={e => {
                setTeamLeaderFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All">All Team Leaders ({teamLeadersList.length})</option>
              {teamLeadersList.map(tl => (
                <option key={tl} value={tl}>{tl}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              id="filter-status-select"
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All">All Statuses ({statusesList.length})</option>
              {statusesList.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Summary & Reset Bar */}
        {(searchTerm || buyerFilter !== 'All' || teamLeaderFilter !== 'All' || statusFilter !== 'All') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500">
              Filtered to <span className="font-bold text-slate-900 dark:text-white">{filteredRecords.length}</span> of {records.length} records
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setBuyerFilter('All');
                setTeamLeaderFilter('All');
                setStatusFilter('All');
                setCurrentPage(1);
              }}
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Main Table Container (Exact 12 headers, No manual edit buttons) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 select-none">
                {/* 1. Status */}
                <th className="py-3 px-3 min-w-[150px] whitespace-nowrap">Status</th>
                {/* 2. Order No. */}
                <th className="py-3 px-3 min-w-[110px] whitespace-nowrap">Order No.</th>
                {/* 3. Buyer Name */}
                <th className="py-3 px-3 min-w-[140px] whitespace-nowrap">Buyer Name</th>
                {/* 4. Team Leader */}
                <th className="py-3 px-3 min-w-[140px] whitespace-nowrap">Team Leader</th>
                {/* 5. FGSM */}
                <th className="py-3 px-3 min-w-[80px] whitespace-nowrap text-center">FGSM</th>
                {/* 6. F. Width */}
                <th className="py-3 px-3 min-w-[95px] whitespace-nowrap">F. Width</th>
                {/* 7. Color */}
                <th className="py-3 px-3 min-w-[130px] whitespace-nowrap">Color</th>
                {/* 8. Fab. Type */}
                <th className="py-3 px-3 min-w-[160px] whitespace-nowrap">Fab. Type</th>
                {/* 9. Req QTY */}
                <th className="py-3 px-3 min-w-[95px] whitespace-nowrap text-right">Req QTY</th>
                {/* 10. Grey QTY */}
                <th className="py-3 px-3 min-w-[95px] whitespace-nowrap text-right">Grey QTY</th>
                {/* 11. Production */}
                <th className="py-3 px-3 min-w-[95px] whitespace-nowrap text-right text-emerald-600 dark:text-emerald-400">Production</th>
                {/* 12. Knit Bal */}
                <th className="py-3 px-3 min-w-[95px] whitespace-nowrap text-right text-amber-600 dark:text-amber-400">Knit Bal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-slate-400">
                    <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-semibold">No Textile Close records found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting filters or upload an Excel file to populate data
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((item, idx) => (
                  <tr
                    key={item.id || `${item.orderNo}-${idx}`}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* 1. Status */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                        <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        {item.status || 'Textile Close By PMC'}
                      </span>
                    </td>

                    {/* 2. Order No. */}
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {item.orderNo}
                    </td>

                    {/* 3. Buyer Name */}
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {item.buyerName || '—'}
                    </td>

                    {/* 4. Team Leader */}
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {item.teamLeader || '—'}
                    </td>

                    {/* 5. FGSM */}
                    <td className="py-2.5 px-3 font-mono text-center text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {item.fgsm !== '' && item.fgsm !== undefined ? item.fgsm : '—'}
                    </td>

                    {/* 6. F. Width */}
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {item.fWidth || '—'}
                    </td>

                    {/* 7. Color */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.color || '—'}
                      </span>
                    </td>

                    {/* 8. Fab. Type */}
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-[220px] truncate" title={item.fabType}>
                      {item.fabType || '—'}
                    </td>

                    {/* 9. Req QTY */}
                    <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                      {item.reqQty ? item.reqQty.toLocaleString() : '0'}
                    </td>

                    {/* 10. Grey QTY */}
                    <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                      {item.greyQty ? item.greyQty.toLocaleString() : '0'}
                    </td>

                    {/* 11. Production */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {item.production ? item.production.toLocaleString() : '0'}
                    </td>

                    {/* 12. Knit Bal */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      <span
                        className={
                          item.knitBal <= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : item.knitBal < 3
                            ? 'text-emerald-500'
                            : 'text-amber-600 dark:text-amber-400'
                        }
                      >
                        {item.knitBal !== undefined ? item.knitBal.toLocaleString() : '0'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Table Footer: Totals Row across the 12 columns */}
            {filteredRecords.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                  <td colSpan={8} className="py-3 px-3 text-right uppercase tracking-wider text-[11px]">
                    Total ({filteredRecords.length} items):
                  </td>
                  <td className="py-3 px-3 text-right font-mono">{metrics.totalReq.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-mono">{metrics.totalGrey.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{metrics.totalProd.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-mono text-amber-600 dark:text-amber-400">{metrics.totalBal.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            Showing <span className="font-bold text-slate-800 dark:text-slate-200">
              {filteredRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </span> to <span className="font-bold text-slate-800 dark:text-slate-200">
              {Math.min(currentPage * pageSize, filteredRecords.length)}
            </span> of <span className="font-bold text-slate-800 dark:text-slate-200">{filteredRecords.length}</span> records
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
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

      {/* Upload Excel Modal with Explicit Replace-on-Upload Notice */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Upload Textile Close By PMC Excel</h3>
                  <p className="text-xs text-slate-500">Imports file and replaces previous database records</p>
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
              {/* Replace Notice */}
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <span className="font-bold">Replace-on-Upload Rule:</span> Uploading this file will completely remove and replace all existing Textile Close By PMC records in Supabase Cloud with the newly uploaded dataset.
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <p className="font-bold text-slate-800 dark:text-slate-200 mb-1.5">Required Column Headers:</p>
                <div className="flex flex-wrap gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Status</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Order No.</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Buyer Name</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Team Leader</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">FGSM</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">F. Width</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Color</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Fab. Type</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Req QTY</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Grey QTY</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Production</span>
                  <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">Knit Bal</span>
                </div>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center hover:border-emerald-500 hover:bg-emerald-50/20 transition-all cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <UploadCloud className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Click to choose file or drag and drop
                </p>
                <p className="text-xs text-slate-400 mt-1">.xlsx, .xls, or .csv up to 10MB</p>
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
    </div>
  );
}
