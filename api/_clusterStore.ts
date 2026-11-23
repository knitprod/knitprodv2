/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared Dual-Supabase Cluster State Coordinator for Vercel Serverless Functions.
 * Persists a single ~1 KB cluster configuration document in Firestore (`settings/supabase_cluster`)
 * so active/paused state, Server 2 credentials, and egress meters survive Vercel cold starts
 * and synchronize across all connected users with 0 bytes of Supabase egress.
 */

import zlib from 'zlib';
import firebaseConfig from '../firebase-applet-config.json';

export type ServerSlotId = 'server1' | 'server2';
// Decimal GB (1e9 bytes) matches Supabase's Free Plan egress billing meter (5 GB = 5,000,000,000 bytes)
export const BYTES_PER_GB = 1_000_000_000;
export const RAIHAN_OPERATOR_UIDS = new Set(['EKL001', 'RAIHAN']);

export function estimateWireEgressBytes(payload: any): number {
  try {
    const raw = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload), 'utf8');
    if (raw.length === 0) return 0;
    return zlib.gzipSync(raw, { level: 1 }).length + 600;
  } catch {
    return 0;
  }
}

export const DEFAULT_SERVER1_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://kwaezsfoalfhigzcnezd.supabase.co';

export const DEFAULT_SERVER1_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YWV6c2ZvYWxmaGlnemNuZXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTUzNzksImV4cCI6MjEwMjk3MTM3OX0.eYxuK9fCwix4i0GnHW-UBl2Kg_gZNOaPWvQ6FkMy_Qs';

export const DEFAULT_SERVER2_URL =
  process.env.SUPABASE_SERVER2_URL ||
  process.env.VITE_SUPABASE_SERVER2_URL ||
  'https://prunomfyqfbpvzojafar.supabase.co';

export const DEFAULT_SERVER2_KEY =
  process.env.SUPABASE_SERVER2_ANON_KEY ||
  process.env.VITE_SUPABASE_SERVER2_ANON_KEY ||
  'sb_publishable_h6pz72HjpfiXGTBuLMcuTQ_Fx8ZAHDm';

export interface SupabaseServerSlot {
  id: ServerSlotId;
  label: string;
  supabaseUrl: string;
  supabaseKey: string;
  status: 'active' | 'paused';
  egressLimitGb: number;
  warningThresholdPct: number;
  billingResetDay: number;
  trackedBytesThisCycle: number;
  calibrationOffsetBytes: number;
  cycleMonthKey: string;
  lastMigratedAt: string | null;
  pausedAt: string | null;
  activatedAt: string | null;
}

export interface SupabaseClusterState {
  activeServerId: ServerSlotId | null;
  clusterRevision: number;
  servers: Record<ServerSlotId, SupabaseServerSlot>;
}

export const MIGRATION_TABLES: Array<{
  table: string;
  label: string;
  conflictCol: string;
  required: boolean;
}> = [
  { table: 'production_ledger', label: 'Production Ledger', conflictCol: 'id', required: true },
  { table: 'yarn_allocations', label: 'Yarn Allocations', conflictCol: 'id', required: true },
  { table: 'order_plans', label: 'Plan Order Followup', conflictCol: 'id', required: true },
  { table: 'knitting_orders', label: 'Knitting Status Orders', conflictCol: 'id', required: true },
  { table: 'textile_close_pmc', label: 'Textile Close By PMC', conflictCol: 'id', required: true },
  { table: 'grey_stock_summary', label: 'Grey Stock Summary', conflictCol: 'id', required: true },
  { table: 'grey_yarn_stock', label: 'Grey Yarn Stock Summary', conflictCol: 'id', required: true },
  { table: 'users', label: 'System Users & Permissions', conflictCol: 'uid', required: true },
  { table: 'factory_units', label: 'Factory Units & Capacity', conflictCol: 'id', required: true },
  { table: 'buyers', label: 'Buyers Directory', conflictCol: 'buyer_name', required: true },
  { table: 'system_settings', label: 'System Settings & Logos', conflictCol: 'id', required: true },
  { table: 'activity_logs', label: 'Activity Audit Logs', conflictCol: 'id', required: true },
  { table: 'app_settings', label: 'Legacy App Settings (Optional)', conflictCol: 'id', required: false }
];

export type CacheableSupabaseTable =
  | 'production_ledger'
  | 'yarn_allocations'
  | 'order_plans'
  | 'knitting_orders'
  | 'textile_close_pmc'
  | 'grey_stock_summary'
  | 'grey_yarn_stock';

export const CACHEABLE_TABLE_CONFIG: Record<
  CacheableSupabaseTable,
  { columns: string; orderCol: string | null; ascending: boolean }
