/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-contained Flat Vercel Serverless Function for Shared Supabase Table Caching,
 * Settings Caching, Version Probing, and Raihan-only 80% Egress Warning Telemetry.
 *
 * Route: /api/supabase-cache?table=:table (rewritten from /api/supabase-cache/:table)
 * Zero relative imports or static JSON imports so Vercel Node.js ESM always runs cleanly.
 */

import zlib from 'zlib';
import { createClient } from '@supabase/supabase-js';

type ServerSlotId = 'server1' | 'server2';
type CacheableSupabaseTable =
  | 'production_ledger'
  | 'yarn_allocations'
  | 'order_plans'
  | 'knitting_orders'
  | 'textile_close_pmc'
  | 'grey_stock_summary'
  | 'grey_yarn_stock';

const BYTES_PER_GB = 1_000_000_000;
const RAIHAN_OPERATOR_UIDS = new Set(['EKL001', 'RAIHAN']);

const DEFAULT_SERVER1_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://kwaezsfoalfhigzcnezd.supabase.co';

const DEFAULT_SERVER1_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YWV6c2ZvYWxmaGlnemNuZXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTUzNzksImV4cCI6MjEwMjk3MTM3OX0.eYxuK9fCwix4i0GnHW-UBl2Kg_gZNOaPWvQ6FkMy_Qs';

const DEFAULT_SERVER2_URL =
  process.env.SUPABASE_SERVER2_URL ||
  process.env.VITE_SUPABASE_SERVER2_URL ||
  'https://prunomfyqfbpvzojafar.supabase.co';

const DEFAULT_SERVER2_KEY =
  process.env.SUPABASE_SERVER2_ANON_KEY ||
  process.env.VITE_SUPABASE_SERVER2_ANON_KEY ||
  'sb_publishable_h6pz72HjpfiXGTBuLMcuTQ_Fx8ZAHDm';

const FIRESTORE_PROJECT = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0538168382';
const FIRESTORE_DB_ID =
  process.env.FIREBASE_DB_ID || 'ai-studio-epyllionknitexlt-52272a1a-3da9-4fb0-9f0d-7b27c4e625d8';
const FIRESTORE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyCySmVMKT0b84CB0wVjfO9zwYtppf6JPJw';

interface SupabaseServerSlot {
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

interface SupabaseClusterState {
  activeServerId: ServerSlotId | null;
  clusterRevision: number;
  servers: Record<ServerSlotId, SupabaseServerSlot>;
}

const CACHEABLE_TABLE_CONFIG: Record<
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

const CACHEABLE_SET = new Set<string>(Object.keys(CACHEABLE_TABLE_CONFIG));
const WARM_TTL_MS = 10 * 60 * 1000;
const SETTINGS_TTL_MS = 30 * 60 * 1000;

interface WarmTableEntry {
  rows: any[];
  fetchedAt: number;
  version: number;
  maxUpdatedAt: string | null;
  clusterRevision: number;
}

const warmTableCache = new Map<CacheableSupabaseTable, WarmTableEntry>();
let warmSettingsCache: { data: any; fetchedAt: number; version: number; clusterRevision: number } | null = null;
let lastClusterRevision = 0;
const tablesRequiringWildcard = new Set<string>();
let memoCluster: { state: SupabaseClusterState; loadedAt: number } | null = null;
const MEMO_TTL_MS = 4000;

function setNoStoreHeaders(res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, x-session-uid');
}

function estimateWireEgressBytes(payload: any): number {
  try {
    const raw = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload), 'utf8');
    if (raw.length === 0) return 0;
    return zlib.gzipSync(raw, { level: 1 }).length + 600;
  } catch {
    return 0;
  }
}

