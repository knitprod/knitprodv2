import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserRecord, LedgerRecord, YarnAllocationRecord, OrderPlan, KnittingStatusOrder, TextileCloseRecord, GreyStockItem, GreyYarnStockItem } from '../types';
import { getOrderPlanCanonicalId, deduplicateOrderPlans } from './knittingStatusStore';
import { formatCompletionDate } from './dateUtils';

/**
 * Supabase Client & Sync Manager for Epyllion Knitex ERP
 * Manages:
 * 1. System Users & Permissions
 * 2. Factory Unit Settings & Targets
 * 3. Audit Activity Logs
 * 4. Production, Order, and Yarn Records fallback storage
 */

export class SupabaseSync {
  private static client: SupabaseClient | null = null;
  private static cachedConfig: { supabaseUrl: string; supabaseKey: string } | null = null;

  // Central default credentials (hardcoded fallback so no device is ever prompted)
  static DEFAULT_SUPABASE_URL = 'https://kwaezsfoalfhigzcnezd.supabase.co';
  static DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YWV6c2ZvYWxmaGlnemNuZXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTUzNzksImV4cCI6MjEwMjk3MTM3OX0.eYxuK9fCwix4i0GnHW-UBl2Kg_gZNOaPWvQ6FkMy_Qs';

  /**
   * Default / Current Supabase Configuration
   */
  static getStoredConfig(): { supabaseUrl: string; supabaseKey: string } {
    if (this.cachedConfig && this.cachedConfig.supabaseUrl && this.cachedConfig.supabaseKey) {
      return this.cachedConfig;
    }

    const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL
      ? import.meta.env.VITE_SUPABASE_URL.trim()
      : '';
    const envKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY
      ? import.meta.env.VITE_SUPABASE_ANON_KEY.trim()
      : '';

    let storedUrl = '';
    let storedKey = '';
    if (typeof localStorage !== 'undefined') {
      storedUrl = localStorage.getItem('epyllion_supabase_url') || '';
      storedKey = localStorage.getItem('epyllion_supabase_anon_key') || '';
    }

    const config = {
      supabaseUrl: storedUrl || envUrl || this.DEFAULT_SUPABASE_URL || '',
      supabaseKey: storedKey || envKey || this.DEFAULT_SUPABASE_KEY || ''
    };

    this.cachedConfig = config;
    return config;
  }

  private static _clusterRevision: number = 0;
  private static _activeServerId: 'server1' | 'server2' | null = 'server1';
  private static _isClusterPaused: boolean = false;
  private static _activeOperatorUid: string | null = null;

  static setActiveOperatorUid(uid: string | null): void {
    this._activeOperatorUid = uid ? uid.trim().toUpperCase() : null;
  }

  static getClusterStateSummary(): { activeServerId: 'server1' | 'server2' | null; isPaused: boolean; clusterRevision: number } {
    return {
      activeServerId: this._activeServerId,
      isPaused: this._isClusterPaused,
      clusterRevision: this._clusterRevision
    };
  }

  static isClusterPaused(): boolean {
    return this._isClusterPaused;
  }

  /**
   * Loads active Supabase config from server (respecting Server 1 / Server 2 Active or Hard-Paused state)
   */
  static async syncRemoteConfig(): Promise<{ supabaseUrl: string; supabaseKey: string; activeServerPaused?: boolean; clusterRevision?: number }> {
    try {
      const serverRes = await fetch('/api/config', { cache: 'no-store' });
      if (serverRes.ok) {
        const json = await serverRes.json();
        const cfg = json?.config;
        if (cfg) {
          const rev = Number(cfg.clusterRevision) || 1;
          const paused = Boolean(cfg.activeServerPaused);
          const srvId = cfg.activeServerId === 'server1' || cfg.activeServerId === 'server2' ? cfg.activeServerId : null;
          if (paused) {
            this.applyClusterSwitch({
              activeServerId: null,
              activeServerPaused: true,
              clusterRevision: rev,
              supabaseUrl: '',
              supabaseKey: ''
            }, false);
            return { supabaseUrl: '', supabaseKey: '', activeServerPaused: true, clusterRevision: rev };
          }
          if (cfg.supabaseUrl && cfg.supabaseKey) {
            const changed =
              this._clusterRevision > 0 &&
              (rev !== this._clusterRevision ||
                this.cachedConfig?.supabaseUrl !== cfg.supabaseUrl ||
                this._isClusterPaused);
            this._activeServerId = srvId;
            this._clusterRevision = rev;
            this._isClusterPaused = false;
            if (changed) {
              this.applyClusterSwitch({
                activeServerId: srvId,
                activeServerPaused: false,
                clusterRevision: rev,
                supabaseUrl: cfg.supabaseUrl,
                supabaseKey: cfg.supabaseKey
              }, true);
            } else {
              this.setCredentials(cfg.supabaseUrl, cfg.supabaseKey, false);
            }
            return { supabaseUrl: cfg.supabaseUrl, supabaseKey: cfg.supabaseKey, activeServerPaused: false, clusterRevision: rev };
          }
        }
      }
    } catch (e) {}

    return this.getStoredConfig();
  }

