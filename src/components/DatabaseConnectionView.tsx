/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Zap
} from 'lucide-react';
import { GasClient } from '../lib/gasClient';
import { SupabaseSync } from '../lib/supabaseClient';
import { SyncConflictLog } from '../types';
import { useGlobalData } from '../context/GlobalDataContext';
import gasScriptContent from '../../google-apps-script/Code.gs?raw';

interface DatabaseConnectionViewProps {
  onSuccessNotice?: (msg: string) => void;
}

export default function DatabaseConnectionView({ onSuccessNotice }: DatabaseConnectionViewProps) {
  const { ledger, refreshAll } = useGlobalData();

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

  // Two-Way Synchronization states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflictLog[]>([]);

  // Sync with central server configuration on load
  useEffect(() => {
    GasClient.fetchServerConfig().then((config) => {
      if (config.gasWebAppUrl) {
        setGasWebAppUrl(config.gasWebAppUrl);
      }
      if (config.databaseMode) {
        setDatabaseMode(config.databaseMode);
      }
    });
  }, []);

  const handleMigrateLedgerToSupabase = async () => {
    if (!SupabaseSync.isConfigured()) {
      if (onSuccessNotice) onSuccessNotice("Please enter and save your Supabase credentials first.");
      return;
    }
    setIsMigratingLedger(true);
    setMigrateStatus("Migrating Production Ledger to Supabase...");
    try {
      const ok = await SupabaseSync.bulkSaveProductionRecords(ledger);
      if (ok) {
        setMigrateStatus(`Successfully migrated ${ledger.length} records to Supabase! Live WebSockets active.`);
        if (onSuccessNotice) onSuccessNotice(`Transferred ${ledger.length} Production Ledger records to Supabase!`);
      } else {
        setMigrateStatus("Notice: Ensure you ran the Supabase SQL schema in Supabase SQL Editor first.");
      }
    } catch (err: any) {
      setMigrateStatus(`Migration notice: ${err.message || String(err)}`);
    } finally {
      setIsMigratingLedger(false);
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SupabaseSync.getSetupSQL());
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch (err) {
      console.error('Failed to copy SQL:', err);
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
    setTimeout(() => setIsSaved(false), 4000);
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(gasScriptContent);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    } catch (err) {
      console.error('Failed to copy script:', err);
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
                All devices viewing <code>knitproduction.vercel.app</code> receive instant live updates via Supabase WebSockets with zero polling and zero Vercel bandwidth limits. Orders & Yarn remain connected to Google Sheets.
              </p>
            </div>

            <button
              type="button"
              disabled={isMigratingLedger || !isSupabaseActive}
              onClick={handleMigrateLedgerToSupabase}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
            >
              {isMigratingLedger ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Transferring Data...</span>
                </>
              ) : (
                <>
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span>Migrate Ledger to Supabase ({ledger.length} records)</span>
                </>
              )}
            </button>
          </div>

          {migrateStatus && (
            <div className="text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-fade-in">
              {migrateStatus}
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