> = {
  production_ledger: {
    columns:
      'id,date,unit,floor,shift_a,shift_b,shift_c,total_production,target,efficiency,active_machines,total_machines,machine_utilization,idle_machines,running_orders,buyer,remarks,updated_by,created_at,updated_at',
    orderCol: 'date',
    ascending: false
  },
  yarn_allocations: {
    columns:
      'id,actual_requisition_date,buyer,order_number,fabrics_type,fabric_shade,fabric_gsm,yarn_required,lot_ref,allocated_yarn,lot_no,spinners_name,allocation_status,yarn_stock_status,yarn_delivery_status,proposed_allocation_date,allocation_date_range,allocation_no,yarn_rq_qty,allocated_qty,balance,remarks,updated_by,created_at,updated_at',
    orderCol: 'id',
    ascending: false
  },
  order_plans: {
    columns:
      'id,plan_month,plan_type,ewo,buyer,color,knit_start,knit_end,target,target_next_month,allocation_start,allocation_end,allocated_qty,allocated_bal,grey_req,knit_pro,knit_bal,a_knit_start,last_production_date,avg_prod_day,expected_knit_end,knit_start_otd,knit_end_otd,knit_start_remarks,knit_end_remarks,knit_team_leaders,updated_by,created_at,updated_at',
    orderCol: 'id',
    ascending: false
  },
  knitting_orders: {
    columns:
      'id,order_no,buyer_name,team_leader,knit_start_date,knit_end_date,req_qty,grey_qty,production,knit_balance,items,remarks,raw_data,created_at,updated_at',
    orderCol: 'id',
    ascending: false
  },
  textile_close_pmc: {
    columns:
      'id,status,order_no,buyer_name,team_leader,fgsm,f_width,color,fab_type,req_qty,grey_qty,production,knit_bal,closed_date,remarks,updated_at',
    orderCol: 'order_no',
    ascending: true
  },
  grey_stock_summary: {
    columns:
      'id,code,order_no,buyer_name,colour,fab_style,fab_type,status,completion_date,net_received_qty,net_issued_qty,stock_qty,double_count,owner_unit,matched_grey_qty,updated_at',
    orderCol: 'id',
    ascending: true
  },
  grey_yarn_stock: {
    columns:
      'id,completion_date,buyer,status,allocated_order_wa,physical_count,physical_lot,spinner,booking_qty,yarn_required,net_received,total_issued,excess_issued,total_stock_qty,issue_balance,order_no,buyer_name,physical_yarn_count,physical_yarn_lot,total_received,issued_balance,remarks,updated_at',
    orderCol: 'order_no',
    ascending: true
  }
};

export function setNoStoreHeaders(res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, x-session-uid');
}

export function getRequestSessionUid(req: any): string | null {
  const headerUid = req?.headers?.['x-session-uid'];
  let cookieUid: string | null = null;
  const cookieHeader = req?.headers?.cookie;
  if (typeof cookieHeader === 'string' && cookieHeader) {
    const match = cookieHeader.match(/ekl_auth_session=([^;]+)/);
    if (match) {
      try {
        cookieUid = decodeURIComponent(match[1]);
      } catch {
        cookieUid = match[1];
      }
    }
  }
  const effective =
    typeof headerUid === 'string' && headerUid.trim()
      ? headerUid.trim().toUpperCase()
      : cookieUid && cookieUid.trim()
        ? cookieUid.trim().toUpperCase()
        : null;
  return effective;
}

export function isRaihanOperatorRequest(req: any): boolean {
  const uid = (getRequestSessionUid(req) || '').replace(/[\s-_]/g, '');
  return RAIHAN_OPERATOR_UIDS.has(uid);
}

export function requireRaihanOperator(req: any, res: any): boolean {
  if (!isRaihanOperatorRequest(req)) {
    res.status(403).json({
      success: false,
      message: 'Restricted: Dual-server failover controls are strictly limited to Superadmin (EKL001) / Raihan.'
    });
    return false;
  }
  return true;
}

