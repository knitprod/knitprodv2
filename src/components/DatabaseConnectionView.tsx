/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Database, Wifi, WifiOff, XCircle, Save, Loader2, HelpCircle, ExternalLink, Copy, Check, CheckCircle, RefreshCw, AlertTriangle, ShieldCheck, Flame, ArrowLeftRight, Layers, FileSpreadsheet, Activity } from 'lucide-react';
import { GasClient } from '../lib/gasClient';
import { FirestoreSyncService } from '../lib/firestoreSync';
import { SyncConflictLog } from '../types';
import gasScriptContent from '../../google-apps-script/Code.gs?raw';

interface DatabaseConnectionViewProps {
  onSuccessNotice?: (msg: string) => void;
}

export default function DatabaseConnectionView({ onSuccessNotice }: DatabaseConnectionViewProps) {
  // Database connection states
  const [databaseMode, setDatabaseMode] = useState<'mock' | 'gas'>(() => GasClient.getDatabaseMode());
  const [gasWebAppUrl, setGasWebAppUrl] = useState(() => GasClient.getWebAppUrl());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Two-Way Synchronization states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflictLog[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => new Date().toISOString());

  // Sync with central server configuration on load & subscribe to sync conflicts
  useEffect(() => {
    GasClient.fetchServerConfig().then((config) => {
      if (config.gasWebAppUrl) {
        setGasWebAppUrl(config.gasWebAppUrl);
      }
      if (config.databaseMode) {
        setDatabaseMode(config.databaseMode);
      }
    });

    // Subscribe to conflict logs in Firestore
    const unsubscribe = FirestoreSyncService.subscribeToConflicts((conflictList) => {
      setConflicts(conflictList);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    try {
      const result = await FirestoreSyncService.reconcileSheetsAndFirestore();
      setSyncNotice(result.message);
      setLastSyncTime(new Date().toISOString());
      if (onSuccessNotice) {
        onSuccessNotice(result.message);
      }
    } catch (err: any) {
      setSyncNotice(`Sync warning: ${err.message || String(err)}`);
    } finally {
      setIsSyncing(false);
    }
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
      console.error("Connection test failed:", err);
      setTestSuccess(false);
      setTestResult(`Connection Failed: ${err.message || 'Network Error'}. Ensure you've deployed the Apps Script as a Web App and configured access to "Anyone".`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConnection = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save database mode & URL configurations centrally
    GasClient.saveServerConfig(gasWebAppUrl, databaseMode);

    setIsSaved(true);
    if (onSuccessNotice) {
      onSuccessNotice("Database connection settings saved successfully.");
    }
    setTimeout(() => {
      setIsSaved(false);
    }, 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="font-sans text-xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Database & Two-Way Sync Control Center
          </h2>
          <p className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
            Firebase Firestore Operational Database & Google Sheets Master Synchronization Engine
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold shadow-2xs">
            <WifiOff className="h-3.5 w-3.5 text-slate-500" />
            Database Disconnected (Offline Local Mode)
          </span>
          <button
            onClick={() => {
              setDatabaseMode('mock');
              setGasWebAppUrl('');
              GasClient.saveServerConfig('', 'mock');
              if (onSuccessNotice) {
                onSuccessNotice("All external database connections removed successfully.");
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            Remove Database Connections
          </button>
        </div>
      </div>

      {isSaved && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900 p-4 text-sm font-bold text-emerald-800 dark:text-emerald-300 shadow-xs flex items-center gap-2.5 animate-fade-in">
          <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Database connection configurations committed to central server cache successfully.</span>
        </div>
      )}

      {/* Direct Push Synchronization Operational Banner */}
      <div className="rounded-2xl border border-blue-900/40 dark:border-blue-800 bg-slate-900 p-6 text-white shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
              <Database className="h-4 w-4 text-emerald-400" />
              <span>Firebase Firestore Active: User Management, Authentication & Settings</span>
            </div>
            <h3 className="text-lg font-black text-white">
              Firebase Connection Active for Settings & User Security
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              User credentials, user roles, and system settings are managed live via <strong>Firebase Firestore & Auth</strong>. All passwords and user directories have been completely purged from browser cache (localStorage) for enterprise security.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-950/80 text-emerald-300 font-black text-xs uppercase tracking-wider border border-emerald-800">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span>Firebase Security Active</span>
            </div>
          </div>
        </div>

        {syncNotice && (
          <div className="p-3.5 rounded-xl bg-white/10 border border-white/20 text-xs font-semibold text-slate-200 flex items-center gap-2 animate-fade-in">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{syncNotice}</span>
          </div>
        )}

        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] font-medium text-slate-400">
          <span>
            Database Status: <strong className="text-emerald-400">Connected to Firebase (Users & System Settings)</strong>
          </span>
          <span className="text-slate-400">
            • Browser cache credential storage disabled
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Connection Form */}
        <div className="lg:col-span-2 space-y-6 rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
          <form onSubmit={handleSaveConnection} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-slate-300 block">
                1. Select Connection Mode
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
                    Operates client-side using IndexedDB cache.
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
                    <span className="text-sm font-black">Google Sheets REST API + Firestore</span>
                  </div>
                  <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400 leading-relaxed">
                    Bidirectional real-time sync with Google Sheets master spreadsheet.
                  </p>
                </button>
              </div>
            </div>

            {/* Google Sheets & Apps Script Integration Config */}
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-slate-300">
                  2. Google Sheets Apps Script Web App URL
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
                    title="Reset to default system URL"
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
                  <a 
                    href="https://script.google.com" 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 uppercase tracking-wider transition-colors"
                  >
                    <span>Open Script Editor</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
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
                <p className="text-[10px] text-gray-400 font-medium">
                  Ensure Web App is deployed with execution permission set to <strong>"Me"</strong> and access set to <strong>"Anyone"</strong>.
                </p>
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
                  <div className="space-y-3 mt-3">
                    <div className={`p-3.5 rounded-xl border text-xs font-semibold ${
                      testSuccess 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300' 
                        : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300'
                    }`}>
                      {testResult}
                    </div>

                    {!testSuccess && (
                      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs space-y-2.5 text-amber-900 dark:text-amber-200">
                        <div className="font-black flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>Google Apps Script Deployment Instructions (30 Seconds):</span>
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-[11px] font-medium leading-relaxed">
                          <li>Click <strong>Copy Code.gs Script</strong> above to copy the backend code.</li>
                          <li>Open your Google Sheet &gt; <strong>Extensions</strong> &gt; <strong>Apps Script</strong>.</li>
                          <li>Paste the script, replace all existing code, and click <strong>Save</strong>.</li>
                          <li>Click <strong>Deploy &gt; New deployment &gt; Select type &gt; Web app</strong>.</li>
                          <li>Set <strong>Execute as: Me</strong> and <strong>Who has access: Anyone</strong>, click <strong>Deploy</strong>, and copy the new Web App URL into the box above!</li>
                        </ol>
                      </div>
                    )}
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
                <span>Save Database Connection Settings</span>
              </button>
            </div>
          </form>
        </div>

        {/* Database Status & Architecture Breakdown Panel */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
              <Flame className="h-5 w-5 text-amber-500 fill-amber-500" />
              <h3 className="font-sans text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                Firestore Database Configuration
              </h3>
            </div>

            <div className="space-y-3 text-xs font-medium text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Project ID</span>
                <span className="block font-mono font-bold text-slate-900 dark:text-white text-xs truncate">
                  gen-lang-client-0538168382
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Realtime Listener</span>
                <span className="block font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active onSnapshot Connection
                </span>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40 text-[#0F4C81] dark:text-blue-300 space-y-1.5 text-[11px]">
                <span className="font-bold block uppercase tracking-wide text-[10px]">How Two-Way Sync Works</span>
                <p className="leading-relaxed">
                  1. <strong>UI Updates</strong>: Edits in web app write to Firestore immediately for 0ms screen refreshes.<br/>
                  2. <strong>Sheets Export</strong>: Firestore pushes records to Google Sheets.<br/>
                  3. <strong>Manual Edits</strong>: Edits typed directly into Google Sheets by managers trigger background updates into Firestore.
                </p>
              </div>
            </div>
          </div>

          {/* Sync Conflict Logs */}
          <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="font-sans text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Conflict Log
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                {conflicts.length} Recorded
              </span>
            </div>

            {conflicts.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium py-2">
                No synchronization conflicts detected. All records in sync.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {conflicts.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[11px] space-y-1">
                    <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-200">
                      <span>Record ID: {c.recordId}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
                        Winner: {c.winner}
                      </span>
                    </div>
                    <p className="text-amber-800 dark:text-amber-300">{c.details}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