  /**
   * Immediately switches this browser tab to the newly activated server (or hard-pauses with 0 traffic)
   * without reloading the page or logging the user out.
   */
  static applyClusterSwitch(
    next: {
      activeServerId: 'server1' | 'server2' | null;
      activeServerPaused: boolean;
      clusterRevision: number;
      supabaseUrl: string;
      supabaseKey: string;
    },
    emitEvent: boolean = true
  ): void {
    // 1. Disconnect old WebSocket channel immediately so ZERO bytes touch the old/paused server
    if (this._syncSignalChannel && this.client) {
      const oldCh = this._syncSignalChannel;
      const oldClient = this.client;
      this._syncSignalChannel = null;
      try {
        oldClient.removeChannel(oldCh);
      } catch {}
    }

    // 2. Clear all in-memory data caches
    this._tableFetchMemo.clear();
    this._settingsMemo = null;
    this._usersMemo = null;
    this._activityLogsMemo = null;
    this._failedTables.clear();
    this._tablesRequiringWildcard.clear();
    this._clusterRevision = next.clusterRevision || this._clusterRevision + 1;
    this._activeServerId = next.activeServerId;
    this._isClusterPaused = Boolean(next.activeServerPaused);

    if (this._isClusterPaused || !next.supabaseUrl || !next.supabaseKey) {
      this.client = null;
      this.cachedConfig = { supabaseUrl: '', supabaseKey: '' };
      if (emitEvent && typeof window !== 'undefined') {
        try {
          window.dispatchEvent(
            new CustomEvent('epyllion_cluster_switched', {
              detail: {
                activeServerId: null,
                activeServerPaused: true,
                clusterRevision: this._clusterRevision
              }
            })
          );
        } catch {}
      }
      return;
    }

    // 3. Reconnect client cleanly to the newly active server
    this.setCredentials(next.supabaseUrl, next.supabaseKey, false);

    // 4. Re-attach shared Broadcast channel on the new server if any listeners are active
    let hasListeners = this._syncSignalListeners.size > 0;
    if (!hasListeners) {
      for (const set of this._tableChangeListeners.values()) {
        if (set.size > 0) {
          hasListeners = true;
          break;
        }
      }
    }
    if (hasListeners) {
      this.ensureSharedSyncChannel();
    }

    // 5. Notify React views to refresh silently without page reload
    if (emitEvent && typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('epyllion_cluster_switched', {
            detail: {
              activeServerId: this._activeServerId,
              activeServerPaused: false,
              clusterRevision: this._clusterRevision
            }
          })
        );
      } catch {}
    }
  }

  /**
   * Broadcasts a live switchover signal on the CURRENTLY connected server right before switching/pausing
   * so all other connected user browsers immediately pull the new server config without reloading.
   */
  static async broadcastClusterSwitchSignal(payload: {
    action: 'activate' | 'pause';
    activeServerId: 'server1' | 'server2' | null;
    clusterRevision: number;
  }): Promise<void> {
    if (!this.client || this._isClusterPaused) return;
    try {
      this.sendBroadcastPayload('server_switched', {
        ...payload,
        ts: Date.now(),
        senderId: this._clientSenderId
      });
      // Give the WebSocket frame a tiny window to flush before tearing down the old connection
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch {}
  }

  private static _serviceRestrictedUntil: number = 0;
  private static _serviceRestrictedReason: string | null = null;
  private static _failedTables = new Set<string>();

  static isQuotaOrRestrictionError(err: any): boolean {
    if (!err) return false;
    try {
      const msg = (
        typeof err === 'string'
          ? err
          : (err.message || err.details || err.hint || err.error_description || JSON.stringify(err))
      ).toLowerCase();
      return (
        msg.includes('exceed_egress_quota') ||
        msg.includes('exceed_quota') ||
        msg.includes('egress quota') ||
        msg.includes('restricted due to') ||
        msg.includes('spend caps') ||
        msg.includes('upgrade their plan') ||
        err?.status === 402
      );
    } catch {
      return false;
    }
  }

  static isServiceRestricted(): boolean {
    if (this._serviceRestrictedUntil > Date.now()) {
      return true;
    }
    try {
      if (typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem('epyllion_supabase_restricted_until');
        if (raw) {
          const ts = parseInt(raw, 10);
          if (!isNaN(ts) && ts > Date.now()) {
            this._serviceRestrictedUntil = ts;
            this._serviceRestrictedReason =
              sessionStorage.getItem('epyllion_supabase_restricted_reason') ||
              'Supabase service quota exceeded. Using backup storage.';
            return true;
          }
        }
      }
    } catch {}
    return false;
  }

  static getServiceRestrictionReason(): string | null {
    return this.isServiceRestricted()
      ? (this._serviceRestrictedReason || 'Supabase quota exceeded. Using backup storage.')
      : null;
  }

  static markServiceRestricted(err: any): void {
    const alreadyRestricted = this._serviceRestrictedUntil > Date.now();
    let reason = 'Supabase project quota exceeded. Switching to backup storage.';
    if (err && typeof err === 'object' && err.message) {
      reason = String(err.message);
    } else if (typeof err === 'string' && err.trim()) {
      try {
        const parsed = JSON.parse(err);
        reason = parsed?.message || err;
      } catch {
        reason = err;
      }
    }

    this._serviceRestrictedUntil = Date.now() + 5 * 60 * 1000;
    this._serviceRestrictedReason = reason;
    this.client = null;

    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('epyllion_supabase_restricted_until', String(this._serviceRestrictedUntil));
        sessionStorage.setItem('epyllion_supabase_restricted_reason', reason);
      }
    } catch {}

    if (!alreadyRestricted) {
      console.warn('Supabase service restricted (quota exceeded) — falling back to backup/local storage:', reason);
    }
  }

  static clearServiceRestriction(): void {
    this._serviceRestrictedUntil = 0;
    this._serviceRestrictedReason = null;
    this._failedTables.clear();
    this._tableFetchMemo.clear();
    this._settingsMemo = null;
    this._usersMemo = null;
    this._activityLogsMemo = null;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('epyllion_supabase_restricted_until');
        sessionStorage.removeItem('epyllion_supabase_restricted_reason');
      }
    } catch {}
  }

  static hasFetchFailed(table: string): boolean {
    return this._failedTables.has(table);
  }

  // =========================================================================
  // EGRESS-SAVING SHARED CACHE, DELTA SYNC & LIVE BROADCAST COORDINATOR
  // =========================================================================

  private static _tableFetchMemo = new Map<string, { ts: number; data: any[]; maxUpdatedAt?: string | null }>();
  private static _tableInFlight = new Map<string, Promise<any>>();
  private static _settingsMemo: { ts: number; data: any } | null = null;
  private static _settingsInFlight: Promise<any | null> | null = null;
  private static _usersMemo: { ts: number; data: UserRecord[] } | null = null;
  private static _usersInFlight: Promise<UserRecord[]> | null = null;
  private static _activityLogsMemo: { ts: number; limit: number; data: any[] } | null = null;
  private static _lastKnownTableVersions: Record<string, number> = {};
  private static _clientSenderId = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  private static _syncSignalChannel: any = null;
  private static _syncSignalListeners = new Set<(signal: { table: string; mode: string; ts: number }) => void>();
  private static _tableChangeListeners = new Map<
    string,
    Set<(change: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: any; id: string }) => void>
  >();
  private static _tablesRequiringWildcard = new Set<string>();
  private static readonly CLIENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (instantly cleared on any write or Broadcast signal)
  private static readonly USERS_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes in-memory only (zero browser storage)

  private static readonly SLIM_SELECT_COLUMNS: Record<string, string> = {
    production_ledger:
      'id,date,unit,floor,shift_a,shift_b,shift_c,total_production,target,efficiency,active_machines,total_machines,machine_utilization,idle_machines,running_orders,buyer,remarks,updated_by,created_at,updated_at',
    yarn_allocations:
      'id,actual_requisition_date,buyer,order_number,fabrics_type,fabric_shade,fabric_gsm,yarn_required,lot_ref,allocated_yarn,lot_no,spinners_name,allocation_status,yarn_stock_status,yarn_delivery_status,proposed_allocation_date,allocation_date_range,allocation_no,yarn_rq_qty,allocated_qty,balance,remarks,updated_by,created_at,updated_at',
    order_plans:
      'id,plan_month,plan_type,ewo,buyer,color,knit_start,knit_end,target,target_next_month,allocation_start,allocation_end,allocated_qty,allocated_bal,grey_req,knit_pro,knit_bal,a_knit_start,last_production_date,avg_prod_day,expected_knit_end,knit_start_otd,knit_end_otd,knit_start_remarks,knit_end_remarks,knit_team_leaders,updated_by,created_at,updated_at',
    knitting_orders:
      'id,order_no,buyer_name,team_leader,knit_start_date,knit_end_date,req_qty,grey_qty,production,knit_balance,items,remarks,raw_data,created_at,updated_at',
    textile_close_pmc:
      'id,status,order_no,buyer_name,team_leader,fgsm,f_width,color,fab_type,req_qty,grey_qty,production,knit_bal,closed_date,remarks,updated_at',
    grey_stock_summary:
      'id,code,order_no,buyer_name,colour,fab_style,fab_type,status,completion_date,net_received_qty,net_issued_qty,stock_qty,double_count,owner_unit,matched_grey_qty,updated_at',
    grey_yarn_stock:
      'id,completion_date,buyer,status,allocated_order_wa,physical_count,physical_lot,spinner,booking_qty,yarn_required,net_received,total_issued,excess_issued,total_stock_qty,issue_balance,order_no,buyer_name,physical_yarn_count,physical_yarn_lot,total_received,issued_balance,remarks,updated_at'
  };

  static getSelectColumns(table: string): string {
    if (this._tablesRequiringWildcard.has(table)) return '*';
    return this.SLIM_SELECT_COLUMNS[table] || '*';
  }

  static getLastKnownVersion(table: string): number {
    return this._lastKnownTableVersions[table] || 0;
  }

  static getLastSyncedTimestamp(table: string): string | null {
    return this._tableFetchMemo.get(table)?.maxUpdatedAt || null;
  }

  static clearLocalTableMemo(table?: string): void {
    if (table) {
      this._tableFetchMemo.delete(table);
    } else {
      this._tableFetchMemo.clear();
    }
  }

  /**
   * Checks lightweight version numbers (~250 bytes) from the shared server cache.
   * Returns null if server cache endpoint is unreachable.
   */
  static async fetchServerTableVersions(
    probe: boolean = false
  ): Promise<{
    restricted: boolean;
    activeServerId?: 'server1' | 'server2' | null;
    activeServerPaused?: boolean;
    clusterRevision?: number;
    raihanAlert?: {
      showWarning: boolean;
      activeServerId: 'server1' | 'server2' | null;
      activeServerLabel: string;
      usedGb: number;
      limitGb: number;
      pct: number;
      isCritical: boolean;
      isRestricted: boolean;
    } | null;
    versions: Record<string, { version: number; fetchedAt: number; maxUpdatedAt: string | null; count: number }>;
  } | null> {
    try {
      const url = probe ? '/api/supabase-cache/versions?probe=1' : '/api/supabase-cache/versions';
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this._activeOperatorUid) {
        headers['x-session-uid'] = this._activeOperatorUid;
      }
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (json?.restricted) {
        this.markServiceRestricted(json.reason || 'Supabase project quota exceeded.');
      }
      if (typeof json?.clusterRevision === 'number') {
        if (this._clusterRevision > 0 && json.clusterRevision !== this._clusterRevision) {
          // Server was manually switched or paused by Raihan -> seamlessly sync this tab without reload!
          void this.syncRemoteConfig();
        } else if (this._clusterRevision === 0) {
          this._clusterRevision = json.clusterRevision;
          this._activeServerId = json.activeServerId || null;
          this._isClusterPaused = Boolean(json.activeServerPaused);
        }
      }
      if (json?.success && json.versions) {
        return {
          restricted: Boolean(json.restricted),
          activeServerId: json.activeServerId ?? null,
          activeServerPaused: Boolean(json.activeServerPaused),
          clusterRevision: json.clusterRevision,
          raihanAlert: json.raihanAlert ?? null,
          versions: json.versions
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Fetches rows via the shared server-side RAM cache (/api/supabase-cache/:table).
   * N concurrent users hit 1 Supabase read instead of N.
   */
  private static async fetchRowsViaServerCache(
    table: string,
    options?: { force?: boolean; since?: string; orderNo?: string }
  ): Promise<{ ok: boolean; rows: any[]; version?: number; maxUpdatedAt?: string | null; restricted?: boolean } | null> {
    try {
      const params = new URLSearchParams();
      if (options?.force) params.set('force', '1');
      if (options?.since) params.set('since', options.since);
      if (options?.orderNo) params.set('orderNo', options.orderNo);
      const qs = params.toString();
      const res = await fetch(`/api/supabase-cache/${encodeURIComponent(table)}${qs ? `?${qs}` : ''}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(45000)
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (typeof json?.clusterRevision === 'number' && this._clusterRevision > 0 && json.clusterRevision !== this._clusterRevision) {
        void this.syncRemoteConfig();
      }
      if (json?.activeServerPaused) {
        this._isClusterPaused = true;
        return { ok: false, rows: [], restricted: false };
      }
      if (json?.restricted) {
        this.markServiceRestricted(json.reason || 'Supabase project quota exceeded.');
        return { ok: false, rows: [], restricted: true };
      }
      if (json?.permissionDenied) {
        return { ok: false, rows: [], restricted: false };
      }
      if (json?.success && Array.isArray(json.rows)) {
        if (typeof json.version === 'number' && !options?.orderNo) {
          this._lastKnownTableVersions[table] = json.version;
        }
        return {
          ok: true,
          rows: json.rows,
          version: json.version,
          maxUpdatedAt: json.maxUpdatedAt || null
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Incremental delta fetch: downloads ONLY rows modified after `sinceIso`.
   */
  static async fetchTableDelta(table: string, sinceIso: string): Promise<any[] | null> {
    if (!sinceIso || this.isServiceRestricted()) return null;
    const cached = await this.fetchRowsViaServerCache(table, { since: sinceIso });
    if (cached) {
      return cached.ok ? cached.rows : null;
    }

    const client = this.getClient();
    if (!client) return null;
    try {
      let selectCols = this.getSelectColumns(table);
      let { data, error } = await client.from(table).select(selectCols).gt('updated_at', sinceIso).limit(1000);
      if (error && selectCols !== '*' && (error.code === '42703' || error.code === 'PGRST204')) {
        this._tablesRequiringWildcard.add(table);
        const retry = await client.from(table).select('*').gt('updated_at', sinceIso).limit(1000);
        data = retry.data;
        error = retry.error;
      }
      if (error) {
        if (this.isQuotaOrRestrictionError(error)) this.markServiceRestricted(error);
        return null;
      }
      return Array.isArray(data) ? data : [];
    } catch {
      return null;
    }
  }

  private static ensureSharedSyncChannel(): any {
    if (this._syncSignalChannel) return this._syncSignalChannel;
    const client = this.getClient();
    if (!client) return null;
    try {
      this._syncSignalChannel = client
        .channel('epyllion:sync_signals', {
          config: { broadcast: { self: false } }
        })
        .on('broadcast', { event: 'dataset_changed' }, (msg: any) => {
          const payload = msg?.payload;
          if (!payload || !payload.table) return;
          if (payload.senderId === this._clientSenderId) return;
          if (payload.table === 'settings') {
            this._settingsMemo = null;
          } else {
            this._tableFetchMemo.delete(payload.table);
          }
          for (const fn of this._syncSignalListeners) {
            try {
              fn({ table: String(payload.table), mode: String(payload.mode || 'bulk'), ts: Number(payload.ts || Date.now()) });
            } catch {}
          }
        })
        .on('broadcast', { event: 'record_changed' }, (msg: any) => {
          const payload = msg?.payload;
          if (!payload || !payload.table) return;
          if (payload.senderId === this._clientSenderId) return;
          this._tableFetchMemo.delete(payload.table);
          const listeners = this._tableChangeListeners.get(String(payload.table));
          if (listeners && listeners.size > 0) {
            const evt = (payload.eventType === 'DELETE' ? 'DELETE' : payload.eventType === 'INSERT' ? 'INSERT' : 'UPDATE') as
              | 'INSERT'
              | 'UPDATE'
              | 'DELETE';
            for (const fn of listeners) {
              try {
                fn({
                  eventType: evt,
                  record: payload.record || { id: payload.id },
                  id: String(payload.id || payload.record?.id || '')
                });
              } catch {}
            }
          }
        })
        .on('broadcast', { event: 'server_switched' }, (msg: any) => {
          const payload = msg?.payload;
          if (!payload || payload.senderId === this._clientSenderId) return;
          // Another tab / Raihan manually paused or switched servers -> seamlessly switch this browser without reload!
          setTimeout(() => {
            void this.syncRemoteConfig();
          }, 300);
        })
        .subscribe();
      return this._syncSignalChannel;
    } catch (err) {
      console.warn('Supabase ensureSharedSyncChannel notice:', err);
      this._syncSignalChannel = null;
      return null;
    }
  }

  private static maybeCleanupSharedSyncChannel(): void {
    let hasTableListeners = false;
    for (const set of this._tableChangeListeners.values()) {
      if (set.size > 0) {
        hasTableListeners = true;
        break;
      }
    }
    if (this._syncSignalListeners.size === 0 && !hasTableListeners && this._syncSignalChannel) {
      const client = this.getClient();
      const ch = this._syncSignalChannel;
      this._syncSignalChannel = null;
      try {
        client?.removeChannel(ch);
      } catch {}
    }
  }

  private static sendBroadcastPayload(event: 'dataset_changed' | 'record_changed' | 'server_switched', payload: Record<string, any>): void {
    const client = this.getClient();
    if (!client) return;
    try {
      if (this._syncSignalChannel) {
        this._syncSignalChannel.send({ type: 'broadcast', event, payload }).catch?.(() => {});
      } else {
        const tempCh = client.channel('epyllion:sync_signals', {
          config: { broadcast: { self: false } }
        });
        tempCh.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            tempCh
              .send({ type: 'broadcast', event, payload })
              .finally(() => {
                setTimeout(() => {
                  try { client.removeChannel(tempCh); } catch {}
                }, 1500);
              });
          }
        });
      }
    } catch {}
  }

  /**
   * Invalidates the shared server cache and broadcasts 1 tiny Realtime signal (~100-300 bytes)
   * over the single shared channel so all connected devices/tabs stay live without postgres_changes storms.
   */
  static notifyDatasetChanged(
    table: string,
    mode: 'single' | 'bulk' = 'bulk',
    singleChange?: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record?: any; id: string }
  ): void {
    if (table === 'settings') {
      this._settingsMemo = null;
    } else {
      this._tableFetchMemo.delete(table);
    }

    // 1. Invalidate shared server RAM cache immediately
    if (typeof fetch !== 'undefined') {
      fetch('/api/supabase-cache/invalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table })
      })
        .then(res => (res.ok ? res.json() : null))
        .then(json => {
          if (json && typeof json.version === 'number') {
            this._lastKnownTableVersions[table] = json.version;
          }
        })
        .catch(() => {});
    }

    // 2. Broadcast 1 tiny signal via Supabase Realtime Broadcast (all other devices auto-update live!)
    if (mode === 'bulk') {
      this.sendBroadcastPayload('dataset_changed', {
        table,
        mode: 'bulk',
        ts: Date.now(),
        senderId: this._clientSenderId
      });
    } else if (singleChange) {
      this.sendBroadcastPayload('record_changed', {
        table,
        eventType: singleChange.eventType,
        record: singleChange.record,
        id: singleChange.id,
        ts: Date.now(),
        senderId: this._clientSenderId
      });
    }
  }

  /**
   * Subscribes to tiny cross-device bulk-upload/mutation broadcast signals.
   * Shares 1 single WebSocket channel across all components.
   */
  static subscribeToSyncSignals(
    listener: (signal: { table: string; mode: string; ts: number }) => void
  ): () => void {
    this._syncSignalListeners.add(listener);
    this.ensureSharedSyncChannel();

    return () => {
      this._syncSignalListeners.delete(listener);
      this.maybeCleanupSharedSyncChannel();
    };
  }

  /**
   * Subscribes to live single-row edits/deletes for a table over the single shared Broadcast channel
   * (zero postgres_changes WAL egress storms during 3,000-row Excel bulk uploads!).
   */
  private static subscribeToTableRecordBroadcast<T>(
    table: string,
    onRecordChange: (change: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: T; id: string }) => void
  ): () => void {
    if (!this.getClient()) return () => {};
    let set = this._tableChangeListeners.get(table);
    if (!set) {
      set = new Set();
      this._tableChangeListeners.set(table, set);
    }
    set.add(onRecordChange as any);
    this.ensureSharedSyncChannel();

    return () => {
      const current = this._tableChangeListeners.get(table);
      if (current) {
        current.delete(onRecordChange as any);
        if (current.size === 0) this._tableChangeListeners.delete(table);
      }
      this.maybeCleanupSharedSyncChannel();
    };
  }

  private static _pendingClientEgressBytes: number = 0;
  private static _egressFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private static _egressUnloadBound: boolean = false;

  private static queueClientEgressBytes(bytes: number): void {
    if (this._isClusterPaused || !Number.isFinite(bytes) || bytes <= 0) return;
    this._pendingClientEgressBytes += Math.round(bytes);

    if (typeof window !== 'undefined' && !this._egressUnloadBound) {
      this._egressUnloadBound = true;
      const flushOnLeave = () => {
        if (this._pendingClientEgressBytes > 0) {
          this.flushClientEgressBytes(true);
        }
      };
      window.addEventListener('pagehide', flushOnLeave);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushOnLeave();
      });
    }

    if (this._pendingClientEgressBytes >= 250_000) {
      this.flushClientEgressBytes(false);
    } else if (!this._egressFlushTimer) {
      this._egressFlushTimer = setTimeout(() => {
        this._egressFlushTimer = null;
        this.flushClientEgressBytes(false);
      }, 20_000);
    }
  }

  private static flushClientEgressBytes(useBeacon: boolean = false): void {
    const bytes = Math.round(this._pendingClientEgressBytes);
    if (bytes < 512 || this._isClusterPaused) {
      if (this._isClusterPaused) this._pendingClientEgressBytes = 0;
      return;
    }
    const uid = this._activeOperatorUid || '';
    if (!uid) return; // Only report for authenticated app sessions
    this._pendingClientEgressBytes = 0;

    const payload = JSON.stringify({ bytes: Math.min(bytes, 50_000_000), uid });
    try {
      if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/supabase-failover/report-egress', blob);
        return;
      }
      if (typeof fetch !== 'undefined') {
        fetch('/api/supabase-failover/report-egress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-uid': uid
          },
          body: payload,
          keepalive: useBeacon
        }).catch(() => {});
      }
    } catch {}
  }

  private static measureResponseWireBytes(response: Response, reqUrl: string): void {
    try {
      const clHeader = response.headers.get('content-length');
      const cl = clHeader ? parseInt(clHeader, 10) : NaN;
      if (Number.isFinite(cl) && cl > 0) {
        this.queueClientEgressBytes(cl + 450);
        return;
      }

      // Check browser PerformanceResourceTiming for exact compressed wire bytes if available
      if (typeof performance !== 'undefined' && typeof performance.getEntriesByName === 'function' && reqUrl) {
        const entries = performance.getEntriesByName(reqUrl);
        const latest = entries[entries.length - 1] as PerformanceResourceTiming | undefined;
        if (latest) {
          const wire = latest.transferSize > 0 ? latest.transferSize : latest.encodedBodySize > 0 ? latest.encodedBodySize + 450 : 0;
          if (wire > 0) {
            this.queueClientEgressBytes(wire);
            return;
          }
        }
      }

      // Fallback: measure cloned response text & estimate gzip wire size (~28% for JSON)
      const ct = (response.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('json') || ct.includes('text')) {
        const isEncoded = Boolean(response.headers.get('content-encoding'));
        response
          .clone()
          .text()
          .then((txt) => {
            const rawLen = new TextEncoder().encode(txt).length;
            const estimatedWire = isEncoded || rawLen > 1024 ? Math.round(rawLen * 0.28) + 450 : rawLen + 450;
            this.queueClientEgressBytes(estimatedWire);
          })
          .catch(() => {});
      }
    } catch {}
  }

  private static createProtectedClient(url: string, key: string, persistSession: boolean = true): SupabaseClient {
    const wrappedFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (SupabaseSync.isServiceRestricted()) {
        return new Response(
          JSON.stringify({ message: SupabaseSync.getServiceRestrictionReason() || 'Service restricted due to quota.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(input, init);
      const reqUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      SupabaseSync.measureResponseWireBytes(response, reqUrl);

      if (!response.ok && (response.status === 402 || response.status === 403 || response.status === 429 || response.status >= 400)) {
        try {
          const text = await response.clone().text();
          if (SupabaseSync.isQuotaOrRestrictionError(text)) {
            SupabaseSync.markServiceRestricted(text);
          }
        } catch {}
      }
      return response;
    };

    return createClient(url, key, {
      global: { fetch: wrappedFetch },
      auth: {
        persistSession,
        autoRefreshToken: persistSession
      }
    });
  }

  /**
   * Initialize or retrieve the Supabase client
   */
  static getClient(): SupabaseClient | null {
    // Hard Pause Lock: zero traffic in/out when active server is paused by Raihan
    if (this._isClusterPaused || this.isServiceRestricted()) return null;
    if (this.client) return this.client;

    const { supabaseUrl, supabaseKey } = this.getStoredConfig();
    if (!supabaseUrl || !supabaseKey) return null;

    try {
      this.client = this.createProtectedClient(supabaseUrl, supabaseKey, true);
      return this.client;
    } catch (err) {
      console.warn('Supabase client initialization warning:', err);
      return null;
    }
  }

  /**
   * Combined Master 12-Table SQL Script for initializing a fresh Server 2 Supabase project in one paste.
   */
  static getFullMaster12TableSQL(): string {
    return [
      '-- =========================================================================',
      '-- EPYLLION KNITEX ERP — MASTER 12-TABLE SETUP SQL FOR SERVER 2',
      '-- Paste & click RUN once in your Server 2 Supabase SQL Editor',
      '-- =========================================================================',
      '',
      this.getSetupSQL(),
      '',
      this.getYarnSetupSQL(),
      '',
      this.getOrderPlansSetupSQL(),
      '',
      this.getKnittingOrdersSetupSQL(),
      '',
      this.getTextileCloseSetupSQL(),
      '',
      this.getGreyStockSchemaSQL(),
      '',
      this.getGreyYarnStockSchemaSQL(),
      '',
      '-- Ensure full API permissions on all 12 tables for anon & authenticated roles:',
      'GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;',
      'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;',
      'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;'
    ].join('\n');
  }

  /**
   * Helper to clean and normalize a Supabase Project URL
   */
  static cleanSupabaseUrl(rawUrl: string): string {
    let clean = (rawUrl || '').trim();
    if (!clean) return '';

    // If user pasted dashboard URL like: https://supabase.com/dashboard/project/abcdefgh...
    const dashboardMatch = clean.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
    if (dashboardMatch && dashboardMatch[1]) {
      return `https://${dashboardMatch[1]}.supabase.co`;
    }

    // Ensure protocol
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }

    try {
      const parsed = new URL(clean);
      // Only keep the origin (e.g. https://xyz.supabase.co), strip any trailing /rest/v1 or /dashboard paths
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return clean.replace(/\/+$/, '');
    }
  }

  /**
   * Update and save Supabase credentials
   */
  static setCredentials(url: string, key: string, persistToCloud: boolean = true): boolean {
    const cleanUrl = this.cleanSupabaseUrl(url);
    const cleanKey = key.trim();

    if (typeof localStorage !== 'undefined') {
      if (cleanUrl) localStorage.setItem('epyllion_supabase_url', cleanUrl);
      if (cleanKey) localStorage.setItem('epyllion_supabase_anon_key', cleanKey);
    }

    this.cachedConfig = { supabaseUrl: cleanUrl, supabaseKey: cleanKey };
    this.client = null;
    this.clearServiceRestriction();

    if (persistToCloud && cleanUrl && cleanKey) {
      // Persist to Express server config if running
      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseUrl: cleanUrl, supabaseKey: cleanKey })
      }).catch(() => {});
    }

    if (cleanUrl && cleanKey) {
      try {
        this.client = this.createProtectedClient(cleanUrl, cleanKey, true);
        // Dispatch event for UI components (deferred)
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            try {
              window.dispatchEvent(new CustomEvent('supabase_config_updated', { detail: { url: cleanUrl } }));
            } catch {}
          }, 0);
        }
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Check if Supabase connection is configured and active
   */
  static isConfigured(): boolean {
    const config = this.getStoredConfig();
    return Boolean(config.supabaseUrl && config.supabaseKey);
  }

  /**
   * Test the connection to Supabase
   */
  static async testConnection(customUrl?: string, customKey?: string): Promise<{ success: boolean; message: string; tables?: string[] }> {
    const rawUrl = (customUrl || this.getStoredConfig().supabaseUrl || '').trim();
    const key = (customKey || this.getStoredConfig().supabaseKey || '').trim();
    const url = this.cleanSupabaseUrl(rawUrl);

    if (!url || !key) {
      return { success: false, message: 'Supabase URL or Anon Key is missing. Please provide both.' };
    }

    try {
      const testClient = createClient(url, key, {
        auth: { persistSession: false }
      });

      // Test querying production_ledger, yarn_allocations, and users tables
      const { error: ledgerError } = await testClient.from('production_ledger').select('id').limit(1);
      if (this.isQuotaOrRestrictionError(ledgerError)) {
        this.markServiceRestricted(ledgerError);
        return {
          success: false,
          message: ledgerError.message || 'Supabase project service is restricted due to quota limits.'
        };
      }

      const { error: yarnError } = await testClient.from('yarn_allocations').select('id').limit(1);
      const { error: userError } = await testClient.from('users').select('id').limit(1);

      const quotaErr = [ledgerError, yarnError, userError].find(e => this.isQuotaOrRestrictionError(e));
      if (quotaErr) {
        this.markServiceRestricted(quotaErr);
        return {
          success: false,
          message: quotaErr.message || 'Supabase project service is restricted due to quota limits.'
        };
      }

      if (ledgerError && (ledgerError.code === 'PGRST301' || ledgerError.message?.includes('JWT') || ledgerError.message?.includes('apikey'))) {
        return { 
          success: false, 
          message: `Invalid API Key: ${ledgerError.message}. Please double-check you copied the "anon public" key from Project Settings > API.` 
        };
      }

      this.clearServiceRestriction();

      const isMissingTable = (err: any) => {
        if (!err) return false;
        return err.code === '42P01' || err.code === 'PGRST205' || err.message?.includes('schema cache') || err.message?.includes('does not exist');
      };

      const tablesFound: string[] = [];
      if (!ledgerError) tablesFound.push('production_ledger');
      if (!yarnError) tablesFound.push('yarn_allocations');
      if (!userError) tablesFound.push('users');

      const missingTables: string[] = [];
      if (ledgerError && isMissingTable(ledgerError)) missingTables.push('production_ledger');
      if (yarnError && isMissingTable(yarnError)) missingTables.push('yarn_allocations');

      if (missingTables.length > 0) {
        return { 
          success: true, 
          message: `Connected to Supabase! Note: Table(s) ${missingTables.join(', ')} not found yet. Please run the setup SQL in your Supabase SQL Editor.`,
          tables: tablesFound
        };
      }

      return { 
        success: true, 
        message: `Successfully connected to Supabase! Verified tables: ${tablesFound.join(', ')}. Real-time WebSockets active.`,
        tables: tablesFound
      };
    } catch (err: any) {
      return { success: false, message: `Network / Connection error: ${err.message || String(err)}` };
    }
  }

  // ==========================================
  // 1. USER MANAGEMENT & AUTHENTICATION
  // ==========================================

  static async fetchUsers(forceRefresh: boolean = false): Promise<UserRecord[]> {
    // 3-minute in-memory cache (strictly RAM only, never written to localStorage/sessionStorage)
    if (!forceRefresh && this._usersMemo && Date.now() - this._usersMemo.ts < this.USERS_CACHE_TTL_MS) {
      return this._usersMemo.data;
    }
    if (!forceRefresh && this._usersInFlight) {
      return this._usersInFlight;
    }

    const client = this.getClient();
    if (!client) return [];

    const run = (async (): Promise<UserRecord[]> => {
      try {
        // 1. Query Supabase users table directly (do NOT re-download Base64 logos via fetchSettings!)
        const { data, error } = await client
          .from('users')
          .select('*')
          .order('user_name', { ascending: true });

        if (error) {
          if (this.isQuotaOrRestrictionError(error)) {
            this.markServiceRestricted(error);
          } else {
            console.warn('Supabase fetchUsers warning:', error.message);
          }
          return [];
        }

        if (!data || !Array.isArray(data)) return [];

        // Read legacy user_metadata ONLY if already in memory (zero extra network/logo egress)
        const cachedSettings = this._settingsMemo?.data;
        const userMetadataMap: Record<string, any> =
          (cachedSettings && (cachedSettings.user_metadata || cachedSettings.user_permissions || cachedSettings.userPermissions)) || {};

        const mapped = data.map((row: any) => {
          const cleanUid = (row.uid || '').trim().toUpperCase();
          const meta = userMetadataMap[cleanUid] || {};

          return {
            id: row.id || `usr-${cleanUid}`,
            uid: cleanUid,
            userName: row.user_name || row.userName || cleanUid,
            userType: (row.user_type || row.userType || 'General') as 'Admin' | 'General',
            designation: row.designation || meta.designation || '',
            department: (row.department || meta.department || 'Knitting') as 'Knitting' | 'Dyeing' | 'Finishing',
            assignedUnits: row.assigned_units || row.assignedUnits || meta.assignedUnits || ['EKL', 'EFL'],
            assignedBuyers: row.assigned_buyers || row.assignedBuyers || meta.assignedBuyers || [],
            allowedTabs: row.allowed_tabs || row.allowedTabs || meta.allowedTabs || [],
            tabPermissions: row.tab_permissions || row.tabPermissions || meta.tabPermissions || {},
            permission: (row.permission || meta.permission || 'Read') as 'Read' | 'Read / Write' | 'Hide',
            status: (row.status || meta.status || 'Active') as 'Active' | 'Inactive',
            phone: row.phone || meta.phone || '',
            email: row.email || meta.email || '',
            lastLogin: row.last_login || row.lastLogin || meta.lastLogin,
            password: row.password || meta.password || 'Password@2026',
            lastUpdated: row.updated_at || row.lastUpdated || meta.lastUpdated || new Date().toLocaleString(),
            createdAt: row.created_at || row.createdAt || meta.createdAt
          };
        });

        this._usersMemo = { ts: Date.now(), data: mapped };
        return mapped;
      } catch (err) {
        console.warn('Supabase fetchUsers exception:', err);
        return [];
      }
    })();

    this._usersInFlight = run.finally(() => {
      this._usersInFlight = null;
    });
    return this._usersInFlight;
  }

  static async saveUser(user: UserRecord): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    const cleanUid = user.uid.trim().toUpperCase();

    try {
      // 1. Primary write to Supabase 'users' table (includes assigned_buyers and tab_permissions)
      const fullRow: any = {
        id: user.id || `USR-${cleanUid}`,
        uid: cleanUid,
        user_name: user.userName,
        user_type: user.userType,
        designation: user.designation || '',
        department: user.department || 'Knitting',
        assigned_units: user.assignedUnits || [],
        assigned_buyers: user.assignedBuyers || [],
        allowed_tabs: user.allowedTabs || [],
        tab_permissions: user.tabPermissions || {},
        permission: user.permission || 'Read',
        status: user.status || 'Active',
        phone: user.phone || '',
        email: user.email || '',
        password: user.password || 'Password@2026',
        last_login: user.lastLogin || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from('users').upsert(fullRow, { onConflict: 'uid' });
      if (error) {
        // Fallback: If table hasn't run the new migration yet, try without newly added columns
        if (error.message?.includes('assigned_buyers') || error.message?.includes('tab_permissions')) {
          const fallbackRow = { ...fullRow };
          delete fallbackRow.assigned_buyers;
          delete fallbackRow.tab_permissions;
          await client.from('users').upsert(fallbackRow, { onConflict: 'uid' });
        } else {
          console.warn('Supabase users table save error:', error.message);
        }
      }

      this._usersMemo = null;
      return true;
    } catch (err) {
      console.warn('Supabase saveUser exception:', err);
      return false;
    }
  }

  static async deleteUser(uidOrId: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    const rawStr = (uidOrId || '').trim();
    const upperStr = rawStr.toUpperCase();

    try {
      // Delete from Supabase 'users' table explicitly by both UID and ID
      await client.from('users').delete().eq('uid', rawStr);
      await client.from('users').delete().eq('uid', upperStr);
      await client.from('users').delete().eq('id', rawStr);
      await client.from('users').delete().eq('id', upperStr);
      await client.from('users').delete().eq('id', `USR-${upperStr}`);

      this._usersMemo = null;
      return true;
    } catch (err) {
      console.warn('Supabase deleteUser error:', err);
      return false;
    }
  }

  static async deleteBuyer(buyerName: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      const cleanName = (buyerName || '').trim();
      if (!cleanName) return false;

      // Delete from dedicated public.buyers table
      await client.from('buyers').delete().eq('buyer_name', cleanName);
      await client.from('buyers').delete().ilike('buyer_name', cleanName);
      this.notifyDatasetChanged('settings', 'bulk');
      return true;
    } catch (err) {
      console.warn('Supabase deleteBuyer error:', err);
      return false;
    }
  }

  static async deleteUnit(unitNameOrId: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      const cleanStr = (unitNameOrId || '').trim();
      if (!cleanStr) return false;

      // Delete from dedicated public.factory_units table
      await client.from('factory_units').delete().eq('unit_name', cleanStr);
      await client.from('factory_units').delete().ilike('unit_name', cleanStr);
      await client.from('factory_units').delete().eq('id', cleanStr);
      await client.from('factory_units').delete().eq('id', `unit-${cleanStr.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
      this.notifyDatasetChanged('settings', 'bulk');
      return true;
    } catch (err) {
      console.warn('Supabase deleteUnit error:', err);
      return false;
    }
  }

  // ==========================================
  // 2. APP SETTINGS & UNIT CONFIGURATIONS (SEPARATED STRUCTURED TABLES)
  // ==========================================

  static async fetchSettings(forceRefresh: boolean = false): Promise<any | null> {
    if (!forceRefresh && this._settingsMemo && Date.now() - this._settingsMemo.ts < this.CLIENT_CACHE_TTL_MS) {
      return this._settingsMemo.data;
    }
    if (!forceRefresh && this._settingsInFlight) {
      return this._settingsInFlight;
    }

    const run = (async (): Promise<any | null> => {
      // 1. Primary path: shared 6-hour server RAM cache (eliminates repeated Base64 logo egress!)
      try {
        const res = await fetch(`/api/supabase-cache/settings${forceRefresh ? '?force=1' : ''}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000)
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.restricted) {
            this.markServiceRestricted(json.reason || 'Supabase project quota exceeded.');
            return null;
          }
          if (json?.success && json.settings) {
            this._settingsMemo = { ts: Date.now(), data: json.settings };
            return json.settings;
          }
        }
      } catch {}

      // 2. Direct Supabase fallback if server cache endpoint is unreachable
      const client = this.getClient();
      if (!client) return null;

      try {
        let structuredSettings: any = {};

        try {
          const { data: unitRows, error: unitErr } = await client
            .from('factory_units')
            .select('id,unit_name,production_capacity,total_machine,avg_prod_per_machine,target_efficiency,display_order')
            .order('display_order', { ascending: true });

          if (!unitErr && unitRows && unitRows.length > 0) {
            structuredSettings.unitConfigs = unitRows.map((u: any, idx: number) => ({
              id: u.id || `unit-${(u.unit_name || `u${idx}`).toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              name: u.unit_name,
              unitName: u.unit_name,
              capacityKgPerDay: Number(u.production_capacity) || 0,
              productionCapacity: Number(u.production_capacity) || 0,
              totalMachines: Number(u.total_machine) || 0,
              totalMachine: Number(u.total_machine) || 0,
              avgProdPerMachine: Number(u.avg_prod_per_machine) || 0,
              targetEfficiency: Number(u.target_efficiency) || 85,
              displayOrder: Number(u.display_order) || idx + 1
            }));
          }
        } catch (err) {
          console.warn('Error fetching factory_units:', err);
        }

        try {
          const { data: buyerRows, error: buyerErr } = await client
            .from('buyers')
            .select('buyer_name,status')
            .order('buyer_name', { ascending: true });

          if (!buyerErr && buyerRows && buyerRows.length > 0) {
            structuredSettings.buyers = buyerRows
              .filter((b: any) => b.status !== 'Inactive')
              .map((b: any) => b.buyer_name);
          }
        } catch (err) {
          console.warn('Error fetching buyers:', err);
        }

        try {
          const { data: sysRow, error: sysErr } = await client
            .from('system_settings')
            .select('reject_threshold,max_idle_machines,alarm_email,company_logo,my_logo')
            .eq('id', 'global_settings')
            .maybeSingle();

          if (!sysErr && sysRow) {
            structuredSettings.rejectThreshold = Number(sysRow.reject_threshold) || 2.5;
            structuredSettings.maxIdleMachines = Number(sysRow.max_idle_machines) || 5;
            structuredSettings.alarmEmail = sysRow.alarm_email || 'knitprod@epylliongroup.com';
            if (sysRow.company_logo) structuredSettings.companyLogo = sysRow.company_logo;
            if (sysRow.my_logo) structuredSettings.myLogo = sysRow.my_logo;
          }
        } catch (err) {
          console.warn('Error fetching system_settings:', err);
        }

        // Only hit legacy app_settings if logos/thresholds are still missing
        if (!structuredSettings.companyLogo || !structuredSettings.myLogo || structuredSettings.rejectThreshold === undefined) {
          try {
            const { data: appRow, error: appErr } = await client
              .from('app_settings')
              .select('settings_data')
              .eq('id', 'global_settings')
              .maybeSingle();

            if (!appErr && appRow?.settings_data) {
              const sd = appRow.settings_data;
              if (!structuredSettings.companyLogo && sd.companyLogo) structuredSettings.companyLogo = sd.companyLogo;
              if (!structuredSettings.myLogo && sd.myLogo) structuredSettings.myLogo = sd.myLogo;
              if (structuredSettings.rejectThreshold === undefined && sd.rejectThreshold) structuredSettings.rejectThreshold = Number(sd.rejectThreshold);
              if (structuredSettings.maxIdleMachines === undefined && sd.maxIdleMachines) structuredSettings.maxIdleMachines = Number(sd.maxIdleMachines);
              if (!structuredSettings.alarmEmail && sd.alarmEmail) structuredSettings.alarmEmail = sd.alarmEmail;
            }
          } catch {}
        }

        this._settingsMemo = { ts: Date.now(), data: structuredSettings };
        return structuredSettings;
      } catch {
        return null;
      }
    })();

    this._settingsInFlight = run.finally(() => {
      this._settingsInFlight = null;
    });
    return this._settingsInFlight;
  }

  static async saveSettings(settingsData: any): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      // 1. Sync to dedicated public.factory_units table if unitConfigs are present
      if (Array.isArray(settingsData.unitConfigs)) {
        try {
          const unitRows = settingsData.unitConfigs.map((u: any, idx: number) => {
            const rawName = (u.name || u.unitName || `Unit ${idx + 1}`).trim();
            const rawId = u.id && u.id.trim()
              ? u.id.trim()
              : `unit-${rawName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

            return {
              id: rawId,
              unit_name: rawName,
              production_capacity: Number(u.capacityKgPerDay ?? u.productionCapacity) || 0,
              total_machine: Number(u.totalMachines ?? u.totalMachine) || 0,
              avg_prod_per_machine: Number(u.avgProdPerMachine) || 0,
              target_efficiency: Number(u.targetEfficiency) || 85,
              display_order: Number(u.displayOrder) || idx + 1,
              updated_at: new Date().toISOString()
            };
          });

          // Upsert current valid units
          if (unitRows.length > 0) {
            await client.from('factory_units').upsert(unitRows, { onConflict: 'id' });
          }

          // Clean removed units from factory_units table
          const currentUnitNames = settingsData.unitConfigs.map((u: any) => (u.name || u.unitName || '').trim().toUpperCase());
          const { data: existingUnits } = await client.from('factory_units').select('id, unit_name');
          if (existingUnits && existingUnits.length > 0) {
            const unitsToDelete = existingUnits.filter((eu: any) => !currentUnitNames.includes((eu.unit_name || '').trim().toUpperCase()));
            for (const u of unitsToDelete) {
              await client.from('factory_units').delete().eq('id', u.id);
            }
          }
        } catch (unitErr) {
          console.warn('factory_units sync error:', unitErr);
        }
      }

      // 2. Sync to dedicated public.buyers table if buyers are present
      if (Array.isArray(settingsData.buyers)) {
        try {
          const buyerRows = settingsData.buyers.map((name: string) => ({
            id: `buy-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            buyer_name: name,
            status: 'Active',
            updated_at: new Date().toISOString()
          }));

          // Upsert current valid buyers
          if (buyerRows.length > 0) {
            await client.from('buyers').upsert(buyerRows, { onConflict: 'buyer_name' });
          }

          // Clean removed buyers from buyers table
          const currentBuyerNames = settingsData.buyers;
          const { data: existingBuyers } = await client.from('buyers').select('id, buyer_name');
          if (existingBuyers && existingBuyers.length > 0) {
            const buyersToDelete = existingBuyers.filter((eb: any) => !currentBuyerNames.includes(eb.buyer_name));
            for (const b of buyersToDelete) {
              await client.from('buyers').delete().eq('id', b.id);
            }
          }
        } catch (buyerErr) {
          console.warn('buyers sync error:', buyerErr);
        }
      }

      // 3. Sync to dedicated public.system_settings table (preserving existing fields on partial update)
      const hasSystemSettingsData = 
        settingsData.rejectThreshold !== undefined ||
        settingsData.maxIdleMachines !== undefined ||
        settingsData.alarmEmail !== undefined ||
        settingsData.companyLogo !== undefined ||
        settingsData.myLogo !== undefined;

      if (hasSystemSettingsData) {
        try {
          let existingSys: any = null;
          try {
            const { data } = await client.from('system_settings').select('*').eq('id', 'global_settings').maybeSingle();
            existingSys = data || null;
          } catch {}

          const sysRow: any = {
            id: 'global_settings',
            reject_threshold: settingsData.rejectThreshold !== undefined 
              ? Number(settingsData.rejectThreshold) 
              : (existingSys?.reject_threshold !== undefined ? Number(existingSys.reject_threshold) : 2.5),
            max_idle_machines: settingsData.maxIdleMachines !== undefined 
              ? Number(settingsData.maxIdleMachines) 
              : (existingSys?.max_idle_machines !== undefined ? Number(existingSys.max_idle_machines) : 5),
            alarm_email: settingsData.alarmEmail !== undefined 
              ? settingsData.alarmEmail 
              : (existingSys?.alarm_email || 'knitprod@epylliongroup.com'),
            company_logo: settingsData.companyLogo !== undefined 
              ? settingsData.companyLogo 
              : (existingSys?.company_logo || ''),
            my_logo: settingsData.myLogo !== undefined 
              ? settingsData.myLogo 
              : (existingSys?.my_logo || ''),
            updated_at: new Date().toISOString()
          };

          const { error: sysErr } = await client.from('system_settings').upsert(sysRow, { onConflict: 'id' });
          if (sysErr) {
            console.warn('system_settings upsert notice:', sysErr);
          }
        } catch (sysErr) {
          console.warn('system_settings sync error:', sysErr);
        }

        // 4. Also dual-sync to public.app_settings table as high-resilience fallback
        try {
          let existingApp: any = {};
          try {
            const { data } = await client.from('app_settings').select('*').eq('id', 'global_settings').maybeSingle();
            existingApp = data?.settings_data || {};
          } catch {}

          const mergedAppData = {
            ...existingApp,
            ...settingsData,
            updated_at: new Date().toISOString()
          };

          await client.from('app_settings').upsert({
            id: 'global_settings',
            settings_data: mergedAppData,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        } catch {
          // Fallback ignored
        }
      }

      this.notifyDatasetChanged('settings', 'bulk');
      return true;
    } catch (err) {
      console.warn('Supabase saveSettings exception:', err);
      return false;
    }
  }

  // ==========================================
  // 3. ACTIVITY LOGS (UNLIMITED AUDIT TRAIL)
  // ==========================================

  static async logActivity(activity: {
    userId: string;
    userName: string;
    action: string;
    details: string;
    floor?: string;
    timestamp?: string;
  }): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      const row = {
        user_id: activity.userId,
        user_name: activity.userName,
        action: activity.action,
        details: activity.details,
        floor: activity.floor || '',
        created_at: activity.timestamp || new Date().toISOString()
      };

      const { error } = await client.from('activity_logs').insert(row);
      if (!error) this._activityLogsMemo = null;
      return !error;
    } catch {
      return false;
    }
  }

  static async fetchActivityLogs(limitCount: number = 100, forceRefresh: boolean = false): Promise<any[]> {
    if (
      !forceRefresh &&
      this._activityLogsMemo &&
      this._activityLogsMemo.limit >= limitCount &&
      Date.now() - this._activityLogsMemo.ts < this.USERS_CACHE_TTL_MS
    ) {
      return this._activityLogsMemo.data.slice(0, limitCount);
    }

    const client = this.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('activity_logs')
        .select('id,user_id,user_name,action,details,floor,created_at')
        .order('created_at', { ascending: false })
        .limit(limitCount);

      if (error || !data) return [];
      const mapped = data.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        action: r.action,
        details: r.details,
        floor: r.floor,
        timestamp: r.created_at
      }));
      this._activityLogsMemo = { ts: Date.now(), limit: limitCount, data: mapped };
      return mapped;
    } catch {
      return [];
    }
  }

  // ==========================================
  // 4. PRODUCTION LEDGER (REAL-TIME MULTI-DEVICE CLOUD SYNC)
  // ==========================================

  /**
   * Helper to format date into ISO YYYY-MM-DD for standard SQL DATE / TEXT columns
   */
  static formatSqlDate(rawDate: any): string {
    if (!rawDate) return new Date().toISOString().split('T')[0];
    const s = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // Handle DD-MM-YYYY or DD/MM/YYYY
    const parts = s.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return s;
  }

  /**
   * Converts a Supabase PostgreSQL row into an app LedgerRecord
   */
  static mapRowToLedgerRecord(row: any): LedgerRecord {
    const raw = row.raw_data || {};
    return {
      id: String(row.id || ''),
      unit: row.unit || raw.unit || '',
      year: Number(row.year || raw.year || 2026),
      month: row.month || raw.month || '',
      date: row.date || raw.date || '',
      day: row.day || raw.day || '',
      floor: row.floor || raw.floor || '',
      target: Number(row.target ?? raw.target ?? 0),
      shiftA: Number(row.shift_a ?? raw.shiftA ?? 0),
      shiftB: Number(row.shift_b ?? raw.shiftB ?? 0),
      shiftC: Number(row.shift_c ?? raw.shiftC ?? 0),
      totalProduction: Number(row.total_production ?? raw.totalProduction ?? 0),
      targetBulk: Number(row.target_bulk ?? raw.targetBulk ?? 0),
      bulkProd: Number(row.bulk_prod ?? raw.bulkProd ?? 0),
      sampleProd: Number(row.sample_prod ?? raw.sampleProd ?? 0),
      totalMachines: Number(row.total_machines ?? raw.totalMachines ?? 0),
      runningMachine: Number(row.running_machine ?? raw.runningMachine ?? 0),
      runningBulk: Number(row.running_bulk ?? raw.runningBulk ?? 0),
      runningSample: Number(row.running_sample ?? raw.runningSample ?? 0),
      idleMc: Number(row.idle_mc ?? raw.idleMc ?? 0),
      machineUtilization: Number(row.machine_utilization ?? raw.machineUtilization ?? 0),
      idleMcPct: Number(row.idle_mc_pct ?? raw.idleMcPct ?? 0),
      prodLossForSample: Number(row.prod_loss_for_sample ?? raw.prodLossForSample ?? 0),
      idleProduction: Number(row.idle_production ?? raw.idleProduction ?? 0),
      efficiency: Number(row.efficiency ?? raw.efficiency ?? 0),
      proPerMc: Number(row.pro_per_mc ?? raw.proPerMc ?? 0),
      reject: Number(row.reject ?? raw.reject ?? 0),
      rejectPct: Number(row.reject_pct ?? raw.rejectPct ?? 0),
      hold: Number(row.hold ?? raw.hold ?? 0),
      holdPct: Number(row.hold_pct ?? raw.holdPct ?? 0),
      jhuteCutpcs: Number(row.jhute_cutpcs ?? raw.jhuteCutpcs ?? 0),
      jhuteCutpcsPct: Number(row.jhute_cutpcs_pct ?? raw.jhuteCutpcsPct ?? 0),
      needleBroken: Number(row.needle_broken ?? raw.needleBroken ?? 0),
      needlePerKg: Number(row.needle_per_kg ?? raw.needlePerKg ?? 0),
      sinkerBroken: Number(row.sinker_broken ?? raw.sinkerBroken ?? 0),
      sinkerPerKg: Number(row.sinker_per_kg ?? raw.sinkerPerKg ?? 0),
      oilConsumption: Number(row.oil_consumption ?? raw.oilConsumption ?? 0),
      beltBroken: Number(row.belt_broken ?? raw.beltBroken ?? 0),
      otherSparePartsName: row.other_spare_parts_name || raw.otherSparePartsName || '',
      otherSparePartsQty: Number(row.other_spare_parts_qty ?? raw.otherSparePartsQty ?? 0),
      setChangeNeedle: Number(row.set_change_needle ?? raw.setChangeNeedle ?? 0),
      setChangeSinker: Number(row.set_change_sinker ?? raw.setChangeSinker ?? 0),
      productionLossForEff: Number(row.production_loss_for_eff ?? raw.productionLossForEff ?? 0),
      capacityUtilization: Number(row.capacity_utilization ?? raw.capacityUtilization ?? 0),
      totalOperator: Number(row.total_operator ?? raw.totalOperator ?? 0),
      absent: Number(row.absent ?? raw.absent ?? 0),
      absentPct: Number(row.absent_pct ?? raw.absentPct ?? 0),
      productionFlatKnit: Number(row.production_flat_knit ?? raw.productionFlatKnit ?? 0),
      achievmentCircular: Number(row.achievment_circular ?? raw.achievmentCircular ?? 0),
      otd: String(row.otd ?? raw.otd ?? ''),
      yarnIssued: Number(row.yarn_issued ?? raw.yarnIssued ?? 0),
      totalRunningFactories: Number(row.total_running_factories ?? raw.totalRunningFactories ?? 0),
      numberVehicles: Number(row.number_vehicles ?? raw.numberVehicles ?? 0),
      fabricReturn: Number(row.fabric_return ?? raw.fabricReturn ?? 0),
      remarks: row.remarks || raw.remarks || '',
      updatedBy: row.updated_by || raw.updatedBy || '',
      createdAt: row.created_at || raw.createdAt,
      updatedAt: row.updated_at || raw.updatedAt
    };
  }

  /**
   * Converts an app LedgerRecord into a Supabase PostgreSQL row
   */
  static mapLedgerRecordToRow(record: LedgerRecord): Record<string, any> {
    const rawId = String(record.id || `rec-${record.date}-${(record.floor || record.unit || 'unit').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`);
    const otdNum = parseFloat(String(record.otd || 0)) || 0;

    return {
      id: rawId,
      unit: String(record.unit || ''),
      year: parseInt(String(record.year || 2026), 10) || 2026,
      month: String(record.month || ''),
      date: this.formatSqlDate(record.date),
      day: String(record.day || ''),
      floor: String(record.floor || ''),
      target: parseFloat(String(record.target || 0)) || 0,
      shift_a: parseFloat(String(record.shiftA || 0)) || 0,
      shift_b: parseFloat(String(record.shiftB || 0)) || 0,
      shift_c: parseFloat(String(record.shiftC || 0)) || 0,
      total_production: parseFloat(String(record.totalProduction || 0)) || 0,
      target_bulk: parseFloat(String(record.targetBulk || 0)) || 0,
      bulk_prod: parseFloat(String(record.bulkProd || 0)) || 0,
      sample_prod: parseFloat(String(record.sampleProd || 0)) || 0,
      total_machines: parseInt(String(record.totalMachines || 0), 10) || 0,
      running_machine: parseInt(String(record.runningMachine || 0), 10) || 0,
      running_bulk: parseInt(String(record.runningBulk || 0), 10) || 0,
      running_sample: parseInt(String(record.runningSample || 0), 10) || 0,
      idle_mc: parseInt(String(record.idleMc || 0), 10) || 0,
      machine_utilization: parseFloat(String(record.machineUtilization || 0)) || 0,
      idle_mc_pct: parseFloat(String(record.idleMcPct || 0)) || 0,
      prod_loss_for_sample: parseFloat(String(record.prodLossForSample || 0)) || 0,
      idle_production: parseFloat(String(record.idleProduction || 0)) || 0,
      efficiency: parseFloat(String(record.efficiency || 0)) || 0,
      pro_per_mc: parseFloat(String(record.proPerMc || 0)) || 0,
      reject: parseFloat(String(record.reject || 0)) || 0,
      reject_pct: parseFloat(String(record.rejectPct || 0)) || 0,
      hold: parseFloat(String(record.hold || 0)) || 0,
      hold_pct: parseFloat(String(record.holdPct || 0)) || 0,
      jhute_cutpcs: parseFloat(String(record.jhuteCutpcs || 0)) || 0,
      jhute_cutpcs_pct: parseFloat(String(record.jhuteCutpcsPct || 0)) || 0,
      needle_broken: parseFloat(String(record.needleBroken || 0)) || 0,
      needle_per_kg: parseFloat(String(record.needlePerKg || 0)) || 0,
      sinker_broken: parseFloat(String(record.sinkerBroken || 0)) || 0,
      sinker_per_kg: parseFloat(String(record.sinkerPerKg || 0)) || 0,
      oil_consumption: parseFloat(String(record.oilConsumption || 0)) || 0,
      belt_broken: parseFloat(String(record.beltBroken || 0)) || 0,
      other_spare_parts_name: String(record.otherSparePartsName || ''),
      other_spare_parts_qty: parseFloat(String(record.otherSparePartsQty || 0)) || 0,
      set_change_needle: parseFloat(String(record.setChangeNeedle || 0)) || 0,
      set_change_sinker: parseFloat(String(record.setChangeSinker || 0)) || 0,
      production_loss_for_eff: parseFloat(String(record.productionLossForEff || 0)) || 0,
      capacity_utilization: parseFloat(String(record.capacityUtilization || 0)) || 0,
      total_operator: parseFloat(String(record.totalOperator || 0)) || 0,
      absent: parseFloat(String(record.absent || 0)) || 0,
      absent_pct: parseFloat(String(record.absentPct || 0)) || 0,
      production_flat_knit: parseFloat(String(record.productionFlatKnit || 0)) || 0,
      achievment_circular: parseFloat(String(record.achievmentCircular || 0)) || 0,
      otd: otdNum,
      yarn_issued: parseFloat(String(record.yarnIssued || 0)) || 0,
      total_running_factories: parseInt(String(record.totalRunningFactories || 0), 10) || 0,
      number_vehicles: parseInt(String(record.numberVehicles || 0), 10) || 0,
      fabric_return: parseFloat(String(record.fabricReturn || 0)) || 0,
      remarks: String(record.remarks || ''),
      updated_by: String(record.updatedBy || ''),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Fetch all production ledger records from Supabase (paginated beyond 1,000-row PostgREST limit)
   */
  static async fetchProductionLedger(
    onProgress?: (loaded: number, total: number, percentage: number) => void,
    force: boolean = false
  ): Promise<LedgerRecord[]> {
    const TABLE = 'production_ledger';
    if (!force) {
      const memo = this._tableFetchMemo.get(TABLE);
      if (memo && Date.now() - memo.ts < this.CLIENT_CACHE_TTL_MS) {
        if (onProgress && memo.data.length > 0) onProgress(memo.data.length, memo.data.length, 100);
        return memo.data as LedgerRecord[];
      }
    }

    const flightKey = `${TABLE}:${force ? 'force' : 'normal'}`;
    if (this._tableInFlight.has(flightKey)) {
      return this._tableInFlight.get(flightKey)!;
    }

    const promise = (async (): Promise<LedgerRecord[]> => {
      this._failedTables.delete(TABLE);

      // 1. Try shared server RAM cache first (N users = 1 Supabase read, gzipped, slim columns)
      const serverRes = await this.fetchRowsViaServerCache(TABLE, { force });
      if (serverRes) {
        if (serverRes.restricted || !serverRes.ok) {
          this._failedTables.add(TABLE);
          return [];
        }
        const mapped = serverRes.rows.map((row) => this.mapRowToLedgerRecord(row));
        this._tableFetchMemo.set(TABLE, { ts: Date.now(), data: mapped, maxUpdatedAt: serverRes.maxUpdatedAt });
        if (onProgress && mapped.length > 0) onProgress(mapped.length, mapped.length, 100);
        return mapped;
      }

      // 2. Fallback: direct Supabase query using slim columns (no raw_data bloat)
      const client = this.getClient();
      if (!client) {
        this._failedTables.add(TABLE);
        return [];
      }

      try {
        const allRows: any[] = [];
        const BATCH_SIZE = 1000;
        let from = 0;
        let selectCols = this.getSelectColumns(TABLE);

        while (true) {
          const to = from + BATCH_SIZE - 1;
          const { data, error } = await client
            .from(TABLE)
            .select(selectCols)
            .order('date', { ascending: false })
            .range(from, to);

          if (error) {
            if (this.isQuotaOrRestrictionError(error)) {
              this._failedTables.add(TABLE);
              this.markServiceRestricted(error);
              return [];
            }
            if (selectCols !== '*' && (error.code === '42703' || error.code === 'PGRST204')) {
              this._tablesRequiringWildcard.add(TABLE);
              selectCols = '*';
              from = 0;
              allRows.length = 0;
              continue;
            }
            this._failedTables.add(TABLE);
            console.warn('Supabase fetchProductionLedger notice:', error.message);
            break;
          }

          if (!data || !Array.isArray(data) || data.length === 0) break;
          allRows.push(...data);
          if (onProgress) {
            const estTotal = data.length === BATCH_SIZE ? allRows.length + BATCH_SIZE : allRows.length;
            onProgress(allRows.length, estTotal, Math.min(99, Math.round((allRows.length / estTotal) * 100)));
          }
          if (data.length < BATCH_SIZE) break;
          from += BATCH_SIZE;
        }

        const mapped = allRows.map((row) => this.mapRowToLedgerRecord(row));
        this._tableFetchMemo.set(TABLE, { ts: Date.now(), data: mapped });
        if (onProgress && mapped.length > 0) onProgress(mapped.length, mapped.length, 100);
        return mapped;
      } catch (err) {
        this._failedTables.add(TABLE);
        console.warn('Supabase fetchProductionLedger error:', err);
        return [];
      }
    })().finally(() => {
      this._tableInFlight.delete(flightKey);
    });

    this._tableInFlight.set(flightKey, promise);
    return promise;
  }

  private static knownMissingColumns = new Set<string>();

  /**
   * Helper to strip known non-existent columns from a row before inserting to Supabase
   */
  private static sanitizeRowForSupabase(row: Record<string, any>): Record<string, any> {
    const sanitized = { ...row };
    for (const col of this.knownMissingColumns) {
      delete sanitized[col];
    }
    return sanitized;
  }

  /**
   * Save or update a single production ledger record in Supabase
   */
  static async saveProductionRecord(record: LedgerRecord): Promise<{ success: boolean; error?: string }> {
    if (this.isServiceRestricted()) {
      return { success: false, error: this.getServiceRestrictionReason() || 'Supabase service quota exceeded' };
    }
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client is not initialized or credentials missing.' };

    try {
      let row = this.sanitizeRowForSupabase(this.mapLedgerRecordToRow(record));
      
      let attempts = 0;
      while (attempts < 6) {
        attempts++;
        const { error } = await client.from('production_ledger').upsert(row, { onConflict: 'id' });
        if (!error) {
          this.notifyDatasetChanged('production_ledger', 'single', {
            eventType: 'UPDATE',
            record,
            id: String(row.id || record.id || '')
          });
          return { success: true };
        }

        if (this.isQuotaOrRestrictionError(error)) {
          this.markServiceRestricted(error);
          return { success: false, error: error.message };
        }

        const match = error.message?.match(/Could not find the '([^']+)' column/) ||
                      error.message?.match(/column "([^"]+)" of relation/) ||
                      error.message?.match(/column '([^']+)' does not exist/);

        if (match && match[1]) {
          const missingCol = match[1];
          this.knownMissingColumns.add(missingCol);
          delete row[missingCol];
          continue; // retry without missing column
        }

        console.warn('Supabase saveProductionRecord notice:', error.message || error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.warn('Supabase saveProductionRecord notice:', err?.message || String(err));
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Bulk save/upsert an array of production records into Supabase
   */
  static async bulkSaveProductionRecords(
    records: LedgerRecord[],
    onProgress?: (processed: number, total: number, percentage: number, stage?: string) => void
  ): Promise<{ success: boolean; count: number; error?: string }> {
    if (this.isServiceRestricted()) {
      return {
        success: false,
        count: 0,
        error: this.getServiceRestrictionReason() || 'Supabase service quota exceeded — using backup/local storage.'
      };
    }

    const client = this.getClient();
    if (!client) {
      return { success: false, count: 0, error: 'Supabase client is not initialized. Please verify your Project URL and Anon Key in Database Settings.' };
    }
    if (!records || records.length === 0) {
      return { success: true, count: 0 };
    }

    try {
      const rows = records.map(r => this.mapLedgerRecordToRow(r));
      
      const chunkSize = 200;
      let insertedCount = 0;

      if (onProgress) {
        onProgress(0, rows.length, 0, 'Starting upload to Supabase...');
      }

      for (let i = 0; i < rows.length; i += chunkSize) {
        if (this.isServiceRestricted()) {
          return {
            success: false,
            count: insertedCount,
            error: this.getServiceRestrictionReason() || 'Supabase service quota exceeded.'
          };
        }

        let chunk = rows.slice(i, i + chunkSize).map(r => this.sanitizeRowForSupabase(r));
        let chunkSuccess = false;
        let attempts = 0;

        while (!chunkSuccess && attempts < 8) {
          attempts++;
          const { error } = await client.from('production_ledger').upsert(chunk, { onConflict: 'id' });
          if (!error) {
            chunkSuccess = true;
            insertedCount += chunk.length;
            const pct = Math.min(100, Math.round((insertedCount / rows.length) * 100));
            if (onProgress) {
              onProgress(insertedCount, rows.length, pct, `Uploading ${insertedCount.toLocaleString()} / ${rows.length.toLocaleString()} records...`);
            }
            break;
          }

          if (this.isQuotaOrRestrictionError(error)) {
            this.markServiceRestricted(error);
            return {
              success: false,
              count: insertedCount,
              error: error.message
            };
          }

          const match = error.message?.match(/Could not find the '([^']+)' column/) ||
                        error.message?.match(/column "([^"]+)" of relation/) ||
                        error.message?.match(/column '([^']+)' does not exist/);

          if (match && match[1]) {
            const missingCol = match[1];
            this.knownMissingColumns.add(missingCol);
            // Prune missing column from all rows in current chunk
            chunk = chunk.map(r => {
              const copy = { ...r };
              delete copy[missingCol];
              return copy;
            });
            continue; // retry this chunk without the missing column
          }

          console.warn(`Supabase bulkSave chunk ${i} notice:`, error.message || error);
          return { 
            success: false, 
            count: insertedCount, 
            error: `Failed to insert chunk at row ${i}: ${error.message} (${error.code || ''})` 
          };
        }
      }

      if (onProgress) {
        onProgress(rows.length, rows.length, 100, 'Upload complete!');
      }

      this.notifyDatasetChanged('production_ledger', 'bulk');
      return { success: true, count: insertedCount };
    } catch (err: any) {
      console.warn('Supabase bulkSaveProductionRecords notice:', err?.message || String(err));
      return { success: false, count: 0, error: err.message || String(err) };
    }
  }

  /**
   * Delete a production record from Supabase
   */
  static async deleteProductionRecord(id: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      const { error } = await client.from('production_ledger').delete().eq('id', id);
      if (!error) this.notifyDatasetChanged('production_ledger', 'single', { eventType: 'DELETE', id });
      return !error;
    } catch (err) {
      console.warn('Supabase deleteProductionRecord error:', err);
      return false;
    }
  }

  /**
   * Real-time Multi-Device Broadcast Subscription (<50ms Live Updates, zero postgres_changes bulk storms)
   */
  static subscribeToProductionLedger(
    onRecordChange: (change: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: LedgerRecord; id: string }) => void
  ): () => void {
    return this.subscribeToTableRecordBroadcast<LedgerRecord>('production_ledger', onRecordChange);
  }

  // ==========================================
  // 6. YARN ALLOCATIONS CLOUD DATABASE & SYNC
  // ==========================================

  /**
   * Converts a Supabase PostgreSQL row into an app YarnAllocationRecord
   */
  static mapRowToYarnAllocation(row: any): YarnAllocationRecord {
    const raw = row.raw_data || {};
    return {
      id: String(row.id || raw.id || ''),
      actualRequisitionDate: row.actual_requisition_date || raw.actualRequisitionDate || '',
      buyer: row.buyer || raw.buyer || '',
      orderNumber: row.order_number || raw.orderNumber || '',
      fabricsType: row.fabrics_type || raw.fabricsType || '',
      fabricShade: row.fabric_shade || raw.fabricShade || '',
      fabricGsm: row.fabric_gsm || raw.fabricGsm || '',
      yarnRequired: row.yarn_required || raw.yarnRequired || '',
      lotRef: row.lot_ref || raw.lotRef || '',
      allocatedYarn: row.allocated_yarn || raw.allocatedYarn || '',
      lotNo: row.lot_no || raw.lotNo || '',
      spinnersName: row.spinners_name || raw.spinnersName || '',
      allocationStatus: row.allocation_status || raw.allocationStatus || '',
      yarnStockStatus: row.yarn_stock_status || raw.yarnStockStatus || '',
      yarnDeliveryStatus: row.yarn_delivery_status || raw.yarnDeliveryStatus || '',
      proposedAllocationDate: row.proposed_allocation_date || raw.proposedAllocationDate || '',
      allocationDateRange: row.allocation_date_range || raw.allocationDateRange || '',
      allocationNo: row.allocation_no || raw.allocationNo || '',
      yarnRqQty: parseFloat(String(row.yarn_rq_qty ?? raw.yarnRqQty ?? 0)) || 0,
      allocatedQty: parseFloat(String(row.allocated_qty ?? raw.allocatedQty ?? 0)) || 0,
      balance: parseFloat(String(row.balance ?? raw.balance ?? 0)) || 0,
      remarks: row.remarks || raw.remarks || '',
      updatedBy: row.updated_by || raw.updatedBy || '',
      createdAt: row.created_at || raw.createdAt,
      updatedAt: row.updated_at || raw.updatedAt
    };
  }

  /**
   * Converts an app YarnAllocationRecord into a Supabase PostgreSQL row
   */
  static mapYarnAllocationToRow(item: YarnAllocationRecord): Record<string, any> {
    const rawId = String(item.id || item.allocationNo || `yarn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
    return {
      id: rawId,
      actual_requisition_date: String(item.actualRequisitionDate || ''),
      buyer: String(item.buyer || ''),
      order_number: String(item.orderNumber || ''),
      fabrics_type: String(item.fabricsType || ''),
      fabric_shade: String(item.fabricShade || ''),
      fabric_gsm: String(item.fabricGsm || ''),
      yarn_required: String(item.yarnRequired || ''),
      lot_ref: String(item.lotRef || ''),
      allocated_yarn: String(item.allocatedYarn || ''),
      lot_no: String(item.lotNo || ''),
      spinners_name: String(item.spinnersName || ''),
      allocation_status: String(item.allocationStatus || ''),
      yarn_stock_status: String(item.yarnStockStatus || ''),
      yarn_delivery_status: String(item.yarnDeliveryStatus || ''),
      proposed_allocation_date: String(item.proposedAllocationDate || ''),
      allocation_date_range: String(item.allocationDateRange || ''),
      allocation_no: String(item.allocationNo || ''),
      yarn_rq_qty: parseFloat(String(item.yarnRqQty || 0)) || 0,
      allocated_qty: parseFloat(String(item.allocatedQty || 0)) || 0,
      balance: parseFloat(String(item.balance || 0)) || 0,
      remarks: String(item.remarks || ''),
      updated_by: String(item.updatedBy || ''),
      raw_data: {},
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Fetch all Yarn Allocations from Supabase (shared server cache first, slim columns)
   */
  static async fetchYarnAllocations(
    onProgress?: (loaded: number, total: number, percentage: number) => void,
    force: boolean = false
  ): Promise<YarnAllocationRecord[]> {
    const TABLE = 'yarn_allocations';
    if (!force) {
      const memo = this._tableFetchMemo.get(TABLE);
      if (memo && Date.now() - memo.ts < this.CLIENT_CACHE_TTL_MS) {
        if (onProgress && memo.data.length > 0) onProgress(memo.data.length, memo.data.length, 100);
        return memo.data as YarnAllocationRecord[];
      }
    }

    const flightKey = `${TABLE}:${force ? 'force' : 'normal'}`;
    if (this._tableInFlight.has(flightKey)) {
      return this._tableInFlight.get(flightKey)!;
    }

    const promise = (async (): Promise<YarnAllocationRecord[]> => {
      this._failedTables.delete(TABLE);

      const serverRes = await this.fetchRowsViaServerCache(TABLE, { force });
      if (serverRes) {
        if (serverRes.restricted || !serverRes.ok) {
          this._failedTables.add(TABLE);
          return [];
        }
        const mapped = serverRes.rows.map(row => this.mapRowToYarnAllocation(row));
        this._tableFetchMemo.set(TABLE, { ts: Date.now(), data: mapped, maxUpdatedAt: serverRes.maxUpdatedAt });
        if (onProgress && mapped.length > 0) onProgress(mapped.length, mapped.length, 100);
        return mapped;
      }

      const client = this.getClient();
      if (!client) {
        this._failedTables.add(TABLE);
        return [];
      }

      try {
        const allRows: any[] = [];
        const BATCH_SIZE = 1000;
        let from = 0;
        let selectCols = this.getSelectColumns(TABLE);

        while (true) {
          const to = from + BATCH_SIZE - 1;
          const { data, error } = await client
            .from(TABLE)
            .select(selectCols)
            .order('id', { ascending: false })
            .range(from, to);

          if (error) {
            if (this.isQuotaOrRestrictionError(error)) {
              this._failedTables.add(TABLE);
              this.markServiceRestricted(error);
              return [];
            }
            if (selectCols !== '*' && (error.code === '42703' || error.code === 'PGRST204')) {
              this._tablesRequiringWildcard.add(TABLE);
              selectCols = '*';
              from = 0;
              allRows.length = 0;
              continue;
            }
            if (error.code !== '42P01' && error.code !== 'PGRST205' && !error.message?.includes('schema cache')) {
              this._failedTables.add(TABLE);
              console.warn('Supabase fetchYarnAllocations notice:', error.message);
            }
            break;
          }

          if (!data || !Array.isArray(data) || data.length === 0) break;
          allRows.push(...data);
          if (onProgress) {
            const estTotal = data.length === BATCH_SIZE ? allRows.length + BATCH_SIZE : allRows.length;
            onProgress(allRows.length, estTotal, Math.min(99, Math.round((allRows.length / estTotal) * 100)));
          }
          if (data.length < BATCH_SIZE) break;
          from += BATCH_SIZE;
        }

        const mapped = allRows.map(row => this.mapRowToYarnAllocation(row));
        this._tableFetchMemo.set(TABLE, { ts: Date.now(), data: mapped });
        if (onProgress && mapped.length > 0) onProgress(mapped.length, mapped.length, 100);
        return mapped;
      } catch (err) {
        this._failedTables.add(TABLE);
        console.warn('Supabase fetchYarnAllocations exception:', err);
        return [];
      }
    })().finally(() => {
      this._tableInFlight.delete(flightKey);
    });

    this._tableInFlight.set(flightKey, promise);
    return promise;
  }

  /**
   * Save or update a single yarn allocation record in Supabase
   */
  static async saveYarnAllocation(item: YarnAllocationRecord): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client is not initialized or credentials missing.' };

    try {
      let row = this.sanitizeRowForSupabase(this.mapYarnAllocationToRow(item));
      
      let attempts = 0;
      while (attempts < 6) {
        attempts++;
        const { error } = await client.from('yarn_allocations').upsert(row, { onConflict: 'id' });
        if (!error) {
          this.notifyDatasetChanged('yarn_allocations', 'single', {
            eventType: 'UPDATE',
            record: item,
            id: String(row.id || item.id || '')
          });
          return { success: true };
        }

        if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
          return {
            success: false,
            error: "Table 'public.yarn_allocations' does not exist in Supabase yet. Please run the Yarn Allocations SQL script in your Supabase SQL Editor."
          };
        }

        const match = error.message?.match(/Could not find the '([^']+)' column/) ||
                      error.message?.match(/column "([^"]+)" of relation/) ||
                      error.message?.match(/column '([^']+)' does not exist/);

        if (match && match[1]) {
          const missingCol = match[1];
          this.knownMissingColumns.add(missingCol);
          delete row[missingCol];
          continue;
        }

        console.warn('Supabase saveYarnAllocation notice:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.warn('Supabase saveYarnAllocation exception:', err.message || String(err));
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Purge all yarn allocation records from Supabase (used when replacing entire dataset)
   */
  static async deleteAllYarnAllocations(): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;
    try {
      const { error } = await client
        .from('yarn_allocations')
        .delete()
        .neq('id', '___PURGE_ALL_PREVIOUS_RECORDS___');
      if (error && error.code !== 'PGRST205' && error.code !== '42P01') {
        console.warn('Supabase deleteAllYarnAllocations notice:', error.message);
      }
      return !error;
    } catch (err) {
      console.warn('Supabase deleteAllYarnAllocations error:', err);
      return false;
    }
  }

  /**
   * Bulk save/upsert an array of yarn allocation records into Supabase.
   * If replace = true, purges all previous records from public.yarn_allocations before inserting the new dataset.
   */
  static async bulkSaveYarnAllocations(
    items: YarnAllocationRecord[], 
    replace: boolean = false,
    onProgress?: (processed: number, total: number, percentage: number, stage?: string) => void
  ): Promise<{ success: boolean; count: number; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, count: 0, error: 'Supabase client is not initialized. Please verify your Project URL and Anon Key in Database Settings.' };
    }

    try {
      if (onProgress) {
        onProgress(0, items?.length || 0, 0, replace ? 'Purging previous records from Supabase...' : 'Preparing upload...');
      }

      // If replace is requested, purge all previous records from Supabase public.yarn_allocations
      if (replace) {
        try {
          const { error: delError } = await client
            .from('yarn_allocations')
            .delete()
            .neq('id', '___PURGE_ALL_PREVIOUS_RECORDS___');
          if (delError && delError.code !== 'PGRST205' && delError.code !== '42P01') {
            console.warn('Supabase purge yarn_allocations notice:', delError.message);
          }
        } catch (delErr: any) {
          console.warn('Supabase purge yarn_allocations exception:', delErr);
        }
      }

      if (!items || items.length === 0) {
        return { success: true, count: 0 };
      }

      const rows = items.map(y => this.mapYarnAllocationToRow(y));
      const chunkSize = 250;
      let insertedCount = 0;

      for (let i = 0; i < rows.length; i += chunkSize) {
        let chunk = rows.slice(i, i + chunkSize).map(r => this.sanitizeRowForSupabase(r));
        let chunkSuccess = false;
        let attempts = 0;

        while (!chunkSuccess && attempts < 8) {
          attempts++;
          const { error } = await client.from('yarn_allocations').upsert(chunk, { onConflict: 'id' });
          if (!error) {
            chunkSuccess = true;
            insertedCount += chunk.length;
            const pct = Math.min(100, Math.round((insertedCount / rows.length) * 100));
            if (onProgress) {
              onProgress(insertedCount, rows.length, pct, `Uploading ${insertedCount.toLocaleString()} / ${rows.length.toLocaleString()} records to Supabase...`);
            }
            break;
          }

          if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
            return { 
              success: false, 
              count: insertedCount, 
              error: "Table 'public.yarn_allocations' was not found in your Supabase database schema cache. Please copy and run the Yarn Allocations SQL script in your Supabase SQL Editor first." 
            };
          }

          const match = error.message?.match(/Could not find the '([^']+)' column/) ||
                        error.message?.match(/column "([^"]+)" of relation/) ||
                        error.message?.match(/column '([^']+)' does not exist/);

          if (match && match[1]) {
            const missingCol = match[1];
            this.knownMissingColumns.add(missingCol);
            chunk = chunk.map(r => {
              const copy = { ...r };
              delete copy[missingCol];
              return copy;
            });
            continue;
          }

          console.warn(`Supabase bulkSaveYarnAllocations chunk ${i} notice:`, error.message);
          return { 
            success: false, 
            count: insertedCount, 
            error: `Failed to insert chunk at row ${i}: ${error.message} (${error.code || ''})` 
          };
        }
      }

      if (onProgress) {
        onProgress(rows.length, rows.length, 100, 'Upload complete!');
      }

      this.notifyDatasetChanged('yarn_allocations', 'bulk');
      return { success: true, count: insertedCount };
    } catch (err: any) {
      console.warn('Supabase bulkSaveYarnAllocations notice:', err.message || String(err));
      return { success: false, count: 0, error: err.message || String(err) };
    }
  }

  /**
   * Delete a yarn allocation record from Supabase
   */
  static async deleteYarnAllocation(id: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      const { error } = await client.from('yarn_allocations').delete().eq('id', id);
      if (!error) this.notifyDatasetChanged('yarn_allocations', 'single', { eventType: 'DELETE', id });
      return !error;
    } catch (err) {
      console.warn('Supabase deleteYarnAllocation error:', err);
      return false;
    }
  }

  /**
   * Real-time Multi-Device Broadcast Subscription for Yarn Allocations (zero postgres_changes bulk storms)
   */
  static subscribeToYarnAllocations(
    onRecordChange: (change: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: YarnAllocationRecord; id: string }) => void
  ): () => void {
    return this.subscribeToTableRecordBroadcast<YarnAllocationRecord>('yarn_allocations', onRecordChange);
  }

  // ==========================================
  // 7. ORDER PLANS & STATUS (PLAN ORDER FOLLOWUP)
  // ==========================================

  /**
   * Converts a Supabase PostgreSQL row into an app OrderPlan
   */
  static mapRowToOrderPlan(row: any): OrderPlan {
    const raw = row.raw_data || {};
    const ewoVal = row.ewo || raw.ewo || '';
    const colVal = row.color || raw.color || '';
    const idVal = row.id && String(row.id).trim()
      ? String(row.id).trim()
      : (raw.id && String(raw.id).trim()
          ? String(raw.id).trim()
          : getOrderPlanCanonicalId({ ewo: ewoVal, color: colVal }));
    return {
      id: idVal,
      planMonth: row.plan_month || raw.planMonth || '',
      planType: row.plan_type || raw.planType || '',
      ewo: ewoVal,
      buyer: row.buyer || raw.buyer || '',
      color: colVal,
      knitStart: row.knit_start || raw.knitStart || '',
      knitEnd: row.knit_end || raw.knitEnd || '',
      target: parseFloat(String(row.target ?? raw.target ?? 0)) || 0,
      targetNextMonth: parseFloat(String(row.target_next_month ?? raw.targetNextMonth ?? 0)) || 0,
      allocationStart: row.allocation_start || raw.allocationStart || '',
      allocationEnd: row.allocation_end || raw.allocationEnd || '',
      allocatedQty: parseFloat(String(row.allocated_qty ?? raw.allocatedQty ?? 0)) || 0,
      allocatedBal: parseFloat(String(row.allocated_bal ?? raw.allocatedBal ?? 0)) || 0,
      greyReq: parseFloat(String(row.grey_req ?? raw.greyReq ?? 0)) || 0,
      knitPro: parseFloat(String(row.knit_pro ?? raw.knitPro ?? 0)) || 0,
      knitBal: parseFloat(String(row.knit_bal ?? raw.knitBal ?? 0)) || 0,
      aKnitStart: row.a_knit_start || raw.aKnitStart || '',
      lastProductionDate: row.last_production_date || raw.lastProductionDate || '',
      avgProdDay: parseFloat(String(row.avg_prod_day ?? raw.avgProdDay ?? 0)) || 0,
      expectedKnitEnd: row.expected_knit_end || raw.expectedKnitEnd || '',
      knitStartOtd: (row.knit_start_otd || raw.knitStartOtd || 'Pending') as any,
      knitEndOtd: (row.knit_end_otd || raw.knitEndOtd || 'Pending') as any,
      knitStartRemarks: row.knit_start_remarks || raw.knitStartRemarks || '',
      knitEndRemarks: row.knit_end_remarks || raw.knitEndRemarks || '',
      knitTeamLeaders: row.knit_team_leaders || raw.knitTeamLeaders || '',
      updatedBy: row.updated_by || raw.updatedBy || '',
      createdAt: row.created_at || raw.createdAt,
      updatedAt: row.updated_at || raw.updatedAt
    };
  }

  /**
   * Converts an app OrderPlan into a Supabase PostgreSQL row
   */
  static mapOrderPlanToRow(item: OrderPlan): Record<string, any> {
    const rawId = item.id && String(item.id).trim() ? String(item.id).trim() : getOrderPlanCanonicalId(item);
    return {
      id: rawId,
      plan_month: String(item.planMonth || ''),
      plan_type: String(item.planType || ''),
      ewo: String(item.ewo || ''),
      buyer: String(item.buyer || ''),
      color: String(item.color || ''),
      knit_start: String(item.knitStart || ''),
      knit_end: String(item.knitEnd || ''),
      target: parseFloat(String(item.target || 0)) || 0,
      target_next_month: parseFloat(String(item.targetNextMonth || 0)) || 0,
      allocation_start: String(item.allocationStart || ''),
      allocation_end: String(item.allocationEnd || ''),
      allocated_qty: parseFloat(String(item.allocatedQty || 0)) || 0,
      allocated_bal: parseFloat(String(item.allocatedBal || 0)) || 0,
      grey_req: parseFloat(String(item.greyReq || 0)) || 0,
      knit_pro: parseFloat(String(item.knitPro || 0)) || 0,
      knit_bal: parseFloat(String(item.knitBal || 0)) || 0,
      a_knit_start: String(item.aKnitStart || ''),
      last_production_date: String(item.lastProductionDate || ''),
      avg_prod_day: parseFloat(String(item.avgProdDay || 0)) || 0,
      expected_knit_end: String(item.expectedKnitEnd || ''),
      knit_start_otd: String(item.knitStartOtd || 'Pending'),
      knit_end_otd: String(item.knitEndOtd || 'Pending'),
      knit_start_remarks: String(item.knitStartRemarks || ''),
      knit_end_remarks: String(item.knitEndRemarks || ''),
      knit_team_leaders: String(item.knitTeamLeaders || ''),
      updated_by: String(item.updatedBy || ''),
      raw_data: {},
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Fetch all Order Plans from Supabase (shared server cache first, slim columns)
   */
  static async fetchOrderPlans(
    onProgress?: (loaded: number, total: number, percentage: number) => void,
    force: boolean = false
  ): Promise<OrderPlan[]> {
    const TABLE = 'order_plans';
    if (!force) {
      const memo = this._tableFetchMemo.get(TABLE);
      if (memo && Date.now() - memo.ts < this.CLIENT_CACHE_TTL_MS) {
        if (onProgress && memo.data.length > 0) onProgress(memo.data.length, memo.data.length, 100);
        return memo.data as OrderPlan[];
      }
    }

    const flightKey = `${TABLE}:${force ? 'force' : 'normal'}`;
    if (this._tableInFlight.has(flightKey)) {
      return this._tableInFlight.get(flightKey)!;
    }

    const promise = (async (): Promise<OrderPlan[]> => {
      this._failedTables.delete(TABLE);

      const serverRes = await this.fetchRowsViaServerCache(TABLE, { force });
      if (serverRes) {
        if (serverRes.restricted || !serverRes.ok) {
          this._failedTables.add(TABLE);
          return [];
        }
        const mapped = deduplicateOrderPlans(serverRes.rows.map(row => this.mapRowToOrderPlan(row)));
        this._tableFetchMemo.set(TABLE, { ts: Date.now(), data: mapped, maxUpdatedAt: serverRes.maxUpdatedAt });
        if (onProgress && mapped.length > 0) onProgress(mapped.length, mapped.length, 100);
        return mapped;
      }

      const client = this.getClient();
      if (!client) {
        this._failedTables.add(TABLE);
        return [];
      }

      try {
        const allRows: any[] = [];
        const BATCH_SIZE = 1000;
        let from = 0;
        let selectCols = this.getSelectColumns(TABLE);

        while (true) {
          const to = from + BATCH_SIZE - 1;
          const { data, error } = await client
            .from(TABLE)
            .select(selectCols)
            .order('id', { ascending: false })
            .range(from, to);

          if (error) {
            if (this.isQuotaOrRestrictionError(error)) {
              this._failedTables.add(TABLE);
              this.markServiceRestricted(error);
              return [];
            }
            if (selectCols !== '*' && (error.code === '42703' || error.code === 'PGRST204')) {
              this._tablesRequiringWildcard.add(TABLE);
              selectCols = '*';
              from = 0;
              allRows.length = 0;
              continue;
            }
            this._failedTables.add(TABLE);
            if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
              return [];
            }
            console.warn('Supabase fetchOrderPlans notice:', error.message);
            break;
          }

          if (!data || !Array.isArray(data) || data.length === 0) break;
          allRows.push(...data);
          if (onProgress) {
            const estTotal = data.length === BATCH_SIZE ? allRows.length + BATCH_SIZE : allRows.length;
            onProgress(allRows.length, estTotal, Math.min(99, Math.round((allRows.length / estTotal) * 100)));
          }
          if (data.length < BATCH_SIZE) break;
          from += BATCH_SIZE;
        }

        const mapped = deduplicateOrderPlans(allRows.map(row => this.mapRowToOrderPlan(row)));
        this._tableFetchMemo.set(TABLE, { ts: Date.now(), data: mapped });
        if (onProgress && mapped.length > 0) onProgress(mapped.length, mapped.length, 100);
        return mapped;
      } catch (err) {
        this._failedTables.add(TABLE);
        console.warn('Supabase fetchOrderPlans exception:', err);
        return [];
      }
    })().finally(() => {
      this._tableInFlight.delete(flightKey);
    });

    this._tableInFlight.set(flightKey, promise);
    return promise;
  }

  /**
   * Save or update a single order plan record in Supabase
   */
  static async saveOrderPlan(item: OrderPlan): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client is not initialized or credentials missing.' };

    try {
      let row = this.sanitizeRowForSupabase(this.mapOrderPlanToRow(item));
      let attempts = 0;
      while (attempts < 6) {
        attempts++;
        const { error } = await client.from('order_plans').upsert(row, { onConflict: 'id' });
        if (!error) {
          this.notifyDatasetChanged('order_plans', 'single', {
            eventType: 'UPDATE',
            record: item,
            id: String(row.id || item.id || '')
          });
          return { success: true };
        }

        if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
          return {
            success: false,
            error: "Table 'public.order_plans' does not exist in Supabase yet. Please run the Order Plans SQL script in your Supabase SQL Editor."
          };
        }

        const match = error.message?.match(/Could not find the '([^']+)' column/) ||
                      error.message?.match(/column "([^"]+)" of relation/) ||
                      error.message?.match(/column '([^']+)' does not exist/);

        if (match && match[1]) {
          const missingCol = match[1];
          this.knownMissingColumns.add(missingCol);
          delete row[missingCol];
          continue;
        }

        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.warn('Supabase saveOrderPlan exception:', err.message || String(err));
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Purge all order plans from Supabase (used during full replace sync)
   */
  static async deleteAllOrderPlans(): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;
    try {
      const { error } = await client
        .from('order_plans')
        .delete()
        .neq('id', '___PURGE_ALL_PREVIOUS_RECORDS___');
      if (error && error.code !== 'PGRST205' && error.code !== '42P01') {
        console.warn('Supabase deleteAllOrderPlans notice:', error.message);
      }
      return !error;
    } catch (err) {
      console.warn('Supabase deleteAllOrderPlans error:', err);
      return false;
    }
  }

  /**
   * Bulk save/upsert an array of Order Plans into Supabase.
   * If replace = true, purges previous rows before inserting.
   */
  static async bulkSaveOrderPlans(
    items: OrderPlan[],
    replace: boolean = false,
    onProgress?: (processed: number, total: number, percentage: number, stage?: string) => void
  ): Promise<{ success: boolean; count: number; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, count: 0, error: 'Supabase client is not initialized. Please verify your Project URL and Anon Key in Database Settings.' };
    }

    try {
      if (onProgress) {
        onProgress(0, items?.length || 0, 0, replace ? 'Purging previous order plans from Supabase...' : 'Preparing order plans upload...');
      }

      if (replace) {
        try {
          const { error: delError } = await client
            .from('order_plans')
            .delete()
            .neq('id', '___PURGE_ALL_PREVIOUS_RECORDS___');
          if (delError && delError.code !== 'PGRST205' && delError.code !== '42P01') {
            console.warn('Supabase purge order_plans notice:', delError.message);
          }
        } catch (delErr: any) {
          console.warn('Supabase purge order_plans exception:', delErr);
        }
      }

      if (!items || items.length === 0) {
        return { success: true, count: 0 };
      }

      const cleanItems = deduplicateOrderPlans(items);
      const rows = cleanItems.map(o => this.mapOrderPlanToRow(o));
      const chunkSize = 200;
      let insertedCount = 0;

      for (let i = 0; i < rows.length; i += chunkSize) {
        let chunk = rows.slice(i, i + chunkSize).map(r => this.sanitizeRowForSupabase(r));
        let chunkSuccess = false;
        let attempts = 0;

        while (!chunkSuccess && attempts < 8) {
          attempts++;
          const { error } = await client.from('order_plans').upsert(chunk, { onConflict: 'id' });
          if (!error) {
            chunkSuccess = true;
            insertedCount += chunk.length;
            const pct = Math.min(100, Math.round((insertedCount / rows.length) * 100));
            if (onProgress) {
              onProgress(insertedCount, rows.length, pct, `Uploading ${insertedCount.toLocaleString()} / ${rows.length.toLocaleString()} orders to Supabase...`);
            }
            break;
          }

          if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
            return {
              success: false,
              count: insertedCount,
              error: "Table 'public.order_plans' was not found in your Supabase database schema cache. Please copy and run the Plan Order Followup SQL script in your Supabase SQL Editor first."
            };
          }

          const match = error.message?.match(/Could not find the '([^']+)' column/) ||
                        error.message?.match(/column "([^"]+)" of relation/) ||
                        error.message?.match(/column '([^']+)' does not exist/);

          if (match && match[1]) {
            const missingCol = match[1];
            this.knownMissingColumns.add(missingCol);
            chunk = chunk.map(r => {
              const cp = { ...r };
              delete cp[missingCol];
              return cp;
            });
            continue;
          }

          console.warn(`Supabase bulkSaveOrderPlans chunk ${i} notice:`, error.message);
          return {
            success: false,
            count: insertedCount,
            error: `Failed to insert orders chunk at row ${i}: ${error.message} (${error.code || ''})`
          };
        }
      }

      if (onProgress) {
        onProgress(rows.length, rows.length, 100, 'Order Plans upload complete!');
      }

      this.notifyDatasetChanged('order_plans', 'bulk');
      return { success: true, count: insertedCount };
    } catch (err: any) {
      console.warn('Supabase bulkSaveOrderPlans notice:', err.message || String(err));
      return { success: false, count: 0, error: err.message || String(err) };
    }
  }

  /**
   * Delete an order plan from Supabase
   */
  static async deleteOrderPlan(id: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      const { error } = await client.from('order_plans').delete().or(`id.eq.${id},ewo.eq.${id}`);
      if (!error) this.notifyDatasetChanged('order_plans', 'single', { eventType: 'DELETE', id });
      return !error;
    } catch (err) {
      console.warn('Supabase deleteOrderPlan error:', err);
      return false;
    }
  }

  /**
   * Real-time Multi-Device Broadcast Subscription for Order Plans (zero postgres_changes bulk storms)
   */
  static subscribeToOrderPlans(
    onRecordChange: (change: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: OrderPlan; id: string }) => void
  ): () => void {
    return this.subscribeToTableRecordBroadcast<OrderPlan>('order_plans', onRecordChange);
  }

  // ==========================================
  // 8. KNITTING ORDERS & FABRICS (LAYERED STATUS)
  // ==========================================

  static mapRowToKnittingOrder(row: any): KnittingStatusOrder {
    const raw = row.raw_data || {};
    const ordNo = String(row.order_no || raw.orderNo || '').trim();
    let kStart = row.knit_start_date || raw.knitStartDate || '';
    let kEnd = row.knit_end_date || raw.knitEndDate || '';
    if (kStart === '19-Sep-2026' || kStart === '19-09-2026') kStart = '20-Sep-2026';
    if (kEnd === '21-Sep-2026' || kEnd === '21-09-2026') kEnd = '22-Sep-2026';

    const pmcStart = raw.pmcKnitStartDate || row.pmc_knit_start_date || '';
    const pmcEnd = raw.pmcKnitEndDate || row.pmc_knit_end_date || '';
    const totalProd = parseFloat(String(row.production ?? raw.production ?? 0)) || 0;
    const greyQty = parseFloat(String(row.grey_qty ?? raw.greyQty ?? 0)) || 0;
    const knitBal = parseFloat(String(row.knit_balance ?? raw.knitBalance ?? (greyQty - totalProd))) || 0;
    const isComplete = knitBal < 3 || (totalProd > 0 && totalProd >= greyQty);

    // If order has no production activity, it has not started yet -> no actual dates!
    const actStart = (totalProd > 0)
      ? (raw.actualKnitStartDate || row.actual_knit_start_date || (kStart && kStart !== pmcStart ? kStart : ''))
      : '';
    const actEnd = (totalProd > 0)
      ? (raw.actualKnitEndDate || row.actual_knit_end_date || (kEnd && kEnd !== pmcEnd ? kEnd : ''))
      : '';
    const otd = raw.otdStatus || row.otd_status || 'Pending';
    const sOtd = raw.knitStartOtd || row.knit_start_otd || 'Pending';
    const eOtd = raw.knitEndOtd || row.knit_end_otd || 'Pending';

    const rawItems: any[] = Array.isArray(row.items) ? row.items : (raw.items || []);
    const items = rawItems.map(itm => {
      const itmProd = Number(itm.production || 0);
      const itmHold = Number(itm.hold || 0);
      const itmGrey = Number(itm.greyQty || 0);
      const hasAct = (itmProd > 0) || (itmHold > 0);
      const itmBal = Number(itm.knitBalance ?? (itmGrey - itmProd));
      const itmIsComplete = itmBal < 3 || (itmProd > 0 && itmProd >= itmGrey);
      let itmStart = itm.knitStartDate || '';
      let itmEnd = itm.knitEndDate || '';
      if (itmStart === '19-Sep-2026' || itmStart === '19-09-2026') itmStart = '20-Sep-2026';
      if (itmEnd === '21-Sep-2026' || itmEnd === '21-09-2026') itmEnd = '22-Sep-2026';

      const itmPmcStart = itm.pmcKnitStartDate || pmcStart;
      const itmPmcEnd = itm.pmcKnitEndDate || pmcEnd;
      const itmActStart = hasAct
        ? (itm.actualKnitStartDate || (itmStart && itmStart !== itmPmcStart ? itmStart : actStart))
        : '';
      const itmActEnd = hasAct
        ? (itm.actualKnitEndDate || (itmEnd && itmEnd !== itmPmcEnd ? itmEnd : actEnd))
        : '';

      return {
        ...itm,
        pmcKnitStartDate: itmPmcStart,
        pmcKnitEndDate: itmPmcEnd,
        actualKnitStartDate: itmActStart,
        actualKnitEndDate: itmActEnd,
        knitStartDate: itmActStart || itmPmcStart || (hasAct ? itmStart : ''),
        knitEndDate: itmActEnd || itmPmcEnd || (hasAct ? itmEnd : ''),
        knitStartOtd: itm.knitStartOtd || sOtd,
        knitEndOtd: itm.knitEndOtd || eOtd,
        otdStatus: itm.otdStatus || otd
      };
    });

    return {
      id: String(row.id || raw.id || row.order_no || raw.orderNo || ''),
      orderNo: ordNo,
      buyerName: row.buyer_name || raw.buyerName || '',
      teamLeader: row.team_leader || raw.teamLeader || '',
      pmcKnitStartDate: pmcStart,
      pmcKnitEndDate: pmcEnd,
      actualKnitStartDate: actStart,
      actualKnitEndDate: actEnd,
      knitStartDate: actStart || pmcStart || kStart,
      knitEndDate: actEnd || pmcEnd || kEnd,
      knitStartOtd: sOtd,
      knitEndOtd: eOtd,
      otdStatus: otd,
      reqQty: parseFloat(String(row.req_qty ?? raw.reqQty ?? 0)) || 0,
      greyQty: parseFloat(String(row.grey_qty ?? raw.greyQty ?? 0)) || 0,
      production: parseFloat(String(row.production ?? raw.production ?? 0)) || 0,
      knitBalance: parseFloat(String(row.knit_balance ?? raw.knitBalance ?? 0)) || 0,
      items: items,
      remarks: row.remarks || raw.remarks || '',
      fabrication: row.fabrication || raw.fabrication || '',
      createdAt: row.created_at || raw.createdAt,
      updatedAt: row.updated_at || raw.updatedAt
    };
  }

  static mapKnittingOrderToRow(item: KnittingStatusOrder): Record<string, any> {
    const rawId = String(item.id || item.orderNo || `kord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
    return {
      id: rawId,
      order_no: String(item.orderNo || ''),
      buyer_name: String(item.buyerName || ''),
      team_leader: String(item.teamLeader || ''),
      knit_start_date: String(item.knitStartDate || ''),
      knit_end_date: String(item.knitEndDate || ''),
      req_qty: parseFloat(String(item.reqQty || 0)) || 0,
      grey_qty: parseFloat(String(item.greyQty || 0)) || 0,
      production: parseFloat(String(item.production || 0)) || 0,
      knit_balance: parseFloat(String(item.knitBalance || 0)) || 0,
      items: item.items || [],
      remarks: String(item.remarks || ''),
      // Store ONLY tiny scalar metadata in raw_data (never duplicate the large `items` array!)
      raw_data: {
        pmcKnitStartDate: item.pmcKnitStartDate || '',
        pmcKnitEndDate: item.pmcKnitEndDate || '',
        actualKnitStartDate: item.actualKnitStartDate || '',
        actualKnitEndDate: item.actualKnitEndDate || '',
        otdStatus: item.otdStatus || 'Pending',
        knitStartOtd: item.knitStartOtd || 'Pending',
        knitEndOtd: item.knitEndOtd || 'Pending',
        fabrication: item.fabrication || ''
      },
      updated_at: new Date().toISOString()
    };
  }

  static async fetchKnittingOrders(
    onProgress?: (loaded: number, total: number, percent: number) => void,
    force: boolean = false
  ): Promise<KnittingStatusOrder[]> {
    const TABLE = 'knitting_orders';
    if (!force) {
      const memo = this._tableFetchMemo.get(TABLE);
      if (memo && Date.now() - memo.ts < this.CLIENT_CACHE_TTL_MS) {
        if (onProgress && memo.data.length > 0) onProgress(memo.data.length, memo.data.length, 100);
        return memo.data as KnittingStatusOrder[];
      }
    }

    const flightKey = `${TABLE}:${force ? 'force' : 'normal'}`;
    if (this._tableInFlight.has(flightKey)) {
      return this._tableInFlight.get(flightKey)!;
    }

    const promise = (async (): Promise<KnittingStatusOrder[]> => {
      this._failedTables.delete(TABLE);

      const serverRes = await this.fetchRowsViaServerCache(TABLE, { force });
      if (serverRes) {
        if (serverRes.restricted || !serverRes.ok) {
          this._failedTables.add(TABLE);
          return [];
        }
        const mapped = serverRes.rows.map(row => this.mapRowToKnittingOrder(row));
        this._tableFetchMemo.set(TABLE, { ts: Date.now(), data: mapped, maxUpdatedAt: serverRes.maxUpdatedAt });
        if (onProgress && mapped.length > 0) onProgress(mapped.length, mapped.length, 100);
        return mapped;
      }

      const client = this.getClient();
      if (!client) {
        this._failedTables.add(TABLE);
        return [];
      }

      try {
        const allRows: any[] = [];
        const BATCH_SIZE = 1000;
        let from = 0;
        let selectCols = this.getSelectColumns(TABLE);

        while (true) {
          const to = from + BATCH_SIZE - 1;
          const { data, error } = await client
            .from(TABLE)
            .select(selectCols)
            .order('id', { ascending: false })
            .range(from, to);

          if (error) {
            if (this.isQuotaOrRestrictionError(error)) {
              this._failedTables.add(TABLE);
              this.markServiceRestricted(error);
              return [];
            }
            if (selectCols !== '*' && (error.code === '42703' || error.code === 'PGRST204')) {
              this._tablesRequiringWildcard.add(TABLE);
              selectCols = '*';
              from = 0;
              allRows.length = 0;
              continue;
            }
            this._failedTables.add(TABLE);
            console.warn('Supabase fetchKnittingOrders range error:', error.message);
            break;
          }

          if (!data || !Array.isArray(data) || data.length === 0) break;
          allRows.push(...data);
          if (onProgress) {
            const estTotal = data.length === BATCH_SIZE ? allRows.length + BATCH_SIZE : allRows.length;
            onProgress(allRows.length, estTotal, Math.min(99, Math.round((allRows.length / estTotal) * 100)));
          }
          if (data.length < BATCH_SIZE) break;
          from += BATCH_SIZE;
        }

        const mapped = allRows.map(row => this.mapRowToKnittingOrder(row));
        this._tableFetchMemo.set(TABLE, { ts: Date.now(), data: mapped });
        if (onProgress && mapped.length > 0) onProgress(mapped.length, mapped.length, 100);
        return mapped;
      } catch {
        this._failedTables.add(TABLE);
        return [];
      }
    })().finally(() => {
      this._tableInFlight.delete(flightKey);
    });

    this._tableInFlight.set(flightKey, promise);
    return promise;
  }

  static async fetchKnittingOrdersByOrder(orderNo: string): Promise<KnittingStatusOrder[]> {
    if (!orderNo) return [];
    const cleanNum = orderNo.trim();
    const serverRes = await this.fetchRowsViaServerCache('knitting_orders', { orderNo: cleanNum });
    if (serverRes && serverRes.ok) {
      return serverRes.rows.map(row => this.mapRowToKnittingOrder(row));
    }

    const client = this.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('knitting_orders')
        .select(this.getSelectColumns('knitting_orders'))
        .ilike('order_no', `%${cleanNum}%`);

      if (error) {
        console.warn('Supabase fetchKnittingOrdersByOrder error:', error.message);
        return [];
      }

      if (Array.isArray(data) && data.length > 0) {
        return data.map(row => this.mapRowToKnittingOrder(row));
      }
      return [];
    } catch (err) {
      console.warn('Supabase fetchKnittingOrdersByOrder error:', err);
      return [];
    }
  }

  static async saveKnittingOrder(item: KnittingStatusOrder): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client is not initialized.' };

    try {
      const row = this.sanitizeRowForSupabase(this.mapKnittingOrderToRow(item));
      const { error } = await client.from('knitting_orders').upsert(row, { onConflict: 'id' });
      if (error) return { success: false, error: error.message };
      this.notifyDatasetChanged('knitting_orders', 'single', {
        eventType: 'UPDATE',
        record: item,
        id: String(row.id || item.id || '')
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  static async bulkSaveKnittingOrders(
    items: KnittingStatusOrder[], 
    replace: boolean = false,
    onProgress?: (processed: number, total: number, percentage: number, stage?: string) => void
  ): Promise<{ success: boolean; count: number; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, count: 0, error: 'Supabase not initialized.' };

    try {
      if (replace) {
        await client.from('knitting_orders').delete().neq('id', '___PURGE___');
      }
      if (!items || items.length === 0) {
        if (replace) this.notifyDatasetChanged('knitting_orders', 'bulk');
        return { success: true, count: 0 };
      }

      const rows = items.map(o => this.sanitizeRowForSupabase(this.mapKnittingOrderToRow(o)));
      const CHUNK_SIZE = 200;
      let insertedCount = 0;

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const { error } = await client.from('knitting_orders').upsert(chunk, { onConflict: 'id' });
        if (error) {
          console.warn('Supabase bulkSaveKnittingOrders chunk error:', error.message);
          return { success: false, count: insertedCount, error: error.message };
        }
        insertedCount += chunk.length;
        if (onProgress) {
          const pct = Math.round((insertedCount / rows.length) * 100);
          onProgress(insertedCount, rows.length, pct, `Saving knitting orders (${insertedCount}/${rows.length})...`);
        }
      }

      this.notifyDatasetChanged('knitting_orders', 'bulk');
      return { success: true, count: insertedCount };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message || String(err) };
    }
  }

  static async deleteKnittingOrder(id: string): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client not initialized.' };
    try {
      const { error } = await client.from('knitting_orders').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
      this.notifyDatasetChanged('knitting_orders', 'single', { eventType: 'DELETE', id });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Real-time Multi-Device Broadcast Subscription for Knitting Orders (zero postgres_changes bulk storms)
   */
  static subscribeToKnittingOrders(
    onRecordChange: (change: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: KnittingStatusOrder; id: string }) => void
  ): () => void {
    return this.subscribeToTableRecordBroadcast<KnittingStatusOrder>('knitting_orders', onRecordChange);
  }

  // =========================================================================
  // TEXTILE CLOSE BY PMC CLOUD SYNCHRONIZATION
  // =========================================================================

  static mapRowToTextileCloseRecord(row: Record<string, any>): TextileCloseRecord {
    const raw = row.raw_data || {};
    return {
      id: String(row.id || raw.id || `tc-pmc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`),
      status: String(row.status || raw.status || 'Textile Close By PMC'),
      orderNo: String(row.order_no || raw.orderNo || ''),
      buyerName: String(row.buyer_name || raw.buyerName || ''),
      teamLeader: String(row.team_leader || raw.teamLeader || ''),
      fgsm: row.fgsm !== undefined && row.fgsm !== null && row.fgsm !== '' ? row.fgsm : (raw.fgsm ?? ''),
      fWidth: String(row.f_width || raw.fWidth || ''),
      color: String(row.color || raw.color || ''),
      fabType: String(row.fab_type || raw.fabType || ''),
      reqQty: parseFloat(String(row.req_qty ?? raw.reqQty ?? 0)) || 0,
      greyQty: parseFloat(String(row.grey_qty ?? raw.greyQty ?? 0)) || 0,
      production: parseFloat(String(row.production ?? raw.production ?? 0)) || 0,
      knitBal: parseFloat(String(row.knit_bal ?? raw.knitBal ?? 0)) || 0,
      closedDate: String(row.closed_date || raw.closedDate || ''),
      remarks: String(row.remarks || raw.remarks || ''),
      updatedAt: row.updated_at || raw.updatedAt || new Date().toISOString()
    };
  }

  static mapTextileCloseRecordToRow(item: TextileCloseRecord): Record<string, any> {
    const rawId = String(item.id || `tc-pmc-${item.orderNo}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
    return {
      id: rawId,
      status: String(item.status || 'Textile Close By PMC'),
      order_no: String(item.orderNo || ''),
      buyer_name: String(item.buyerName || ''),
      team_leader: String(item.teamLeader || ''),
      fgsm: String(item.fgsm ?? ''),
      f_width: String(item.fWidth || ''),
      color: String(item.color || ''),
      fab_type: String(item.fabType || ''),
      req_qty: parseFloat(String(item.reqQty || 0)) || 0,
      grey_qty: parseFloat(String(item.greyQty || 0)) || 0,
      production: parseFloat(String(item.production || 0)) || 0,
      knit_bal: parseFloat(String(item.knitBal || 0)) || 0,
      closed_date: String(item.closedDate || ''),
      remarks: String(item.remarks || ''),
      raw_data: {},
      updated_at: new Date().toISOString()
    };
  }

  static async fetchTextileCloseRecords(
    onProgress?: (loaded: number, total: number, percent: number) => void,
    force: boolean = false
  ): Promise<TextileCloseRecord[]> {
    const TABLE = 'textile_close_pmc';
    if (!force) {
      const memo = this._tableFetchMemo.get(TABLE);
      if (memo && Date.now() - memo.ts < this.CLIENT_CACHE_TTL_MS) {
        if (onProgress && memo.data.length > 0) onProgress(memo.data.length, memo.data.length, 100);
        return memo.data as TextileCloseRecord[];
      }
    }

    const flightKey = `${TABLE}:${force ? 'force' : 'normal'}`;
    if (this._tableInFlight.has(flightKey)) {
      return this._tableInFlight.get(flightKey)!;
    }

    const promise = (async (): Promise<TextileCloseRecord[]> => {
      this._failedTables.delete(TABLE);

      const serverRes = await this.fetchRowsViaServerCache(TABLE, { force });
      if (serverRes) {
        if (serverRes.restricted || !serverRes.ok) {
          this._failedTables.add(TABLE);
          return [];
        }
        const mapped = serverRes.rows.map(row => this.mapRowToTextileCloseRecord(row));
        this._tableFetchMemo.set(TABLE, { ts: Date.now(), data: mapped, maxUpdatedAt: serverRes.maxUpdatedAt });
        if (onProgress && mapped.length > 0) onProgress(mapped.length, mapped.length, 100);
        return mapped;
      }

      const client = this.getClient();
      if (!client) {
        this._failedTables.add(TABLE);
        return [];
      }

      try {
        const allRows: any[] = [];
        const BATCH_SIZE = 1000;
        let from = 0;
        let selectCols = this.getSelectColumns(TABLE);

        while (true) {
          const to = from + BATCH_SIZE - 1;
          const { data, error } = await client
            .from(TABLE)
            .select(selectCols)
            .order('order_no', { ascending: true })
            .range(from, to);

          if (error) {
            if (this.isQuotaOrRestrictionError(error)) {
              this._failedTables.add(TABLE);
              this.markServiceRestricted(error);
              return [];
            }
            if (selectCols !== '*' && (error.code === '42703' || error.code === 'PGRST204')) {
              this._tablesRequiringWildcard.add(TABLE);
              selectCols = '*';
              from = 0;
              allRows.length = 0;
              continue;
            }
            this._failedTables.add(TABLE);
            console.warn('Supabase fetchTextileCloseRecords range error:', error.message);
            break;
          }

          if (!data || !Array.isArray(data) || data.length === 0) break;
          allRows.push(...data);
          if (onProgress) {
            const estTotal = data.length === BATCH_SIZE ? allRows.length + BATCH_SIZE : allRows.length;
            onProgress(allRows.length, estTotal, Math.min(99, Math.round((allRows.length / estTotal) * 100)));
          }
          if (data.length < BATCH_SIZE) break;
          from += BATCH_SIZE;
        }

        const mapped = allRows.map(row => this.mapRowToTextileCloseRecord(row));
        this._tableFetchMemo.set(TABLE, { ts: Date.now(), data: mapped });
        if (onProgress && mapped.length > 0) onProgress(mapped.length, mapped.length, 100);
        return mapped;
      } catch {
        this._failedTables.add(TABLE);
        return [];
      }
    })().finally(() => {
      this._tableInFlight.delete(flightKey);
    });

    this._tableInFlight.set(flightKey, promise);
    return promise;
  }

  static async fetchTextileCloseRecordsByOrder(orderNo: string): Promise<TextileCloseRecord[]> {
    if (!orderNo) return [];
    const cleanNum = orderNo.trim();
    const serverRes = await this.fetchRowsViaServerCache('textile_close_pmc', { orderNo: cleanNum });
    if (serverRes && serverRes.ok) {
      return serverRes.rows.map(row => this.mapRowToTextileCloseRecord(row));
    }

    const client = this.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('textile_close_pmc')
        .select(this.getSelectColumns('textile_close_pmc'))
        .ilike('order_no', `%${cleanNum}%`);

      if (error) {
        console.warn('Supabase fetchTextileCloseRecordsByOrder error:', error.message);
        return [];
      }

      if (Array.isArray(data) && data.length > 0) {
        return data.map(row => this.mapRowToTextileCloseRecord(row));
      }
      return [];
    } catch (err) {
      console.warn('Supabase fetchTextileCloseRecordsByOrder error:', err);
      return [];
    }
  }

  static async saveTextileCloseRecord(item: TextileCloseRecord): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client is not initialized.' };

    try {
      const row = this.sanitizeRowForSupabase(this.mapTextileCloseRecordToRow(item));
      const { error } = await client.from('textile_close_pmc').upsert(row, { onConflict: 'id' });
      if (error) return { success: false, error: error.message };
      this.notifyDatasetChanged('textile_close_pmc', 'single', {
        eventType: 'UPDATE',
        record: item,
        id: String(row.id || item.id || '')
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  static async bulkSaveTextileCloseRecords(
    items: TextileCloseRecord[],
    replace: boolean = false,
    onProgress?: (processed: number, total: number, percentage: number, stage?: string) => void
  ): Promise<{ success: boolean; count: number; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, count: 0, error: 'Supabase not initialized.' };

    try {
      if (replace) {
        if (onProgress) {
          onProgress(0, items.length, 5, 'Purging previous records from Supabase cloud...');
        }
        await client.from('textile_close_pmc').delete().neq('id', '___PURGE___');
      }

      if (!items || items.length === 0) {
        if (replace) this.notifyDatasetChanged('textile_close_pmc', 'bulk');
        return { success: true, count: 0 };
      }

      const rows = items.map(r => this.sanitizeRowForSupabase(this.mapTextileCloseRecordToRow(r)));
      const CHUNK_SIZE = 200;
      let insertedCount = 0;

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const { error } = await client.from('textile_close_pmc').upsert(chunk, { onConflict: 'id' });
        if (error) {
          console.warn('Supabase bulkSaveTextileCloseRecords chunk error:', error.message);
          return { success: false, count: insertedCount, error: error.message };
        }
        insertedCount += chunk.length;
        if (onProgress) {
          const pct = Math.round((insertedCount / rows.length) * 100);
          onProgress(insertedCount, rows.length, pct, `Syncing Textile Close By PMC (${insertedCount}/${rows.length})...`);
        }
      }

      this.notifyDatasetChanged('textile_close_pmc', 'bulk');
      return { success: true, count: insertedCount };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message || String(err) };
    }
  }

  static async deleteTextileCloseRecord(id: string): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client not initialized.' };
    try {
      const { error } = await client.from('textile_close_pmc').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
      this.notifyDatasetChanged('textile_close_pmc', 'single', { eventType: 'DELETE', id });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  static subscribeToTextileCloseRecords(
    onRecordChange: (change: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: TextileCloseRecord; id: string }) => void
  ): () => void {
    return this.subscribeToTableRecordBroadcast<TextileCloseRecord>('textile_close_pmc', onRecordChange);
  }

  // =========================================================================
  // GREY STOCK SUMMARY CLOUD SYNCHRONIZATION
  // =========================================================================

  static mapRowToGreyStockItem(row: Record<string, any>): GreyStockItem {
    if (!row || typeof row !== 'object') {
      return {
        id: `gs-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        orderNo: 'Unknown',
        fabType: '—',
        colour: '—',
        fabStyle: '—',
        status: 'Running',
        netReceivedQty: 0,
        netIssuedQty: 0,
        stockQty: 0
      };
    }

    const raw = (row.raw_data && typeof row.raw_data === 'object') ? row.raw_data : {};

    // Helper: case-insensitive, punctuation-insensitive lookup across row and raw_data
    const getVal = (...keys: string[]): any => {
      // 1. Direct exact key match on row
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
      }
      // 2. Direct exact key match on raw
      for (const k of keys) {
        if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k];
      }
      // 3. Normalized alphanumeric lowercase key match on row
      const rowEntries = Object.entries(row);
      for (const k of keys) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const [rk, rv] of rowEntries) {
          if (rk.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanK) {
            if (rv !== undefined && rv !== null && rv !== '') return rv;
          }
        }
      }
      // 4. Normalized alphanumeric lowercase key match on raw
      const rawEntries = Object.entries(raw);
      for (const k of keys) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const [rk, rv] of rawEntries) {
          if (rk.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanK) {
            if (rv !== undefined && rv !== null && rv !== '') return rv;
          }
        }
      }
      return undefined;
    };

    // Extract Order No (supports all Supabase naming conventions: order_no, orderno, order, order_number, job_no, etc.)
    const rawOrderNo = getVal('order_no', 'orderNo', 'order', 'orderno', 'order_number', 'ordernumber', 'job_no', 'jobno', 'ewo_no', 'ewono');
    const orderNoStr = rawOrderNo !== undefined && rawOrderNo !== null ? String(rawOrderNo).trim() : '';

    // Extract Buyer Name
    const rawBuyer = getVal('buyer_name', 'buyerName', 'buyer', 'buyername', 'customer', 'customer_name');
    const buyerStr = rawBuyer !== undefined && rawBuyer !== null && String(rawBuyer).trim() !== '' ? String(rawBuyer).trim() : undefined;

    // Extract Colour
    const rawColour = getVal('colour', 'color', 'Colour', 'Color', 'shade', 'fabric_colour', 'fabric_color');
    const colourStr = rawColour !== undefined && rawColour !== null ? String(rawColour).trim() : '';

    // Extract Fabric Type
    const rawFabType = getVal('fab_type', 'fabType', 'fabric_type', 'fabricstype', 'fabtype', 'fabrication', 'fabrics', 'fabric', 'Fabric Type', 'Fabrics Type');
    const fabTypeStr = rawFabType !== undefined && rawFabType !== null ? String(rawFabType).trim() : '';

    // Extract Fabric Style
    const rawFabStyle = getVal('fab_style', 'fabStyle', 'fabric_style', 'style', 'fabstyle', 'fabricstyle', 'Fab Style', 'Fabric Style');
    const fabStyleStr = rawFabStyle !== undefined && rawFabStyle !== null ? String(rawFabStyle).trim() : '';

    // Extract Status
    const rawStatus = getVal('status', 'order_status', 'orderstatus', 'item_status', 'itemstatus', 'Status');
    const statusStr = rawStatus !== undefined && rawStatus !== null && String(rawStatus).trim() !== '' ? String(rawStatus).trim() : 'Running';

    // Extract Completion Date
    const rawCompDate = getVal('completion_date', 'completionDate', 'comp_date', 'compdate', 'closing_date', 'closed_date', 'delivery_date', 'Completion Date');
    const compDateStr = rawCompDate !== undefined && rawCompDate !== null && String(rawCompDate).trim() !== '' ? formatCompletionDate(rawCompDate) : undefined;

    // Extract Numerical Quantities with fallbacks
    const rawNetRec = getVal('net_received_qty', 'netReceivedQty', 'net_received', 'netrec', 'total_received', 'totalreceived', 'received_qty', 'received', 'recieved', 'Net Received', 'Total Received');
    const netReceivedQty = parseFloat(String(rawNetRec ?? 0)) || 0;

    const rawNetIss = getVal('net_issued_qty', 'netIssuedQty', 'net_issued', 'netiss', 'total_issued', 'totalissued', 'issued_qty', 'issued', 'Net Issued', 'Total Issued');
    const netIssuedQty = parseFloat(String(rawNetIss ?? 0)) || 0;

    const rawStock = getVal('stock_qty', 'stockQty', 'total_stock', 'totalstock', 'stock', 'grey_stock', 'greystock', 'balance', 'Total Stock', 'Stock');
    let stockQty = rawStock !== undefined && rawStock !== null && rawStock !== '' ? (parseFloat(String(rawStock)) || 0) : Math.max(0, netReceivedQty - netIssuedQty);

    // Double Count
    const rawDouble = getVal('double_count', 'doubleCount', 'double', 'doublecount', 'Double Count');
    const doubleCount = rawDouble !== undefined && rawDouble !== null ? rawDouble : 0;

    // Owner Unit
    const rawUnit = getVal('owner_unit', 'ownerUnit', 'unit', 'plant', 'factory', 'Owner Unit', 'Unit');
    const ownerUnit = rawUnit !== undefined && rawUnit !== null && String(rawUnit).trim() !== '' ? String(rawUnit).trim() : 'EKL';

    // Code
    const rawCode = getVal('code', 'item_code', 'itemcode', 'order_code', 'ordercode', 'fabric_code', 'Code');
    const code = rawCode !== undefined && rawCode !== null && String(rawCode).trim() !== '' ? String(rawCode).trim() : undefined;

    // Matched Grey QTY
    const rawMatched = getVal('matched_grey_qty', 'matchedGreyQty', 'matched_qty', 'matchedgrey');
    const matchedGreyQty = rawMatched !== undefined && rawMatched !== null && rawMatched !== '' ? parseFloat(String(rawMatched)) : undefined;

    // Track standard normalized keys to safely isolate custom user-added columns
    const standardNormKeys = new Set([
      'id', 'orderno', 'ordernumber', 'order', 'jobno', 'ewono', 'buyername', 'buyer', 'customer',
      'colour', 'color', 'shade', 'fabtype', 'fabrictype', 'fabricstype', 'fabrication', 'fabrics', 'fabric',
      'fabstyle', 'fabricstyle', 'style', 'status', 'orderstatus', 'itemstatus', 'completiondate', 'compdate',
      'closingdate', 'closeddate', 'deliverydate', 'netreceivedqty', 'netreceived', 'netrec', 'totalreceived',
      'receivedqty', 'received', 'recieved', 'netissuedqty', 'netissued', 'netiss', 'totalissued', 'issuedqty',
      'issued', 'stockqty', 'totalstock', 'stock', 'greystock', 'balance', 'doublecount', 'double', 'ownerunit',
      'unit', 'plant', 'factory', 'code', 'itemcode', 'ordercode', 'fabriccode', 'matchedgreyqty', 'matchedqty',
      'rawdata', 'updatedat', 'createdat'
    ]);

    // Preserve ANY custom or newly added columns in Supabase
    const customFields: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw)) {
      const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!standardNormKeys.has(normK) && v !== undefined && v !== null && v !== '') {
        customFields[k] = v;
      }
    }
    for (const [k, v] of Object.entries(row)) {
      if (k === 'raw_data') continue;
      const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!standardNormKeys.has(normK) && v !== undefined && v !== null && v !== '') {
        customFields[k] = v;
      }
    }

    const item: GreyStockItem = {
      id: String(row.id || raw.id || `gs-item-${orderNoStr || 'ord'}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`),
      code,
      orderNo: orderNoStr,
      buyerName: buyerStr,
      colour: colourStr,
      fabStyle: fabStyleStr,
      fabType: fabTypeStr,
      status: statusStr,
      completionDate: compDateStr,
      netReceivedQty,
      netIssuedQty,
      stockQty,
      doubleCount,
      ownerUnit,
      matchedGreyQty,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      updatedAt: row.updated_at || raw.updatedAt || new Date().toISOString(),
      ...customFields // Spread custom columns directly onto item for instant access
    };

    return item;
  }

  static mapGreyStockItemToRow(item: GreyStockItem): Record<string, any> {
    const rawId = String(item.id || `gs-${item.orderNo}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
    return {
      id: rawId,
      code: item.code || null,
      order_no: String(item.orderNo || ''),
      buyer_name: item.buyerName || null,
      colour: String(item.colour || ''),
      fab_style: String(item.fabStyle || ''),
      fab_type: String(item.fabType || ''),
      status: String(item.status || 'Running'),
      completion_date: item.completionDate ? formatCompletionDate(item.completionDate) : null,
      net_received_qty: parseFloat(String(item.netReceivedQty || 0)) || 0,
      net_issued_qty: parseFloat(String(item.netIssuedQty || 0)) || 0,
      stock_qty: parseFloat(String(item.stockQty || 0)) || 0,
      double_count: item.doubleCount !== undefined && item.doubleCount !== null ? parseFloat(String(item.doubleCount)) || 0 : 0,
      owner_unit: String(item.ownerUnit || 'EKL'),
      matched_grey_qty: item.matchedGreyQty !== undefined ? parseFloat(String(item.matchedGreyQty)) : null,
      // Only store non-empty customFields in raw_data instead of duplicating all columns
      raw_data: item.customFields && Object.keys(item.customFields).length > 0 ? item.customFields : {},
      updated_at: new Date().toISOString()
    };
  }

  private static _greyStockTableExists: boolean | null = null;
  private static _lastGreyStockCheckTime: number = 0;
  private static _checkingGreyStockTable: Promise<boolean> | null = null;

  private static _greyYarnStockTableExists: boolean | null = null;
  private static _lastGreyYarnStockCheckTime: number = 0;
  private static _checkingGreyYarnStockTable: Promise<boolean> | null = null;

  static isGreyStockTableAvailable(): boolean {
    if (this._greyStockTableExists === false) {
      if (Date.now() - this._lastGreyStockCheckTime < 10 * 60 * 1000) {
        return false;
      }
      this._greyStockTableExists = null;
    }
    return true;
  }

  static async checkGreyStockTableExists(forceRecheck: boolean = false): Promise<boolean> {
    const client = this.getClient();
    if (!client || !this.isConfigured()) return false;

    if (!forceRecheck && this._greyStockTableExists !== null) {
      if (this._greyStockTableExists === false && Date.now() - this._lastGreyStockCheckTime < 10 * 60 * 1000) {
        return false;
      }
      if (this._greyStockTableExists === true) {
        return true;
      }
    }

    if (this._checkingGreyStockTable) return this._checkingGreyStockTable;

    this._checkingGreyStockTable = (async () => {
      try {
        const { error } = await client
          .from('grey_stock_summary')
          .select('id', { head: true, count: 'exact' });

        if (error) {
          if (this.isQuotaOrRestrictionError(error)) {
            this.markServiceRestricted(error);
            return false;
          }
          if (error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('grey_stock_summary')) {
            this._greyStockTableExists = false;
            this._lastGreyStockCheckTime = Date.now();
            try { sessionStorage.setItem('epyllion_grey_stock_table_exists', 'false'); } catch {}
            return false;
          }
        }
        this._greyStockTableExists = true;
        this._lastGreyStockCheckTime = Date.now();
        try { sessionStorage.setItem('epyllion_grey_stock_table_exists', 'true'); } catch {}
        return true;
      } catch (e: any) {
        if (e?.code === 'PGRST205' || e?.message?.includes('does not exist')) {
          this._greyStockTableExists = false;
          this._lastGreyStockCheckTime = Date.now();
          try { sessionStorage.setItem('epyllion_grey_stock_table_exists', 'false'); } catch {}
          return false;
        }
        return false;
      } finally {
        this._checkingGreyStockTable = null;
      }
    })();

    return this._checkingGreyStockTable;
  }

  static resetGreyStockTableCache(): void {
    this._greyStockTableExists = null;
    this._lastGreyStockCheckTime = 0;
    try { sessionStorage.removeItem('epyllion_grey_stock_table_exists'); } catch {}
  }

  static async fetchGreyStockRecords(
    onProgress?: (loaded: number, total: number, percent: number) => void,
    force: boolean = false
  ): Promise<GreyStockItem[]> {
    const TABLE = 'grey_stock_summary';
    if (!this.isGreyStockTableAvailable()) return [];

    if (!force) {
      const memo = this._tableFetchMemo.get(TABLE);
      if (memo && Date.now() - memo.ts < this.CLIENT_CACHE_TTL_MS) {
        if (onProgress && memo.data.length > 0) onProgress(memo.data.length, memo.data.length, 100);
        return memo.data as GreyStockItem[];
      }
    }

    const flightKey = `${TABLE}:${force ? 'force' : 'normal'}`;
    if (this._tableInFlight.has(flightKey)) {
      return this._tableInFlight.get(flightKey)!;
    }

    const promise = (async (): Promise<GreyStockItem[]> => {
      this._failedTables.delete(TABLE);

      const serverRes = await this.fetchRowsViaServerCache(TABLE, { force });
      if (serverRes) {
        if (serverRes.restricted || !serverRes.ok) {
          this._failedTables.add(TABLE);
          return [];
        }
        this._greyStockTableExists = true;
        const mapped = serverRes.rows.map(row => this.mapRowToGreyStockItem(row));
        this._tableFetchMemo.set(TABLE, { ts: Date.now(), data: mapped, maxUpdatedAt: serverRes.maxUpdatedAt });
        if (onProgress && mapped.length > 0) onProgress(mapped.length, mapped.length, 100);
        return mapped;
      }

      const client = this.getClient();
      if (!client) {
        this._failedTables.add(TABLE);
        return [];
      }

      try {
        const allRows: any[] = [];
        const BATCH_SIZE = 1000;
        let from = 0;
        let sortKey: 'id' | 'order_no' | null = 'id';
        let selectCols = this.getSelectColumns(TABLE);

        while (true) {
          const to = from + BATCH_SIZE - 1;
          let query = client.from(TABLE).select(selectCols);
          if (sortKey) {
            query = query.order(sortKey, { ascending: true });
          }
          const { data, error } = await query.range(from, to);

          if (error) {
            if (this.isQuotaOrRestrictionError(error)) {
              this._failedTables.add(TABLE);
              this.markServiceRestricted(error);
              return [];
            }
            if (error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('grey_stock_summary')) {
              this._greyStockTableExists = false;
              this._lastGreyStockCheckTime = Date.now();
              return [];
            }
            if (selectCols !== '*' && (error.code === '42703' || error.code === 'PGRST204')) {
              this._tablesRequiringWildcard.add(TABLE);
              selectCols = '*';
              from = 0;
              allRows.length = 0;
              continue;
            }
            if (sortKey) {
              sortKey = null;
              continue;
            }
            this._failedTables.add(TABLE);
            console.warn('Supabase fetch range notice:', error);
            break;
          }

          if (!data || !Array.isArray(data) || data.length === 0) break;
          allRows.push(...data);
          if (onProgress) {
            const estTotal = data.length === BATCH_SIZE ? allRows.length + BATCH_SIZE : allRows.length;
            onProgress(allRows.length, estTotal, Math.min(99, Math.round((allRows.length / estTotal) * 100)));
          }
          if (data.length < BATCH_SIZE) break;
          from += BATCH_SIZE;
        }

        this._greyStockTableExists = true;
        const mapped = allRows.map(row => this.mapRowToGreyStockItem(row));
        this._tableFetchMemo.set(TABLE, { ts: Date.now(), data: mapped });
        if (onProgress && mapped.length > 0) onProgress(mapped.length, mapped.length, 100);
        return mapped;
      } catch {
        this._failedTables.add(TABLE);
        return [];
      }
    })().finally(() => {
      this._tableInFlight.delete(flightKey);
    });

    this._tableInFlight.set(flightKey, promise);
    return promise;
  }

  /**
   * Targeted single-order Grey Stock lookup (avoids downloading the entire table on modal open!)
   */
  static async fetchGreyStockByOrder(orderNo: string): Promise<GreyStockItem[]> {
    if (!orderNo || !this.isGreyStockTableAvailable()) return [];
    const cleanNum = orderNo.trim();
    if (!cleanNum) return [];

    // 1. Try shared server cache targeted lookup first (0 Supabase egress if warm)
    const serverRes = await this.fetchRowsViaServerCache('grey_stock_summary', { orderNo: cleanNum });
    if (serverRes && serverRes.ok) {
      return serverRes.rows.map(row => this.mapRowToGreyStockItem(row));
    }

    // 2. Fallback: targeted single-order PostgREST query with slim columns
    const client = this.getClient();
    if (!client) return [];
    try {
      let selectCols = this.getSelectColumns('grey_stock_summary');
      let { data, error } = await client
        .from('grey_stock_summary')
        .select(selectCols)
        .ilike('order_no', `%${cleanNum}%`)
        .limit(300);

      if (error && selectCols !== '*' && (error.code === '42703' || error.code === 'PGRST204')) {
        this._tablesRequiringWildcard.add('grey_stock_summary');
        const retry = await client
          .from('grey_stock_summary')
          .select('*')
          .ilike('order_no', `%${cleanNum}%`)
          .limit(300);
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        if (this.isQuotaOrRestrictionError(error)) this.markServiceRestricted(error);
        return [];
      }
      return Array.isArray(data) ? data.map(row => this.mapRowToGreyStockItem(row)) : [];
    } catch {
      return [];
    }
  }

  static async bulkSaveGreyStockRecords(
    items: GreyStockItem[],
    replace: boolean = false,
    onProgress?: (processed: number, total: number, percentage: number, stage?: string) => void
  ): Promise<{ success: boolean; count: number; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, count: 0, error: 'Supabase client is not initialized.' };

    const tableAvailable = this.isGreyStockTableAvailable() || await this.checkGreyStockTableExists();
    if (!tableAvailable) {
      return {
        success: false,
        count: 0,
        error: "Table 'public.grey_stock_summary' does not exist yet. Please execute the SQL schema in Supabase SQL Editor."
      };
    }

    try {
      if (replace) {
        if (onProgress) {
          onProgress(0, items.length, 5, 'Purging previous records from Supabase cloud...');
        }
        const { error: delError } = await client.from('grey_stock_summary').delete().neq('id', '___PURGE___');
        if (delError) {
          if (delError.code === 'PGRST205' || delError.message?.includes('does not exist') || delError.message?.includes('grey_stock_summary')) {
            this._greyStockTableExists = false;
            this._lastGreyStockCheckTime = Date.now();
            return {
              success: false,
              count: 0,
              error: "Table 'public.grey_stock_summary' does not exist yet. Please execute the SQL schema in Supabase SQL Editor."
            };
          }
          return { success: false, count: 0, error: delError.message };
        }
      }

      if (!items || items.length === 0) {
        if (replace) this.notifyDatasetChanged('grey_stock_summary', 'bulk');
        return { success: true, count: 0 };
      }

      const rows = items.map(r => this.sanitizeRowForSupabase(this.mapGreyStockItemToRow(r)));
      const CHUNK_SIZE = 200;
      let insertedCount = 0;

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const { error } = await client.from('grey_stock_summary').upsert(chunk, { onConflict: 'id' });
        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('grey_stock_summary')) {
            this._greyStockTableExists = false;
            this._lastGreyStockCheckTime = Date.now();
            return {
              success: false,
              count: insertedCount,
              error: "Table 'public.grey_stock_summary' does not exist yet. Please execute the SQL schema in Supabase SQL Editor."
            };
          }
          return { success: false, count: insertedCount, error: error.message };
        }
        insertedCount += chunk.length;
        if (onProgress) {
          const pct = Math.round((insertedCount / rows.length) * 100);
          onProgress(insertedCount, rows.length, pct, `Uploading Grey Stock records (${insertedCount}/${rows.length})...`);
        }
      }

      this._greyStockTableExists = true;
      this.notifyDatasetChanged('grey_stock_summary', 'bulk');
      return { success: true, count: insertedCount };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message || String(err) };
    }
  }

  static async deleteGreyStockRecord(id: string): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client || !this.isGreyStockTableAvailable()) return { success: false, error: 'Supabase client not initialized or table not available.' };
    try {
      const { error } = await client.from('grey_stock_summary').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
      this.notifyDatasetChanged('grey_stock_summary', 'single', { eventType: 'DELETE', id });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  static subscribeToGreyStockRecords(
    onRecordChange: (change: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: GreyStockItem; id: string }) => void
  ): () => void {
    if (!this.isGreyStockTableAvailable()) return () => {};
    return this.subscribeToTableRecordBroadcast<GreyStockItem>('grey_stock_summary', onRecordChange);
  }

  // =========================================================================
  // GREY YARN STOCK CLOUD SYNCHRONIZATION
  // Table: public.grey_yarn_stock
  // Matches exact headers: Completion Date, Buyer, Status, Allocated Order WA,
  // Physical Count, Physical Lot, Spinner, Booking QTY, Yarn Required,
  // Net Received, Total Issued, Excess Issued, Total Stock QTY, Issue Balance
  // =========================================================================

  static mapRowToGreyYarnStockItem(row: Record<string, any>): GreyYarnStockItem {
    if (!row || typeof row !== 'object') {
      return {
        id: `gys-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        orderNo: 'Unknown',
        physicalYarnCount: '—',
        physicalYarnLot: '—',
        spinner: '—',
        bookingQty: 0,
        yarnRequired: 0,
        totalReceived: 0,
        totalIssued: 0,
        excessIssued: 0,
        totalStockQty: 0,
        issuedBalance: 0
      };
    }

    const raw = (row.raw_data && typeof row.raw_data === 'object') ? row.raw_data : {};
    const bQty = Number(row.booking_qty ?? row.bookingQty ?? raw.bookingQty) || 0;
    const yReq = Number(row.yarn_required ?? row.yarnRequired ?? raw.yarnRequired) || bQty;
    const tRec = Number(row.total_received ?? row.net_received ?? row.totalReceived ?? raw.totalReceived) || 0;
    const tIss = Number(row.total_issued ?? row.totalIssued ?? raw.totalIssued) || 0;
    const eIss = Number(row.excess_issued ?? row.excessIssued ?? raw.excessIssued) || 0;
    const sQty = row.total_stock_qty !== undefined ? Number(row.total_stock_qty) : (row.totalStockQty !== undefined ? Number(row.totalStockQty) : Math.max(0, tRec - tIss));
    const bal = row.issued_balance !== undefined ? Number(row.issued_balance) : (row.issuedBalance !== undefined ? Number(row.issuedBalance) : Math.max(0, yReq - tIss));

    return {
      id: String(row.id || raw.id || `gys-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`),
      orderNo: String(row.order_no || row.allocated_order_wa || row.orderNo || raw.orderNo || 'Unknown').trim(),
      buyerName: row.buyer_name || row.buyer || row.buyerName || raw.buyerName || '',
      status: row.status || raw.status || 'Running',
      completionDate: (row.completion_date || row.completionDate || raw.completionDate)
        ? formatCompletionDate(row.completion_date || row.completionDate || raw.completionDate)
        : '',
      physicalYarnCount: row.physical_yarn_count || row.physicalCount || row.physical_count || row.physicalYarnCount || raw.physicalYarnCount || '—',
      physicalYarnLot: row.physical_yarn_lot || row.physicalLot || row.physical_lot || row.physicalYarnLot || raw.physicalYarnLot || '—',
      spinner: row.spinner || row.spinners_name || row.spinnersName || raw.spinner || '—',
      bookingQty: bQty,
      yarnRequired: yReq,
      totalReceived: tRec,
      totalIssued: tIss,
      excessIssued: eIss,
      totalStockQty: sQty,
      issuedBalance: bal,
      remarks: row.remarks || raw.remarks || '',
      customFields: raw.customFields || {}
    };
  }

  static mapGreyYarnStockItemToRow(item: GreyYarnStockItem): Record<string, any> {
    const rawOrder = String(item.orderNo || '').trim();
    const rawBuyer = item.buyerName || '';
    const rawCount = item.physicalYarnCount || '';
    const rawLot = item.physicalYarnLot || '';
    const bQty = Number(item.bookingQty) || 0;
    const yReq = Number(item.yarnRequired) || 0;
    const nRec = Number(item.totalReceived) || 0;
    const tIss = Number(item.totalIssued) || 0;
    const eIss = Number(item.excessIssued) || 0;
    const sQty = Number(item.totalStockQty) || 0;
    const iBal = Number(item.issuedBalance) || 0;

    return {
      id: item.id || `gys-${rawOrder}-${Math.random().toString(36).substring(2, 8)}`,
      // Direct columns matching user file headers:
      completion_date: item.completionDate ? formatCompletionDate(item.completionDate) : null,
      buyer: rawBuyer || null,
      status: item.status || 'Running',
      allocated_order_wa: rawOrder,
      physical_count: rawCount,
      physical_lot: rawLot,
      spinner: item.spinner || '',
      booking_qty: bQty,
      yarn_required: yReq,
      net_received: nRec,
      total_issued: tIss,
      excess_issued: eIss,
      total_stock_qty: sQty,
      issue_balance: iBal,

      // Cross-compatibility aliases:
      order_no: rawOrder,
      buyer_name: rawBuyer || null,
      physical_yarn_count: rawCount,
      physical_yarn_lot: rawLot,
      total_received: nRec,
      issued_balance: iBal,
      remarks: item.remarks || null,
      // Only persist customFields if present; never duplicate all columns inside raw_data
      raw_data: item.customFields && Object.keys(item.customFields).length > 0 ? { customFields: item.customFields } : {},
      updated_at: new Date().toISOString()
    };
  }

  static isGreyYarnStockTableAvailable(): boolean {
    if (this._greyYarnStockTableExists === false) {
      if (Date.now() - this._lastGreyYarnStockCheckTime < 10 * 60 * 1000) {
        return false;
      }
      this._greyYarnStockTableExists = null;
    }
    return true;
  }

  static async checkGreyYarnStockTableExists(forceRecheck: boolean = false): Promise<boolean> {
    const client = this.getClient();
    if (!client || !this.isConfigured()) return false;

    if (!forceRecheck && this._greyYarnStockTableExists !== null) {
      if (this._greyYarnStockTableExists === false && Date.now() - this._lastGreyYarnStockCheckTime < 10 * 60 * 1000) {
        return false;
      }
      if (this._greyYarnStockTableExists === true) {
        return true;
      }
    }

    if (this._checkingGreyYarnStockTable) return this._checkingGreyYarnStockTable;

    this._checkingGreyYarnStockTable = (async () => {
      try {
        const { error } = await client
          .from('grey_yarn_stock')
          .select('id', { head: true, count: 'exact' });

        if (error) {
          if (this.isQuotaOrRestrictionError(error)) {
            this.markServiceRestricted(error);
            return false;
          }
          if (error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('grey_yarn_stock')) {
            this._greyYarnStockTableExists = false;
            this._lastGreyYarnStockCheckTime = Date.now();
            try { sessionStorage.setItem('epyllion_grey_yarn_stock_table_exists', 'false'); } catch {}
            return false;
          }
        }
        this._greyYarnStockTableExists = true;
        this._lastGreyYarnStockCheckTime = Date.now();
        try { sessionStorage.setItem('epyllion_grey_yarn_stock_table_exists', 'true'); } catch {}
        return true;
      } catch (e: any) {
        if (e?.code === 'PGRST205' || e?.message?.includes('does not exist')) {
          this._greyYarnStockTableExists = false;
          this._lastGreyYarnStockCheckTime = Date.now();
          try { sessionStorage.setItem('epyllion_grey_yarn_stock_table_exists', 'false'); } catch {}
          return false;
        }
        return false;
      } finally {
        this._checkingGreyYarnStockTable = null;
      }
    })();

    return this._checkingGreyYarnStockTable;
  }

  static resetGreyYarnStockTableCache(): void {
    this._greyYarnStockTableExists = null;
    this._lastGreyYarnStockCheckTime = 0;
    try { sessionStorage.removeItem('epyllion_grey_yarn_stock_table_exists'); } catch {}
  }

  static async fetchGreyYarnStockRecords(
    onProgress?: (loaded: number, total: number, percent: number) => void,
    force: boolean = false
  ): Promise<GreyYarnStockItem[]> {
    const TABLE = 'grey_yarn_stock';
    if (!this.isGreyYarnStockTableAvailable()) return [];

    if (!force) {
      const memo = this._tableFetchMemo.get(TABLE);
      if (memo && Date.now() - memo.ts < this.CLIENT_CACHE_TTL_MS) {
        if (onProgress && memo.data.length > 0) onProgress(memo.data.length, memo.data.length, 100);
        return memo.data as GreyYarnStockItem[];
      }
    }

    const flightKey = `${TABLE}:${force ? 'force' : 'normal'}`;
    if (this._tableInFlight.has(flightKey)) {
      return this._tableInFlight.get(flightKey)!;
    }

    const promise = (async (): Promise<GreyYarnStockItem[]> => {
      this._failedTables.delete(TABLE);

      const serverRes = await this.fetchRowsViaServerCache(TABLE, { force });
      if (serverRes) {
        if (serverRes.restricted || !serverRes.ok) {
          this._failedTables.add(TABLE);
          return [];
        }
        this._greyYarnStockTableExists = true;
        const mapped = serverRes.rows.map(row => this.mapRowToGreyYarnStockItem(row));
        this._tableFetchMemo.set(TABLE, { ts: Date.now(), data: mapped, maxUpdatedAt: serverRes.maxUpdatedAt });
        if (onProgress && mapped.length > 0) onProgress(mapped.length, mapped.length, 100);
        return mapped;
      }

      const client = this.getClient();
      if (!client) {
        this._failedTables.add(TABLE);
        return [];
      }

      try {
        const BATCH_SIZE = 1000;
        let from = 0;
        const allRows: any[] = [];
        let sortKey: string | null = 'order_no';
        let selectCols = this.getSelectColumns(TABLE);

        while (true) {
          const to = from + BATCH_SIZE - 1;
          let query = client.from(TABLE).select(selectCols);
          if (sortKey) {
            query = query.order(sortKey, { ascending: true });
          }
          const { data, error } = await query.range(from, to);

          if (error) {
            if (this.isQuotaOrRestrictionError(error)) {
              this._failedTables.add(TABLE);
              this.markServiceRestricted(error);
              return [];
            }
            if (error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('grey_yarn_stock')) {
              this._greyYarnStockTableExists = false;
              this._lastGreyYarnStockCheckTime = Date.now();
              return [];
            }
            if (selectCols !== '*' && (error.code === '42703' || error.code === 'PGRST204')) {
              this._tablesRequiringWildcard.add(TABLE);
              selectCols = '*';
              from = 0;
              allRows.length = 0;
              continue;
            }
            if (sortKey) {
              sortKey = null;
              continue;
            }
            this._failedTables.add(TABLE);
            break;
          }

          if (!data || !Array.isArray(data) || data.length === 0) break;
          allRows.push(...data);
          if (onProgress) {
            const estTotal = data.length === BATCH_SIZE ? allRows.length + BATCH_SIZE : allRows.length;
            onProgress(allRows.length, estTotal, Math.min(99, Math.round((allRows.length / estTotal) * 100)));
          }
          if (data.length < BATCH_SIZE) break;
          from += BATCH_SIZE;
        }

        this._greyYarnStockTableExists = true;
        const mapped = allRows.map(row => this.mapRowToGreyYarnStockItem(row));
        this._tableFetchMemo.set(TABLE, { ts: Date.now(), data: mapped });
        if (onProgress && mapped.length > 0) onProgress(mapped.length, mapped.length, 100);
        return mapped;
      } catch {
        this._failedTables.add(TABLE);
        return [];
      }
    })().finally(() => {
      this._tableInFlight.delete(flightKey);
    });

    this._tableInFlight.set(flightKey, promise);
    return promise;
  }

  static async bulkSaveGreyYarnStockRecords(
    items: GreyYarnStockItem[],
    replace: boolean = false,
    onProgress?: (processed: number, total: number, percentage: number, stage?: string) => void
  ): Promise<{ success: boolean; count: number; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, count: 0, error: 'Supabase client is not initialized.' };

    const tableAvailable = this.isGreyYarnStockTableAvailable() || await this.checkGreyYarnStockTableExists();
    if (!tableAvailable) {
      return {
        success: false,
        count: 0,
        error: "Table 'public.grey_yarn_stock' does not exist yet. Please execute the SQL schema in Supabase SQL Editor."
      };
    }

    try {
      if (replace) {
        if (onProgress) {
          onProgress(0, items.length, 5, 'Purging previous records from Supabase cloud...');
        }
        const { error: delError } = await client.from('grey_yarn_stock').delete().neq('id', '___PURGE___');
        if (delError) {
          if (delError.code === 'PGRST205' || delError.message?.includes('does not exist') || delError.message?.includes('grey_yarn_stock')) {
            this._greyYarnStockTableExists = false;
            this._lastGreyYarnStockCheckTime = Date.now();
            return {
              success: false,
              count: 0,
              error: "Table 'public.grey_yarn_stock' does not exist yet. Please execute the SQL schema in Supabase SQL Editor."
            };
          }
          return { success: false, count: 0, error: delError.message };
        }
      }

      if (!items || items.length === 0) {
        if (replace) this.notifyDatasetChanged('grey_yarn_stock', 'bulk');
        return { success: true, count: 0 };
      }

      const rows = items.map(r => this.sanitizeRowForSupabase(this.mapGreyYarnStockItemToRow(r)));
      const CHUNK_SIZE = 200;
      let insertedCount = 0;

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const { error } = await client.from('grey_yarn_stock').upsert(chunk, { onConflict: 'id' });
        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('grey_yarn_stock')) {
            this._greyYarnStockTableExists = false;
            this._lastGreyYarnStockCheckTime = Date.now();
            return {
              success: false,
              count: 0,
              error: "Table 'public.grey_yarn_stock' does not exist yet. Please execute the SQL schema in Supabase SQL Editor."
            };
          }
          return { success: false, count: insertedCount, error: error.message };
        }
        insertedCount += chunk.length;
        if (onProgress) {
          const percent = Math.min(99, Math.round((insertedCount / rows.length) * 100));
          onProgress(insertedCount, rows.length, percent, `Saved ${insertedCount} of ${rows.length} records...`);
        }
      }

      this._greyYarnStockTableExists = true;
      this.notifyDatasetChanged('grey_yarn_stock', 'bulk');
      if (onProgress) {
        onProgress(rows.length, rows.length, 100, 'Cloud save complete!');
      }
      return { success: true, count: insertedCount };
    } catch (err: any) {
      return { success: false, count: 0, error: err?.message || 'Failed to save to Supabase' };
    }
  }

  static async deleteGreyYarnStockRecord(id: string): Promise<boolean> {
    const client = this.getClient();
    if (!client || !this.isGreyYarnStockTableAvailable()) return false;
    try {
      const { error } = await client.from('grey_yarn_stock').delete().eq('id', id);
      if (!error) this.notifyDatasetChanged('grey_yarn_stock', 'single', { eventType: 'DELETE', id });
      return !error;
    } catch {
      return false;
    }
  }

  static subscribeToGreyYarnStockRecords(
    onRecordChange: (change: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: GreyYarnStockItem; id: string }) => void
  ): () => void {
    if (!this.isGreyYarnStockTableAvailable()) return () => {};
    return this.subscribeToTableRecordBroadcast<GreyYarnStockItem>('grey_yarn_stock', onRecordChange);
  }

  static getGreyYarnStockSchemaSQL(): string {
    return `-- =========================================================================
-- EPYLLION KNITEX ERP: GREY YARN STOCK CLOUD TABLE & REAL-TIME SETUP
-- Matches exact file headers:
-- 1.  Completion Date    -> completion_date
-- 2.  Buyer              -> buyer (and buyer_name)
-- 3.  Status             -> status
-- 4.  Allocated Order WA -> allocated_order_wa (and order_no)
-- 5.  Physical Count     -> physical_count (and physical_yarn_count)
-- 6.  Physical Lot       -> physical_lot (and physical_yarn_lot)
-- 7.  Spinner            -> spinner
-- 8.  Booking QTY        -> booking_qty
-- 9.  Yarn Required      -> yarn_required
-- 10. Net Received       -> net_received (and total_received)
-- 11. Total Issued       -> total_issued
-- 12. Excess Issued      -> excess_issued
-- 13. Total Stock QTY    -> total_stock_qty
-- 14. Issue Balance      -> issue_balance (and issued_balance)
--
-- Instructions: Copy and run this script in your Supabase SQL Editor.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.grey_yarn_stock (
  id TEXT PRIMARY KEY,
  completion_date TEXT,
  buyer TEXT,
  buyer_name TEXT,
  status TEXT DEFAULT 'Running',
  allocated_order_wa TEXT,
  order_no TEXT,
  physical_count TEXT,
  physical_yarn_count TEXT,
  physical_lot TEXT,
  physical_yarn_lot TEXT,
  spinner TEXT,
  booking_qty NUMERIC DEFAULT 0,
  yarn_required NUMERIC DEFAULT 0,
  net_received NUMERIC DEFAULT 0,
  total_received NUMERIC DEFAULT 0,
  total_issued NUMERIC DEFAULT 0,
  excess_issued NUMERIC DEFAULT 0,
  total_stock_qty NUMERIC DEFAULT 0,
  issue_balance NUMERIC DEFAULT 0,
  issued_balance NUMERIC DEFAULT 0,
  remarks TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent column additions for safe schema upgrades
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS completion_date TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS buyer TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS buyer_name TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Running';
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS allocated_order_wa TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS order_no TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS physical_count TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS physical_yarn_count TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS physical_lot TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS physical_yarn_lot TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS spinner TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS booking_qty NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS yarn_required NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS net_received NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS total_received NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS total_issued NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS excess_issued NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS total_stock_qty NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS issue_balance NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS issued_balance NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Performance Indexes for Ultra-Fast Queries
CREATE INDEX IF NOT EXISTS idx_grey_yarn_allocated_order_wa ON public.grey_yarn_stock(allocated_order_wa);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_order_no ON public.grey_yarn_stock(order_no);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_buyer ON public.grey_yarn_stock(buyer);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_buyer_name ON public.grey_yarn_stock(buyer_name);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_status ON public.grey_yarn_stock(status);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_completion_date ON public.grey_yarn_stock(completion_date);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_spinner ON public.grey_yarn_stock(spinner);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_physical_count ON public.grey_yarn_stock(physical_count);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_physical_lot ON public.grey_yarn_stock(physical_lot);

-- Grant API Role Permissions (Required on new Supabase Postgres instances)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE public.grey_yarn_stock TO anon, authenticated, service_role;

-- Enable Row Level Security (RLS) with full read/write access
ALTER TABLE public.grey_yarn_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to grey_yarn_stock" ON public.grey_yarn_stock;
CREATE POLICY "Allow public full access to grey_yarn_stock" ON public.grey_yarn_stock FOR ALL USING (true) WITH CHECK (true);

-- Enable Real-Time WebSocket Replication
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'grey_yarn_stock'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.grey_yarn_stock;
  END IF;
EXCEPTION WHEN OTHERS THEN 
  NULL;
END $$;
`;
  }

  static getGreyStockSchemaSQL(): string {
    return `-- =========================================================================
-- EPYLLION KNITEX ERP: GREY STOCK SUMMARY TABLE & REAL-TIME SETUP
-- Execute this script in your Supabase SQL Editor:
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.grey_stock_summary (
  id TEXT PRIMARY KEY,
  code TEXT,
  order_no TEXT NOT NULL,
  buyer_name TEXT,
  fab_type TEXT,
  colour TEXT,
  fab_style TEXT,
  status TEXT DEFAULT 'Running',
  completion_date TEXT,
  net_received_qty NUMERIC DEFAULT 0,
  net_issued_qty NUMERIC DEFAULT 0,
  stock_qty NUMERIC DEFAULT 0,
  double_count NUMERIC DEFAULT 0,
  owner_unit TEXT DEFAULT 'EKL',
  matched_grey_qty NUMERIC DEFAULT 0,
  raw_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent ALTER TABLE to add newly introduced columns if table already exists
ALTER TABLE public.grey_stock_summary ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.grey_stock_summary ADD COLUMN IF NOT EXISTS buyer_name TEXT;
ALTER TABLE public.grey_stock_summary ADD COLUMN IF NOT EXISTS completion_date TEXT;
ALTER TABLE public.grey_stock_summary ADD COLUMN IF NOT EXISTS double_count NUMERIC DEFAULT 0;
ALTER TABLE public.grey_stock_summary ADD COLUMN IF NOT EXISTS fab_style TEXT;
ALTER TABLE public.grey_stock_summary ADD COLUMN IF NOT EXISTS fab_type TEXT;
ALTER TABLE public.grey_stock_summary ADD COLUMN IF NOT EXISTS colour TEXT;
ALTER TABLE public.grey_stock_summary ADD COLUMN IF NOT EXISTS owner_unit TEXT DEFAULT 'EKL';
ALTER TABLE public.grey_stock_summary ADD COLUMN IF NOT EXISTS matched_grey_qty NUMERIC DEFAULT 0;
ALTER TABLE public.grey_stock_summary ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE public.grey_stock_summary ADD COLUMN IF NOT EXISTS net_received_qty NUMERIC DEFAULT 0;
ALTER TABLE public.grey_stock_summary ADD COLUMN IF NOT EXISTS net_issued_qty NUMERIC DEFAULT 0;
ALTER TABLE public.grey_stock_summary ADD COLUMN IF NOT EXISTS stock_qty NUMERIC DEFAULT 0;
ALTER TABLE public.grey_stock_summary ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Running';

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_grey_stock_order_no ON public.grey_stock_summary(order_no);
CREATE INDEX IF NOT EXISTS idx_grey_stock_buyer_name ON public.grey_stock_summary(buyer_name);
CREATE INDEX IF NOT EXISTS idx_grey_stock_completion_date ON public.grey_stock_summary(completion_date);
CREATE INDEX IF NOT EXISTS idx_grey_stock_colour ON public.grey_stock_summary(colour);
CREATE INDEX IF NOT EXISTS idx_grey_stock_fab_type ON public.grey_stock_summary(fab_type);
CREATE INDEX IF NOT EXISTS idx_grey_stock_owner_unit ON public.grey_stock_summary(owner_unit);
CREATE INDEX IF NOT EXISTS idx_grey_stock_status ON public.grey_stock_summary(status);

-- Grant API Role Permissions (Required on new Supabase Postgres instances)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE public.grey_stock_summary TO anon, authenticated, service_role;

-- Row Level Security (RLS)
ALTER TABLE public.grey_stock_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to grey_stock_summary" ON public.grey_stock_summary;
CREATE POLICY "Allow public full access to grey_stock_summary" ON public.grey_stock_summary FOR ALL USING (true) WITH CHECK (true);

-- Enable Real-Time WebSocket Replication
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'grey_stock_summary'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.grey_stock_summary;
  END IF;
EXCEPTION WHEN OTHERS THEN 
  NULL;
END $$;
`;
  }

  /**
   * Dedicated SQL script for Knitting Status Orders & Items table only
   */
  static getKnittingOrdersSetupSQL(): string {
    return `-- =========================================================
-- EPYLLION KNITEX ERP: KNITTING STATUS ORDERS & SPECIFICATIONS TABLE
-- Paste and Run in Supabase Dashboard > SQL Editor (Free Forever)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.knitting_orders (
  id TEXT PRIMARY KEY,
  order_no TEXT,
  buyer_name TEXT,
  team_leader TEXT,
  knit_start_date TEXT,
  knit_end_date TEXT,
  req_qty NUMERIC DEFAULT 0,
  grey_qty NUMERIC DEFAULT 0,
  production NUMERIC DEFAULT 0,
  knit_balance NUMERIC DEFAULT 0,
  items JSONB DEFAULT '[]'::jsonb,
  remarks TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add items column if table already existed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='knitting_orders' AND column_name='items') THEN
    ALTER TABLE public.knitting_orders ADD COLUMN items JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_knitting_orders_order_no ON public.knitting_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_knitting_orders_buyer_name ON public.knitting_orders(buyer_name);

-- Grant API Role Permissions (Required on new Supabase Postgres instances)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE public.knitting_orders TO anon, authenticated, service_role;

-- Row Level Security (RLS) with full read/write access
ALTER TABLE public.knitting_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to knitting_orders" ON public.knitting_orders;
CREATE POLICY "Allow public full access to knitting_orders" ON public.knitting_orders FOR ALL USING (true) WITH CHECK (true);

-- Enable Instant Sub-50ms Real-Time WebSocket Replication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'knitting_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.knitting_orders;
  END IF;
END $$;
`;
  }

  /**
   * Dedicated SQL script for Plan Order Followup & Status table only (safe, idempotent, fast)
   */
  static getOrderPlansSetupSQL(): string {
    return `-- =========================================================
-- EPYLLION KNITEX ERP: PLAN ORDER FOLLOWUP & STATUS CLOUD TABLE
-- Paste and Run in Supabase Dashboard > SQL Editor (Free Forever)
-- =========================================================

-- 1. Create Order Plans Table
CREATE TABLE IF NOT EXISTS public.order_plans (
  id TEXT PRIMARY KEY,
  plan_month TEXT,
  plan_type TEXT,
  ewo TEXT,
  buyer TEXT,
  color TEXT,
  knit_start TEXT,
  knit_end TEXT,
  target NUMERIC DEFAULT 0,
  target_next_month NUMERIC DEFAULT 0,
  allocation_start TEXT,
  allocation_end TEXT,
  allocated_qty NUMERIC DEFAULT 0,
  allocated_bal NUMERIC DEFAULT 0,
  grey_req NUMERIC DEFAULT 0,
  knit_pro NUMERIC DEFAULT 0,
  knit_bal NUMERIC DEFAULT 0,
  a_knit_start TEXT,
  last_production_date TEXT,
  avg_prod_day NUMERIC DEFAULT 0,
  expected_knit_end TEXT,
  knit_start_otd TEXT DEFAULT 'Pending',
  knit_end_otd TEXT DEFAULT 'Pending',
  knit_start_remarks TEXT,
  knit_end_remarks TEXT,
  knit_team_leaders TEXT,
  updated_by TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Layered Knitting Orders Table
CREATE TABLE IF NOT EXISTS public.knitting_orders (
  id TEXT PRIMARY KEY,
  order_no TEXT,
  buyer_name TEXT,
  team_leader TEXT,
  knit_start_date TEXT,
  knit_end_date TEXT,
  req_qty NUMERIC DEFAULT 0,
  grey_qty NUMERIC DEFAULT 0,
  production NUMERIC DEFAULT 0,
  knit_balance NUMERIC DEFAULT 0,
  items JSONB DEFAULT '[]'::jsonb,
  remarks TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Textile Close By PMC Table
CREATE TABLE IF NOT EXISTS public.textile_close_pmc (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'Textile Close By PMC',
  order_no TEXT NOT NULL,
  buyer_name TEXT,
  team_leader TEXT,
  fgsm TEXT,
  f_width TEXT,
  color TEXT,
  fab_type TEXT,
  req_qty NUMERIC DEFAULT 0,
  grey_qty NUMERIC DEFAULT 0,
  production NUMERIC DEFAULT 0,
  knit_bal NUMERIC DEFAULT 0,
  closed_date TEXT,
  remarks TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Fast Query Indexes
CREATE INDEX IF NOT EXISTS idx_order_plans_ewo ON public.order_plans(ewo);
CREATE INDEX IF NOT EXISTS idx_order_plans_buyer ON public.order_plans(buyer);
CREATE INDEX IF NOT EXISTS idx_order_plans_plan_month ON public.order_plans(plan_month);
CREATE INDEX IF NOT EXISTS idx_order_plans_team_leaders ON public.order_plans(knit_team_leaders);
CREATE INDEX IF NOT EXISTS idx_knitting_orders_order_no ON public.knitting_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_knitting_orders_buyer_name ON public.knitting_orders(buyer_name);
CREATE INDEX IF NOT EXISTS idx_textile_close_order_no ON public.textile_close_pmc(order_no);
CREATE INDEX IF NOT EXISTS idx_textile_close_buyer_name ON public.textile_close_pmc(buyer_name);

-- 5. Grant API Role Permissions & Row Level Security Policies
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE public.order_plans, public.knitting_orders, public.textile_close_pmc TO anon, authenticated, service_role;

ALTER TABLE public.order_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knitting_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.textile_close_pmc ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public full access to order_plans" ON public.order_plans;
DROP POLICY IF EXISTS "Allow public full access to knitting_orders" ON public.knitting_orders;
DROP POLICY IF EXISTS "Allow public full access to textile_close_pmc" ON public.textile_close_pmc;

CREATE POLICY "Allow public full access to order_plans" ON public.order_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to knitting_orders" ON public.knitting_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to textile_close_pmc" ON public.textile_close_pmc FOR ALL USING (true) WITH CHECK (true);

-- 6. Enable Instant Sub-50ms Real-Time WebSocket Replication
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'order_plans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_plans;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'knitting_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.knitting_orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'textile_close_pmc'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.textile_close_pmc;
  END IF;
EXCEPTION WHEN OTHERS THEN 
  NULL;
END $$;
`;
  }

  /**
   * Helper SQL schema for automatic copy-paste in Supabase SQL Editor
   */
  static getSetupSQL(): string {
    return `-- =========================================================
-- EPYLLION KNITEX ERP - IDEMPOTENT SUPABASE DATABASE SCHEMA
-- Run this in your Supabase SQL Editor (100% Free Forever)
-- =========================================================

-- 1. USERS & ACCESS MANAGEMENT TABLE (WITH ASSIGNED BUYERS)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  uid TEXT UNIQUE NOT NULL,
  user_name TEXT NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'General',
  designation TEXT,
  department TEXT DEFAULT 'Knitting',
  assigned_units JSONB DEFAULT '[]'::jsonb,
  assigned_buyers JSONB DEFAULT '[]'::jsonb,
  allowed_tabs JSONB DEFAULT '[]'::jsonb,
  tab_permissions JSONB DEFAULT '{}'::jsonb,
  permission TEXT DEFAULT 'Read',
  status TEXT DEFAULT 'Active',
  phone TEXT,
  email TEXT,
  password TEXT DEFAULT 'Password@2026',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add assigned_buyers & tab_permissions columns if users table already existed
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='assigned_buyers') THEN
    ALTER TABLE public.users ADD COLUMN assigned_buyers JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='tab_permissions') THEN
    ALTER TABLE public.users ADD COLUMN tab_permissions JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2. FACTORY UNITS CONFIGURATION TABLE (READABLE TABLE FORMAT)
CREATE TABLE IF NOT EXISTS public.factory_units (
  id TEXT PRIMARY KEY,
  unit_name TEXT NOT NULL,
  production_capacity NUMERIC DEFAULT 0,
  total_machine INTEGER DEFAULT 0,
  avg_prod_per_machine NUMERIC DEFAULT 0,
  target_efficiency NUMERIC DEFAULT 85,
  display_order INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BUYERS DIRECTORY TABLE (READABLE TABLE FORMAT)
CREATE TABLE IF NOT EXISTS public.buyers (
  id TEXT PRIMARY KEY,
  buyer_name TEXT UNIQUE NOT NULL,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SYSTEM OPERATIONAL THRESHOLDS & GLOBAL SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
  id TEXT PRIMARY KEY,
  reject_threshold NUMERIC DEFAULT 2.5,
  max_idle_machines INTEGER DEFAULT 5,
  alarm_email TEXT DEFAULT 'knitprod@epylliongroup.com',
  company_logo TEXT,
  my_logo TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add company_logo & my_logo columns if system_settings already existed
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_settings' AND column_name='company_logo') THEN
    ALTER TABLE public.system_settings ADD COLUMN company_logo TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_settings' AND column_name='my_logo') THEN
    ALTER TABLE public.system_settings ADD COLUMN my_logo TEXT;
  END IF;
END $$;

-- 5. PRODUCTION LEDGER TABLE (HIGH-PERFORMANCE REAL-TIME CLOUD TABLE)
CREATE TABLE IF NOT EXISTS public.production_ledger (
  id TEXT PRIMARY KEY,
  unit TEXT,
  year INTEGER DEFAULT 2026,
  month TEXT,
  date TEXT NOT NULL,
  day TEXT,
  floor TEXT NOT NULL,
  target NUMERIC DEFAULT 0,
  shift_a NUMERIC DEFAULT 0,
  shift_b NUMERIC DEFAULT 0,
  shift_c NUMERIC DEFAULT 0,
  total_production NUMERIC DEFAULT 0,
  target_bulk NUMERIC DEFAULT 0,
  bulk_prod NUMERIC DEFAULT 0,
  sample_prod NUMERIC DEFAULT 0,
  total_machines INTEGER DEFAULT 0,
  running_machine INTEGER DEFAULT 0,
  running_bulk INTEGER DEFAULT 0,
  running_sample INTEGER DEFAULT 0,
  idle_mc INTEGER DEFAULT 0,
  machine_utilization NUMERIC DEFAULT 0,
  idle_mc_pct NUMERIC DEFAULT 0,
  prod_loss_for_sample NUMERIC DEFAULT 0,
  idle_production NUMERIC DEFAULT 0,
  efficiency NUMERIC DEFAULT 0,
  pro_per_mc NUMERIC DEFAULT 0,
  reject NUMERIC DEFAULT 0,
  reject_pct NUMERIC DEFAULT 0,
  hold NUMERIC DEFAULT 0,
  hold_pct NUMERIC DEFAULT 0,
  jhute_cutpcs NUMERIC DEFAULT 0,
  jhute_cutpcs_pct NUMERIC DEFAULT 0,
  needle_broken NUMERIC DEFAULT 0,
  needle_per_kg NUMERIC DEFAULT 0,
  sinker_broken NUMERIC DEFAULT 0,
  sinker_per_kg NUMERIC DEFAULT 0,
  oil_consumption NUMERIC DEFAULT 0,
  belt_broken NUMERIC DEFAULT 0,
  other_spare_parts_name TEXT,
  other_spare_parts_qty NUMERIC DEFAULT 0,
  set_change_needle NUMERIC DEFAULT 0,
  set_change_sinker NUMERIC DEFAULT 0,
  production_loss_for_eff NUMERIC DEFAULT 0,
  capacity_utilization NUMERIC DEFAULT 0,
  total_operator NUMERIC DEFAULT 0,
  absent NUMERIC DEFAULT 0,
  absent_pct NUMERIC DEFAULT 0,
  production_flat_knit NUMERIC DEFAULT 0,
  achievment_circular NUMERIC DEFAULT 0,
  otd TEXT,
  yarn_issued NUMERIC DEFAULT 0,
  total_running_factories INTEGER DEFAULT 0,
  number_vehicles INTEGER DEFAULT 0,
  fabric_return NUMERIC DEFAULT 0,
  remarks TEXT,
  updated_by TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add missing columns if production_ledger was previously created with fewer columns
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='production_ledger' AND column_name='total_machines') THEN
    ALTER TABLE public.production_ledger ADD COLUMN total_machines INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='production_ledger' AND column_name='updated_by') THEN
    ALTER TABLE public.production_ledger ADD COLUMN updated_by TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='production_ledger' AND column_name='raw_data') THEN
    ALTER TABLE public.production_ledger ADD COLUMN raw_data JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Fast Indexes for Instant Queries
CREATE INDEX IF NOT EXISTS idx_production_ledger_date ON public.production_ledger(date);
CREATE INDEX IF NOT EXISTS idx_production_ledger_floor ON public.production_ledger(floor);
CREATE INDEX IF NOT EXISTS idx_production_ledger_unit ON public.production_ledger(unit);

-- 6. ACTIVITY & AUDIT LOGS (UNLIMITED RETENTION)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  floor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. YARN ALLOCATIONS CLOUD DATABASE
CREATE TABLE IF NOT EXISTS public.yarn_allocations (
  id TEXT PRIMARY KEY,
  actual_requisition_date TEXT,
  buyer TEXT,
  order_number TEXT,
  fabrics_type TEXT,
  fabric_shade TEXT,
  fabric_gsm TEXT,
  yarn_required TEXT,
  lot_ref TEXT,
  allocated_yarn TEXT,
  lot_no TEXT,
  spinners_name TEXT,
  allocation_status TEXT,
  yarn_stock_status TEXT,
  yarn_delivery_status TEXT,
  proposed_allocation_date TEXT,
  allocation_date_range TEXT,
  allocation_no TEXT,
  yarn_rq_qty NUMERIC DEFAULT 0,
  allocated_qty NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  remarks TEXT,
  updated_by TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast Indexes for Yarn Allocations
CREATE INDEX IF NOT EXISTS idx_yarn_allocations_order_number ON public.yarn_allocations(order_number);
CREATE INDEX IF NOT EXISTS idx_yarn_allocations_buyer ON public.yarn_allocations(buyer);
CREATE INDEX IF NOT EXISTS idx_yarn_allocations_allocation_no ON public.yarn_allocations(allocation_no);
CREATE INDEX IF NOT EXISTS idx_yarn_allocations_lot_no ON public.yarn_allocations(lot_no);

-- 7. ORDER PLANS & STATUS (PLAN ORDER FOLLOWUP)
CREATE TABLE IF NOT EXISTS public.order_plans (
  id TEXT PRIMARY KEY,
  plan_month TEXT,
  plan_type TEXT,
  ewo TEXT,
  buyer TEXT,
  color TEXT,
  knit_start TEXT,
  knit_end TEXT,
  target NUMERIC DEFAULT 0,
  target_next_month NUMERIC DEFAULT 0,
  allocation_start TEXT,
  allocation_end TEXT,
  allocated_qty NUMERIC DEFAULT 0,
  allocated_bal NUMERIC DEFAULT 0,
  grey_req NUMERIC DEFAULT 0,
  knit_pro NUMERIC DEFAULT 0,
  knit_bal NUMERIC DEFAULT 0,
  a_knit_start TEXT,
  last_production_date TEXT,
  avg_prod_day NUMERIC DEFAULT 0,
  expected_knit_end TEXT,
  knit_start_otd TEXT DEFAULT 'Pending',
  knit_end_otd TEXT DEFAULT 'Pending',
  knit_start_remarks TEXT,
  knit_end_remarks TEXT,
  knit_team_leaders TEXT,
  updated_by TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast Indexes for Order Plans
CREATE INDEX IF NOT EXISTS idx_order_plans_ewo ON public.order_plans(ewo);
CREATE INDEX IF NOT EXISTS idx_order_plans_buyer ON public.order_plans(buyer);
CREATE INDEX IF NOT EXISTS idx_order_plans_plan_month ON public.order_plans(plan_month);
CREATE INDEX IF NOT EXISTS idx_order_plans_team_leaders ON public.order_plans(knit_team_leaders);

-- 8. KNITTING ORDERS & FABRICS (LAYERED STATUS)
CREATE TABLE IF NOT EXISTS public.knitting_orders (
  id TEXT PRIMARY KEY,
  order_no TEXT,
  buyer_name TEXT,
  team_leader TEXT,
  knit_start_date TEXT,
  knit_end_date TEXT,
  req_qty NUMERIC DEFAULT 0,
  grey_qty NUMERIC DEFAULT 0,
  production NUMERIC DEFAULT 0,
  knit_balance NUMERIC DEFAULT 0,
  items JSONB DEFAULT '[]'::jsonb,
  remarks TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knitting_orders_order_no ON public.knitting_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_knitting_orders_buyer_name ON public.knitting_orders(buyer_name);

-- 9. TEXTILE CLOSE BY PMC
CREATE TABLE IF NOT EXISTS public.textile_close_pmc (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'Textile Close By PMC',
  order_no TEXT NOT NULL,
  buyer_name TEXT,
  team_leader TEXT,
  fgsm TEXT,
  f_width TEXT,
  color TEXT,
  fab_type TEXT,
  req_qty NUMERIC DEFAULT 0,
  grey_qty NUMERIC DEFAULT 0,
  production NUMERIC DEFAULT 0,
  knit_bal NUMERIC DEFAULT 0,
  closed_date TEXT,
  remarks TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_textile_close_order_no ON public.textile_close_pmc(order_no);
CREATE INDEX IF NOT EXISTS idx_textile_close_buyer_name ON public.textile_close_pmc(buyer_name);

-- Grant Schema & Table Privileges to Supabase API Roles (Fixes 42501 permission denied on new projects)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yarn_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knitting_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.textile_close_pmc ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first so it never throws error 42710
DROP POLICY IF EXISTS "Allow public full access to users" ON public.users;
DROP POLICY IF EXISTS "Allow public full access to factory_units" ON public.factory_units;
DROP POLICY IF EXISTS "Allow public full access to buyers" ON public.buyers;
DROP POLICY IF EXISTS "Allow public full access to system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public full access to production_ledger" ON public.production_ledger;
DROP POLICY IF EXISTS "Allow public full access to activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow public full access to yarn_allocations" ON public.yarn_allocations;
DROP POLICY IF EXISTS "Allow public full access to order_plans" ON public.order_plans;
DROP POLICY IF EXISTS "Allow public full access to knitting_orders" ON public.knitting_orders;
DROP POLICY IF EXISTS "Allow public full access to textile_close_pmc" ON public.textile_close_pmc;

-- Recreate policies cleanly
CREATE POLICY "Allow public full access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to factory_units" ON public.factory_units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to buyers" ON public.buyers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to production_ledger" ON public.production_ledger FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to yarn_allocations" ON public.yarn_allocations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to order_plans" ON public.order_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to knitting_orders" ON public.knitting_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to textile_close_pmc" ON public.textile_close_pmc FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- Enable Real-Time Broadcast for Tables
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'production_ledger'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.production_ledger;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'yarn_allocations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.yarn_allocations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'order_plans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_plans;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'knitting_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.knitting_orders;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'textile_close_pmc'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.textile_close_pmc;
  END IF;
EXCEPTION WHEN OTHERS THEN 
  NULL;
END $$;

-- Insert Default Factory Units
INSERT INTO public.factory_units (id, unit_name, production_capacity, total_machine, avg_prod_per_machine, display_order)
VALUES
  ('unit-1', 'EKL', 25000, 45, 555.56, 1),
  ('unit-2', 'EFL', 18000, 32, 562.50, 2),
  ('unit-3', 'Auto Stripe', 12000, 20, 600.00, 3),
  ('unit-4', 'EFL-2', 15000, 28, 535.71, 4),
  ('unit-5', 'EFL-Extension', 10000, 18, 555.56, 5),
  ('unit-6', 'ESL-Extension', 8000, 14, 571.43, 6),
  ('unit-7', 'Sub-Contact', 6000, 10, 600.00, 7)
ON CONFLICT (id) DO NOTHING;

-- Insert Default Buyers Directory
INSERT INTO public.buyers (id, buyer_name, status)
VALUES
  ('buy-1', 'Marks & Spencer', 'Active'),
  ('buy-2', 'H&M', 'Active'),
  ('buy-3', 'C&A', 'Active'),
  ('buy-4', 'PUMA', 'Active'),
  ('buy-5', 'Next', 'Active'),
  ('buy-6', 'Zara', 'Active'),
  ('buy-7', 'Decathlon', 'Active'),
  ('buy-8', 'Tesco', 'Active'),
  ('buy-9', 'Target', 'Active'),
  ('buy-10', 'GAP', 'Active'),
  ('buy-11', 'Lindex', 'Active'),
  ('buy-12', 'Bestseller', 'Active'),
  ('buy-13', 'G-Star Raw', 'Active'),
  ('buy-14', 'Mango', 'Active'),
  ('buy-15', 'Levi''s', 'Active'),
  ('buy-16', 'Primark', 'Active'),
  ('buy-17', 'Uniqlo', 'Active'),
  ('buy-18', 'ASOS', 'Active'),
  ('buy-19', 'Carrefour', 'Active'),
  ('buy-20', 'Tommy Hilfiger', 'Active'),
  ('buy-21', 'Calvin Klein', 'Active'),
  ('buy-22', 'Under Armour', 'Active'),
  ('buy-23', 'Esprit', 'Active'),
  ('buy-24', 'Jack & Jones', 'Active')
ON CONFLICT (buyer_name) DO NOTHING;

-- Insert Default System Settings
INSERT INTO public.system_settings (id, reject_threshold, max_idle_machines, alarm_email)
VALUES ('global_settings', 2.5, 5, 'knitprod@epylliongroup.com')
ON CONFLICT (id) DO NOTHING;
`;
  }

  /**
   * Dedicated SQL script for Yarn Allocations table only (safe, idempotent, fast)
   */
  static getYarnSetupSQL(): string {
    return `-- ==========================================
-- EPYLLION KNITEX ERP: YARN ALLOCATIONS CLOUD TABLE
-- Paste and Run in Supabase Dashboard > SQL Editor
-- ==========================================

-- 1. Create Yarn Allocations Table
CREATE TABLE IF NOT EXISTS public.yarn_allocations (
  id TEXT PRIMARY KEY,
  actual_requisition_date TEXT,
  buyer TEXT,
  order_number TEXT,
  fabrics_type TEXT,
  fabric_shade TEXT,
  fabric_gsm TEXT,
  yarn_required TEXT,
  lot_ref TEXT,
  allocated_yarn TEXT,
  lot_no TEXT,
  spinners_name TEXT,
  allocation_status TEXT,
  yarn_stock_status TEXT,
  yarn_delivery_status TEXT,
  proposed_allocation_date TEXT,
  allocation_date_range TEXT,
  allocation_no TEXT,
  yarn_rq_qty NUMERIC DEFAULT 0,
  allocated_qty NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  remarks TEXT,
  updated_by TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Fast Query Indexes
CREATE INDEX IF NOT EXISTS idx_yarn_allocations_order_number ON public.yarn_allocations(order_number);
CREATE INDEX IF NOT EXISTS idx_yarn_allocations_buyer ON public.yarn_allocations(buyer);
CREATE INDEX IF NOT EXISTS idx_yarn_allocations_allocation_no ON public.yarn_allocations(allocation_no);
CREATE INDEX IF NOT EXISTS idx_yarn_allocations_lot_no ON public.yarn_allocations(lot_no);

-- 3. Grant API Role Permissions & Row Level Security Policies
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE public.yarn_allocations TO anon, authenticated, service_role;

ALTER TABLE public.yarn_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to yarn_allocations" ON public.yarn_allocations;
CREATE POLICY "Allow public full access to yarn_allocations" ON public.yarn_allocations FOR ALL USING (true) WITH CHECK (true);

-- 4. Enable Instant Sub-50ms Real-Time WebSocket Replication
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'yarn_allocations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.yarn_allocations;
  END IF;
EXCEPTION WHEN OTHERS THEN 
  NULL;
END $$;
`;
  }

  /**
   * Dedicated SQL script for Textile Close By PMC table only (safe, idempotent, fast)
   */
  static getTextileCloseSetupSQL(): string {
    return `-- =========================================================
-- EPYLLION KNITEX ERP: TEXTILE CLOSE BY PMC CLOUD TABLE
-- Paste and Run in Supabase Dashboard > SQL Editor (Free Forever)
-- =========================================================

-- 1. Create Textile Close By PMC Table
CREATE TABLE IF NOT EXISTS public.textile_close_pmc (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'Textile Close By PMC',
  order_no TEXT NOT NULL,
  buyer_name TEXT,
  team_leader TEXT,
  fgsm TEXT,
  f_width TEXT,
  color TEXT,
  fab_type TEXT,
  req_qty NUMERIC DEFAULT 0,
  grey_qty NUMERIC DEFAULT 0,
  production NUMERIC DEFAULT 0,
  knit_bal NUMERIC DEFAULT 0,
  closed_date TEXT,
  remarks TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Fast Query Indexes
CREATE INDEX IF NOT EXISTS idx_textile_close_order_no ON public.textile_close_pmc(order_no);
CREATE INDEX IF NOT EXISTS idx_textile_close_buyer_name ON public.textile_close_pmc(buyer_name);
CREATE INDEX IF NOT EXISTS idx_textile_close_team_leader ON public.textile_close_pmc(team_leader);
CREATE INDEX IF NOT EXISTS idx_textile_close_status ON public.textile_close_pmc(status);

-- 3. Grant API Role Permissions & Row Level Security Policies
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE public.textile_close_pmc TO anon, authenticated, service_role;

ALTER TABLE public.textile_close_pmc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to textile_close_pmc" ON public.textile_close_pmc;
CREATE POLICY "Allow public full access to textile_close_pmc" ON public.textile_close_pmc FOR ALL USING (true) WITH CHECK (true);

-- 4. Enable Instant Sub-50ms Real-Time WebSocket Replication
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'textile_close_pmc'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.textile_close_pmc;
  END IF;
EXCEPTION WHEN OTHERS THEN 
  NULL;
END $$;
`;
  }
}

