/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vercel Serverless Handler for Shared Supabase Table Cache, Versions & Raihan 80% Egress Alert.
 * Endpoint: /api/supabase-cache/:table (versions | settings | invalidate | <table>)
 */

import { createClient } from '@supabase/supabase-js';
import {
  CACHEABLE_TABLE_CONFIG,
  CacheableSupabaseTable,
  computeSlotEgressMetrics,
  estimateWireEgressBytes,
  getActiveClusterServer,
  isRaihanOperatorRequest,
  isSupabasePermissionDeniedError,
  isSupabaseQuotaError,
  loadClusterStateFromCloud,
  parseJsonBody,
  recordServerEgressBytesCloud,
  setNoStoreHeaders
} from '../_clusterStore';

const CACHEABLE_SET = new Set<string>(Object.keys(CACHEABLE_TABLE_CONFIG));
const WARM_TTL_MS = 10 * 60 * 1000; // 10 minutes warm lambda cache

interface WarmTableEntry {
  rows: any[];
  fetchedAt: number;
  version: number;
  maxUpdatedAt: string | null;
  clusterRevision: number;
}

const warmTableCache = new Map<CacheableSupabaseTable, WarmTableEntry>();
const tablesRequiringWildcard = new Set<CacheableSupabaseTable>();
let warmSettingsCache: { data: any; fetchedAt: number; version: number; clusterRevision: number } | null = null;
let lastKnownRevision = 0;

function resetWarmCachesIfRevisionChanged(rev: number) {
  if (lastKnownRevision !== rev) {
    warmTableCache.clear();
    tablesRequiringWildcard.clear();
    warmSettingsCache = null;
    lastKnownRevision = rev;
  }
}

function computeMaxUpdatedAt(rows: any[]): string | null {
  let maxIso: string | null = null;
  for (const r of rows) {
    const ts = r?.updated_at || r?.created_at;
    if (typeof ts === 'string' && ts.length >= 10) {
      if (!maxIso || ts > maxIso) maxIso = ts;
    }
  }
  return maxIso;
}

export default async function handler(req: any, res: any) {
  setNoStoreHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawTable = Array.isArray(req.query?.table) ? req.query.table[0] : req.query?.table;
  const fallbackFromUrl = typeof req.url === 'string'
    ? req.url.split('?')[0].split('/').filter(Boolean).pop()
    : '';
  const target = String(rawTable || fallbackFromUrl || '').trim();

  try {
    const cluster = await loadClusterStateFromCloud(false);
    resetWarmCachesIfRevisionChanged(cluster.clusterRevision);
    const activeSlot = getActiveClusterServer(cluster);

    // 1. GET /api/supabase-cache/versions
    if (target === 'versions' && req.method === 'GET') {
      const versions: Record<string, { version: number; fetchedAt: number; maxUpdatedAt: string | null; count: number }> = {};
      for (const tbl of CACHEABLE_SET) {
        const entry = warmTableCache.get(tbl as CacheableSupabaseTable);
        versions[tbl] = {
          version: entry?.version || 0,
          fetchedAt: entry?.fetchedAt || 0,
          maxUpdatedAt: entry?.maxUpdatedAt || null,
          count: entry?.rows?.length || 0
        };
      }

      // Strictly expose 80% egress warning payload ONLY to Superadmin (EKL001) / Raihan
      let raihanAlert: any = null;
      if (isRaihanOperatorRequest(req)) {
        const metrics = activeSlot ? computeSlotEgressMetrics(activeSlot) : null;
        raihanAlert = {
          showWarning: Boolean(metrics && metrics.isWarning),
          activeServerId: cluster.activeServerId,
          activeServerLabel: activeSlot?.label || 'All Servers Paused',
          usedGb: metrics?.usedGb ?? 0,
          limitGb: metrics?.limitGb ?? 5.0,
          pct: metrics?.pct ?? 0,
          isCritical: Boolean(metrics?.isCritical),
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
      const body = parseJsonBody(req);
      const tbl = String(body.table || '').trim();
      if (tbl === 'settings') {
        warmSettingsCache = null;
      } else if (CACHEABLE_SET.has(tbl)) {
        warmTableCache.delete(tbl as CacheableSupabaseTable);
      } else {
        warmTableCache.clear();
        warmSettingsCache = null;
      }
      return res.status(200).json({ success: true });
    }

    // 3. Hard Pause Lock: if active server is paused, return 0 bytes without touching Supabase
    if (!activeSlot) {
      return res.status(200).json({
        success: false,
        restricted: false,
        activeServerId: null,
        activeServerPaused: true,
        clusterRevision: cluster.clusterRevision,
        rows: [],
        settings: null
      });
    }

    // 4. GET /api/supabase-cache/settings
    if (target === 'settings' && req.method === 'GET') {
      const force = req.query?.force === '1' || req.query?.force === 'true';
      if (
        !force &&
        warmSettingsCache &&
        Date.now() - warmSettingsCache.fetchedAt < WARM_TTL_MS
      ) {
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
        await recordServerEgressBytesCloud(
          activeSlot.id,
          estimateWireEgressBytes(settingsData)
        );
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
        await recordServerEgressBytesCloud(
          activeSlot.id,
          estimateWireEgressBytes(allRows)
        );
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
      message: err?.message || 'Error serving cached table.'
    });
  }
}