function getRequestSessionUid(req: any): string | null {
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

function isRaihanOperatorRequest(req: any): boolean {
  const uid = (getRequestSessionUid(req) || '').replace(/[\s-_]/g, '');
  return RAIHAN_OPERATOR_UIDS.has(uid);
}

function getBillingCycleKey(resetDay: number, now: Date = new Date()): string {
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

function ensureBillingCycleCurrent(slot: SupabaseServerSlot): boolean {
  const expectedKey = getBillingCycleKey(slot.billingResetDay);
  if (slot.cycleMonthKey !== expectedKey) {
    slot.cycleMonthKey = expectedKey;
    slot.trackedBytesThisCycle = 0;
    slot.calibrationOffsetBytes = 0;
    return true;
  }
  return false;
}

function computeSlotEgressMetrics(slot: SupabaseServerSlot) {
  ensureBillingCycleCurrent(slot);
  const trackedBytes = Math.max(0, Number(slot.trackedBytesThisCycle) || 0);
  const calibrationOffsetBytes = Number(slot.calibrationOffsetBytes) || 0;
  const totalBytes = Math.max(0, trackedBytes + calibrationOffsetBytes);
  const usedGb = Number((totalBytes / BYTES_PER_GB).toFixed(3));
  const limitGb = Math.max(0.1, Number(slot.egressLimitGb) || 5.0);
  const pct = Number(Math.min(100, (usedGb / limitGb) * 100).toFixed(1));
  const warningThresholdPct = Math.max(10, Math.min(99, Number(slot.warningThresholdPct) || 80));
  return {
    totalBytes,
    trackedBytes,
    calibrationOffsetBytes,
    usedGb,
    limitGb,
    pct,
    warningThresholdPct,
    isWarning: pct >= warningThresholdPct,
    isCritical: pct >= 95
  };
}

function createDefaultClusterState(): SupabaseClusterState {
  const cycleKey = getBillingCycleKey(1);
  const nowIso = new Date().toISOString();
  return {
    activeServerId: 'server1',
    clusterRevision: 1,
    servers: {
      server1: {
        id: 'server1',
        label: 'Server 1 (Primary)',
        supabaseUrl: DEFAULT_SERVER1_URL,
        supabaseKey: DEFAULT_SERVER1_KEY,
        status: 'active',
        egressLimitGb: 5.0,
        warningThresholdPct: 80,
        billingResetDay: 1,
        trackedBytesThisCycle: 0,
        calibrationOffsetBytes: 0,
        cycleMonthKey: cycleKey,
        lastMigratedAt: null,
        pausedAt: null,
        activatedAt: nowIso
      },
      server2: {
        id: 'server2',
        label: 'Server 2 (Standby)',
        supabaseUrl: DEFAULT_SERVER2_URL,
        supabaseKey: DEFAULT_SERVER2_KEY,
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

function getActiveClusterServer(cluster: SupabaseClusterState): SupabaseServerSlot | null {
  if (!cluster.activeServerId) return null;
  const slot = cluster.servers[cluster.activeServerId];
  if (!slot || slot.status !== 'active' || !slot.supabaseUrl || !slot.supabaseKey) {
    return null;
  }
  return slot;
}

function getClusterDocUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIRESTORE_PROJECT
  )}/databases/${encodeURIComponent(
    FIRESTORE_DB_ID
  )}/documents/settings/supabase_cluster?key=${encodeURIComponent(FIRESTORE_API_KEY)}`;
}

async function saveClusterStateToCloud(state: SupabaseClusterState): Promise<void> {
  memoCluster = { state, loadedAt: Date.now() };
  try {
    await fetch(getClusterDocUrl(), {
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
  } catch {}
}

async function loadClusterStateFromCloud(forceFresh: boolean = false): Promise<SupabaseClusterState> {
  if (!forceFresh && memoCluster && Date.now() - memoCluster.loadedAt < MEMO_TTL_MS) {
    return memoCluster.state;
  }
  const defaults = createDefaultClusterState();
  try {
    const res = await fetch(getClusterDocUrl(), {
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
          memoCluster = { state: merged, loadedAt: Date.now() };
          return merged;
        }
      }
    }
  } catch {
    if (memoCluster) return memoCluster.state;
  }
  memoCluster = { state: defaults, loadedAt: Date.now() };
  return defaults;
}

async function recordServerEgressBytesCloud(serverId: ServerSlotId | null, bytes: number): Promise<void> {
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

function isSupabasePermissionDeniedError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return code === '42501' || msg.includes('permission denied');
}

function isSupabaseQuotaError(err: any): boolean {
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

function parseJsonBody(req: any): Record<string, any> {
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

function computeMaxUpdatedAt(rows: any[]): string | null {
  let maxTs: string | null = null;
  for (const r of rows) {
    const ts = r?.updated_at || r?.created_at || null;
    if (typeof ts === 'string' && (!maxTs || ts > maxTs)) {
      maxTs = ts;
    }
  }
  return maxTs;
}

export default async function handler(req: any, res: any) {
  setNoStoreHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawTable = Array.isArray(req.query?.table) ? req.query.table[0] : req.query?.table;
  const fallbackFromUrl =
    typeof req.url === 'string'
      ? req.url.split('?')[0].split('/').filter(Boolean).pop()
      : '';
  const target = String(
    rawTable || (fallbackFromUrl && fallbackFromUrl !== 'supabase-cache' ? fallbackFromUrl : '')
  ).trim();
  const body = parseJsonBody(req);

  try {
    const cluster = await loadClusterStateFromCloud(target === 'versions');
    if (cluster.clusterRevision !== lastClusterRevision) {
      warmTableCache.clear();
      warmSettingsCache = null;
      tablesRequiringWildcard.clear();
      lastClusterRevision = cluster.clusterRevision;
    }
    const activeSlot = getActiveClusterServer(cluster);

    // 1. GET /api/supabase-cache/versions
    if (target === 'versions' && req.method === 'GET') {
      const versions: Record<
        string,
        { version: number; fetchedAt: number; maxUpdatedAt: string | null; count: number }
      > = {};
      for (const tbl of CACHEABLE_SET) {
        const entry = warmTableCache.get(tbl as CacheableSupabaseTable);
        versions[tbl] = {
          version: entry?.version || 0,
          fetchedAt: entry?.fetchedAt || 0,
          maxUpdatedAt: entry?.maxUpdatedAt || null,
          count: entry?.rows?.length || 0
        };
      }
      versions.settings = {
        version: warmSettingsCache?.version || 0,
        fetchedAt: warmSettingsCache?.fetchedAt || 0,
        maxUpdatedAt: null,
        count: warmSettingsCache ? 1 : 0
      };

      let raihanAlert: {
        showWarning: boolean;
        activeServerId: 'server1' | 'server2' | null;
        activeServerLabel: string;
        usedGb: number;
        limitGb: number;
        pct: number;
        isCritical: boolean;
        isRestricted: boolean;
      } | null = null;

      if (isRaihanOperatorRequest(req) && activeSlot) {
        const metrics = computeSlotEgressMetrics(activeSlot);
        raihanAlert = {
          showWarning: metrics.isWarning,
          activeServerId: activeSlot.id,
          activeServerLabel: activeSlot.label,
          usedGb: metrics.usedGb,
          limitGb: metrics.limitGb,
          pct: metrics.pct,
          isCritical: metrics.isCritical,
          isRestricted: false
        };
      }

      return res.status(200).json({
        success: true,
        restricted: false,
        reason: null,
        activeServerId: cluster.activeServerId,
        activeServerPaused: !activeSlot,
        clusterRevision: cluster.clusterRevision,
        raihanAlert,
        versions
      });
    }

    // 2. POST /api/supabase-cache/invalidate
    if (target === 'invalidate' && req.method === 'POST') {
      const tbl = typeof body.table === 'string' ? body.table.trim() : '';
      const estimatedBytes = Number(body.estimatedBytes) || 0;
      if (estimatedBytes > 0 && estimatedBytes < 50 * 1024 * 1024 && activeSlot) {
        await recordServerEgressBytesCloud(activeSlot.id, estimatedBytes);
      }
      if (tbl === 'all') {
        warmTableCache.clear();
        warmSettingsCache = null;
        return res.status(200).json({ success: true, invalidated: 'all' });
      }
      if (tbl === 'settings') {
        warmSettingsCache = null;
        return res.status(200).json({ success: true, invalidated: 'settings', version: 1 });
      }
      if (CACHEABLE_SET.has(tbl)) {
        const entry = warmTableCache.get(tbl as CacheableSupabaseTable);
        warmTableCache.delete(tbl as CacheableSupabaseTable);
        return res.status(200).json({
          success: true,
          invalidated: tbl,
          version: (entry?.version || 0) + 1
        });
      }
      return res.status(200).json({ success: true, invalidated: tbl || 'none' });
    }

    // 3. Hard-Pause Lock: zero bytes in/out when active server is paused
    if (!activeSlot) {
      return res.status(200).json({
        success: false,
        paused: true,
        activeServerId: null,
        activeServerPaused: true,
        clusterRevision: cluster.clusterRevision,
        reason: 'Active database server is paused by Superadmin. Zero traffic in/out.',
        rows: [],
        settings: null
      });
    }

    // 4. GET /api/supabase-cache/settings
    if (target === 'settings' && req.method === 'GET') {
      const force = req.query?.force === '1' || req.query?.force === 'true';
      if (!force && warmSettingsCache && Date.now() - warmSettingsCache.fetchedAt < SETTINGS_TTL_MS) {
        return res.status(200).json({
          success: true,
          fromCache: true,
          version: warmSettingsCache.version,
          settings: warmSettingsCache.data
        });
      }

      const supabase = createClient(activeSlot.supabaseUrl, activeSlot.supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const [unitsRes, buyersRes, sysRes] = await Promise.all([
        supabase.from('factory_units').select('*').order('display_order', { ascending: true }),
        supabase.from('buyers').select('*').order('buyer_name', { ascending: true }),
        supabase.from('system_settings').select('*').eq('id', 'global').maybeSingle()
      ]);

      const settingsData = {
        units: Array.isArray(unitsRes.data) ? unitsRes.data : [],
        buyers: Array.isArray(buyersRes.data) ? buyersRes.data : [],
        systemSettings: sysRes.data || null
      };

      try {
        await recordServerEgressBytesCloud(activeSlot.id, estimateWireEgressBytes(settingsData));
      } catch {}

      warmSettingsCache = {
        data: settingsData,
        fetchedAt: Date.now(),
        version: (warmSettingsCache?.version || 0) + 1,
        clusterRevision: cluster.clusterRevision
      };

      return res.status(200).json({
        success: true,
        fromCache: false,
        version: warmSettingsCache.version,
        settings: settingsData
      });
    }

    // 5. GET /api/supabase-cache/:table
    if (!CACHEABLE_SET.has(target)) {
      return res.status(400).json({ success: false, message: `Unsupported table: ${target}` });
    }

    const tbl = target as CacheableSupabaseTable;
    const force = req.query?.force === '1' || req.query?.force === 'true';
    const existing = warmTableCache.get(tbl);
    if (!force && existing && Date.now() - existing.fetchedAt < WARM_TTL_MS) {
      return res.status(200).json({
        success: true,
        fromCache: true,
        version: existing.version,
        activeServerId: cluster.activeServerId,
        activeServerPaused: false,
        clusterRevision: cluster.clusterRevision,
        rows: existing.rows
      });
    }

    const supabase = createClient(activeSlot.supabaseUrl, activeSlot.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const cfg = CACHEABLE_TABLE_CONFIG[tbl];
    let selectClause = tablesRequiringWildcard.has(tbl) ? '*' : cfg.columns;
    let orderCol: string | null = cfg.orderCol;

    const allRows: any[] = [];
    const BATCH_SIZE = 1000;
    let from = 0;

    while (true) {
      let query = supabase.from(tbl).select(selectClause);
      if (orderCol) {
        query = query.order(orderCol, { ascending: cfg.ascending });
      }
      const { data, error } = await query.range(from, from + BATCH_SIZE - 1);

      if (error) {
        if (isSupabaseQuotaError(error)) {
          return res.status(200).json({
            success: false,
            restricted: true,
            reason: error.message || 'Supabase egress quota exceeded.',
            rows: existing?.rows || []
          });
        }
        if (isSupabasePermissionDeniedError(error)) {
          return res.status(200).json({
            success: false,
            restricted: false,
            reason: error.message,
            rows: existing?.rows || []
          });
        }
        if (
          selectClause !== '*' &&
          (error.code === '42703' ||
            error.code === 'PGRST204' ||
            error.message?.includes('does not exist') ||
            error.message?.includes('Could not find'))
        ) {
          tablesRequiringWildcard.add(tbl);
          selectClause = '*';
          from = 0;
          allRows.length = 0;
          continue;
        }
        if (orderCol && (error.code === '42703' || error.message?.includes('column'))) {
          orderCol = null;
          from = 0;
          allRows.length = 0;
          continue;
        }
        if (error.code === 'PGRST205' || error.code === '42P01') {
          break;
        }
        return res.status(200).json({
          success: false,
          restricted: false,
          reason: error.message,
          rows: existing?.rows || []
        });
      }

      if (!Array.isArray(data) || data.length === 0) break;
      const rowsBatch = data as any[];
      if (tbl === 'knitting_orders') {
        for (const r of rowsBatch) {
          if (r && r.raw_data && typeof r.raw_data === 'object' && 'items' in r.raw_data) {
            const { items: _dup, ...slimMeta } = r.raw_data;
            allRows.push({ ...r, raw_data: slimMeta });
          } else {
            allRows.push(r);
          }
        }
      } else {
        allRows.push(...rowsBatch);
      }
      if (rowsBatch.length < BATCH_SIZE) break;
      from += BATCH_SIZE;
    }

    if (allRows.length > 0) {
      try {
        await recordServerEgressBytesCloud(activeSlot.id, estimateWireEgressBytes(allRows));
      } catch {}
    }

    const nextEntry: WarmTableEntry = {
      rows: allRows,
      fetchedAt: Date.now(),
      version: (existing?.version || 0) + 1,
      maxUpdatedAt: computeMaxUpdatedAt(allRows),
      clusterRevision: cluster.clusterRevision
    };
    warmTableCache.set(tbl, nextEntry);

    return res.status(200).json({
      success: true,
      fromCache: false,
      version: nextEntry.version,
      activeServerId: cluster.activeServerId,
      activeServerPaused: false,
      clusterRevision: cluster.clusterRevision,
      rows: allRows
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Unexpected error in supabase-cache.'
    });
  }
}
