/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Server,
  Pause,
  Play,
  ArrowRightLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sliders,
  Key,
  Globe,
  Code,
  Copy,
  Check,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Database,
  X,
  RotateCcw
} from 'lucide-react';
import { UserRecord } from './UserManagementView';
import { SupabaseSync } from '../lib/supabaseClient';
import { safeCopyText } from '../lib/clipboardHelper';

type ServerSlotId = 'server1' | 'server2';

interface ServerSlotView {
  id: ServerSlotId;
  label: string;
  supabaseUrl: string;
  hasKey: boolean;
  keyPreview: string;
  status: 'active' | 'paused';
  isActive: boolean;
  billingResetDay: number;
  cycleMonthKey: string;
  lastMigratedAt: string | null;
  pausedAt: string | null;
  activatedAt: string | null;
  totalBytes: number;
  usedGb: number;
  limitGb: number;
  pct: number;
  warningThresholdPct: number;
  isWarning: boolean;
  isCritical: boolean;
}

interface MigrationTableProgress {
  table: string;
  label: string;
  status: 'pending' | 'checking' | 'copying' | 'done' | 'skipped' | 'error';
  rowsCopied: number;
  totalRows: number;
  error?: string;
}

interface MigrationJobState {
  jobId: string;
  sourceServerId: ServerSlotId;
  targetServerId: ServerSlotId;
  status: 'preflight' | 'migrating' | 'completed' | 'failed';
  currentTable: string | null;
  totalRowsCopied: number;
  message: string;
  error?: string;
  startedAt: string;
  completedAt: string | null;
  tables: MigrationTableProgress[];
}

interface FailoverStatusResponse {
  success: boolean;
  activeServerId: ServerSlotId | null;
  clusterRevision: number;
  restricted: boolean;
  reason: string | null;
  servers: {
    server1: ServerSlotView;
    server2: ServerSlotView;
  };
  activeJob: MigrationJobState | null;
}

interface DualServerFailoverPanelProps {
  currentUser?: UserRecord | null;
  onSuccessNotice?: (msg: string) => void;
  onClusterChanged?: () => void;
}

const RAIHAN_UID = 'EKL001';

function formatShortTimestamp(iso: string | null): string {
  if (!iso) return 'Never';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Never';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Never';
  }
}

