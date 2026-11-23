/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-contained Flat Vercel Serverless Function for Dual-Supabase Failover,
 * Egress Calibration, Browser Egress Reporting, Manual Active/Pause Switching,
 * and Chunked 12-Table Live Migration.
 *
 * Route: /api/supabase-failover?action=:action (rewritten from /api/supabase-failover/:action)
 * Zero relative imports or static JSON imports so Vercel Node.js ESM always runs cleanly.
 */

import zlib from 'zlib';
import { createClient } from '@supabase/supabase-js';

type ServerSlotId = 'server1' | 'server2';

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

const MIGRATION_TABLES: Array<{
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

function sanitizeSupabaseUrl(raw: string): string | null {
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

function maskKeyPreview(key: string): string {
  const clean = String(key || '').trim();
  if (!clean) return '';
  if (clean.length <= 12) return '••••••••';
  return `${clean.slice(0, 8)}••••••••${clean.slice(-6)}`;
}

function computeSlotEgressMetrics(slot: SupabaseServerSlot) {
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

function createDefaultClusterState(): SupabaseClusterState {
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

let memoCluster: { state: SupabaseClusterState; loadedAt: number } | null = null;
const MEMO_TTL_MS = 4000;

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
          const backfilledS2 = !parsed.servers.server2.supabaseUrl || !parsed.servers.server2.supabaseKey;
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
      await saveClusterStateToCloud(defaults).catch(() => {});
      return defaults;
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

export default async function handler(req: any, res: any) {
  setNoStoreHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawAction = Array.isArray(req.query?.action) ? req.query.action[0] : req.query?.action;
  const fallbackFromUrl =
    typeof req.url === 'string'
      ? req.url.split('?')[0].split('/').filter(Boolean).pop()
      : '';
  const action = String(
    rawAction || (fallbackFromUrl && fallbackFromUrl !== 'supabase-failover' ? fallbackFromUrl : '')
  )
    .trim()
    .toLowerCase();
  const body = parseJsonBody(req);

  // 0. POST /api/supabase-failover/report-egress (any authenticated user reports direct browser Supabase wire bytes)
  if (action === 'report-egress' && req.method === 'POST') {
    const headerOrCookieUid = getRequestSessionUid(req);
    const bodyUid = typeof body.uid === 'string' ? body.uid.trim().toUpperCase() : '';
    const effectiveUid = headerOrCookieUid || (/^[A-Z0-9_-]{2,32}$/.test(bodyUid) ? bodyUid : null);
    if (!effectiveUid) {
      return res.status(401).json({ success: false, message: 'Active session required.' });
    }
    const bytes = Math.round(Number(body.bytes) || 0);
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 50_000_000) {
      return res.status(200).json({ success: true, ignored: true });
    }
    try {
      const cluster = await loadClusterStateFromCloud(false);
      const activeSlot = getActiveClusterServer(cluster);
      if (!activeSlot) {
        return res.status(200).json({ success: true, ignored: true });
      }
      await recordServerEgressBytesCloud(activeSlot.id, bytes);
      return res.status(200).json({ success: true, recorded: bytes, serverId: activeSlot.id });
    } catch {
      return res.status(200).json({ success: true, ignored: true });
    }
  }

  // Strictly restrict all failover controls to Superadmin (EKL001) / Raihan
  if (!isRaihanOperatorRequest(req)) {
    return res.status(403).json({
      success: false,
      message: 'Restricted: Dual-server failover controls are strictly limited to Superadmin (EKL001) / Raihan.'
    });
  }

  try {
    // 1. GET /api/supabase-failover/status
    if (action === 'status' && req.method === 'GET') {
      const cluster = await loadClusterStateFromCloud(true);
      const buildView = (slot: SupabaseServerSlot) => {
        const metrics = computeSlotEgressMetrics(slot);
        return {
          id: slot.id,
          label: slot.label,
          supabaseUrl: slot.supabaseUrl,
          hasKey: Boolean(slot.supabaseKey && slot.supabaseKey.trim()),
          keyPreview: maskKeyPreview(slot.supabaseKey),
          status: slot.status,
          isActive: cluster.activeServerId === slot.id && slot.status === 'active',
          billingResetDay: slot.billingResetDay,
          cycleMonthKey: slot.cycleMonthKey,
          lastMigratedAt: slot.lastMigratedAt,
          pausedAt: slot.pausedAt,
          activatedAt: slot.activatedAt,
          ...metrics
        };
      };

      return res.status(200).json({
        success: true,
        activeServerId: cluster.activeServerId,
        clusterRevision: cluster.clusterRevision,
        restricted: false,
        reason: null,
        servers: {
          server1: buildView(cluster.servers.server1),
          server2: buildView(cluster.servers.server2)
        },
        activeJob: null
      });
    }

    // 2. POST /api/supabase-failover/config
    if (action === 'config' && req.method === 'POST') {
      const serverId = body.serverId;
      if (serverId !== 'server1' && serverId !== 'server2') {
        return res.status(400).json({ success: false, message: 'Invalid serverId. Must be server1 or server2.' });
      }

      const cluster = await loadClusterStateFromCloud(true);
      const slot = cluster.servers[serverId as ServerSlotId];

      if (typeof body.label === 'string' && body.label.trim()) {
        slot.label = body.label.trim().slice(0, 60);
      }
      if (typeof body.supabaseUrl === 'string') {
        const rawUrl = body.supabaseUrl.trim();
        if (!rawUrl) {
          slot.supabaseUrl = '';
        } else {
          const cleanUrl = sanitizeSupabaseUrl(rawUrl);
          if (!cleanUrl) {
            return res.status(400).json({ success: false, message: 'Please enter a valid HTTPS Supabase Project URL.' });
          }
          slot.supabaseUrl = cleanUrl;
        }
      }
      if (typeof body.supabaseKey === 'string' && body.supabaseKey.trim()) {
        slot.supabaseKey = body.supabaseKey.trim();
      }
      if (body.billingResetDay !== undefined) {
        const day = Math.floor(Number(body.billingResetDay));
        if (Number.isFinite(day) && day >= 1 && day <= 28) {
          slot.billingResetDay = day;
          ensureBillingCycleCurrent(slot);
        }
      }
      if (body.egressLimitGb !== undefined) {
        const lim = Number(body.egressLimitGb);
        if (Number.isFinite(lim) && lim >= 0.5 && lim <= 500) {
          slot.egressLimitGb = Number(lim.toFixed(2));
        }
      }
      if (body.warningThresholdPct !== undefined) {
        const pct = Number(body.warningThresholdPct);
        if (Number.isFinite(pct) && pct >= 10 && pct <= 99) {
          slot.warningThresholdPct = Math.round(pct);
        }
      }

      await saveClusterStateToCloud(cluster);

      return res.status(200).json({
        success: true,
        message: `${slot.label} configuration saved.`,
        server: {
          id: slot.id,
          label: slot.label,
          supabaseUrl: slot.supabaseUrl,
          hasKey: Boolean(slot.supabaseKey),
          keyPreview: maskKeyPreview(slot.supabaseKey),
          status: slot.status,
          billingResetDay: slot.billingResetDay,
          ...computeSlotEgressMetrics(slot)
        }
      });
    }

    // 3. POST /api/supabase-failover/calibrate
    if (action === 'calibrate' && req.method === 'POST') {
      const serverId = body.serverId;
      if (serverId !== 'server1' && serverId !== 'server2') {
        return res.status(400).json({ success: false, message: 'Invalid serverId.' });
      }

      const cluster = await loadClusterStateFromCloud(true);
      const slot = cluster.servers[serverId as ServerSlotId];
      ensureBillingCycleCurrent(slot);

      if (body.billingResetDay !== undefined) {
        const day = Math.floor(Number(body.billingResetDay));
        if (Number.isFinite(day) && day >= 1 && day <= 28) {
          slot.billingResetDay = day;
          slot.cycleMonthKey = getBillingCycleKey(day);
        }
      }

      if (body.reset === true) {
        slot.trackedBytesThisCycle = 0;
        slot.calibrationOffsetBytes = 0;
      } else if (body.currentGb !== undefined) {
        const targetGb = Number(body.currentGb);
        if (!Number.isFinite(targetGb) || targetGb < 0 || targetGb > 500) {
          return res.status(400).json({ success: false, message: 'Please enter a valid GB value (0 or higher).' });
        }
        const targetBytes = Math.round(targetGb * BYTES_PER_GB);
        slot.calibrationOffsetBytes = targetBytes - (Number(slot.trackedBytesThisCycle) || 0);
      }

      await saveClusterStateToCloud(cluster);
      return res.status(200).json({
        success: true,
        serverId,
        metrics: computeSlotEgressMetrics(slot),
        billingResetDay: slot.billingResetDay
      });
    }

    // 4. POST /api/supabase-failover/test
    if (action === 'test' && req.method === 'POST') {
      const serverId = body.serverId;
      if (serverId !== 'server1' && serverId !== 'server2') {
        return res.status(400).json({ success: false, message: 'Invalid serverId.' });
      }

      const cluster = await loadClusterStateFromCloud(true);
      const slot = cluster.servers[serverId as ServerSlotId];
      const testUrl =
        typeof body.supabaseUrl === 'string' && body.supabaseUrl.trim()
          ? sanitizeSupabaseUrl(body.supabaseUrl)
          : slot.supabaseUrl;
      const testKey =
        typeof body.supabaseKey === 'string' && body.supabaseKey.trim()
          ? body.supabaseKey.trim()
          : slot.supabaseKey;

      if (!testUrl || !testKey) {
        return res.status(400).json({
          success: false,
          message: `Please enter both a valid HTTPS URL and Anon Key for ${slot.label}.`
        });
      }

      const tempClient = createClient(testUrl, testKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const requiredTables = MIGRATION_TABLES.filter((t) => t.required);
      const results = await Promise.all(
        requiredTables.map(async (def) => {
          const { count, error } = await tempClient
            .from(def.table)
            .select('*', { count: 'exact', head: true });
          return {
            table: def.table,
            ok: !error,
            count: count ?? 0,
            error: error?.message || null
          };
        })
      );

      const readyTables = results.filter((r) => r.ok);
      const missingTables = results.filter((r) => !r.ok);

      return res.status(200).json({
        success: readyTables.length > 0,
        readyCount: readyTables.length,
        totalRequired: requiredTables.length,
        missingTables: missingTables.map((m) => ({ table: m.table, error: m.error })),
        message:
          missingTables.length === 0
            ? `Connected to ${slot.label}! All ${readyTables.length}/${requiredTables.length} tables verified and ready.`
            : readyTables.length > 0
              ? `Connected to ${slot.label} (${readyTables.length}/${requiredTables.length} tables ready). Missing: ${missingTables.map((m) => m.table).join(', ')}.`
              : `Connection or permission check failed on ${slot.label}: ${missingTables[0]?.error || 'Check URL, Key, and SQL permissions.'}`
      });
    }

    // 5. POST /api/supabase-failover/toggle-state (100% Manual Active / Pause)
    if (action === 'toggle-state' && req.method === 'POST') {
      const serverId = body.serverId;
      const toggleAction = body.action;
      if (
        (serverId !== 'server1' && serverId !== 'server2') ||
        (toggleAction !== 'activate' && toggleAction !== 'pause')
      ) {
        return res.status(400).json({ success: false, message: 'Invalid serverId or action.' });
      }

      const cluster = await loadClusterStateFromCloud(true);
      const slot = cluster.servers[serverId as ServerSlotId];
      const otherId: ServerSlotId = serverId === 'server1' ? 'server2' : 'server1';
      const otherSlot = cluster.servers[otherId];
      const nowIso = new Date().toISOString();

      if (toggleAction === 'activate') {
        if (!slot.supabaseUrl || !slot.supabaseKey) {
          return res.status(400).json({
            success: false,
            message: `Cannot activate ${slot.label} — save its Supabase Project URL and Anon Key first.`
          });
        }
        slot.status = 'active';
        slot.activatedAt = nowIso;
        slot.pausedAt = null;
        otherSlot.status = 'paused';
        otherSlot.pausedAt = nowIso;
        cluster.activeServerId = serverId;
        cluster.clusterRevision = (Number(cluster.clusterRevision) || 1) + 1;
        await saveClusterStateToCloud(cluster);

        return res.status(200).json({
          success: true,
          action: 'activate',
          activeServerId: serverId,
          activeServerLabel: slot.label,
          activeServerPaused: false,
          clusterRevision: cluster.clusterRevision,
          activeConfig: {
            supabaseUrl: slot.supabaseUrl,
            supabaseKey: slot.supabaseKey
          },
          message: `${slot.label} is now ACTIVE. ${otherSlot.label} is HARD PAUSED (zero traffic in/out).`
        });
      } else {
        slot.status = 'paused';
        slot.pausedAt = nowIso;
        if (cluster.activeServerId === serverId) {
          cluster.activeServerId = null;
        }
        cluster.clusterRevision = (Number(cluster.clusterRevision) || 1) + 1;
        await saveClusterStateToCloud(cluster);

        return res.status(200).json({
          success: true,
          action: 'pause',
          activeServerId: cluster.activeServerId,
          activeServerLabel: null,
          activeServerPaused: !getActiveClusterServer(cluster),
          clusterRevision: cluster.clusterRevision,
          activeConfig: null,
          message: `${slot.label} is now HARD PAUSED. Zero data will go in or come out from ${slot.label}.`
        });
      }
    }

    // 6. POST /api/supabase-failover/migrate-table (Chunked 12-table migration — NEVER auto-switches)
    if (action === 'migrate-table' && req.method === 'POST') {
      const phase = String(body.phase || '').trim();
      const sourceServerId = body.sourceServerId as ServerSlotId;
      const targetServerId = body.targetServerId as ServerSlotId;

      if (
        (sourceServerId !== 'server1' && sourceServerId !== 'server2') ||
        (targetServerId !== 'server1' && targetServerId !== 'server2') ||
        sourceServerId === targetServerId
      ) {
        return res.status(400).json({
          success: false,
          message: 'Source and target servers must be distinct (server1 <-> server2).'
        });
      }

      const cluster = await loadClusterStateFromCloud(true);
      const sourceSlot = cluster.servers[sourceServerId];
      const targetSlot = cluster.servers[targetServerId];

      if (!sourceSlot.supabaseUrl || !sourceSlot.supabaseKey) {
        return res.status(400).json({ success: false, message: `${sourceSlot.label} credentials are not configured.` });
      }
      if (!targetSlot.supabaseUrl || !targetSlot.supabaseKey) {
        return res.status(400).json({
          success: false,
          message: `${targetSlot.label} credentials are not configured yet. Save its URL and Key first.`
        });
      }

      if (phase === 'preflight') {
        const targetClient = createClient(targetSlot.supabaseUrl, targetSlot.supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });

        const checks = await Promise.all(
          MIGRATION_TABLES.map(async (def) => {
            const { error } = await targetClient
              .from(def.table)
              .select('*', { count: 'exact', head: true })
              .limit(1);
            if (!error) {
              return { table: def.table, label: def.label, required: def.required, ok: true, skipped: false, error: null };
            }
            const isMissing =
              error.code === 'PGRST205' ||
              error.code === '42P01' ||
              error.message?.includes('does not exist') ||
              error.message?.includes('schema cache');
            const isPerm = isSupabasePermissionDeniedError(error);
            if (!def.required) {
              return { table: def.table, label: def.label, required: false, ok: true, skipped: true, error: null };
            }
            return {
              table: def.table,
              label: def.label,
              required: true,
              ok: false,
              skipped: false,
              error: isPerm ? 'Permission denied (run GRANT SQL)' : isMissing ? 'Table missing on target server' : error.message
            };
          })
        );

        const missingRequired = checks.filter((c) => !c.ok);
        return res.status(200).json({
          success: missingRequired.length === 0,
          checks,
          message:
            missingRequired.length === 0
              ? `Pre-flight passed on ${targetSlot.label}. Starting table copy...`
              : `Target server is missing or denying access to: ${missingRequired.map((m) => m.table).join(', ')}. Copy & run the 12-Table Setup SQL in ${targetSlot.label}'s SQL Editor first.`
        });
      }

      if (phase === 'copy') {
        const tableName = String(body.table || '').trim();
        const def = MIGRATION_TABLES.find((t) => t.table === tableName);
        if (!def) {
          return res.status(400).json({ success: false, message: `Unsupported migration table: ${tableName}` });
        }

        const offset = Math.max(0, Math.floor(Number(body.offset) || 0));
        const limit = Math.max(50, Math.min(500, Math.floor(Number(body.limit) || 400)));

        const sourceClient = createClient(sourceSlot.supabaseUrl, sourceSlot.supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
        const targetClient = createClient(targetSlot.supabaseUrl, targetSlot.supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });

        let totalRows: number | null = null;
        if (offset === 0) {
          const cnt = await sourceClient.from(def.table).select('*', { count: 'exact', head: true });
          if (cnt.error) {
            const isMissing =
              cnt.error.code === 'PGRST205' ||
              cnt.error.code === '42P01' ||
              cnt.error.message?.includes('does not exist');
            if (!def.required || isMissing) {
              return res.status(200).json({
                success: true,
                table: def.table,
                skipped: true,
                copiedInSlice: 0,
                nextOffset: 0,
                totalRows: 0,
                hasMore: false
              });
            }
          }
          totalRows = cnt.count ?? null;
        }

        const { data, error } = await sourceClient
          .from(def.table)
          .select('*')
          .range(offset, offset + limit - 1);

        if (error) {
          const isMissing =
            error.code === 'PGRST205' ||
            error.code === '42P01' ||
            error.message?.includes('does not exist');
          if (!def.required || isMissing) {
            return res.status(200).json({
              success: true,
              table: def.table,
              skipped: true,
              copiedInSlice: 0,
              nextOffset: offset,
              totalRows: 0,
              hasMore: false
            });
          }
          return res.status(500).json({
            success: false,
            table: def.table,
            message: `Read error on ${def.table}: ${error.message}`
          });
        }

        const rawBatch = Array.isArray(data) ? (data as any[]) : [];
        if (rawBatch.length === 0) {
          return res.status(200).json({
            success: true,
            table: def.table,
            skipped: false,
            copiedInSlice: 0,
            nextOffset: offset,
            totalRows: totalRows ?? offset,
            hasMore: false
          });
        }

        const batch =
          def.table === 'knitting_orders'
            ? rawBatch.map((r) => {
                if (r && r.raw_data && typeof r.raw_data === 'object' && 'items' in r.raw_data) {
                  const { items: _dup, ...slimMeta } = r.raw_data;
                  return { ...r, raw_data: slimMeta };
                }
                return r;
              })
            : rawBatch;

        try {
          await recordServerEgressBytesCloud(sourceSlot.id, estimateWireEgressBytes(rawBatch));
        } catch {}

        const UPSERT_CHUNK = 200;
        for (let i = 0; i < batch.length; i += UPSERT_CHUNK) {
          const chunk = batch.slice(i, i + UPSERT_CHUNK);
          let { error: upsertErr } = await targetClient
            .from(def.table)
            .upsert(chunk, { onConflict: def.conflictCol });

          if (upsertErr && def.table === 'activity_logs') {
            const cleanChunk = chunk.map(({ id: _omitId, ...rest }) => rest);
            const retry = await targetClient.from(def.table).insert(cleanChunk);
            upsertErr = retry.error;
          } else if (upsertErr && def.conflictCol !== 'id') {
            const retry = await targetClient.from(def.table).upsert(chunk);
            upsertErr = retry.error;
          }

          if (upsertErr) {
            return res.status(500).json({
              success: false,
              table: def.table,
              message: `Write error on ${def.table}: ${upsertErr.message}`
            });
          }
        }

        const hasMore = rawBatch.length >= limit;
        return res.status(200).json({
          success: true,
          table: def.table,
          skipped: false,
          copiedInSlice: batch.length,
          nextOffset: offset + batch.length,
          totalRows: totalRows ?? offset + batch.length,
          hasMore
        });
      }

      if (phase === 'finalize') {
        targetSlot.lastMigratedAt = new Date().toISOString();
        await saveClusterStateToCloud(cluster);
        return res.status(200).json({
          success: true,
          message: `Migration to ${targetSlot.label} completed. Active/Paused server states were NOT changed automatically — use Activate / Pause whenever you are ready.`
        });
      }

      return res.status(400).json({ success: false, message: 'Invalid migration phase.' });
    }

    return res.status(404).json({ success: false, message: `Unknown failover action: ${action}` });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Unexpected error in failover controller.'
    });
  }
}