export function sanitizeSupabaseUrl(raw: string): string | null {
  let clean = String(raw || '').trim();
  if (!clean) return null;
  const dashMatch = clean.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
  if (dashMatch && dashMatch[1]) {
    clean = `https://${dashMatch[1]}.supabase.co`;
  }
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    // SSRF guard: reject loopback, metadata, link-local, and RFC1918 private addresses
    if (
      host === 'localhost' ||
      host === '::1' ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('169.254.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function getBillingCycleKey(resetDay: number, now: Date = new Date()): string {
  const safeDay = Math.max(1, Math.min(28, Math.floor(Number(resetDay) || 1)));
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1;
  if (now.getUTCDate() < safeDay) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  return `${year}-${String(month).padStart(2, '0')}-d${String(safeDay).padStart(2, '0')}`;
}

export function ensureBillingCycleCurrent(slot: SupabaseServerSlot): boolean {
  const expectedKey = getBillingCycleKey(slot.billingResetDay);
  if (slot.cycleMonthKey !== expectedKey) {
    slot.cycleMonthKey = expectedKey;
    slot.trackedBytesThisCycle = 0;
    slot.calibrationOffsetBytes = 0;
    return true;
  }
  return false;
}

export function maskKeyPreview(key: string): string {
  const clean = String(key || '').trim();
  if (!clean) return '';
  if (clean.length <= 12) return '••••••••';
  return `${clean.slice(0, 8)}••••••••${clean.slice(-6)}`;
}

export function computeSlotEgressMetrics(slot: SupabaseServerSlot) {
  ensureBillingCycleCurrent(slot);
  const trackedBytes = Math.max(0, Number(slot.trackedBytesThisCycle) || 0);
  const calibrationOffsetBytes = Number(slot.calibrationOffsetBytes) || 0;
  const totalBytes = Math.max(0, trackedBytes + calibrationOffsetBytes);
  const usedGb = Number((totalBytes / BYTES_PER_GB).toFixed(3));
  const trackedGb = Number((trackedBytes / BYTES_PER_GB).toFixed(4));
  const limitGb = Math.max(0.1, Number(slot.egressLimitGb) || 5.0);
  const pct = Number(Math.min(100, (usedGb / limitGb) * 100).toFixed(1));
  const warningThresholdPct = Math.max(10, Math.min(99, Number(slot.warningThresholdPct) || 80));
  return {
    totalBytes,
    trackedBytes,
    calibrationOffsetBytes,
    trackedGb,
    usedGb,
    limitGb,
    pct,
    warningThresholdPct,
    isWarning: pct >= warningThresholdPct,
    isCritical: pct >= 95
  };
}

export function createDefaultClusterState(): SupabaseClusterState {
  const cycleKey = getBillingCycleKey(1);
  const nowIso = new Date().toISOString();
  const s1Url = sanitizeSupabaseUrl(DEFAULT_SERVER1_URL) || DEFAULT_SERVER1_URL;
  const s1Key = DEFAULT_SERVER1_KEY.trim();
  const s2Url = sanitizeSupabaseUrl(DEFAULT_SERVER2_URL) || DEFAULT_SERVER2_URL;
  const s2Key = DEFAULT_SERVER2_KEY.trim();

  return {
    activeServerId: s1Url && s1Key ? 'server1' : null,
    clusterRevision: 1,
    servers: {
      server1: {
        id: 'server1',
        label: 'Server 1 (Primary)',
        supabaseUrl: s1Url,
        supabaseKey: s1Key,
        status: s1Url && s1Key ? 'active' : 'paused',
        egressLimitGb: 5.0,
        warningThresholdPct: 80,
        billingResetDay: 1,
        trackedBytesThisCycle: 0,
        calibrationOffsetBytes: 0,
        cycleMonthKey: cycleKey,
        lastMigratedAt: null,
        pausedAt: null,
        activatedAt: s1Url && s1Key ? nowIso : null
      },
      server2: {
        id: 'server2',
        label: 'Server 2 (Standby)',
        supabaseUrl: s2Url,
        supabaseKey: s2Key,
        status: 'paused',
        egressLimitGb: 5.0,
        warningThresholdPct: 80,
        billingResetDay: 1,
        trackedBytesThisCycle: 0,
        calibrationOffsetBytes: 0,
        cycleMonthKey: cycleKey,
        lastMigratedAt: null,
        pausedAt: nowIso,
        activatedAt: null
      }
    }
  };
}

export function getActiveClusterServer(cluster: SupabaseClusterState): SupabaseServerSlot | null {
  if (!cluster.activeServerId) return null;
  const slot = cluster.servers[cluster.activeServerId];
  if (!slot || slot.status !== 'active' || !slot.supabaseUrl || !slot.supabaseKey) {
    return null;
  }
  return slot;
}

// =========================================================================
// FIRESTORE REST PERSISTENCE (0 BYTES SUPABASE EGRESS, SURVIVES COLD STARTS)
// =========================================================================

const FIRESTORE_PROJECT = firebaseConfig?.projectId || '';
const FIRESTORE_DB_ID = firebaseConfig?.firestoreDatabaseId || '(default)';
const FIRESTORE_API_KEY = firebaseConfig?.apiKey || '';

function getClusterDocUrl(): string | null {
  if (!FIRESTORE_PROJECT || !FIRESTORE_API_KEY) return null;
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIRESTORE_PROJECT
  )}/databases/${encodeURIComponent(
    FIRESTORE_DB_ID
  )}/documents/settings/supabase_cluster?key=${encodeURIComponent(FIRESTORE_API_KEY)}`;
}

let memoCluster: { state: SupabaseClusterState; loadedAt: number } | null = null;
const MEMO_TTL_MS = 4000; // 4s warm lambda cache; writes bypass and refresh immediately

export async function loadClusterStateFromCloud(forceFresh: boolean = false): Promise<SupabaseClusterState> {
  if (!forceFresh && memoCluster && Date.now() - memoCluster.loadedAt < MEMO_TTL_MS) {
    return memoCluster.state;
  }

  const defaults = createDefaultClusterState();
  const docUrl = getClusterDocUrl();

  if (docUrl) {
    try {
      const res = await fetch(docUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const doc = await res.json();
        const rawPayload = doc?.fields?.payload?.stringValue;
        if (typeof rawPayload === 'string' && rawPayload.trim()) {
          const parsed = JSON.parse(rawPayload);
          if (parsed && parsed.servers?.server1 && parsed.servers?.server2) {
            const merged: SupabaseClusterState = {
              activeServerId:
                parsed.activeServerId === 'server1' || parsed.activeServerId === 'server2'
                  ? parsed.activeServerId
                  : null,
              clusterRevision: Number(parsed.clusterRevision) || 1,
              servers: {
                server1: {
                  ...defaults.servers.server1,
                  ...parsed.servers.server1,
                  id: 'server1',
                  supabaseUrl: parsed.servers.server1.supabaseUrl || defaults.servers.server1.supabaseUrl,
                  supabaseKey: parsed.servers.server1.supabaseKey || defaults.servers.server1.supabaseKey
                },
                server2: {
                  ...defaults.servers.server2,
                  ...parsed.servers.server2,
                  id: 'server2',
                  supabaseUrl: parsed.servers.server2.supabaseUrl || defaults.servers.server2.supabaseUrl,
                  supabaseKey: parsed.servers.server2.supabaseKey || defaults.servers.server2.supabaseKey
                }
              }
            };
            const backfilledS2 =
              !parsed.servers.server2.supabaseUrl || !parsed.servers.server2.supabaseKey;
            const changed1 = ensureBillingCycleCurrent(merged.servers.server1);
            const changed2 = ensureBillingCycleCurrent(merged.servers.server2);
            memoCluster = { state: merged, loadedAt: Date.now() };
            if (changed1 || changed2 || backfilledS2) {
              await saveClusterStateToCloud(merged).catch(() => {});
            }
            return merged;
          }
        }
      } else if (res.status === 404) {
        // First-time bootstrap: seed default Server 1 Active / Server 2 Paused state
        await saveClusterStateToCloud(defaults).catch(() => {});
        return defaults;
      }
    } catch {
      // Fall back to warm memo or defaults on transient network issue
      if (memoCluster) return memoCluster.state;
    }
  }

  memoCluster = { state: defaults, loadedAt: Date.now() };
  return defaults;
}

export async function saveClusterStateToCloud(state: SupabaseClusterState): Promise<void> {
  memoCluster = { state, loadedAt: Date.now() };
  const docUrl = getClusterDocUrl();
  if (!docUrl) return;

  try {
    await fetch(docUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        fields: {
          payload: { stringValue: JSON.stringify(state) },
          updatedAt: { stringValue: new Date().toISOString() },
          clusterRevision: { integerValue: String(state.clusterRevision || 1) }
        }
      }),
      signal: AbortSignal.timeout(6000)
    });
  } catch {
    // Keep in-memory state updated even if persistence fails transiently
  }
}

export async function recordServerEgressBytesCloud(
  serverId: ServerSlotId | null,
  bytes: number
): Promise<void> {
  if (!serverId || !Number.isFinite(bytes) || bytes <= 0) return;
  try {
    const cluster = await loadClusterStateFromCloud(false);
    const slot = cluster.servers[serverId];
    if (!slot) return;
    ensureBillingCycleCurrent(slot);
    slot.trackedBytesThisCycle = (Number(slot.trackedBytesThisCycle) || 0) + Math.round(bytes);
    await saveClusterStateToCloud(cluster);
  } catch {}
}

export function isSupabasePermissionDeniedError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return code === '42501' || msg.includes('permission denied');
}

export function isSupabaseQuotaError(err: any): boolean {
  if (!err) return false;
  try {
    const msg = (
      typeof err === 'string'
        ? err
        : err.message || err.details || err.hint || JSON.stringify(err)
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

export function parseJsonBody(req: any): Record<string, any> {
  if (!req || req.body == null) return {};
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf8'));
    } catch {
      return {};
    }
  }
  if (typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}