export default function DualServerFailoverPanel({
  currentUser,
  onSuccessNotice,
  onClusterChanged
}: DualServerFailoverPanelProps) {
  const normalizedUid = currentUser?.uid ? currentUser.uid.trim().toUpperCase().replace(/[\s-_]/g, '') : '';
  const isRaihan = normalizedUid === RAIHAN_UID || normalizedUid === 'RAIHAN';

  const [statusData, setStatusData] = useState<FailoverStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Per-server editable form drafts (URL + optional new key)
  const [draftUrls, setDraftUrls] = useState<Record<ServerSlotId, string>>({ server1: '', server2: '' });
  const [draftKeys, setDraftKeys] = useState<Record<ServerSlotId, string>>({ server1: '', server2: '' });
  const [showKeyInput, setShowKeyInput] = useState<Record<ServerSlotId, boolean>>({ server1: false, server2: false });
  const [expandedCreds, setExpandedCreds] = useState<Record<ServerSlotId, boolean>>({ server1: false, server2: true });
  const [expandedCalibrate, setExpandedCalibrate] = useState<Record<ServerSlotId, boolean>>({ server1: false, server2: false });

  // Calibration inputs per server
  const [calibrateGb, setCalibrateGb] = useState<Record<ServerSlotId, string>>({ server1: '', server2: '' });
  const [calibrateDay, setCalibrateDay] = useState<Record<ServerSlotId, number>>({ server1: 1, server2: 1 });
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Inline feedback messages per server
  const [serverFeedback, setServerFeedback] = useState<
    Record<ServerSlotId, { ok: boolean; text: string } | null>
  >({ server1: null, server2: null });

  // Inline confirmation prompt before Pause / Activate / Migrate
  const [pendingConfirm, setPendingConfirm] = useState<
    | { type: 'toggle'; serverId: ServerSlotId; action: 'activate' | 'pause' }
    | { type: 'migrate'; sourceServerId: ServerSlotId; targetServerId: ServerSlotId }
    | null
  >(null);

  // 12-Table Master SQL drawer
  const [showMasterSql, setShowMasterSql] = useState<boolean>(false);
  const [copiedMasterSql, setCopiedMasterSql] = useState<boolean>(false);

  // Live 12-table migration modal state
  const [migrationJob, setMigrationJob] = useState<MigrationJobState | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-session-uid': currentUser?.uid?.trim().toUpperCase() || ''
    };
  }, [currentUser?.uid]);

  const fetchStatus = useCallback(
    async (silent: boolean = false) => {
      if (!isRaihan) return;
      if (!silent) setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch('/api/supabase-failover/status', {
          method: 'GET',
          headers: authHeaders(),
          cache: 'no-store'
        });
        const json = await res.json();
        if (!res.ok || !json?.success) {
          setLoadError(json?.message || 'Unable to load dual-server status.');
          return;
        }
        const data = json as FailoverStatusResponse;
        setStatusData(data);
        setDraftUrls((prev) => ({
          server1: prev.server1 || data.servers.server1.supabaseUrl || '',
          server2: prev.server2 || data.servers.server2.supabaseUrl || ''
        }));
        setCalibrateDay({
          server1: data.servers.server1.billingResetDay || 1,
          server2: data.servers.server2.billingResetDay || 1
        });
        setCalibrateGb((prev) => ({
          server1: prev.server1 || data.servers.server1.usedGb.toFixed(2),
          server2: prev.server2 || data.servers.server2.usedGb.toFixed(2)
        }));
        // Expand Server 2 credentials automatically only if not configured yet
        if (!data.servers.server2.supabaseUrl || !data.servers.server2.hasKey) {
          setExpandedCreds((prev) => ({ ...prev, server2: true }));
        }
        if (data.activeJob && (data.activeJob.status === 'preflight' || data.activeJob.status === 'migrating')) {
          setMigrationJob(data.activeJob);
        }
      } catch (err: any) {
        setLoadError(err?.message || 'Network error while fetching failover status.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [isRaihan, authHeaders]
  );

  useEffect(() => {
    if (!isRaihan) return;
    fetchStatus(false);
  }, [isRaihan, fetchStatus]);

  // Poll active migration job every 800ms until completed or failed
  useEffect(() => {
    if (!isRaihan) return;
    if (!migrationJob || (migrationJob.status !== 'preflight' && migrationJob.status !== 'migrating')) {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const jobId = migrationJob.jobId;
    const poll = async () => {
      try {
        const res = await fetch(`/api/supabase-failover/migrate/${encodeURIComponent(jobId)}`, {
          headers: authHeaders(),
          cache: 'no-store'
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json?.success && json.job) {
          setMigrationJob(json.job as MigrationJobState);
          if (json.job.status === 'completed' || json.job.status === 'failed') {
            fetchStatus(true);
            window.dispatchEvent(new Event('epyllion_failover_status_updated'));
            if (json.job.status === 'completed' && onSuccessNotice) {
              onSuccessNotice(json.job.message);
            }
          }
        }
      } catch {}
    };

    pollTimerRef.current = window.setInterval(poll, 800);
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isRaihan, migrationJob?.jobId, migrationJob?.status, authHeaders, fetchStatus, onSuccessNotice]);

  // Strictly hidden for everyone except Raihan (EKL001)
  if (!isRaihan) {
    return null;
  }

  const notifyParentRefresh = () => {
    window.dispatchEvent(new Event('epyllion_failover_status_updated'));
  };

  const handleSaveCredentials = async (serverId: ServerSlotId) => {
    const urlVal = (draftUrls[serverId] || '').trim();
    const keyVal = (draftKeys[serverId] || '').trim();
    const slot = statusData?.servers[serverId];

    if (!urlVal) {
      setServerFeedback((prev) => ({ ...prev, [serverId]: { ok: false, text: 'Enter a valid HTTPS Supabase Project URL.' } }));
      return;
    }
    if (!keyVal && !slot?.hasKey) {
      setServerFeedback((prev) => ({ ...prev, [serverId]: { ok: false, text: 'Enter the Supabase Anon Public Key.' } }));
      return;
    }

    setBusyAction(`save-${serverId}`);
    setServerFeedback((prev) => ({ ...prev, [serverId]: null }));
    try {
      const payload: Record<string, any> = {
        serverId,
        supabaseUrl: urlVal
      };
      if (keyVal) payload.supabaseKey = keyVal;

      const res = await fetch('/api/supabase-failover/config', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setServerFeedback((prev) => ({ ...prev, [serverId]: { ok: false, text: json?.message || 'Failed to save credentials.' } }));
        return;
      }
      setDraftKeys((prev) => ({ ...prev, [serverId]: '' }));
      setDraftUrls((prev) => ({ ...prev, [serverId]: json.server?.supabaseUrl || urlVal }));
      setServerFeedback((prev) => ({ ...prev, [serverId]: { ok: true, text: json.message || 'Credentials saved.' } }));
      await fetchStatus(true);
      notifyParentRefresh();
      if (onSuccessNotice) onSuccessNotice(json.message || 'Server credentials saved.');
    } catch (err: any) {
      setServerFeedback((prev) => ({ ...prev, [serverId]: { ok: false, text: err?.message || 'Network error saving credentials.' } }));
    } finally {
      setBusyAction(null);
    }
  };

  const handleTestServer = async (serverId: ServerSlotId) => {
    setBusyAction(`test-${serverId}`);
    setServerFeedback((prev) => ({ ...prev, [serverId]: null }));
    try {
      const payload: Record<string, any> = { serverId };
      if (draftUrls[serverId]?.trim()) payload.supabaseUrl = draftUrls[serverId].trim();
      if (draftKeys[serverId]?.trim()) payload.supabaseKey = draftKeys[serverId].trim();

      const res = await fetch('/api/supabase-failover/test', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      setServerFeedback((prev) => ({
        ...prev,
        [serverId]: {
          ok: Boolean(json?.success && (!json.missingTables || json.missingTables.length === 0)),
          text: json?.message || 'Connection test finished.'
        }
      }));
    } catch (err: any) {
      setServerFeedback((prev) => ({
        ...prev,
        [serverId]: { ok: false, text: err?.message || 'Network error testing connection.' }
      }));
    } finally {
      setBusyAction(null);
    }
  };

  const handleApplyCalibration = async (serverId: ServerSlotId, resetToZero: boolean = false) => {
    setBusyAction(`cal-${serverId}`);
    setServerFeedback((prev) => ({ ...prev, [serverId]: null }));
    try {
      const payload: Record<string, any> = {
        serverId,
        billingResetDay: calibrateDay[serverId]
      };
      if (resetToZero) {
        payload.reset = true;
      } else {
        const parsed = parseFloat(calibrateGb[serverId]);
        if (!Number.isFinite(parsed) || parsed < 0) {
          setServerFeedback((prev) => ({ ...prev, [serverId]: { ok: false, text: 'Enter a valid GB value (e.g. 3.85).' } }));
          setBusyAction(null);
          return;
        }
        payload.currentGb = parsed;
      }

      const res = await fetch('/api/supabase-failover/calibrate', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setServerFeedback((prev) => ({ ...prev, [serverId]: { ok: false, text: json?.message || 'Calibration failed.' } }));
        return;
      }
      const nextUsed = Number(json.metrics?.usedGb ?? 0).toFixed(2);
      setCalibrateGb((prev) => ({ ...prev, [serverId]: nextUsed }));
      setServerFeedback((prev) => ({
        ...prev,
        [serverId]: {
          ok: true,
          text: resetToZero
            ? `Cycle meter reset to 0.00 GB (resets monthly on day ${json.billingResetDay}).`
            : `Egress meter calibrated to ${nextUsed} GB (${json.metrics?.pct ?? 0}%).`
        }
      }));
      await fetchStatus(true);
      notifyParentRefresh();
    } catch (err: any) {
      setServerFeedback((prev) => ({ ...prev, [serverId]: { ok: false, text: err?.message || 'Calibration network error.' } }));
    } finally {
      setBusyAction(null);
    }
  };

  const executeToggleState = async (serverId: ServerSlotId, action: 'activate' | 'pause') => {
    setPendingConfirm(null);
    setBusyAction(`toggle-${serverId}`);
    setServerFeedback((prev) => ({ ...prev, [serverId]: null }));
    try {
      const res = await fetch('/api/supabase-failover/toggle-state', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ serverId, action })
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setServerFeedback((prev) => ({ ...prev, [serverId]: { ok: false, text: json?.message || 'Server state change failed.' } }));
        return;
      }

      // 1. Broadcast live switchover signal on the STILL-CONNECTED old WebSocket so all other active browsers switch immediately without reload
      await SupabaseSync.broadcastClusterSwitchSignal({
        action,
        activeServerId: json.activeServerId ?? null,
        clusterRevision: Number(json.clusterRevision) || 1
      });

      // 2. Apply live switchover / hard-pause to Raihan's own browser immediately
      SupabaseSync.applyClusterSwitch(
        {
          activeServerId: json.activeServerId ?? null,
          activeServerPaused: Boolean(json.activeServerPaused),
          clusterRevision: Number(json.clusterRevision) || 1,
          supabaseUrl: json.activeConfig?.supabaseUrl || '',
          supabaseKey: json.activeConfig?.supabaseKey || ''
        },
        true
      );

      setServerFeedback((prev) => ({ ...prev, [serverId]: { ok: true, text: json.message } }));
      await fetchStatus(true);
      notifyParentRefresh();
      if (onClusterChanged) onClusterChanged();
      if (onSuccessNotice) onSuccessNotice(json.message);
    } catch (err: any) {
      setServerFeedback((prev) => ({ ...prev, [serverId]: { ok: false, text: err?.message || 'Failed to update server state.' } }));
    } finally {
      setBusyAction(null);
    }
  };

  const executeStartMigration = async (sourceServerId: ServerSlotId, targetServerId: ServerSlotId) => {
    setPendingConfirm(null);
    setBusyAction(`migrate-${sourceServerId}`);
    setServerFeedback((prev) => ({ ...prev, [sourceServerId]: null }));
    try {
      const res = await fetch('/api/supabase-failover/migrate', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ sourceServerId, targetServerId })
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setServerFeedback((prev) => ({
          ...prev,
          [sourceServerId]: { ok: false, text: json?.message || 'Could not start migration.' }
        }));
        return;
      }
      setMigrationJob(json.job as MigrationJobState);
    } catch (err: any) {
      setServerFeedback((prev) => ({
        ...prev,
        [sourceServerId]: { ok: false, text: err?.message || 'Network error starting migration.' }
      }));
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyMasterSql = async () => {
    const ok = await safeCopyText(SupabaseSync.getFullMaster12TableSQL());
    if (ok) {
      setCopiedMasterSql(true);
      if (onSuccessNotice) onSuccessNotice('Copied full 12-Table Setup SQL for Server 2.');
      setTimeout(() => setCopiedMasterSql(false), 2500);
    }
  };

  const s1 = statusData?.servers.server1;
  const s2 = statusData?.servers.server2;
  const activeSummaryText =
    statusData?.activeServerId === 'server1'
      ? 'Server 1 Active · Server 2 Hard Paused'
      : statusData?.activeServerId === 'server2'
        ? 'Server 2 Active · Server 1 Hard Paused'
        : 'All Servers Paused · Zero Traffic';

  const renderServerCard = (slot: ServerSlotView, otherSlot: ServerSlotView) => {
    const isServer1 = slot.id === 'server1';
    const shortName = isServer1 ? 'Server 1' : 'Server 2';
    const targetShortName = isServer1 ? 'Server 2' : 'Server 1';
    const isConfigured = Boolean(slot.supabaseUrl && slot.hasKey);
    const otherConfigured = Boolean(otherSlot.supabaseUrl && otherSlot.hasKey);
    const migrationRunning = Boolean(
      migrationJob && (migrationJob.status === 'preflight' || migrationJob.status === 'migrating')
    );

    const barColorClass =
      slot.isCritical
        ? 'bg-red-600 dark:bg-red-500'
        : slot.isWarning
          ? 'bg-amber-500 dark:bg-amber-400'
          : 'bg-emerald-600 dark:bg-emerald-500';

    const pctTextClass =
      slot.isCritical
        ? 'text-red-700 dark:text-red-400'
        : slot.isWarning
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-emerald-700 dark:text-emerald-400';

    const feedback = serverFeedback[slot.id];
    const isThisTogglePending =
      pendingConfirm?.type === 'toggle' && pendingConfirm.serverId === slot.id;
    const isThisMigratePending =
      pendingConfirm?.type === 'migrate' && pendingConfirm.sourceServerId === slot.id;

    return (
      <div
        key={slot.id}
        className={`flex flex-col justify-between rounded-xl border bg-white dark:bg-slate-900 p-5 transition-colors ${
          slot.isActive
            ? 'border-emerald-300 dark:border-emerald-800'
            : 'border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="space-y-4">
          {/* Card Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Server
                  className={`h-4 w-4 shrink-0 ${
                    slot.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  {slot.label}
                </h4>
              </div>
              <p className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                {slot.supabaseUrl || 'Not configured yet'}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <div
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  slot.isActive
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {slot.isActive ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Active</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5 shrink-0" />
                    <span>Paused</span>
                  </>
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                {slot.isActive ? 'Serving live traffic' : 'Zero traffic in/out'}
              </div>
            </div>
          </div>

          {/* Dedicated Egress Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {shortName} Egress Quota
              </span>
              <div className="flex items-baseline gap-2 font-mono tabular-nums">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {slot.usedGb.toFixed(2)} / {slot.limitGb.toFixed(2)} GB
                </span>
                <span className={`text-xs font-bold ${pctTextClass}`}>
                  {slot.pct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Progress Track with 80% Alert Threshold Tick */}
            <div className="relative h-2.5 w-full rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${barColorClass}`}
                style={{ width: `${Math.min(100, Math.max(0, slot.pct))}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-px bg-slate-900/40 dark:bg-white/50"
                style={{ left: `${slot.warningThresholdPct}%` }}
                title={`${slot.warningThresholdPct}% manual transfer alert threshold`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                Alert at {slot.warningThresholdPct}% · Resets monthly on day{' '}
                <span className="font-mono tabular-nums">{slot.billingResetDay}</span>
              </span>
              <span>
                Last migrated:{' '}
                <span className="font-mono tabular-nums">{formatShortTimestamp(slot.lastMigratedAt)}</span>
              </span>
            </div>

            {slot.isWarning && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  Egress reached <strong className="font-mono tabular-nums">{slot.pct.toFixed(1)}%</strong>. Transfer data and switch manually when ready.
                </span>
              </div>
            )}
          </div>

          {/* Compact Utility Toggles: Calibrate GB & Credentials */}
          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs">
            <button
              type="button"
              onClick={() =>
                setExpandedCalibrate((prev) => ({ ...prev, [slot.id]: !prev[slot.id] }))
              }
              className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>{expandedCalibrate[slot.id] ? 'Hide Calibration' : 'Calibrate GB'}</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <button
              type="button"
              onClick={() =>
                setExpandedCreds((prev) => ({ ...prev, [slot.id]: !prev[slot.id] }))
              }
              className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <Key className="h-3.5 w-3.5" />
              <span>
                {expandedCreds[slot.id]
                  ? 'Hide Connection Settings'
                  : isConfigured
                    ? 'Connection Settings'
                    : 'Configure Server'}
              </span>
            </button>
          </div>

          {/* Expandable Calibration Panel */}
          {expandedCalibrate[slot.id] && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3 space-y-2.5">
              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                Match this meter to the exact GB displayed in your Supabase Dashboard (auto-tracks live server reads going forward).
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="space-y-1">
                  <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Current Usage (GB)
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    step="0.01"
                    value={calibrateGb[slot.id]}
                    onChange={(e) =>
                      setCalibrateGb((prev) => ({ ...prev, [slot.id]: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Billing Reset Day (1–28)
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    step="1"
                    value={calibrateDay[slot.id]}
                    onChange={(e) =>
                      setCalibrateDay((prev) => ({
                        ...prev,
                        [slot.id]: Math.max(1, Math.min(28, Number(e.target.value) || 1))
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => handleApplyCalibration(slot.id, false)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {busyAction === `cal-${slot.id}` && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Apply Calibration</span>
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => handleApplyCalibration(slot.id, true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset to 0.00 GB</span>
                </button>
              </div>
            </div>
          )}

          {/* Expandable Connection Settings */}
          {expandedCreds[slot.id] && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3 space-y-2.5">
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <Globe className="h-3 w-3 text-slate-400" />
                  <span>Supabase Project URL</span>
                </label>
                <input
                  type="text"
                  placeholder="https://your-project-ref.supabase.co"
                  value={draftUrls[slot.id]}
                  onChange={(e) =>
                    setDraftUrls((prev) => ({ ...prev, [slot.id]: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Key className="h-3 w-3 text-slate-400" />
                    <span>Anon Public Key</span>
                  </span>
                  {slot.hasKey && (
                    <span className="font-mono text-[10px] text-slate-400">
                      Saved: {slot.keyPreview}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showKeyInput[slot.id] ? 'text' : 'password'}
                    placeholder={slot.hasKey ? 'Leave blank to keep saved key, or paste new key' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'}
                    value={draftKeys[slot.id]}
                    onChange={(e) =>
                      setDraftKeys((prev) => ({ ...prev, [slot.id]: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-2.5 pr-8 py-1.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowKeyInput((prev) => ({ ...prev, [slot.id]: !prev[slot.id] }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    aria-label={showKeyInput[slot.id] ? 'Hide key' : 'Show key'}
                  >
                    {showKeyInput[slot.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => handleSaveCredentials(slot.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
                >
                  {busyAction === `save-${slot.id}` && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Save Credentials</span>
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null || (!isConfigured && !draftUrls[slot.id].trim())}
                  onClick={() => handleTestServer(slot.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {busyAction === `test-${slot.id}` && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Test & Verify 12 Tables</span>
                </button>
              </div>
            </div>
          )}

          {/* Inline Feedback Notice */}
          {feedback && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                feedback.ok
                  ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                  : 'border-red-200 dark:border-red-800/60 bg-red-50/70 dark:bg-red-950/30 text-red-800 dark:text-red-300'
              }`}
            >
              {feedback.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              )}
              <span className="leading-snug">{feedback.text}</span>
            </div>
          )}

          {/* Inline Confirmation Strip */}
          {isThisTogglePending && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2 text-xs">
              <p className="font-semibold text-amber-950 dark:text-amber-200">
                {pendingConfirm.action === 'pause'
                  ? `Pause ${shortName}? Zero data will go in or come out from ${shortName}, and all connected users will pause cloud reads until you activate a server.`
                  : `Activate ${shortName}? This will immediately hard-pause ${targetShortName} (0 bytes in/out) and switch all connected users to ${shortName} without reloading.`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => executeToggleState(slot.id, pendingConfirm.action)}
                  className="rounded-lg bg-slate-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90 cursor-pointer"
                >
                  Confirm {pendingConfirm.action === 'pause' ? `Pause ${shortName}` : `Activate ${shortName}`}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isThisMigratePending && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-3 space-y-2 text-xs">
              <p className="font-semibold text-blue-950 dark:text-blue-200">
                Copy all 12 tables (production data, orders, yarn, stocks, users, settings, logos & logs) from {shortName} to {targetShortName}? Active/Paused server status will NOT change automatically.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => executeStartMigration(slot.id, otherSlot.id)}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                >
                  Start Full Migration
                </button>
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* EXACTLY 2 OPERATIONAL ACTION BUTTONS PER SERVER CARD */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Button 1: Active / Pause */}
          <button
            type="button"
            disabled={
              busyAction !== null ||
              migrationRunning ||
              (!slot.isActive && !isConfigured)
            }
            onClick={() =>
              setPendingConfirm({
                type: 'toggle',
                serverId: slot.id,
                action: slot.isActive ? 'pause' : 'activate'
              })
            }
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold transition-colors disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer ${
              slot.isActive
                ? 'border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {busyAction === `toggle-${slot.id}` ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : slot.isActive ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span>{slot.isActive ? `Pause ${shortName}` : `Activate ${shortName}`}</span>
          </button>

          {/* Button 2: Migrate Data to Other Server */}
          <button
            type="button"
            disabled={
              busyAction !== null ||
              migrationRunning ||
              !isConfigured ||
              !otherConfigured
            }
            onClick={() =>
              setPendingConfirm({
                type: 'migrate',
                sourceServerId: slot.id,
                targetServerId: otherSlot.id
              })
            }
            title={
              !isConfigured || !otherConfigured
                ? 'Configure both Server 1 and Server 2 credentials first'
                : `Copy all 12 tables from ${shortName} to ${targetShortName}`
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
          >
            {busyAction === `migrate-${slot.id}` ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRightLeft className="h-3.5 w-3.5" />
            )}
            <span>Migrate Data to {targetShortName}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 p-5 space-y-5">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>Operator Control · Raihan ({RAIHAN_UID}) Only · Manual Switching</span>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Dual-Supabase Server Egress &amp; Live Migration
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {activeSummaryText} · Paused server sends and receives 0 bytes · Switching updates all active users without reload.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMasterSql((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Code className="h-3.5 w-3.5" />
            <span>{showMasterSql ? 'Hide 12-Table SQL' : '12-Table Setup SQL'}</span>
          </button>
          <button
            type="button"
            onClick={handleCopyMasterSql}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            {copiedMasterSql ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Copied SQL</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Full SQL</span>
              </>
            )}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => fetchStatus(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Collapsible One-Paste 12-Table Setup SQL for Server 2 */}
      {showMasterSql && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-xs space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Database className="h-4 w-4 text-emerald-400" />
              <span>Run once in Server 2 Supabase SQL Editor (Creates all 12 tables + GRANT permissions)</span>
            </div>
            <button
              type="button"
              onClick={handleCopyMasterSql}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer"
            >
              {copiedMasterSql ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedMasterSql ? 'Copied' : 'Copy SQL'}</span>
            </button>
          </div>
          <pre className="max-h-56 overflow-auto rounded-md bg-slate-950 p-3 font-mono text-[11px] text-emerald-300 leading-relaxed">
            {SupabaseSync.getFullMaster12TableSQL()}
          </pre>
        </div>
      )}

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-800 dark:text-red-300">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Side-by-Side Server 1 & Server 2 Cards */}
      {s1 && s2 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {renderServerCard(s1, s2)}
          {renderServerCard(s2, s1)}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading Server 1 &amp; Server 2 egress status...</span>
        </div>
      )}

      {/* Live 12-Table Migration Progress Modal */}
      {migrationJob && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => {
              if (migrationJob.status === 'completed' || migrationJob.status === 'failed') {
                setMigrationJob(null);
              }
            }}
          />
          <div className="relative w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-5 py-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>
                    Database Migration:{' '}
                    {migrationJob.sourceServerId === 'server1' ? 'Server 1' : 'Server 2'} &rarr;{' '}
                    {migrationJob.targetServerId === 'server1' ? 'Server 1' : 'Server 2'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {migrationJob.message}
                </p>
              </div>
              {(migrationJob.status === 'completed' || migrationJob.status === 'failed') && (
                <button
                  type="button"
                  onClick={() => setMigrationJob(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Close migration progress"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Table-by-table live progress list */}
            <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 px-5 py-2">
              {migrationJob.tables.map((t) => (
                <div
                  key={t.table}
                  className="flex items-center justify-between gap-3 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {t.status === 'done' && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                    {(t.status === 'copying' || t.status === 'checking') && (
                      <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
                    )}
                    {t.status === 'error' && (
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                    )}
                    {(t.status === 'pending' || t.status === 'skipped') && (
                      <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {t.label}
                      </div>
                      {t.error && (
                        <div className="text-[11px] text-red-600 dark:text-red-400 truncate">
                          {t.error}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-300">
                    {t.status === 'skipped'
                      ? 'Optional · Skipped'
                      : t.status === 'done'
                        ? `${t.rowsCopied.toLocaleString()} rows`
                        : t.status === 'copying'
                          ? `${t.rowsCopied.toLocaleString()} / ${t.totalRows.toLocaleString()}`
                          : t.status === 'checking'
                            ? 'Verifying...'
                            : t.status === 'error'
                              ? 'Error'
                              : 'Waiting'}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                Total copied: <strong>{migrationJob.totalRowsCopied.toLocaleString()}</strong> rows
              </div>
              {migrationJob.error && (
                <div className="text-xs text-red-600 dark:text-red-400 sm:max-w-md">
                  {migrationJob.error}
                </div>
              )}
              {(migrationJob.status === 'completed' || migrationJob.status === 'failed') ? (
                <button
                  type="button"
                  onClick={() => setMigrationJob(null)}
                  className="rounded-lg bg-slate-900 dark:bg-white px-4 py-2 text-xs font-bold text-white dark:text-slate-900 hover:opacity-90 cursor-pointer"
                >
                  Close
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Transferring on server...</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
