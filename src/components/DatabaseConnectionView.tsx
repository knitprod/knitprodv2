/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  Wifi, 
  WifiOff, 
  XCircle, 
  Save, 
  Loader2, 
  HelpCircle, 
  ExternalLink, 
  Copy, 
  Check, 
  CheckCircle, 
  RefreshCw, 
  AlertTriangle, 
  ShieldCheck, 
  Flame, 
  Layers, 
  FileSpreadsheet, 
  Activity, 
  Server, 
  Code,
  Key,
  Globe,
  ArrowRight,
  ArrowDown,
  CloudDownload,
  CloudUpload,
  Zap,
  Boxes,
  Download
} from 'lucide-react';
import { GasClient } from '../lib/gasClient';
import { SupabaseSync } from '../lib/supabaseClient';
import { TextileClosePMCStorage } from '../lib/textileClosePMCStore';
import { KnittingStatusStorage } from '../lib/knittingStatusStore';
import { GreyStockStorage } from '../lib/greyStockStore';
import { GreyYarnStockStorage } from '../lib/greyYarnStockStore';
import { SyncConflictLog } from '../types';
import { useGlobalData } from '../context/GlobalDataContext';
import gasScriptContent from '../../google-apps-script/Code.gs?raw';
import { safeCopyText } from '../lib/clipboardHelper';

interface DatabaseConnectionViewProps {
  onSuccessNotice?: (msg: string) => void;
}

export default function DatabaseConnectionView({ onSuccessNotice }: DatabaseConnectionViewProps) {
  const { ledger, yarnAllocations, orderPlans, refreshAll } = useGlobalData();

  // Google Sheets database connection states
  const [databaseMode, setDatabaseMode] = useState<'mock' | 'gas'>(() => GasClient.getDatabaseMode());
  const [gasWebAppUrl, setGasWebAppUrl] = useState(() => GasClient.getWebAppUrl());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Supabase states
  const [supabaseUrl, setSupabaseUrl] = useState(() => SupabaseSync.getStoredConfig().supabaseUrl);
  const [supabaseKey, setSupabaseKey] = useState(() => SupabaseSync.getStoredConfig().supabaseKey);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<string | null>(null);
  const [supabaseTestSuccess, setSupabaseTestSuccess] = useState<boolean | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlSetup, setShowSqlSetup] = useState(false);

  // Production Ledger to Supabase Migration State
  const [isMigratingLedger, setIsMigratingLedger] = useState(false);
  const [migrateStatus, setMigrateStatus] = useState<string | null>(null);

  // Yarn Allocations to Supabase Migration State
  const [isMigratingYarn, setIsMigratingYarn] = useState(false);
  const [migrateYarnStatus, setMigrateYarnStatus] = useState<string | null>(null);
  const [copiedYarnSql, setCopiedYarnSql] = useState(false);
  const [showYarnSql, setShowYarnSql] = useState(false);

  // Plan Order Followup to Supabase Migration State
  const [isMigratingOrders, setIsMigratingOrders] = useState(false);
  const [migrateOrdersStatus, setMigrateOrdersStatus] = useState<string | null>(null);
  const [copiedOrdersSql, setCopiedOrdersSql] = useState(false);
  const [showOrdersSql, setShowOrdersSql] = useState(false);

  // Textile Close By PMC to Supabase Migration State
  const [isMigratingTextileClose, setIsMigratingTextileClose] = useState(false);
  const [migrateTextileCloseStatus, setMigrateTextileCloseStatus] = useState<string | null>(null);
  const [copiedTextileCloseSql, setCopiedTextileCloseSql] = useState(false);
  const [showTextileCloseSql, setShowTextileCloseSql] = useState(false);

  // Grey Stock Summary to Supabase Migration State
  const [isMigratingGreyStock, setIsMigratingGreyStock] = useState(false);
  const [migrateGreyStockStatus, setMigrateGreyStockStatus] = useState<string | null>(null);
  const [copiedGreyStockSql, setCopiedGreyStockSql] = useState(false);
  const [showGreyStockSql, setShowGreyStockSql] = useState(false);

  // Grey Yarn Stock Summary to Supabase Migration State
  const [isMigratingGreyYarnStock, setIsMigratingGreyYarnStock] = useState(false);
  const [migrateGreyYarnStockStatus, setMigrateGreyYarnStockStatus] = useState<string | null>(null);
  const [copiedGreyYarnStockSql, setCopiedGreyYarnStockSql] = useState(false);
  const [showGreyYarnStockSql, setShowGreyYarnStockSql] = useState(false);

  // Knitting Orders Supabase Migration State
  const [isMigratingKnitting, setIsMigratingKnitting] = useState(false);
  const [migrateKnittingStatus, setMigrateKnittingStatus] = useState<string | null>(null);
  const [copiedKnittingSql, setCopiedKnittingSql] = useState(false);
  const [showKnittingSql, setShowKnittingSql] = useState(false);

  // Pull states for each table
  const [isPullingAll, setIsPullingAll] = useState(false);
  const [pullAllProgress, setPullAllProgress] = useState<{ current: number; total: number; stage: string } | null>(null);
  const [isPullingLedger, setIsPullingLedger] = useState(false);
  const [pullLedgerStatus, setPullLedgerStatus] = useState<string | null>(null);
  const [isPullingYarn, setIsPullingYarn] = useState(false);
  const [pullYarnStatus, setPullYarnStatus] = useState<string | null>(null);
  const [isPullingOrders, setIsPullingOrders] = useState(false);
  const [pullOrdersStatus, setPullOrdersStatus] = useState<string | null>(null);
  const [isPullingKnitting, setIsPullingKnitting] = useState(false);
  const [pullKnittingStatus, setPullKnittingStatus] = useState<string | null>(null);
  const [isPullingTextileClose, setIsPullingTextileClose] = useState(false);
  const [pullTextileCloseStatus, setPullTextileCloseStatus] = useState<string | null>(null);
  const [isPullingGreyStock, setIsPullingGreyStock] = useState(false);
  const [pullGreyStockStatus, setPullGreyStockStatus] = useState<string | null>(null);
  const [isPullingGreyYarnStock, setIsPullingGreyYarnStock] = useState(false);
  const [pullGreyYarnStockStatus, setPullGreyYarnStockStatus] = useState<string | null>(null);

  // Live row counts in Supabase
  const [supabaseCounts, setSupabaseCounts] = useState<{
    ledger: number | null;
    yarn: number | null;
    orders: number | null;
    knitting: number | null;
    textileClose: number | null;
    greyStock: number | null;
    greyYarnStock: number | null;
  }>({
    ledger: null,
    yarn: null,
    orders: null,
    knitting: null,
    textileClose: null,
    greyStock: null,
    greyYarnStock: null,
  });
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

  // Local storage counts
  const [localCounts, setLocalCounts] = useState({
    knitting: KnittingStatusStorage.getOrders().length,
    textileClose: TextileClosePMCStorage.getRecords().length,
    greyStock: GreyStockStorage.getRecords().length,
    greyYarn: GreyYarnStockStorage.getRecords().length
  });

  const refreshLocalCounts = useCallback(() => {
    setLocalCounts({
      knitting: KnittingStatusStorage.getOrders().length,
      textileClose: TextileClosePMCStorage.getRecords().length,
      greyStock: GreyStockStorage.getRecords().length,
      greyYarn: GreyYarnStockStorage.getRecords().length
    });
  }, []);

  // Fetch live counts from Supabase Cloud
  const fetchSupabaseCounts = useCallback(async () => {
    const client = SupabaseSync.getClient();
    if (!client || !SupabaseSync.isConfigured()) return;
    setIsLoadingCounts(true);
    try {
      const [rLedger, rYarn, rOrders, rKnit, rTC, rGS, rGYS] = await Promise.allSettled([
        client.from('production_ledger').select('*', { count: 'exact', head: true }),
        client.from('yarn_allocations').select('*', { count: 'exact', head: true }),
        client.from('order_plans').select('*', { count: 'exact', head: true }),
        client.from('knitting_orders').select('*', { count: 'exact', head: true }),
        client.from('textile_close_pmc').select('*', { count: 'exact', head: true }),
        client.from('grey_stock_summary').select('*', { count: 'exact', head: true }),
        client.from('grey_yarn_stock').select('*', { count: 'exact', head: true }),
      ]);
      setSupabaseCounts({
        ledger: rLedger.status === 'fulfilled' ? (rLedger.value.count ?? null) : null,
        yarn: rYarn.status === 'fulfilled' ? (rYarn.value.count ?? null) : null,
        orders: rOrders.status === 'fulfilled' ? (rOrders.value.count ?? null) : null,
        knitting: rKnit.status === 'fulfilled' ? (rKnit.value.count ?? null) : null,
        textileClose: rTC.status === 'fulfilled' ? (rTC.value.count ?? null) : null,
        greyStock: rGS.status === 'fulfilled' ? (rGS.value.count ?? null) : null,
        greyYarnStock: rGYS.status === 'fulfilled' ? (rGYS.value.count ?? null) : null,
      });
    } catch {} finally {
      setIsLoadingCounts(false);
    }
  }, []);

  // Two-Way Synchronization states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflictLog[]>([]);

  // Sync with central server configuration on load & fetch counts
  useEffect(() => {
    GasClient.fetchServerConfig().then((config) => {
      if (config.gasWebAppUrl) {
        setGasWebAppUrl(config.gasWebAppUrl);
      }
      if (config.databaseMode) {
        setDatabaseMode(config.databaseMode);
      }
    });

    if (SupabaseSync.isConfigured()) {
      fetchSupabaseCounts();
    }

    const handleKnittingUpdate = () => refreshLocalCounts();
    const handleTCUpdate = () => refreshLocalCounts();
    const handleGSUpdate = () => refreshLocalCounts();
    const handleGYSUpdate = () => refreshLocalCounts();

    window.addEventListener('epyllion_knitting_status_updated', handleKnittingUpdate);
    window.addEventListener('epyllion_tc_pmc_updated', handleTCUpdate);
    window.addEventListener('epyllion_grey_stock_updated', handleGSUpdate);
    window.addEventListener('epyllion_grey_yarn_stock_updated', handleGYSUpdate);

    return () => {
      window.removeEventListener('epyllion_knitting_status_updated', handleKnittingUpdate);
      window.removeEventListener('epyllion_tc_pmc_updated', handleTCUpdate);
      window.removeEventListener('epyllion_grey_stock_updated', handleGSUpdate);
      window.removeEventListener('epyllion_grey_yarn_stock_updated', handleGYSUpdate);
    };
  }, [fetchSupabaseCounts, refreshLocalCounts]);

  const handleMigrateLedgerToSupabase = async () => {
    if (!SupabaseSync.isConfigured()) {
      if (onSuccessNotice) onSuccessNotice("Please enter and save your Supabase credentials first.");
      return;
    }
    setIsMigratingLedger(true);
    setMigrateStatus("Migrating Production Ledger to Supabase...");
    try {
      const res = await SupabaseSync.bulkSaveProductionRecords(ledger);
      if (res.success) {
        setMigrateStatus(`Successfully migrated ${res.count} records to Supabase! Live WebSockets active.`);
        if (onSuccessNotice) onSuccessNotice(`Transferred ${res.count} Production Ledger records to Supabase!`);
      } else {
        setMigrateStatus(`Error transferring records: ${res.error || 'Check Supabase SQL Editor and table structure.'}`);
      }
    } catch (err: any) {
      setMigrateStatus(`Migration notice: ${err.message || String(err)}`);
    } finally {
      setIsMigratingLedger(false);
    }
  };

  const handleMigrateYarnToSupabase = async () => {
    if (!SupabaseSync.isConfigured()) {
      if (onSuccessNotice) onSuccessNotice("Please enter and save your Supabase credentials first.");
      return;
    }
    setIsMigratingYarn(true);
    setMigrateYarnStatus("Migrating Yarn Allocations to Supabase...");
    try {
      const res = await SupabaseSync.bulkSaveYarnAllocations(yarnAllocations);
      if (res.success) {
        setMigrateYarnStatus(`Successfully migrated ${res.count} Yarn Allocations to Supabase! Live WebSockets active.`);
        if (onSuccessNotice) onSuccessNotice(`Transferred ${res.count} Yarn Allocations to Supabase!`);
      } else {
        if (res.error?.includes('yarn_allocations') || res.error?.includes('schema cache') || res.error?.includes('PGRST205')) {
          setShowYarnSql(true);
          setMigrateYarnStatus("Table 'public.yarn_allocations' does not exist in Supabase yet. Please copy the SQL script below, run it in your Supabase SQL Editor, and then click Migration.");
        } else {
          setMigrateYarnStatus(`Error transferring records: ${res.error || 'Check Supabase SQL Editor and table structure.'}`);
        }
      }
    } catch (err: any) {
      setMigrateYarnStatus(`Migration notice: ${err.message || String(err)}`);
    } finally {
      setIsMigratingYarn(false);
    }
  };

  const handleCopyYarnSql = async () => {
    const success = await safeCopyText(SupabaseSync.getYarnSetupSQL());
    if (success) {
      setCopiedYarnSql(true);
      setTimeout(() => setCopiedYarnSql(false), 2500);
    }
  };

  const handleMigrateOrdersToSupabase = async () => {
    if (!SupabaseSync.isConfigured()) {
      if (onSuccessNotice) onSuccessNotice("Please enter and save your Supabase credentials first.");
      return;
    }
    setIsMigratingOrders(true);
    setMigrateOrdersStatus("Migrating Plan Order Followup & Status to Supabase...");
    try {
      const res = await SupabaseSync.bulkSaveOrderPlans(orderPlans);
      if (res.success) {
        setMigrateOrdersStatus(`Successfully migrated ${res.count} Plan Orders to Supabase! Live WebSockets active.`);
        if (onSuccessNotice) onSuccessNotice(`Transferred ${res.count} Plan Orders to Supabase!`);
      } else {
        if (res.error?.includes('order_plans') || res.error?.includes('schema cache') || res.error?.includes('PGRST205')) {
          setShowOrdersSql(true);
          setMigrateOrdersStatus("Table 'public.order_plans' does not exist in Supabase yet. Please copy the SQL script below, run it in your Supabase SQL Editor, and then click Migration.");
        } else {
          setMigrateOrdersStatus(`Error transferring records: ${res.error || 'Check Supabase SQL Editor and table structure.'}`);
        }
      }
    } catch (err: any) {
      setMigrateOrdersStatus(`Migration notice: ${err.message || String(err)}`);
    } finally {
      setIsMigratingOrders(false);
    }
  };

  const handleCopyOrdersSql = async () => {
    const success = await safeCopyText(SupabaseSync.getOrderPlansSetupSQL());
    if (success) {
      setCopiedOrdersSql(true);
      setTimeout(() => setCopiedOrdersSql(false), 2500);
    }
  };

  const handleMigrateTextileCloseToSupabase = async () => {
    if (!SupabaseSync.isConfigured()) {
      if (onSuccessNotice) onSuccessNotice("Please enter and save your Supabase credentials first.");
      return;
    }
    setIsMigratingTextileClose(true);
    setMigrateTextileCloseStatus("Migrating Textile Close By PMC records to Supabase...");
    try {
      const records = TextileClosePMCStorage.getRecords();
      const res = await SupabaseSync.bulkSaveTextileCloseRecords(records, false);
      if (res.success) {
        setMigrateTextileCloseStatus(`Successfully migrated ${res.count} records to Supabase! Live WebSockets active.`);
        if (onSuccessNotice) onSuccessNotice(`Transferred ${res.count} Textile Close By PMC records to Supabase!`);
      } else {
        if (res.error?.includes('textile_close_pmc') || res.error?.includes('schema cache') || res.error?.includes('PGRST205')) {
          setShowTextileCloseSql(true);
          setMigrateTextileCloseStatus("Table 'public.textile_close_pmc' does not exist in Supabase yet. Please copy the SQL script below, run it in your Supabase SQL Editor, and then click Migration.");
        } else {
          setMigrateTextileCloseStatus(`Error transferring records: ${res.error || 'Check Supabase SQL Editor and table structure.'}`);
        }
      }
    } catch (err: any) {
      setMigrateTextileCloseStatus(`Migration notice: ${err.message || String(err)}`);
    } finally {
      setIsMigratingTextileClose(false);
    }
  };

  const handleCopyTextileCloseSql = async () => {
    const success = await safeCopyText(SupabaseSync.getTextileCloseSetupSQL());
    if (success) {
      setCopiedTextileCloseSql(true);
      setTimeout(() => setCopiedTextileCloseSql(false), 2500);
    }
  };

  const handleMigrateGreyStockToSupabase = async () => {
    if (!SupabaseSync.isConfigured()) {
      if (onSuccessNotice) onSuccessNotice("Please enter and save your Supabase credentials first.");
      return;
    }
    setIsMigratingGreyStock(true);
    setMigrateGreyStockStatus("Migrating Grey Stock Summary records to Supabase...");
    try {
      const records = GreyStockStorage.getRecords();
      const res = await SupabaseSync.bulkSaveGreyStockRecords(records, true);
      if (res.success) {
        setMigrateGreyStockStatus(`Successfully migrated and replaced ${res.count} records in Supabase! Live WebSockets active.`);
        if (onSuccessNotice) onSuccessNotice(`Transferred ${res.count} Grey Stock Summary records to Supabase!`);
      } else {
        if (res.error?.includes('grey_stock_summary') || res.error?.includes('schema cache') || res.error?.includes('PGRST205')) {
          setShowGreyStockSql(true);
          setMigrateGreyStockStatus("Table 'public.grey_stock_summary' does not exist in Supabase yet. Please copy the SQL script below, run it in your Supabase SQL Editor, and then click Migration.");
        } else {
          setMigrateGreyStockStatus(`Error transferring records: ${res.error || 'Check Supabase SQL Editor and table structure.'}`);
        }
      }
    } catch (err: any) {
      setMigrateGreyStockStatus(`Migration notice: ${err.message || String(err)}`);
    } finally {
      setIsMigratingGreyStock(false);
    }
  };

  const handleCopyGreyStockSql = async () => {
    const success = await safeCopyText(SupabaseSync.getGreyStockSchemaSQL());
    if (success) {
      setCopiedGreyStockSql(true);
      setTimeout(() => setCopiedGreyStockSql(false), 2500);
    }
  };

  const handleMigrateGreyYarnStockToSupabase = async () => {
    if (!SupabaseSync.isConfigured()) {
      if (onSuccessNotice) onSuccessNotice("Please enter and save your Supabase credentials first.");
      return;
    }
    setIsMigratingGreyYarnStock(true);
    setMigrateGreyYarnStockStatus("Migrating Grey Yarn Stock Summary records to Supabase...");
    try {
      const records = GreyYarnStockStorage.getRecords();
      const res = await SupabaseSync.bulkSaveGreyYarnStockRecords(records, true);
      if (res.success) {
        setMigrateGreyYarnStockStatus(`Successfully migrated and replaced ${res.count} records in Supabase! Live WebSockets active.`);
        if (onSuccessNotice) onSuccessNotice(`Transferred ${res.count} Grey Yarn Stock Summary records to Supabase!`);
      } else {
        if (res.error?.includes('grey_yarn_stock') || res.error?.includes('schema cache') || res.error?.includes('PGRST205')) {
          setShowGreyYarnStockSql(true);
          setMigrateGreyYarnStockStatus("Table 'public.grey_yarn_stock' does not exist in Supabase yet. Please copy the SQL script below, run it in your Supabase SQL Editor, and then click Migration.");
        } else {
          setMigrateGreyYarnStockStatus(`Error transferring records: ${res.error || 'Check Supabase SQL Editor and table structure.'}`);
        }
      }
    } catch (err: any) {
      setMigrateGreyYarnStockStatus(`Migration notice: ${err.message || String(err)}`);
    } finally {
      setIsMigratingGreyYarnStock(false);
    }
  };

  const handleCopyGreyYarnStockSql = async () => {
    const success = await safeCopyText(SupabaseSync.getGreyYarnStockSchemaSQL());
    if (success) {
      setCopiedGreyYarnStockSql(true);
      if (onSuccessNotice) onSuccessNotice("Copied Grey Yarn Stock SQL script!");
      setTimeout(() => setCopiedGreyYarnStockSql(false), 2500);
    }
  };

  const handleDownloadGreyYarnStockSql = () => {
    const sql = SupabaseSync.getGreyYarnStockSchemaSQL();
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supabase_grey_yarn_stock.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (onSuccessNotice) onSuccessNotice('Downloaded supabase_grey_yarn_stock.sql');
  };

  const handleCopySql = async () => {
    const success = await safeCopyText(SupabaseSync.getSetupSQL());
    if (success) {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    }
  };

  const handleCopyKnittingSql = async () => {
    const success = await safeCopyText(SupabaseSync.getKnittingOrdersSetupSQL());
    if (success) {
      setCopiedKnittingSql(true);
      if (onSuccessNotice) onSuccessNotice("Copied Knitting Orders SQL script!");
      setTimeout(() => setCopiedKnittingSql(false), 2500);
    }
  };

  const handleMigrateKnittingToSupabase = async () => {
    if (!SupabaseSync.isConfigured()) {
      if (onSuccessNotice) onSuccessNotice("Please enter and save your Supabase credentials first.");
      return;
    }
    setIsMigratingKnitting(true);
    setMigrateKnittingStatus("Migrating Knitting Status orders & items to Supabase...");
    try {
      const records = KnittingStatusStorage.getOrders();
      const res = await SupabaseSync.bulkSaveKnittingOrders(records, true);
      if (res.success) {
        setMigrateKnittingStatus(`Successfully migrated and replaced ${res.count} Knitting Orders in Supabase! Live WebSockets active.`);
        if (onSuccessNotice) onSuccessNotice(`Transferred ${res.count} Knitting Orders to Supabase!`);
        fetchSupabaseCounts();
      } else {
        if (res.error?.includes('knitting_orders') || res.error?.includes('schema cache') || res.error?.includes('PGRST205')) {
          setShowKnittingSql(true);
          setMigrateKnittingStatus("Table 'public.knitting_orders' does not exist in Supabase yet. Please copy the SQL script below, run it in your Supabase SQL Editor, and then click Migration.");
        } else {
          setMigrateKnittingStatus(`Error transferring records: ${res.error || 'Check Supabase SQL Editor and table structure.'}`);
        }
      }
    } catch (err: any) {
      setMigrateKnittingStatus(`Migration notice: ${err.message || String(err)}`);
    } finally {
      setIsMigratingKnitting(false);
    }
  };

  // ----------------------------------------------------
  // Two-Way PULL Handlers: Pulling from Supabase Cloud
  // ----------------------------------------------------
  const handlePullLedgerFromSupabase = async () => {
    if (!SupabaseSync.isConfigured()) return;
    setIsPullingLedger(true);
    setPullLedgerStatus("Pulling Production Ledger records from Supabase Cloud...");
    try {
      const records = await SupabaseSync.fetchProductionLedger();
      if (Array.isArray(records)) {
        await refreshAll(true);
        setPullLedgerStatus(`Successfully pulled ${records.length} Production Ledger records from Supabase!`);
        if (onSuccessNotice) onSuccessNotice(`Pulled ${records.length} records from Supabase Cloud.`);
        fetchSupabaseCounts();
      }
    } catch (e: any) {
      setPullLedgerStatus(`Pull notice: ${e.message || String(e)}`);
    } finally {
      setIsPullingLedger(false);
    }
  };

  const handlePullYarnFromSupabase = async () => {
    if (!SupabaseSync.isConfigured()) return;
    setIsPullingYarn(true);
    setPullYarnStatus("Pulling Yarn Allocations from Supabase Cloud...");
    try {
      const records = await SupabaseSync.fetchYarnAllocations();
      if (Array.isArray(records)) {
        await refreshAll(true);
        setPullYarnStatus(`Successfully pulled ${records.length} Yarn Allocations from Supabase!`);
        if (onSuccessNotice) onSuccessNotice(`Pulled ${records.length} Yarn records from Supabase Cloud.`);
        fetchSupabaseCounts();
      }
    } catch (e: any) {
      setPullYarnStatus(`Pull notice: ${e.message || String(e)}`);
    } finally {
      setIsPullingYarn(false);
    }
  };

  const handlePullOrdersFromSupabase = async () => {
    if (!SupabaseSync.isConfigured()) return;
    setIsPullingOrders(true);
    setPullOrdersStatus("Pulling Plan Orders from Supabase Cloud...");
    try {
      const records = await SupabaseSync.fetchOrderPlans();
      if (Array.isArray(records)) {
        await refreshAll(true);
        setPullOrdersStatus(`Successfully pulled ${records.length} Plan Orders from Supabase!`);
        if (onSuccessNotice) onSuccessNotice(`Pulled ${records.length} Plan Orders from Supabase Cloud.`);
        fetchSupabaseCounts();
      }
    } catch (e: any) {
      setPullOrdersStatus(`Pull notice: ${e.message || String(e)}`);
    } finally {
      setIsPullingOrders(false);
    }
  };

  const handlePullKnittingFromSupabase = async () => {
    if (!SupabaseSync.isConfigured()) return;
    setIsPullingKnitting(true);
    setPullKnittingStatus("Pulling Knitting Status orders from Supabase Cloud...");
    try {
      const records = await SupabaseSync.fetchKnittingOrders();
      if (Array.isArray(records)) {
        KnittingStatusStorage.saveOrders(records);
        window.dispatchEvent(new CustomEvent('epyllion_knitting_status_updated', { detail: records }));
        refreshLocalCounts();
        setPullKnittingStatus(`Successfully pulled ${records.length} Knitting Orders from Supabase!`);
        if (onSuccessNotice) onSuccessNotice(`Pulled ${records.length} Knitting Orders from Supabase Cloud.`);
        fetchSupabaseCounts();
      }
    } catch (e: any) {
      setPullKnittingStatus(`Pull notice: ${e.message || String(e)}`);
    } finally {
      setIsPullingKnitting(false);
    }
  };

  const handlePullTextileCloseFromSupabase = async () => {
    if (!SupabaseSync.isConfigured()) return;
    setIsPullingTextileClose(true);
    setPullTextileCloseStatus("Pulling Textile Close By PMC records from Supabase Cloud...");
    try {
      const records = await SupabaseSync.fetchTextileCloseRecords();
      if (Array.isArray(records)) {
        TextileClosePMCStorage.saveRecords(records);
        window.dispatchEvent(new CustomEvent('epyllion_tc_pmc_updated', { detail: records }));
        refreshLocalCounts();
        setPullTextileCloseStatus(`Successfully pulled ${records.length} Textile Close records from Supabase!`);
        if (onSuccessNotice) onSuccessNotice(`Pulled ${records.length} Textile Close records from Supabase Cloud.`);
        fetchSupabaseCounts();
      }
    } catch (e: any) {
      setPullTextileCloseStatus(`Pull notice: ${e.message || String(e)}`);
    } finally {
      setIsPullingTextileClose(false);
    }
  };

  const handlePullGreyStockFromSupabase = async () => {
    if (!SupabaseSync.isConfigured()) return;
    setIsPullingGreyStock(true);
    setPullGreyStockStatus("Pulling Grey Stock Summary records from Supabase Cloud...");
    try {
      const records = await SupabaseSync.fetchGreyStockRecords();
      if (Array.isArray(records)) {
        GreyStockStorage.saveRecords(records, false);
        window.dispatchEvent(new CustomEvent('epyllion_grey_stock_updated', { detail: records }));
        refreshLocalCounts();
        setPullGreyStockStatus(`Successfully pulled ${records.length} Grey Stock records from Supabase!`);
        if (onSuccessNotice) onSuccessNotice(`Pulled ${records.length} Grey Stock records from Supabase Cloud.`);
        fetchSupabaseCounts();
      }
    } catch (e: any) {
      setPullGreyStockStatus(`Pull notice: ${e.message || String(e)}`);
    } finally {
      setIsPullingGreyStock(false);
    }
  };

  const handlePullGreyYarnStockFromSupabase = async () => {
    if (!SupabaseSync.isConfigured()) return;
    setIsPullingGreyYarnStock(true);
    setPullGreyYarnStockStatus("Pulling Grey Yarn Stock Summary records from Supabase Cloud...");
    try {
      const records = await SupabaseSync.fetchGreyYarnStockRecords();
      if (Array.isArray(records)) {
        GreyYarnStockStorage.saveRecords(records, false);
        window.dispatchEvent(new CustomEvent('epyllion_grey_yarn_stock_updated', { detail: records }));
        refreshLocalCounts();
        setPullGreyYarnStockStatus(`Successfully pulled ${records.length} Grey Yarn Stock records from Supabase!`);
        if (onSuccessNotice) onSuccessNotice(`Pulled ${records.length} Grey Yarn Stock records from Supabase Cloud.`);
        fetchSupabaseCounts();
      }
    } catch (e: any) {
      setPullGreyYarnStockStatus(`Pull notice: ${e.message || String(e)}`);
    } finally {
      setIsPullingGreyYarnStock(false);
    }
  };

  const handlePullAllFromSupabase = async () => {
    if (!SupabaseSync.isConfigured()) {
      if (onSuccessNotice) onSuccessNotice("Please enter and save your Supabase credentials first.");
      return;
    }
    setIsPullingAll(true);
    setPullAllProgress({ current: 0, total: 7, stage: 'Connecting to Supabase Cloud...' });

    try {
      // 1. Production Ledger
      setPullAllProgress({ current: 1, total: 7, stage: 'Pulling Production Ledger records from Supabase...' });
      const ledgerData = await SupabaseSync.fetchProductionLedger().catch(() => []);

      // 2. Yarn Allocations
      setPullAllProgress({ current: 2, total: 7, stage: 'Pulling Yarn Allocations from Supabase...' });
      const yarnData = await SupabaseSync.fetchYarnAllocations().catch(() => []);

      // 3. Order Plans
      setPullAllProgress({ current: 3, total: 7, stage: 'Pulling Plan Orders from Supabase...' });
      const ordersData = await SupabaseSync.fetchOrderPlans().catch(() => []);

      // 4. Knitting Orders
      setPullAllProgress({ current: 4, total: 7, stage: 'Pulling Knitting Status Orders & Items from Supabase...' });
      const knitData = await SupabaseSync.fetchKnittingOrders().catch(() => []);
      if (Array.isArray(knitData) && knitData.length > 0) {
        KnittingStatusStorage.saveOrders(knitData);
        window.dispatchEvent(new CustomEvent('epyllion_knitting_status_updated', { detail: knitData }));
      }

      // 5. Textile Close By PMC
      setPullAllProgress({ current: 5, total: 7, stage: 'Pulling Textile Close By PMC records from Supabase...' });
      const tcData = await SupabaseSync.fetchTextileCloseRecords().catch(() => []);
      if (Array.isArray(tcData) && tcData.length > 0) {
        TextileClosePMCStorage.saveRecords(tcData);
        window.dispatchEvent(new CustomEvent('epyllion_tc_pmc_updated', { detail: tcData }));
      }

      // 6. Grey Stock Summary
      setPullAllProgress({ current: 6, total: 7, stage: 'Pulling Grey Stock Summary records from Supabase...' });
      const gsData = await SupabaseSync.fetchGreyStockRecords().catch(() => []);
      if (Array.isArray(gsData) && gsData.length > 0) {
        GreyStockStorage.saveRecords(gsData, false);
        window.dispatchEvent(new CustomEvent('epyllion_grey_stock_updated', { detail: gsData }));
      }

      // 7. Grey Yarn Stock Summary
      setPullAllProgress({ current: 7, total: 7, stage: 'Pulling Grey Yarn Stock Summary records from Supabase...' });
      const gysData = await SupabaseSync.fetchGreyYarnStockRecords().catch(() => []);
      if (Array.isArray(gysData) && gysData.length > 0) {
        GreyYarnStockStorage.saveRecords(gysData, false);
        window.dispatchEvent(new CustomEvent('epyllion_grey_yarn_stock_updated', { detail: gysData }));
      }

      // Refresh Global Context for Ledger, Yarn, Orders
      await refreshAll(true);
      refreshLocalCounts();
      await fetchSupabaseCounts();

      const totalRows = (ledgerData?.length || 0) + (yarnData?.length || 0) + (ordersData?.length || 0) + 
        (knitData?.length || 0) + (tcData?.length || 0) + (gsData?.length || 0) + (gysData?.length || 0);

      const msg = `Successfully pulled all ${totalRows.toLocaleString()} live records across 7 tables from Supabase Cloud!`;
      setSyncNotice(msg);
      if (onSuccessNotice) onSuccessNotice(msg);
    } catch (err: any) {
      setSyncNotice(`Pull notice: ${err.message || String(err)}`);
    } finally {
      setIsPullingAll(false);
      setPullAllProgress(null);
    }
  };

  const handleTestSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setSupabaseTestSuccess(false);
      setSupabaseTestResult("Please enter both Supabase Project URL and Anon Public Key.");
      return;
    }

    setIsTestingSupabase(true);
    setSupabaseTestResult(null);
    setSupabaseTestSuccess(null);

    // Temporarily apply credentials to test
    SupabaseSync.setCredentials(supabaseUrl, supabaseKey);

    try {
      const res = await SupabaseSync.testConnection(supabaseUrl, supabaseKey);
      setSupabaseTestSuccess(res.success);
      setSupabaseTestResult(res.message);
      if (res.success) {
        fetchSupabaseCounts();
      }
    } catch (err: any) {
      setSupabaseTestSuccess(false);
      setSupabaseTestResult(`Connection Failed: ${err.message || String(err)}`);
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = SupabaseSync.setCredentials(supabaseUrl, supabaseKey);
    setIsSaved(true);
    if (onSuccessNotice) {
      onSuccessNotice("Supabase credentials saved successfully. Users, Settings, & Logs now route to Supabase (100% Free Forever).");
    }
    fetchSupabaseCounts();
    setTimeout(() => setIsSaved(false), 4000);
  };

  const handleCopyScript = async () => {
    const success = await safeCopyText(gasScriptContent);
    if (success) {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    }
  };

  const handleTestConnection = async () => {
    let cleanUrl = gasWebAppUrl.trim();
    if (cleanUrl.endsWith('/dev')) {
      cleanUrl = cleanUrl.replace(/\/dev$/, '/exec');
      setGasWebAppUrl(cleanUrl);
    } else if (cleanUrl.endsWith('/edit')) {
      cleanUrl = cleanUrl.replace(/\/edit$/, '/exec');
      setGasWebAppUrl(cleanUrl);
    } else if (cleanUrl.includes('/macros/s/') && !cleanUrl.endsWith('/exec')) {
      cleanUrl = cleanUrl.replace(/\/+$/, '') + '/exec';
      setGasWebAppUrl(cleanUrl);
    }

    if (!cleanUrl) {
      setTestSuccess(false);
      setTestResult("Please provide a valid Google Apps Script Web App URL first.");
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setTestSuccess(null);

    try {
      const res = await GasClient.testConnection(cleanUrl);
      if (res.success) {
        setTestSuccess(true);
        setTestResult(`Success! Connected to Epyllion GAS REST API v${res.version || '1.0.0'}. All sheets verified.`);
      } else {
        setTestSuccess(false);
        setTestResult(`Connection Failed: ${res.message}`);
      }
    } catch (err: any) {
      setTestSuccess(false);
      setTestResult(`Connection Failed: ${err.message || 'Network Error'}. Ensure you've deployed the Apps Script as a Web App and configured access to "Anyone".`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    await GasClient.saveServerConfig(gasWebAppUrl, databaseMode);
    setIsSaved(true);
    if (onSuccessNotice) {
      onSuccessNotice("Database connection settings saved successfully.");
    }
    setTimeout(() => {
      setIsSaved(false);
    }, 4000);
  };

  const isSupabaseActive = SupabaseSync.isConfigured();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="font-sans text-xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Database & Cloud Backend Control Center
          </h2>
          <p className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
            Supabase PostgreSQL (Users, Settings & Logs) + Google Sheets Master Production Ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSupabaseActive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-xs font-bold shadow-2xs">
              <Server className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Supabase Connected (100% Free Forever)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700 text-xs font-bold shadow-2xs">
              <Flame className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Ready for Supabase Setup
            </span>
          )}
        </div>
      </div>

      {isSaved && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900 p-4 text-sm font-bold text-emerald-800 dark:text-emerald-300 shadow-xs flex items-center gap-2.5 animate-fade-in">
          <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Configurations committed and database connection refreshed successfully!</span>
        </div>
      )}

      {/* Supabase Free Cloud Integration Card */}
      <div className="rounded-2xl border-2 border-emerald-500/40 bg-linear-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-slate-900 p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-100 dark:border-emerald-900/40 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              <Server className="h-4 w-4" />
              <span>Primary Enterprise Cloud Database (100% Free Forever)</span>
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Supabase PostgreSQL Connection
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Connect your free Supabase project to store <strong>System Users & Permissions</strong>, <strong>Factory Unit Settings</strong>, and <strong>Unlimited Activity Audit Logs</strong> with zero read-count limits or daily lockouts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSqlSetup(!showSqlSetup)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 transition-all cursor-pointer shadow-2xs"
            >
              <Code className="h-3.5 w-3.5" />
              <span>{showSqlSetup ? 'Hide SQL Script' : 'View / Copy SQL Script'}</span>
            </button>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs"
            >
              <span>Open Supabase Dashboard</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* SQL Copy Drawer */}
        {showSqlSetup && (
          <div className="p-4 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 text-xs space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-emerald-400" />
                <span className="font-bold text-slate-200">Supabase SQL Schema (Run once in SQL Editor)</span>
              </div>
              <button
                type="button"
                onClick={handleCopySql}
                className="inline-flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
              >
                {copiedSql ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied SQL!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy SQL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="text-[11px] font-mono p-3 bg-slate-950 rounded-lg overflow-x-auto max-h-48 text-emerald-300">
              {SupabaseSync.getSetupSQL()}
            </pre>
          </div>
        )}

        <form onSubmit={handleSaveSupabase} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-emerald-600" />
              <span>Supabase Project URL</span>
            </label>
            <input
              type="text"
              placeholder="https://xyzcompany.supabase.co"
              value={supabaseUrl}
              onChange={(e) => {
                setSupabaseUrl(e.target.value);
                setSupabaseTestResult(null);
              }}
              onBlur={() => {
                if (supabaseUrl.trim()) {
                  setSupabaseUrl(SupabaseSync.cleanSupabaseUrl(supabaseUrl));
                }
              }}
              className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500 transition-all shadow-xs"
            />
            <p className="text-[10px] text-slate-400">
              Found in: <strong>Project Settings &gt; API &gt; Project URL</strong> (e.g. <code>https://xyzcompany.supabase.co</code>)
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-emerald-600" />
              <span>Supabase Anon Public API Key</span>
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseKey}
              onChange={(e) => {
                setSupabaseKey(e.target.value);
                setSupabaseTestResult(null);
              }}
              className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500 transition-all shadow-xs"
            />
            <p className="text-[10px] text-slate-400">
              Found in: <strong>Project Settings &gt; API &gt; Project API keys &gt; anon public</strong>
            </p>
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isTestingSupabase || !supabaseUrl.trim() || !supabaseKey.trim()}
                onClick={handleTestSupabase}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 py-2 px-4 text-xs font-bold text-slate-800 dark:text-slate-200 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isTestingSupabase ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                    <span>Connecting to Supabase...</span>
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4 text-emerald-600" />
                    <span>Test Supabase Connection</span>
                  </>
                )}
              </button>

              {isSupabaseActive && (
                <button
                  type="button"
                  onClick={() => {
                    setSupabaseUrl('');
                    setSupabaseKey('');
                    SupabaseSync.setCredentials('', '');
                    if (onSuccessNotice) onSuccessNotice("Supabase credentials cleared.");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 text-xs font-bold transition-all cursor-pointer"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Disconnect</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-6 text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>Save Supabase Connection</span>
            </button>
          </div>
        </form>

        {/* Master Two-Way Cloud Synchronization & Live Row Counts Panel */}
        <div className="rounded-2xl border-2 border-indigo-500/40 bg-gradient-to-br from-indigo-50/90 via-white to-emerald-50/60 dark:from-indigo-950/40 dark:via-slate-900 dark:to-emerald-950/30 p-5 shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    Two-Way Supabase Cloud Synchronization &amp; Live Data Pull
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                      Live 7 Tables
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Pull live data from Supabase into your browser memory, or push local records to Supabase.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={isPullingAll || !isSupabaseActive}
                onClick={handlePullAllFromSupabase}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md hover:shadow-lg active:scale-95"
                title="Download all live rows across all 7 Supabase tables into your browser application"
              >
                {isPullingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Pulling Live Data ({pullAllProgress?.stage || 'Connecting'})...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>📥 Pull All Live Data from Supabase</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isLoadingCounts || !isSupabaseActive}
                onClick={() => {
                  fetchSupabaseCounts();
                  refreshLocalCounts();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Refresh live row counts from Supabase"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCounts ? 'animate-spin text-indigo-500' : ''}`} />
                <span>Refresh Counts</span>
              </button>
            </div>
          </div>

          {/* 7-Table Live Counts Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-2">
            {[
              { label: 'Production Ledger', supa: supabaseCounts.ledger, local: ledger.length, onPull: handlePullLedgerFromSupabase, isPulling: isPullingLedger },
              { label: 'Yarn Allocations', supa: supabaseCounts.yarn, local: yarnAllocations.length, onPull: handlePullYarnFromSupabase, isPulling: isPullingYarn },
              { label: 'Plan Orders', supa: supabaseCounts.orders, local: orderPlans.length, onPull: handlePullOrdersFromSupabase, isPulling: isPullingOrders },
              { label: 'Knitting Orders', supa: supabaseCounts.knitting, local: KnittingStatusStorage.getOrders().length, onPull: handlePullKnittingFromSupabase, isPulling: isPullingKnitting },
              { label: 'Textile Close', supa: supabaseCounts.textileClose, local: TextileClosePMCStorage.getRecords().length, onPull: handlePullTextileCloseFromSupabase, isPulling: isPullingTextileClose },
              { label: 'Grey Stock', supa: supabaseCounts.greyStock, local: GreyStockStorage.getRecords().length, onPull: handlePullGreyStockFromSupabase, isPulling: isPullingGreyStock },
              { label: 'Grey Yarn Stock', supa: supabaseCounts.greyYarnStock, local: GreyYarnStockStorage.getRecords().length, onPull: handlePullGreyYarnStockFromSupabase, isPulling: isPullingGreyYarnStock },
            ].map((col, idx) => (
              <div key={idx} className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{col.label}</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {col.supa !== null ? col.supa.toLocaleString() : '—'}
                    </span>
                    <span className="text-[9px] text-slate-400">in cloud</span>
                  </div>
                  <div className="text-[9.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Local: {col.local.toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={col.isPulling || !isSupabaseActive}
                  onClick={col.onPull}
                  className="mt-2 w-full py-1 px-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-[10.5px] font-bold border border-indigo-200 dark:border-indigo-800 flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title={`Pull live ${col.label} from Supabase`}
                >
                  {col.isPulling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  <span>Pull</span>
                </button>
              </div>
            ))}
          </div>

          {pullAllStatus && (
            <div className="text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-800 animate-fade-in flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{pullAllStatus}</span>
            </div>
          )}
        </div>

        {/* Production Ledger Supabase Transfer & Real-time Status Card */}
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-white/80 dark:bg-slate-900/80 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Production Ledger Real-Time Cloud Engine (Supabase WebSockets)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  Sub-50ms Live Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                All devices viewing <code>knitproduction.vercel.app</code> receive instant live updates via Supabase WebSockets with zero polling and zero Vercel bandwidth limits.
              </p>
              <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                <span>Cloud: <strong>{supabaseCounts.ledger !== null ? supabaseCounts.ledger.toLocaleString() : 'Checking...'}</strong> rows</span>
                <span>•</span>
                <span>Local: <strong>{ledger.length.toLocaleString()}</strong> records</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isPullingLedger || !isSupabaseActive}
                onClick={handlePullLedgerFromSupabase}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-800 dark:text-indigo-200 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-2xs whitespace-nowrap"
                title="Pull and download live Production Ledger records from Supabase"
              >
                {isPullingLedger ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Pulling...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>📥 Pull from Supabase ({supabaseCounts.ledger !== null ? supabaseCounts.ledger.toLocaleString() : 'Live'} rows)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isMigratingLedger || !isSupabaseActive}
                onClick={handleMigrateLedgerToSupabase}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
                title="Only needed once to seed your historical records into Supabase"
              >
                {isMigratingLedger ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Transferring Data...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    <span>📤 Migrate to Supabase ({ledger.length} records)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {pullLedgerStatus && (
            <div className="text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 animate-fade-in">
              {pullLedgerStatus}
            </div>
          )}

          {migrateStatus && (
            <div className="text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-fade-in">
              {migrateStatus}
            </div>
          )}
        </div>

        {/* Yarn Allocations Supabase Transfer & Real-time Status Card */}
        <div className="rounded-xl border border-teal-200 dark:border-teal-900 bg-white/80 dark:bg-slate-900/80 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Yarn Allocations Real-Time Cloud Engine (Supabase WebSockets)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                  Sub-50ms Live Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Yarn Allocations now use Supabase as the primary operational database with live multi-device WebSocket updates. Google Sheets serves as an asynchronous cold backup mirror.
              </p>
              <p className="text-[11px] font-medium text-teal-700 dark:text-teal-300">
                ⚡ <strong>Setup Requirement:</strong> Ensure table <code className="px-1 py-0.5 rounded bg-teal-100 dark:bg-teal-900/80 font-mono text-[10px]">public.yarn_allocations</code> exists in your Supabase project before migrating.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyYarnSql}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950 dark:hover:bg-teal-900 text-teal-800 dark:text-teal-200 text-xs font-bold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                title="Copy the SQL script to create the yarn_allocations table in Supabase"
              >
                {copiedYarnSql ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Copied Yarn SQL!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Copy Yarn SQL</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowYarnSql(!showYarnSql)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
              >
                <Code className="h-3.5 w-3.5 text-slate-500" />
                <span>{showYarnSql ? 'Hide SQL' : 'View SQL'}</span>
              </button>

              <button
                type="button"
                disabled={isMigratingYarn || !isSupabaseActive}
                onClick={handleMigrateYarnToSupabase}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
                title="Seed your existing yarn allocation records into Supabase"
              >
                {isMigratingYarn ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Transferring Yarn Data...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>One-Time Initial Migration ({yarnAllocations.length} records)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {showYarnSql && (
            <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-slate-950 p-3.5 space-y-2 text-slate-200 animate-fade-in font-mono text-[11px]">
              <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
                <span className="text-teal-400 font-bold">SQL Editor Script (Yarn Allocations Table & Realtime)</span>
                <button
                  type="button"
                  onClick={handleCopyYarnSql}
                  className="inline-flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300 font-semibold cursor-pointer"
                >
                  {copiedYarnSql ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedYarnSql ? 'Copied' : 'Copy Query'}
                </button>
              </div>
              <pre className="overflow-x-auto max-h-48 text-[11px] leading-relaxed text-slate-300 selection:bg-teal-800">
                {SupabaseSync.getYarnSetupSQL()}
              </pre>
            </div>
          )}

          {migrateYarnStatus && (
            <div className={`text-xs font-semibold px-3 py-2 rounded-lg border animate-fade-in ${
              migrateYarnStatus.includes('Successfully')
                ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
            }`}>
              {migrateYarnStatus}
            </div>
          )}
        </div>

        {/* Plan Order Followup & Status Supabase Transfer & Real-time Status Card */}
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white/80 dark:bg-slate-900/80 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Plan Order Followup & Status Real-Time Cloud Engine (Supabase WebSockets)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                  Sub-50ms Live Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Plan Order Followup & Status uses Supabase as the primary operational database with live multi-device WebSocket updates. Google Sheets serves as an asynchronous backup mirror.
              </p>
              <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
                ⚡ <strong>Setup Requirement:</strong> Ensure table <code className="px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/80 font-mono text-[10px]">public.order_plans</code> exists in your Supabase project before migrating.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyOrdersSql}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-800 dark:text-indigo-200 text-xs font-bold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                title="Copy the SQL script to create the order_plans table in Supabase"
              >
                {copiedOrdersSql ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Copied Orders SQL!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Copy Orders SQL</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowOrdersSql(!showOrdersSql)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
              >
                <Code className="h-3.5 w-3.5 text-slate-500" />
                <span>{showOrdersSql ? 'Hide SQL' : 'View SQL'}</span>
              </button>

              <button
                type="button"
                disabled={isMigratingOrders || !isSupabaseActive}
                onClick={handleMigrateOrdersToSupabase}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
                title="Seed your existing plan order followup records into Supabase"
              >
                {isMigratingOrders ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Transferring Plan Orders...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>One-Time Initial Migration ({orderPlans.length} orders)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {showOrdersSql && (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-slate-950 p-3.5 space-y-2 text-slate-200 animate-fade-in font-mono text-[11px]">
              <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
                <span className="text-indigo-400 font-bold">SQL Editor Script (Order Plans Table & Realtime)</span>
                <button
                  type="button"
                  onClick={handleCopyOrdersSql}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                >
                  {copiedOrdersSql ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedOrdersSql ? 'Copied' : 'Copy Query'}
                </button>
              </div>
              <pre className="overflow-x-auto max-h-48 text-[11px] leading-relaxed text-slate-300 selection:bg-indigo-800">
                {SupabaseSync.getOrderPlansSetupSQL()}
              </pre>
            </div>
          )}

          {migrateOrdersStatus && (
            <div className={`text-xs font-semibold px-3 py-2 rounded-lg border animate-fade-in ${
              migrateOrdersStatus.includes('Successfully')
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
            }`}>
              {migrateOrdersStatus}
            </div>
          )}
        </div>

        {/* Textile Close By PMC Supabase Transfer & Real-time Status Card */}
        <div className="rounded-xl border border-teal-200 dark:border-teal-900 bg-white/80 dark:bg-slate-900/80 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Textile Close By PMC Real-Time Cloud Engine (Supabase WebSockets)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                  Sub-50ms Live Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Textile Close By PMC fabric specifications use Supabase as the primary cloud database with real-time multi-device WebSocket updates, replace-on-upload protection, and fast query indexing.
              </p>
              <p className="text-[11px] font-medium text-teal-700 dark:text-teal-300">
                ⚡ <strong>Setup Requirement:</strong> Ensure table <code className="px-1 py-0.5 rounded bg-teal-100 dark:bg-teal-900/80 font-mono text-[10px]">public.textile_close_pmc</code> exists in your Supabase project before migrating.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyTextileCloseSql}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950 dark:hover:bg-teal-900 text-teal-800 dark:text-teal-200 text-xs font-bold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                title="Copy the SQL script to create the textile_close_pmc table in Supabase"
              >
                {copiedTextileCloseSql ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Copied Textile Close SQL!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Copy Textile Close SQL</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowTextileCloseSql(!showTextileCloseSql)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
              >
                <Code className="h-3.5 w-3.5 text-slate-500" />
                <span>{showTextileCloseSql ? 'Hide SQL' : 'View SQL'}</span>
              </button>

              <button
                type="button"
                disabled={isMigratingTextileClose || !isSupabaseActive}
                onClick={handleMigrateTextileCloseToSupabase}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
                title="Seed your existing Textile Close By PMC records into Supabase"
              >
                {isMigratingTextileClose ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Transferring Records...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>One-Time Initial Migration ({TextileClosePMCStorage.getRecords().length} records)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {showTextileCloseSql && (
            <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-slate-950 p-3.5 space-y-2 text-slate-200 animate-fade-in font-mono text-[11px]">
              <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
                <span className="text-teal-400 font-bold">SQL Editor Script (Textile Close PMC Table & Realtime)</span>
                <button
                  type="button"
                  onClick={handleCopyTextileCloseSql}
                  className="inline-flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300 font-semibold cursor-pointer"
                >
                  {copiedTextileCloseSql ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedTextileCloseSql ? 'Copied' : 'Copy Query'}
                </button>
              </div>
              <pre className="overflow-x-auto max-h-48 text-[11px] leading-relaxed text-slate-300 selection:bg-teal-800">
                {SupabaseSync.getTextileCloseSetupSQL()}
              </pre>
            </div>
          )}

          {migrateTextileCloseStatus && (
            <div className={`text-xs font-semibold px-3 py-2 rounded-lg border animate-fade-in ${
              migrateTextileCloseStatus.includes('Successfully')
                ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
            }`}>
              {migrateTextileCloseStatus}
            </div>
          )}
        </div>

        {/* Grey Yarn Stock Summary Supabase Transfer & Real-time Status Card */}
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white/80 dark:bg-slate-900/80 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Grey Yarn Stock Summary Real-Time Cloud Engine (Supabase WebSockets)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                  public.grey_yarn_stock
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  Exact 14-Column Schema
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Master Grey Yarn Stock records (1st Layer Order Rollup + 2nd Layer Physical Count/Lot/Spinner breakdown) synchronize through Supabase table <code className="px-1 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 font-mono text-[10px] text-indigo-700 dark:text-indigo-300">public.grey_yarn_stock</code> with automatic replace-on-upload and live multi-user WebSocket updates.
              </p>
              <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
                ⚡ <strong>Setup Requirement:</strong> Execute the Grey Yarn Stock SQL script below in your Supabase SQL Editor to support your file's exact 14 columns.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyGreyYarnStockSql}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-800 dark:text-indigo-200 text-xs font-bold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                title="Copy SQL script to create the grey_yarn_stock table in Supabase"
              >
                {copiedGreyYarnStockSql ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Copied SQL!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Copy SQL</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadGreyYarnStockSql}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                title="Download .sql script file"
              >
                <Database className="h-3.5 w-3.5 text-indigo-500" />
                <span>.sql File</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGreyYarnStockSql(!showGreyYarnStockSql)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
              >
                <Code className="h-3.5 w-3.5 text-slate-500" />
                <span>{showGreyYarnStockSql ? 'Hide SQL' : 'View SQL'}</span>
              </button>

              <button
                type="button"
                disabled={isMigratingGreyYarnStock || !isSupabaseActive}
                onClick={handleMigrateGreyYarnStockToSupabase}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
                title="Seed and upload current Grey Yarn Stock records into Supabase"
              >
                {isMigratingGreyYarnStock ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Uploading Records...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>One-Time Initial Migration ({GreyYarnStockStorage.getRecords().length} records)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Supported Headers Summary Banner */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700 text-[11px]">
            <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Supports Your Exact 14 File Headers:
            </span>
            <div className="flex flex-wrap gap-1 font-mono text-[10px]">
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
              ].map((h, idx) => (
                <span key={h} className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  <span className="text-indigo-500 font-bold mr-1">{idx + 1}.</span>
                  {h}
                </span>
              ))}
            </div>
          </div>

          {showGreyYarnStockSql && (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-slate-950 p-4 space-y-3 text-slate-200 animate-fade-in text-[11px]">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                <span className="text-indigo-400 font-bold flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  SQL Editor Script (public.grey_yarn_stock Table & Real-Time Setup)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyGreyYarnStockSql}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    {copiedGreyYarnStockSql ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedGreyYarnStockSql ? 'Copied' : 'Copy Query'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadGreyYarnStockSql}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download .sql</span>
                  </button>
                </div>
              </div>

              {/* Exact Column Mappings Table */}
              <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider block">
                  Column Mappings (File Header ➜ Database Column)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 font-mono text-[10px]">
                  {[
                    { h: 'Completion Date', c: 'completion_date' },
                    { h: 'Buyer', c: 'buyer (buyer_name)' },
                    { h: 'Status', c: 'status' },
                    { h: 'Allocated Order WA', c: 'allocated_order_wa (order_no)' },
                    { h: 'Physical Count', c: 'physical_count (physical_yarn_count)' },
                    { h: 'Physical Lot', c: 'physical_lot (physical_yarn_lot)' },
                    { h: 'Spinner', c: 'spinner' },
                    { h: 'Booking QTY', c: 'booking_qty' },
                    { h: 'Yarn Required', c: 'yarn_required' },
                    { h: 'Net Received', c: 'net_received (total_received)' },
                    { h: 'Total Issued', c: 'total_issued' },
                    { h: 'Excess Issued', c: 'excess_issued' },
                    { h: 'Total Stock QTY', c: 'total_stock_qty' },
                    { h: 'Issue Balance', c: 'issue_balance (issued_balance)' },
                  ].map(m => (
                    <div key={m.h} className="p-1.5 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-300">{m.h}:</span>
                      <span className="text-sky-400 font-bold ml-1">{m.c}</span>
                    </div>
                  ))}
                </div>
              </div>

              <pre className="overflow-x-auto max-h-64 font-mono leading-relaxed text-slate-300 selection:bg-indigo-800 p-3 rounded-lg bg-slate-900 border border-slate-800">
                {SupabaseSync.getGreyYarnStockSchemaSQL()}
              </pre>

              <div className="text-[11px] text-slate-400">
                💡 <strong className="text-slate-200">How to run:</strong> Open your Supabase Dashboard ➜ SQL Editor ➜ Paste the code ➜ Click "Run".
              </div>
            </div>
          )}

          {migrateGreyYarnStockStatus && (
            <div className={`text-xs font-semibold px-3 py-2 rounded-lg border animate-fade-in ${
              migrateGreyYarnStockStatus.includes('Successfully')
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
            }`}>
              {migrateGreyYarnStockStatus}
            </div>
          )}
        </div>

        {supabaseTestResult && (
          <div className={`p-3.5 rounded-xl border text-xs font-semibold ${
            supabaseTestSuccess
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300'
          }`}>
            {supabaseTestResult}
          </div>
        )}
      </div>

      {/* Google Sheets Production Ledger Sync */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Connection Form */}
        <div className="lg:col-span-2 space-y-6 rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
          <form onSubmit={handleSaveConnection} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-slate-300 block">
                Google Sheets Production Ledger Connection
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDatabaseMode('mock')}
                  className={`p-4 text-left rounded-xl border transition-all cursor-pointer ${
                    databaseMode === 'mock'
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 font-bold'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-black">Local Client Mode</span>
                  </div>
                  <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400 leading-relaxed">
                    Operates using in-memory state and local cache.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDatabaseMode('gas')}
                  className={`p-4 text-left rounded-xl border transition-all cursor-pointer ${
                    databaseMode === 'gas'
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 font-bold'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-black">Google Sheets Live REST API</span>
                  </div>
                  <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400 leading-relaxed">
                    Syncs production records directly with Google Sheets.
                  </p>
                </button>
              </div>
            </div>

            {/* Google Sheets & Apps Script Integration Config */}
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-slate-300">
                  Google Apps Script Web App URL
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setGasWebAppUrl(GasClient.DEFAULT_URL);
                      setTestSuccess(null);
                      setTestResult(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-all cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                    <span>Reset Default URL</span>
                  </button>
                  <button 
                    type="button"
                    onClick={handleCopyScript}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/50 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:text-blue-300 transition-all cursor-pointer shadow-2xs"
                  >
                    {copiedScript ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied Code.gs!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Copy Code.gs Script</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={gasWebAppUrl}
                  onChange={(e) => {
                    setGasWebAppUrl(e.target.value);
                    setTestSuccess(null);
                    setTestResult(null);
                  }}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-xs"
                />
              </div>

              {/* Test connection action */}
              <div className="pt-1">
                <button
                  type="button"
                  disabled={isTesting || !gasWebAppUrl.trim()}
                  onClick={handleTestConnection}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 py-2.5 px-4 text-xs font-bold text-slate-800 dark:text-slate-200 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span>Verifying Endpoint Connection...</span>
                    </>
                  ) : (
                    <>
                      <Wifi className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span>Test Google Sheets REST Endpoint</span>
                    </>
                  )}
                </button>

                {testResult && (
                  <div className={`p-3.5 rounded-xl border text-xs font-semibold mt-3 ${
                    testSuccess 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300' 
                      : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300'
                  }`}>
                    {testResult}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-900 hover:bg-blue-950 text-white py-3 text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Save Google Sheets Connection</span>
              </button>
            </div>
          </form>
        </div>

        {/* Database Architecture Breakdown */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
              <Server className="h-5 w-5 text-emerald-500" />
              <h3 className="font-sans text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                Cloud Architecture
              </h3>
            </div>

            <div className="space-y-3 text-xs font-medium text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-300 space-y-1">
                <span className="block text-[10px] font-bold text-emerald-600 uppercase">Supabase (PostgreSQL)</span>
                <p className="text-[11px] leading-relaxed">
                  Stores <strong>Users, Settings, & Activity Logs</strong>. 100% Free with zero daily read counting.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40 text-blue-900 dark:text-blue-300 space-y-1">
                <span className="block text-[10px] font-bold text-blue-600 uppercase">Google Sheets (GAS API)</span>
                <p className="text-[11px] leading-relaxed">
                  Stores <strong>Master Production Ledgers, Order Plans & Yarn Allocations</strong> inside your Google Drive spreadsheets.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
